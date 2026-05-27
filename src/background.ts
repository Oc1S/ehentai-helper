import { defaultConfig, EXTENSION_NAME, isObject } from './shared';
import { configStorage, downloadIndexMapStorage, downloadListStorage } from './storage';
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

let currentConfig = defaultConfig;
let currentDownloadContext: {
  downloadPath: string;
  total: number;
} | null = null;

const registerListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  chrome.downloads.onCreated.addListener((downloadItem) => {
    if (!isOurExtensionDownload(downloadItem)) return;
    if (downloadItem.mime === textMime) return;

    trackedExtensionDownloadIds.add(downloadItem.id);
    void patchDownloadListNow(downloadItem);
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
  });

  chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    if (downloadItem.byExtensionName !== EXTENSION_NAME) return;

    const indexMap = downloadIndexMapStorage.getSnapshot() ?? {};
    const { fileNameRule, filenameConflictAction: conflictAction } = currentConfig;
    const entry = indexMap[String(downloadItem.id)];
    const downloadPath =
      entry?.downloadPath ||
      currentDownloadContext?.downloadPath ||
      currentConfig.intermediateDownloadPath;

    let { filename } = downloadItem;
    const [name, fileType] = splitFilename(filename);
    if (downloadItem.mime === textMime) {
      filename = `${downloadPath}/info.txt`;
    } else {
      filename = `${downloadPath}/${fileNameRule
        .replace('[index]', String(entry?.index ?? ''))
        .replace('[name]', name)
        .replace('[total]', String(entry?.total ?? currentDownloadContext?.total ?? ''))}.${fileType}`;
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
        },
      }));
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'set-download-context') {
      currentDownloadContext = {
        downloadPath: message.downloadPath,
        total: message.total,
      };
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
  await syncDownloadList().catch(() => undefined);

  configStorage.subscribe(() => {
    void configStorage.get().then((config) => {
      currentConfig = config;
    });
  });
  registerListeners();
})();
