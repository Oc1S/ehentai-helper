import { createStorage, StorageType } from './base';

export type DownloadIndexEntry = {
  index: number;
  total: number;
  downloadPath?: string;
};

export const downloadIndexMapStorage = createStorage<Record<string, DownloadIndexEntry>>('download-index-map', {}, {
  storageType: StorageType.Local,
  liveUpdate: true
});
