import { clearCbzTask } from './download/cbz-cache';
import { consumePendingCbzFilename } from './download/cbz-download';
import {
  onGalleryRecordChanged,
  requestCancelDownload,
  runDownloadJob,
} from './download/orchestrator';
import {
  configStorage,
  downloadIndexMapStorage,
  downloadListStorage,
  downloadOwnerStorage,
  downloadTaskStorage,
  galleryRecordsStorage,
} from './storage';
import { DEFAULT_CONFIG, EXTENSION_NAME, isObject } from './utils';
import { splitFilename } from './utils';

const textMime = 'text/plain';
const extensionId = chrome.runtime.id;

/** 仅跟踪本扩展发起的下载，避免监听全局 downloads 导致 storage 与内存暴涨 */
const trackedExtensionDownloadIds = new Set<number>();

let listenersRegistered = false;
let patchFlushTimer: ReturnType<typeof setTimeout> | null = null;
type DownloadPatch = Partial<chrome.downloads.DownloadItem> & { id: number };

const pendingDownloadPatches = new Map<number, DownloadPatch>();

const isOurExtensionDownload = (item: { byExtensionId?: string }) =>
  item.byExtensionId === extensionId;

const rebuildTrackedIdsFromIndexMap = (map: Record<string, unknown> | null | undefined) => {
  trackedExtensionDownloadIds.clear();
  if (!map) return;
  for (const id of Object.keys(map)) {
    trackedExtensionDownloadIds.add(Number(id));
  }
};

const syncDownloadList = async () => {
  if (trackedExtensionDownloadIds.size === 0) {
    await downloadListStorage.set([]);
    return;
  }
  const results = await Promise.all(
    [...trackedExtensionDownloadIds].map((id) => chrome.downloads.search({ id }))
  );
  await downloadListStorage.set(results.flat());
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
    return next.filter((item) => trackedExtensionDownloadIds.has(item.id));
  });
};

const scheduleDownloadPatch = (patch: DownloadPatch) => {
  if (!trackedExtensionDownloadIds.has(patch.id)) return;

  const existing = pendingDownloadPatches.get(patch.id);
  pendingDownloadPatches.set(patch.id, existing ? { ...existing, ...patch } : patch);

  if (patchFlushTimer !== null) return;
  patchFlushTimer = setTimeout(() => {
    patchFlushTimer = null;
    void flushPendingDownloadPatches();
  }, 80);
};

