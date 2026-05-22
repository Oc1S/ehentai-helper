import { EXTENSION_NAME, defaultConfig, isObject } from './shared';
import { configStorage, downloadIndexMapStorage, downloadListStorage } from './storage';
import { splitFilename } from './utils';

const textMime = 'text/plain';

const syncDownloadList = async () => {
  const items = await chrome.downloads.search({});
  await downloadListStorage.set(items);
};

let currentConfig = defaultConfig;
let currentDownloadContext: {
  downloadPath: string;
  total: number;
} | null = null;

const patchDownloadList = async (patch: chrome.downloads.DownloadItem) => {
  await downloadListStorage.set(list => {
    const next = [...(Array.isArray(list) ? list : [])];
    const index = next.findIndex(item => item.id === patch.id);
    if (index === -1) {
      next.push(patch);
      return next;
    }
    next[index] = { ...next[index], ...patch };
    return next;
  });
};

const registerListeners = () => {
  chrome.downloads.onCreated.addListener(downloadItem => {
    if (downloadItem.mime === textMime) {
      return;
    }
    void patchDownloadList(downloadItem);
  });

  chrome.downloads.onChanged.addListener(downloadDelta => {
    const { id } = downloadDelta;
    const next: Record<string, unknown> = {};
    for (const key in downloadDelta) {
      if (isObject(downloadDelta[key])) {
        next[key] = downloadDelta[key].current;
      }
    }
    void patchDownloadList({
      id,
      ...next
    } as chrome.downloads.DownloadItem);
  });

  chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    if (downloadItem.byExtensionName !== EXTENSION_NAME) return;

    void (async () => {
      const indexMap = await downloadIndexMapStorage.get();
      const { fileNameRule, filenameConflictAction: conflictAction } = currentConfig;
      const entry = indexMap[String(downloadItem.id)];
      const downloadPath = entry?.downloadPath || currentDownloadContext?.downloadPath || currentConfig.intermediateDownloadPath;

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
        conflictAction
      });
    })();
    return true;
  });

  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.type === 'register-download-index') {
      void downloadIndexMapStorage.set(map => ({
        ...(map || {}),
        [String(message.id)]: {
          index: message.index,
          total: message.total,
          downloadPath: message.downloadPath
        }
      }));
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'set-download-context') {
      currentDownloadContext = {
        downloadPath: message.downloadPath,
        total: message.total
      };
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'clear-download-index-map') {
      void downloadIndexMapStorage.set({});
      currentDownloadContext = null;
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
};

void (async () => {
  currentConfig = await configStorage.get();
  await Promise.all([downloadIndexMapStorage.get(), downloadListStorage.get().catch(() => [])]);
  await syncDownloadList().catch(() => undefined);
  configStorage.subscribe(() => {
    void configStorage.get().then(config => {
      currentConfig = config;
    });
  });
  registerListeners();
})();
