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

const refreshDownloadMetadata = async (params: RegisterDownloadParams) => {
  try {
    const [item] = await chrome.downloads.search({ id: params.id });
    if (!item) return;

    const mapped = item.state ? mapChromeDownloadState(item.state) : undefined;
    const patch: Parameters<typeof galleryRecordsStorage.patchImageByDownloadId>[3] = {};
    if (mapped && mapped !== 'in_progress') patch.state = mapped;
    if (item.filename) patch.filename = item.filename;
    if (item.error) patch.error = item.error;
    if (typeof item.bytesReceived === 'number') patch.bytesReceived = item.bytesReceived;
    if (typeof item.totalBytes === 'number') patch.totalBytes = item.totalBytes;

    if (Object.keys(patch).length > 0) {
      await galleryRecordsStorage.patchImageByDownloadId(
        params.id,
        params.galleryUrl,
        params.index,
        patch
      );
    }
  } catch {
    /* downloads.search may fail for brand-new ids on some builds */
  }
};

const scheduleDownloadMetadataRefresh = (params: RegisterDownloadParams) => {
  for (const delay of [150, 750, 2000]) {
    setTimeout(() => {
      void refreshDownloadMetadata(params);
    }, delay);
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

  await refreshDownloadMetadata(params);
  scheduleDownloadMetadataRefresh(params);
};

export const clearTrackedDownloads = () => {
  trackedDownloadIds.clear();
};
