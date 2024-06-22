import { createContext } from 'react';

export const DownloadContext = createContext<{
  downloadList: chrome.downloads.DownloadItem[];
  imageIdMap: Map<number, number>;
  setDownloadList: React.Dispatch<React.SetStateAction<chrome.downloads.DownloadItem[]>>;
}>({
  downloadList: [],
  setDownloadList: () => {},
  imageIdMap: new Map(),
});
