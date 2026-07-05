import type { BaseStorage } from './base';
import { createStorage, StorageType } from './base';

export type GalleryImageState = 'in_progress' | 'complete' | 'interrupted';

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
  upsertGallery: (record: Omit<GalleryRecord, 'createdAt' | 'updatedAt' | 'images'>) => Promise<void>;
  upsertImage: (
    galleryUrl: string,
    image: GalleryImageRecord
  ) => Promise<void>;
  patchImageByDownloadId: (
    chromeDownloadId: number,
    galleryUrl: string,
    index: number,
    patch: Partial<GalleryImageRecord>
  ) => Promise<void>;
  removeGallery: (galleryUrl: string) => Promise<void>;
  clear: () => Promise<void>;
};

const baseStorage = createStorage<GalleryRecordsMap>('gallery-records', {}, {
  storageType: StorageType.Local,
  liveUpdate: true,
});

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
          [String(image.index)]: clearSettledError({
            ...(current.images[String(image.index)] || {}),
            ...image,
            updatedAt: Date.now(),
          }),
        },
        updatedAt: Date.now(),
      };
      return { ...(map || {}), [galleryUrl]: next };
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

export type DownloadOwner = {
  galleryUrl: string;
  index: number;
};

export const downloadOwnerStorage = createStorage<Record<string, DownloadOwner>>(
  'download-owner',
  {},
  {
    storageType: StorageType.Local,
    liveUpdate: true,
  }
);