const patchDownloadListNow = async (downloadItem: chrome.downloads.DownloadItem) => {
  if (!trackedExtensionDownloadIds.has(downloadItem.id)) return;

  trackedExtensionDownloadIds.add(downloadItem.id);
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

const MAX_OWNER_ENTRIES = 5000;

const trimOwnerMap = (map: Record<string, unknown>): Record<string, unknown> => {
  const keys = Object.keys(map);
  if (keys.length <= MAX_OWNER_ENTRIES) return map;
  // chrome download ids are monotonically increasing → keep the newest IDs
  const sorted = keys.map(Number).sort((a, b) => a - b);
  const toDrop = sorted.slice(0, keys.length - MAX_OWNER_ENTRIES);
  const next = { ...map };
  for (const id of toDrop) delete next[String(id)];
  return next;
};

const getFormatOverrideExtension = (): string | null => {
  const fmt = currentConfig.imageFormat;
  if (!fmt || fmt === 'original') return null;
  return fmt;
};

const propagateImagePatchToGallery = async (
  chromeDownloadId: number,
  patch: {
    state?: chrome.downloads.DownloadItem['state'];
    filename?: string;
    error?: string;
    bytesReceived?: number;
    totalBytes?: number;
  }
) => {
  const ownerMap = downloadOwnerStorage.getSnapshot() || (await downloadOwnerStorage.get());
  const owner = ownerMap?.[String(chromeDownloadId)];
  if (!owner) return;
  await galleryRecordsStorage.patchImageByDownloadId(
    chromeDownloadId,
    owner.galleryUrl,
    owner.index,
    patch
  );
};

const registerListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  chrome.downloads.onCreated.addListener((downloadItem) => {
    if (!isOurExtensionDownload(downloadItem)) return;
    if (downloadItem.mime === textMime) return;

    trackedExtensionDownloadIds.add(downloadItem.id);
    patchDownloadListNow(downloadItem);
    propagateImagePatchToGallery(downloadItem.id, {
      state: downloadItem.state,
      filename: downloadItem.filename,
    }).then(() => {
      const ownerMap = downloadOwnerStorage.getSnapshot();
      const owner = ownerMap?.[String(downloadItem.id)];
      if (owner?.galleryUrl) onGalleryRecordChanged(owner.galleryUrl);
    });
  });

  chrome.downloads.onChanged.addListener((downloadDelta) => {
    const { id } = downloadDelta;
    if (!trackedExtensionDownloadIds.has(id)) return;

    const next: DownloadPatch = { id };
    for (const key in downloadDelta) {
      if (key === 'id') continue;
      if (isObject(downloadDelta[key])) {
        (next as Record<string, unknown>)[key] = downloadDelta[key].current;
      }
    }
    scheduleDownloadPatch(next);

    const galleryPatch: {
      state?: chrome.downloads.DownloadItem['state'];
      filename?: string;
      error?: string;
      totalBytes?: number;
    } = {};
    if (downloadDelta.state) {
      galleryPatch.state = downloadDelta.state.current as chrome.downloads.DownloadItem['state'];
    }
    if (downloadDelta.filename) galleryPatch.filename = downloadDelta.filename.current;
    if (downloadDelta.error) galleryPatch.error = downloadDelta.error.current;
    if (downloadDelta.totalBytes) galleryPatch.totalBytes = downloadDelta.totalBytes.current;
    if (Object.keys(galleryPatch).length > 0) {
      propagateImagePatchToGallery(id, galleryPatch).then(() => {
        const ownerMap = downloadOwnerStorage.getSnapshot();
        const owner = ownerMap?.[String(id)];
        if (owner?.galleryUrl) onGalleryRecordChanged(owner.galleryUrl);
      });
    }
  });

  chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    if (downloadItem.byExtensionName !== EXTENSION_NAME) return;

    const cbzPath = consumePendingCbzFilename();
    if (cbzPath) {
      suggest({
        filename: cbzPath,
        conflictAction: currentConfig.filenameConflictAction,
      });
      return;
    }

    const indexMap = downloadIndexMapStorage.getSnapshot() ?? {};
    const { fileNameRule, filenameConflictAction: conflictAction } = currentConfig;
    const entry = indexMap[String(downloadItem.id)];
    const downloadPath =
      entry?.downloadPath ||
      currentDownloadContext?.downloadPath ||
      currentConfig.intermediateDownloadPath;

    let { filename } = downloadItem;
    const [name, originalFileType] = splitFilename(filename);
    if (downloadItem.mime === textMime) {
      filename = `${downloadPath}/info.txt`;
    } else {
      const overrideExt = getFormatOverrideExtension();
      const fileType = overrideExt || originalFileType || 'jpg';
      filename = `${downloadPath}/${fileNameRule
        .replace('[index]', String(entry?.index ?? ''))
        .replace('[name]', name)
        .replace(
          '[total]',
          String(entry?.total ?? currentDownloadContext?.total ?? '')
        )}.${fileType}`;
    }

    suggest({
      filename,
      conflictAction,
    });
  });

  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.type === 'register-download-index') {
      trackedExtensionDownloadIds.add(message.id);
      void downloadIndexMapStorage.set((map) => ({
        ...(map || {}),
        [String(message.id)]: {
          index: message.index,
          total: message.total,
          downloadPath: message.downloadPath,
          galleryUrl: message.galleryUrl,
          sourceUrl: message.sourceUrl,
          taskId: message.taskId,
        },
      }));

      if (message.galleryUrl) {
        downloadOwnerStorage.set(
          (map) =>
            trimOwnerMap({
              ...(map || {}),
              [String(message.id)]: {
                galleryUrl: message.galleryUrl,
                index: message.index,
              },
            }) as Record<string, { galleryUrl: string; index: number }>
        );
        galleryRecordsStorage
          .upsertImage(message.galleryUrl, {
            index: message.index,
            sourceUrl: message.sourceUrl ?? '',
            state: 'in_progress',
            chromeDownloadId: message.id,
            updatedAt: Date.now(),
          })
          .then(() => onGalleryRecordChanged(message.galleryUrl));
      }

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
        await galleryRecordsStorage.upsertGallery({
          galleryUrl: payload.galleryFrontPageUrl,
          galleryName: payload.galleryName,
          galleryId: payload.galleryId,
          downloadPath: payload.downloadPath,
          total: payload.totalImages,
        });
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
      void (async () => {
        const prev = await downloadTaskStorage.get();
        if (prev?.taskId) await clearCbzTask(prev.taskId);
        await downloadTaskStorage.set((task) =>
          task ? { ...task, status: 'cancelled', updatedAt: Date.now() } : task
        );
      })();
      sendResponse({ ok: true });
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

    if (message.type === 'clear-download-index-map') {
      void downloadIndexMapStorage.set({});
      currentDownloadContext = null;
      trackedExtensionDownloadIds.clear();
      clearPendingPatches();
      void downloadListStorage.set([]);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
};

(async () => {
  currentConfig = await configStorage.get();
  const indexMap = await downloadIndexMapStorage.get();
  rebuildTrackedIdsFromIndexMap(indexMap);
  await downloadListStorage.get().catch(() => []);
  await downloadOwnerStorage.get().catch(() => ({}));
  await galleryRecordsStorage.get().catch(() => ({}));
  await downloadTaskStorage.get().catch(() => null);
  await syncDownloadList().catch(() => undefined);

  configStorage.subscribe(() => {
    void configStorage.get().then((config) => {
      currentConfig = config;
    });
  });
  registerListeners();
})();
