import type { GalleryImageState } from '@/storage';

/** 本扩展发起的 chrome.downloads id，供 onChanged 过滤 */
export const trackedDownloadIds = new Set<number>();

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

export const clearTrackedDownloads = () => {
  trackedDownloadIds.clear();
};
