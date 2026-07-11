import { consumePendingCbzFilename } from './download/cbz-download';
import {
  buildStorageRelativeFilename,
  consumePendingDownloadFilename,
  extensionFromDownloadItem,
  hydratePendingDownloadHintsFromSession,
  normalizeDownloadDir,
  peekPendingDownloadFilename,
  peekPendingDownloadFilenameSync,
} from './download/download-filename';
import { clearTrackedDownloads, trackedDownloadIds } from './download/download-registry';
import {
  releaseChromeDownloadSlot,
  requestCancelDownload,
  runDownloadJob,
} from './download/orchestrator';
import {
  clearActiveTask,
  ensureSettledIfAlreadyDone,
  patchChromeDownloadMetadata,
  reconcileActiveTask,
  registerChromeDownload,
  settleChromeDownload,
} from './download/state-store';
import {
  configStorage,
  downloadIndexMapStorage,
  downloadListStorage,
  galleryRecordsStorage,
} from './storage';
import { DEFAULT_CONFIG, EXTENSION_NAME, isObject } from './utils';
import { splitFilename } from './utils';

const textMime = 'text/plain';
const extensionId = chrome.runtime.id;

/** 仅跟踪本扩展发起的下载，避免监听全局 downloads 导致 storage 与内存暴涨 */

let listenersRegistered = false;
let patchFlushTimer: ReturnType<typeof setTimeout> | null = null;
type DownloadPatch = Partial<chrome.downloads.DownloadItem> & { id: number };
type GalleryDownloadPatch = {
  filename?: string;
  error?: string;
  totalBytes?: number;
};

const pendingDownloadPatches = new Map<number, DownloadPatch>();

const isOurExtensionDownload = (item: { byExtensionId?: string }) =>
  item.byExtensionId === extensionId;

const rebuildTrackedIdsFromIndexMap = (map: Record<string, unknown> | null | undefined) => {
  clearTrackedDownloads();
  if (!map) return;
  for (const id of Object.keys(map)) {
    trackedDownloadIds.add(Number(id));
  }
};

const backfillGalleryRecordsFromDownloads = async (items: chrome.downloads.DownloadItem[]) => {
  await Promise.all(
    items.map(async (item) => {
      if (item.state === 'complete' || item.state === 'interrupted') {
        await settleChromeDownload(item.id, item.state, item.error);
        return;
      }

      await patchChromeDownloadMetadata(item.id, {
        filename: item.filename,
        error: item.error,
        totalBytes: item.totalBytes,
      });
    })
  );
};

const syncDownloadList = async () => {
  if (trackedDownloadIds.size === 0) {
    await downloadListStorage.set([]);
    return;
  }
  const results = await Promise.all(
    [...trackedDownloadIds].map((id) => chrome.downloads.search({ id }))
  );
  const items = results.flat();
  await downloadListStorage.set(items);
  await backfillGalleryRecordsFromDownloads(items);
};

const flushPendingDownloadPatches = async () => {
  if (pendingDownloadPatches.size === 0) return;
  const patches = [...pendingDownloadPatches.values()];
  pendingDownloadPatches.clear();

  await downloadListStorage.set((list) => {
    const next = [...(Array.isArray(list) ? list : [])];
    for (const patch of patches) {
      const index = next.findIndex((item) => item.id === patch.id);
      if (index === -1) {
        next.push(patch as chrome.downloads.DownloadItem);
      } else {
        next[index] = { ...next[index], ...patch };
      }
    }
    return next.filter((item) => trackedDownloadIds.has(item.id));
  });
};

const scheduleDownloadPatch = (patch: DownloadPatch) => {
  if (!trackedDownloadIds.has(patch.id)) return;

  const existing = pendingDownloadPatches.get(patch.id);
  pendingDownloadPatches.set(patch.id, existing ? { ...existing, ...patch } : patch);

  if (patchFlushTimer !== null) return;
  patchFlushTimer = setTimeout(() => {
    patchFlushTimer = null;
    void flushPendingDownloadPatches();
  }, 80);
};

const patchDownloadListNow = async (downloadItem: chrome.downloads.DownloadItem) => {
  if (!trackedDownloadIds.has(downloadItem.id)) return;

  trackedDownloadIds.add(downloadItem.id);
  await downloadListStorage.set((list) => {
    const next = [...(Array.isArray(list) ? list : [])];
    const index = next.findIndex((item) => item.id === downloadItem.id);
    if (index === -1) {
      next.push(downloadItem);
      return next;
    }
    next[index] = { ...next[index], ...downloadItem };
    return next;
  });
};

const clearPendingPatches = () => {
  pendingDownloadPatches.clear();
  if (patchFlushTimer !== null) {
    clearTimeout(patchFlushTimer);
    patchFlushTimer = null;
  }
};

