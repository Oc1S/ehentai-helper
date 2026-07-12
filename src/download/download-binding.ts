import type { DownloadIndexEntry, GalleryImageRecord, GalleryRecordsMap } from '@/storage';

export type OwnedDownloadBinding = {
  entry: DownloadIndexEntry & { galleryUrl: string; taskId: string };
  image: GalleryImageRecord;
  taskId: string;
  needsBind: boolean;
};

export const isImageOwnedByTask = (
  image: GalleryImageRecord | undefined,
  taskId: string
): image is GalleryImageRecord => image?.taskId === taskId;

/**
 * 用持久化 owner（gallery/index/taskId）解析 Chrome 下载事件。
 * 活动任务不参与判断：它只负责当前 UI 汇总，不能阻止历史下载的晚到终态落账。
 */
export const resolveOwnedDownloadBinding = (
  chromeDownloadId: number,
  indexMap: Record<string, DownloadIndexEntry>,
  records: GalleryRecordsMap
): OwnedDownloadBinding | null => {
  const entry = indexMap[String(chromeDownloadId)];
  if (!entry?.galleryUrl || typeof entry.index !== 'number' || !entry.taskId) return null;

  const image = records[entry.galleryUrl]?.images[String(entry.index)];
  if (!isImageOwnedByTask(image, entry.taskId)) return null;

  return {
    entry: { ...entry, galleryUrl: entry.galleryUrl, taskId: entry.taskId },
    image,
    taskId: entry.taskId,
    needsBind: image.chromeDownloadId !== chromeDownloadId,
  };
};
