import { BaseStorage, createStorage, StorageType } from './base';

export type DownloadHistoryItem = {
  url: string;
  name: string;
  range: [number, number];
  timestamp: number;
};

type HistoryStorage = BaseStorage<DownloadHistoryItem[]> & {
  add: (item: Omit<DownloadHistoryItem, 'timestamp'>) => Promise<void>;
  clear: () => Promise<void>;
  remove: (timestamp: number) => Promise<void>;
};

const storage = createStorage<DownloadHistoryItem[]>('download-history', [], {
  storageType: StorageType.Local,
  liveUpdate: true,
});

export const downloadHistoryStorage: HistoryStorage = {
  ...storage,
  add: async item => {
    const entry = { ...item, timestamp: Date.now() };
    await storage.set(list => [entry, ...(Array.isArray(list) ? list : [])].slice(0, 200));
  },
  clear: async () => {
    await storage.set([]);
  },
  remove: async timestamp => {
    await storage.set(list => (Array.isArray(list) ? list.filter(i => i.timestamp !== timestamp) : []));
  },
};