let currentConfig = DEFAULT_CONFIG;
let currentDownloadContext: {
  downloadPath: string;
  total: number;
  galleryUrl?: string;
  galleryName?: string;
  galleryId?: string;
} | null = null;

const getFormatOverrideExtension = (): string | null => {
  const fmt = currentConfig.imageFormat;
  if (!fmt || fmt === 'original') return null;
  return fmt;
};

const registerListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  chrome.downloads.onCreated.addListener((downloadItem) => {
    if (!isOurExtensionDownload(downloadItem)) return;
    if (downloadItem.mime === textMime) return;

    trackedDownloadIds.add(downloadItem.id);
    patchDownloadListNow(downloadItem);

    // 兜底：chrome.downloads.download 的 callback 在 service worker 休眠时可能丢失。
    // onCreated 用 pending intent 补注册 chrome id，注册成功后再消费 intent。
    void peekPendingDownloadFilename(downloadItem.url, downloadItem.finalUrl).then((hint) => {
      if (!hint?.galleryUrl || typeof hint.index !== 'number') return;
      void registerChromeDownload({
        id: downloadItem.id,
        index: hint.index,
        total: hint.total,
        downloadPath: hint.downloadPath,
        galleryUrl: hint.galleryUrl,
        sourceUrl: hint.sourceUrl,
        taskId: hint.taskId ?? null,
        filename: hint.filename,
      }).then((registered) => {
        if (registered) {
          void consumePendingDownloadFilename(downloadItem.url, downloadItem.finalUrl);
          void ensureSettledIfAlreadyDone(downloadItem.id).then((settled) => {
            if (settled) releaseChromeDownloadSlot(downloadItem.id);
          });
        }
        void patchChromeDownloadMetadata(downloadItem.id, {
          filename: downloadItem.filename,
          totalBytes: downloadItem.totalBytes,
        });
      });
    });
  });

  chrome.downloads.onChanged.addListener((downloadDelta) => {
    const { id } = downloadDelta;

    // 下载进入终态时，释放并发槽，并把终态交给 state-store 幂等提交。
    // settle 已带上同事件的 filename/error 时，下面不再重复 patch，避免双写闪烁。
    let settledTerminal = false;
    if (downloadDelta.state) {
      const nextState = downloadDelta.state.current;
      if (nextState === 'complete' || nextState === 'interrupted') {
        settledTerminal = true;
        releaseChromeDownloadSlot(id);
        void settleChromeDownload(
          id,
          nextState,
          downloadDelta.error?.current,
          downloadDelta.filename?.current
        );
      }
    }

    // 非 state 字段（filename / 进度等）回写 gallery record
    const galleryPatch: GalleryDownloadPatch = {};
    if (!settledTerminal && downloadDelta.filename) {
      galleryPatch.filename = downloadDelta.filename.current;
    }
    if (!settledTerminal && downloadDelta.error) {
      galleryPatch.error = downloadDelta.error.current;
    }
    if (downloadDelta.totalBytes) galleryPatch.totalBytes = downloadDelta.totalBytes.current;
    if (Object.keys(galleryPatch).length > 0) {
      void patchChromeDownloadMetadata(id, galleryPatch);
    }

    if (!trackedDownloadIds.has(id)) return;

    const next: DownloadPatch = { id };
    for (const key in downloadDelta) {
      if (key === 'id') continue;
      if (isObject(downloadDelta[key])) {
        (next as Record<string, unknown>)[key] = downloadDelta[key].current;
      }
    }
    scheduleDownloadPatch(next);
  });

  chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    const isOurDownload =
      downloadItem.byExtensionId === extensionId || downloadItem.byExtensionName === EXTENSION_NAME;
    if (!isOurDownload) return;

    const cbzPath = consumePendingCbzFilename();
    if (cbzPath) {
      suggest({
        filename: cbzPath.replace(/\\/g, '/'),
        conflictAction: currentConfig.filenameConflictAction,
      });
      return;
    }

    const indexMap = downloadIndexMapStorage.getSnapshot() ?? {};
    const { fileNameRule, filenameConflictAction: conflictAction } = currentConfig;
    const pending = peekPendingDownloadFilenameSync(downloadItem.url, downloadItem.finalUrl);
    if (pending) {
      suggest({
        filename: pending.filename ?? buildStorageRelativeFilename({ fileNameRule }, pending),
        conflictAction,
      });
      return;
    }

    const suggestFromEntryOrDefault = () => {
      const entry = indexMap[String(downloadItem.id)];
      if (!entry && downloadItem.mime !== textMime) {
        suggest();
        return;
      }

      const downloadPath =
        entry?.downloadPath ||
        currentDownloadContext?.downloadPath ||
        currentConfig.intermediateDownloadPath;

      let { filename } = downloadItem;
      if (downloadItem.mime === textMime) {
        filename = `${normalizeDownloadDir(downloadPath)}info.txt`;
      } else {
        const overrideExt = getFormatOverrideExtension();
        const fileType = extensionFromDownloadItem(downloadItem, overrideExt);
        const name =
          entry?.sourceUrl != null
            ? (() => {
                try {
                  const base = new URL(entry.sourceUrl).pathname.split('/').pop() ?? 'image';
                  return splitFilename(base)[0] || 'image';
                } catch {
                  return 'image';
                }
              })()
            : splitFilename(downloadItem.filename ?? '')[0] || 'image';

        filename = `${normalizeDownloadDir(downloadPath)}${fileNameRule
          .replace('[index]', String(entry?.index ?? ''))
          .replace('[name]', name)
          .replace(
            '[total]',
            String(entry?.total ?? currentDownloadContext?.total ?? '')
          )}.${fileType}`;
      }

      const normalized = filename.replace(/\\/g, '/').replace(/^\/+/, '') || 'download.bin';

      suggest({
        filename: normalized,
        conflictAction,
      });
    };

    // 内存 miss（SW 刚唤醒）：异步读 session hint，再 suggest
    void peekPendingDownloadFilename(downloadItem.url, downloadItem.finalUrl).then(
      (asyncPending) => {
        if (asyncPending) {
          suggest({
            filename:
              asyncPending.filename ?? buildStorageRelativeFilename({ fileNameRule }, asyncPending),
            conflictAction,
          });
          return;
        }
        suggestFromEntryOrDefault();
      }
    );
    return true;
  });

  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.type === 'register-download-index') {
      void registerChromeDownload({
        id: message.id,
        index: message.index,
        total: message.total,
        downloadPath: message.downloadPath,
        galleryUrl: message.galleryUrl,
        sourceUrl: message.sourceUrl,
        taskId: message.taskId ?? null,
      });

      sendResponse({ ok: true });
      return true;
    }

    const handleDownloadJob = (
      payload: {
        galleryFrontPageUrl: string;
        galleryName: string;
        galleryId: string;
        downloadPath: string;
        rangeStart: number;
        rangeEnd: number;
        imagesPerPage: number;
        numPages: number;
        totalImages: number;
        indices?: number[];
        taskId?: string;
      },
      mode: 'full' | 'resume' | 'retry'
    ) => {
      void (async () => {
        currentDownloadContext = {
          downloadPath: payload.downloadPath,
          total: payload.totalImages,
          galleryUrl: payload.galleryFrontPageUrl,
          galleryName: payload.galleryName,
          galleryId: payload.galleryId,
        };
        void runDownloadJob({ ...payload, mode });
      })();
    };

    if (message.type === 'start-download') {
      handleDownloadJob(message.payload, message.mode ?? 'full');
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'resume-download') {
      handleDownloadJob(message.payload, 'resume');
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'retry-failed') {
      handleDownloadJob(message.payload, 'retry');
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'cancel-download') {
      requestCancelDownload();
      void clearActiveTask().then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === 'clear-download-task') {
      void clearActiveTask().then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === 'set-download-context') {
      currentDownloadContext = {
        downloadPath: message.downloadPath,
        total: message.total,
        galleryUrl: message.galleryUrl,
        galleryName: message.galleryName,
        galleryId: message.galleryId,
      };
      if (message.galleryUrl) {
        void galleryRecordsStorage.upsertGallery({
          galleryUrl: message.galleryUrl,
          galleryName: message.galleryName ?? '',
          galleryId: message.galleryId ?? '',
          downloadPath: message.downloadPath,
          total: message.total,
        });
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'reconcile-gallery') {
      void reconcileActiveTask(message.galleryUrl).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === 'clear-download-index-map') {
      void downloadIndexMapStorage.set({});
      currentDownloadContext = null;
      clearTrackedDownloads();
      clearPendingPatches();
      void downloadListStorage.set([]);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
};

// 必须在 top-level 同步注册事件监听，确保 service worker 唤醒时能立即接收
// chrome.downloads.onChanged 等事件；放在 async IIFE 里会因 await 延迟注册而漏掉事件，
// 导致下载完成状态无法回写 gallery record。
registerListeners();

(async () => {
  currentConfig = await configStorage.get();
  await hydratePendingDownloadHintsFromSession().catch(() => undefined);
  const indexMap = await downloadIndexMapStorage.get();
  rebuildTrackedIdsFromIndexMap(indexMap);
  await downloadListStorage.get().catch(() => []);
  await galleryRecordsStorage.get().catch(() => ({}));
  await syncDownloadList().catch(() => undefined);
  await reconcileActiveTask().catch(() => undefined);

  configStorage.subscribe(() => {
    void configStorage.get().then((config) => {
      currentConfig = config;
    });
  });
})();
