import type { BaseStorage } from './base';
import { createStorage, StorageType } from './base';

export type GalleryImageState = 'queued' | 'in_progress' | 'complete' | 'interrupted';

export type GalleryImageRecord = {
  index: number;
  sourceUrl: string;
  taskId?: string;
  filename?: string;
  state: GalleryImageState;
  chromeDownloadId?: number;
  error?: string;
  bytesReceived?: number;
  totalBytes?: number;
  updatedAt: number;
};

export type GalleryRecord = {
  galleryUrl: string;
  galleryName: string;
  galleryId: string;
  downloadPath: string;
  total: number;
  images: Record<string, GalleryImageRecord>;
  createdAt: number;
  updatedAt: number;
};

export type GalleryRecordsMap = Record<string, GalleryRecord>;

import { MAX_GALLERY_RECORDS } from './limits';

type GalleryRecordsStorage = BaseStorage<GalleryRecordsMap> & {
  upsertGallery: (
    record: Omit<GalleryRecord, 'createdAt' | 'updatedAt' | 'images'>
  ) => Promise<void>;
  upsertImage: (galleryUrl: string, image: GalleryImageRecord) => Promise<void>;
  markImagesQueued: (galleryUrl: string, indices: number[], taskId: string) => Promise<void>;
  patchImageByDownloadId: (
    chromeDownloadId: number,
    galleryUrl: string,
    index: number,
    patch: Partial<GalleryImageRecord>
  ) => Promise<void>;
  removeGallery: (galleryUrl: string) => Promise<void>;
  clear: () => Promise<void>;
};

const baseStorage = createStorage<GalleryRecordsMap>(
  'gallery-records',
  {},
  {
    storageType: StorageType.Local,
    liveUpdate: true,
  }
);

const trimToMax = (map: GalleryRecordsMap): GalleryRecordsMap => {
  const entries = Object.entries(map);
  if (entries.length <= MAX_GALLERY_RECORDS) return map;
  entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  const kept = entries.slice(0, MAX_GALLERY_RECORDS);
  return Object.fromEntries(kept);
};

const clearSettledError = (image: GalleryImageRecord) => {
  if (image.state === 'interrupted') return image;
  const next = { ...image };
  delete next.error;
  return next;
};

const hasOwn = <T extends object>(object: T, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(object, key);

const mergeImageRecord = (
  previous: GalleryImageRecord | undefined,
  image: GalleryImageRecord
): GalleryImageRecord => {
  const merged = clearSettledError({
    ...(previous || {}),
    ...image,
    updatedAt: Date.now(),
  });

  // 缺省保留已有字段；仅当 patch 显式带上 key 时才覆盖/清空
  if (hasOwn(image, 'filename')) {
    if (!image.filename) delete merged.filename;
  }
  if (hasOwn(image, 'chromeDownloadId')) {
    if (image.chromeDownloadId == null) delete merged.chromeDownloadId;
  }
  if (hasOwn(image, 'bytesReceived')) {
    if (image.bytesReceived == null) delete merged.bytesReceived;
  }
  if (hasOwn(image, 'totalBytes')) {
    if (image.totalBytes == null) delete merged.totalBytes;
  }

  return merged;
};

export const galleryRecordsStorage: GalleryRecordsStorage = {
  ...baseStorage,
  upsertGallery: async ({ galleryUrl, galleryName, galleryId, downloadPath, total }) => {
    await baseStorage.set((map) => {
      const prev = (map || {})[galleryUrl];
      const now = Date.now();
      const next: GalleryRecord = {
        galleryUrl,
        galleryName,
        galleryId,
        downloadPath,
        total,
        images: prev?.images ?? {},
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      return trimToMax({ ...(map || {}), [galleryUrl]: next });
    });
  },
  upsertImage: async (galleryUrl, image) => {
    await baseStorage.set((map) => {
      const current = (map || {})[galleryUrl];
      if (!current) return map || {};
      const next: GalleryRecord = {
        ...current,
        images: {
          ...current.images,
          [String(image.index)]: mergeImageRecord(current.images[String(image.index)], image),
        },
        updatedAt: Date.now(),
      };
      return { ...(map || {}), [galleryUrl]: next };
    });
  },
  markImagesQueued: async (galleryUrl, indices, taskId) => {
    if (indices.length === 0) return;
    await baseStorage.set((map) => {
      const current = (map || {})[galleryUrl];
      if (!current) return map || {};
      const nextImages = { ...current.images };
      const now = Date.now();
      for (const index of indices) {
        const key = String(index);
        const prev = current.images[key];
        if (prev?.state === 'complete' && prev?.taskId === taskId) continue;
        // 新一轮排队：显式清空旧 chrome 绑定与进度，避免缺省保留语义留下脏 id
        nextImages[key] = mergeImageRecord(prev, {
          index,
          sourceUrl: prev?.sourceUrl ?? '',
          taskId,
          state: 'queued',
          chromeDownloadId: undefined,
          bytesReceived: undefined,
          totalBytes: undefined,
          updatedAt: now,
        });
      }
      return {
        ...(map || {}),
        [galleryUrl]: { ...current, images: nextImages, updatedAt: now },
      };
    });
  },
  patchImageByDownloadId: async (chromeDownloadId, galleryUrl, index, patch) => {
    await baseStorage.set((map) => {
      const current = (map || {})[galleryUrl];
      if (!current) return map || {};
      const key = String(index);
      const prevImg = current.images[key];
      if (!prevImg) return map || {};
      if (prevImg.chromeDownloadId !== chromeDownloadId) return map || {};
      const merged: GalleryImageRecord = {
        ...prevImg,
        ...patch,
        chromeDownloadId,
        updatedAt: Date.now(),
      };
      if (patch.state && patch.state !== 'interrupted') delete merged.error;
      const next: GalleryRecord = {
        ...current,
        images: { ...current.images, [key]: merged },
        updatedAt: Date.now(),
      };
      return { ...(map || {}), [galleryUrl]: next };
    });
  },
  removeGallery: async (galleryUrl) => {
    await baseStorage.set((map) => {
      if (!map || !(galleryUrl in map)) return map || {};
      const next = { ...map };
      delete next[galleryUrl];
      return next;
    });
  },
  clear: async () => {
    await baseStorage.set({});
  },
};
