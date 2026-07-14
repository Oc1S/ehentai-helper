/** 本扩展发起的 chrome.downloads id，供 onChanged 过滤 */
export const trackedDownloadIds = new Set<number>();

export const clearTrackedDownloads = () => {
  trackedDownloadIds.clear();
};
