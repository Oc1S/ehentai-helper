import type { BaseStorage } from './base';
import { createStorage, StorageType } from './base';
import { MAX_DOWNLOAD_HISTORY } from './limits';

export type DownloadHistoryItem = {
  url: string;
  name: string;
  range: [number, number];
  ranges?: [number, number][];
  timestamp: number;
  info: GalleryInfo;
};

type HistoryStorage = BaseStorage<DownloadHistoryItem[]> & {
  add: (item: Omit<DownloadHistoryItem, 'timestamp'>) => Promise<void>;
  clear: () => Promise<void>;
  remove: (target: number | string) => Promise<void>;
};

export interface GalleryTag {
  category: string;
  content: string;
}

export interface GalleryInfo {
  id: string;
  name: string;
  nameInJapanese: string;
  category: string;
  uploader: string;
  posted: string;
  parent: string;
  visible: string;
  language: string;
  originalFileSizeMB: number;
  numImages: number;
  favorited: number;
  ratingTimes: number;
  averageScore: number;
  tags: GalleryTag[];
  coverUrl?: string;
}

const storage = createStorage<DownloadHistoryItem[]>('download-history', [], {
  storageType: StorageType.Local,
  liveUpdate: true,
});

const normalizeRanges = (ranges: [number, number][]) =>
  ranges
    .map(([start, end]) => [Math.min(start, end), Math.max(start, end)] as [number, number])
    .sort(([a], [b]) => a - b)
    .reduce<[number, number][]>((merged, range) => {
      const prev = merged[merged.length - 1];
      if (!prev || range[0] > prev[1] + 1) {
        merged.push(range);
        return merged;
      }
      prev[1] = Math.max(prev[1], range[1]);
      return merged;
    }, []);

const getHistoryRanges = (item: Pick<DownloadHistoryItem, 'range' | 'ranges'>) =>
  normalizeRanges(item.ranges?.length ? item.ranges : [item.range]);

const getBoundingRange = (ranges: [number, number][]): [number, number] => [
  Math.min(...ranges.map(([start]) => start)),
  Math.max(...ranges.map(([, end]) => end)),
];

export const mergeDownloadHistoryItems = (items: DownloadHistoryItem[]) => {
  const mergedByUrl = new Map<string, DownloadHistoryItem>();

  for (const item of items) {
    const previous = mergedByUrl.get(item.url);
    const ranges = normalizeRanges([
      ...(previous ? getHistoryRanges(previous) : []),
      ...getHistoryRanges(item),
    ]);
    const latest = !previous || item.timestamp >= previous.timestamp ? item : previous;

    mergedByUrl.set(item.url, {
      ...latest,
      range: getBoundingRange(ranges),
      ranges,
      timestamp: Math.max(previous?.timestamp ?? 0, item.timestamp),
    });
  }

  return [...mergedByUrl.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_DOWNLOAD_HISTORY);
};

export const downloadHistoryStorage: HistoryStorage = {
  ...storage,
  add: async (item) => {
    await storage.set((list) => {
      const currentList = Array.isArray(list) ? list : [];
      const entry: DownloadHistoryItem = {
        ...item,
        ranges: item.ranges?.length ? item.ranges : [item.range],
        timestamp: Date.now(),
      };
      return mergeDownloadHistoryItems([entry, ...currentList]);
    });
  },
  clear: async () => {
    await storage.set([]);
  },
  remove: async (target) => {
    await storage.set((list) =>
      Array.isArray(list)
        ? list.filter((item) =>
            typeof target === 'number' ? item.timestamp !== target : item.url !== target
          )
        : []
    );
  },
};

export const getDownloadHistoryRanges = getHistoryRanges;
