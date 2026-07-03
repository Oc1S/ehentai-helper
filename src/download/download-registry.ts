import {
  downloadIndexMapStorage,
  downloadOwnerStorage,
  type GalleryImageState,
  galleryRecordsStorage,
} from '@/storage';

export type RegisterDownloadParams = {
  id: number;
  index: number;
  total: number;
  downloadPath: string;
  galleryUrl: string;
  sourceUrl: string;
  taskId: string | null;
};

/** 本扩展发起的 chrome.downloads id，供 onChanged 过滤 */
export const trackedDownloadIds = new Set<number>();

const MAX_OWNER_ENTRIES = 5000;

const trimOwnerMap = (map: Record<string, unknown>): Record<string, unknown> => {
  const keys = Object.keys(map);
  if (keys.length <= MAX_OWNER_ENTRIES) return map;
  const sorted = keys.map(Number).sort((a, b) => a - b);
  const toDrop = sorted.slice(0, keys.length - MAX_OWNER_ENTRIES);
  const next = { ...map };
  for (const id of toDrop) delete next[String(id)];
  return next;
};

export const mapChromeDownloadState = (
  state: chrome.downloads.DownloadItem['state']
): GalleryImageState | undefined => {
  switch (state) {
    case 'complete':
      return 'complete';
    case 'interrupted':
      return 'interrupted';
    case 'in_progress':
      return 'in_progress';
    default:
      return undefined;
  }
};

export const registerDownloadIndex = async (params: RegisterDownloadParams) => {
  trackedDownloadIds.add(params.id);

  await downloadIndexMapStorage.set((map) => ({
    ...(map || {}),
    [String(params.id)]: {
      index: params.index,
      total: params.total,
      downloadPath: params.downloadPath,
      galleryUrl: params.galleryUrl,
      sourceUrl: params.sourceUrl,
      taskId: params.taskId ?? undefined,
    },
  }));

  await downloadOwnerStorage.set(
    (map) =>
      trimOwnerMap({
        ...(map || {}),
        [String(params.id)]: {
          galleryUrl: params.galleryUrl,
          index: params.index,
        },
      }) as Record<string, { galleryUrl: string; index: number }>
  );

  await galleryRecordsStorage.upsertImage(params.galleryUrl, {
    index: params.index,
    sourceUrl: params.sourceUrl ?? '',
    taskId: params.taskId ?? undefined,
    state: 'in_progress',
    chromeDownloadId: params.id,
    updatedAt: Date.now(),
  });

  try {
    const [item] = await chrome.downloads.search({ id: params.id });
    if (item?.state) {
      const mapped = mapChromeDownloadState(item.state);
      if (mapped && mapped !== 'in_progress') {
        await galleryRecordsStorage.patchImageByDownloadId(params.id, params.galleryUrl, params.index, {
          state: mapped,
          filename: item.filename,
          error: item.error,
        });
      }
    }
  } catch {
    /* downloads.search may fail for brand-new ids on some builds */
  }
};

export const clearTrackedDownloads = () => {
  trackedDownloadIds.clear();
};
