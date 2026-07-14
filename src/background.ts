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
  reconcileActiveTask,
  registerChromeDownload,
  settleChromeDownload,
} from './download/state-store';
import {
  configStorage,
  downloadIndexMapStorage,
  downloadTaskStorage,
  galleryRecordsStorage,
} from './storage';
import { DEFAULT_CONFIG, EXTENSION_NAME } from './utils';
import { splitFilename } from './utils';

const textMime = 'text/plain';
const extensionId = chrome.runtime.id;

/** 仅跟踪本扩展发起的下载，避免监听全局 downloads */

let listenersRegistered = false;

const isOurExtensionDownload = (item: { byExtensionId?: string }) =>
  item.byExtensionId === extensionId;

const rebuildTrackedIdsFromIndexMap = (
  map: Record<string, { taskId?: string } | unknown> | null | undefined,
  activeTaskId?: string
) => {
  clearTrackedDownloads();
  // 无活动任务时不预热历史 id；新下载会在 onCreated/register 时加入
  if (!map || !activeTaskId) return;
  for (const [id, entry] of Object.entries(map)) {
    const taskId =
      entry && typeof entry === 'object' && 'taskId' in entry
        ? (entry as { taskId?: string }).taskId
        : undefined;
    if (taskId !== activeTaskId) continue;
    trackedDownloadIds.add(Number(id));
  }
};

const isTrackedDownload = (id: number) =>
  trackedDownloadIds.has(id) || Boolean(downloadIndexMapStorage.getSnapshot()?.[String(id)]);

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
        if (!registered) return;
        void consumePendingDownloadFilename(downloadItem.url, downloadItem.finalUrl);
        void ensureSettledIfAlreadyDone(downloadItem.id).then((settled) => {
          if (settled) releaseChromeDownloadSlot(downloadItem.id);
        });
      });
    });
  });

  chrome.downloads.onChanged.addListener((downloadDelta) => {
    const { id } = downloadDelta;
    if (!downloadDelta.state) return;

    const nextState = downloadDelta.state.current;
    if (nextState !== 'complete' && nextState !== 'interrupted') return;

    releaseChromeDownloadSlot(id);
    if (!isTrackedDownload(id)) return;

    // 终态一次 settle：filename/error 随事件带入，不再单独 patch 进度字段
    void settleChromeDownload(
      id,
      nextState,
      downloadDelta.error?.current,
      downloadDelta.filename?.current
    );
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

    // 内存 miss（SW 刚唤醒）：异步读 session hint；再退到 indexMap / 当前任务上下文
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

        const entry = indexMap[String(downloadItem.id)];
        if (!entry && downloadItem.mime !== textMime) {
          suggest();
          return;
        }

        const downloadPath =
          entry?.downloadPath ||
          currentDownloadContext?.downloadPath ||
          currentConfig.intermediateDownloadPath;

        let filename: string;
        if (downloadItem.mime === textMime) {
          filename = `${normalizeDownloadDir(downloadPath)}info.txt`;
        } else {
          const overrideExt = getFormatOverrideExtension();
          const fileType = extensionFromDownloadItem(downloadItem, overrideExt);
          let name = splitFilename(downloadItem.filename ?? '')[0] || 'image';
          if (entry?.sourceUrl) {
            try {
              const base = new URL(entry.sourceUrl).pathname.split('/').pop() ?? 'image';
              name = splitFilename(base)[0] || 'image';
            } catch {
              /* keep fallback name */
            }
          }
          filename = `${normalizeDownloadDir(downloadPath)}${fileNameRule
            .replace('[index]', String(entry?.index ?? ''))
            .replace('[name]', name)
            .replace(
              '[total]',
              String(entry?.total ?? currentDownloadContext?.total ?? '')
            )}.${fileType}`;
        }

        suggest({
          filename: filename.replace(/\\/g, '/').replace(/^\/+/, '') || 'download.bin',
          conflictAction,
        });
      }
    );
    return true;
  });

  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
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

    if (message.type === 'reconcile-gallery') {
      void reconcileActiveTask(message.galleryUrl).then(() => {
        sendResponse({ ok: true });
      });
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
  const activeTask = await downloadTaskStorage.get().catch(() => null);
  const indexMap = await downloadIndexMapStorage.get();
  // 仅预热未结束任务的 id；冷启动只做 id settle
  const trackTaskId =
    activeTask &&
    activeTask.status !== 'completed' &&
    activeTask.status !== 'partial_success' &&
    activeTask.status !== 'failed' &&
    activeTask.status !== 'cancelled'
      ? activeTask.taskId
      : undefined;
  rebuildTrackedIdsFromIndexMap(indexMap, trackTaskId);
  await galleryRecordsStorage.get().catch(() => ({}));
  await reconcileActiveTask().catch(() => undefined);

  configStorage.subscribe(() => {
    void configStorage.get().then((config) => {
      currentConfig = config;
    });
  });
})();
