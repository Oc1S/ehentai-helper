import { createStorage, StorageType } from './base';

const EMPTY_LIST: chrome.downloads.DownloadItem[] = [];

export const downloadListStorage = createStorage<chrome.downloads.DownloadItem[]>(
  'download-list',
  EMPTY_LIST,
  {
    storageType: StorageType.Local,
    liveUpdate: true,
  }
);
