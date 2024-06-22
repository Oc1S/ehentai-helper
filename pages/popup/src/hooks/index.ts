import { useMounted } from '@ehentai-helper/shared';

export const useDownload = ({
  onDownloadCreated,
  onDownloadChanged,
  onDeterminingFilename,
}: {
  onDownloadCreated: Parameters<typeof chrome.downloads.onCreated.addListener>[0];
  onDownloadChanged: Parameters<typeof chrome.downloads.onChanged.addListener>[0];
  onDeterminingFilename: Parameters<typeof chrome.downloads.onDeterminingFilename.addListener>[0];
}) => {
  useMounted(() => {
    chrome.downloads.onCreated.addListener(onDownloadCreated);
    chrome.downloads.onChanged.addListener(onDownloadChanged);
    chrome.downloads.onDeterminingFilename.addListener(onDeterminingFilename);
    return () => {
      chrome.downloads.onCreated.removeListener(onDownloadCreated);
      chrome.downloads.onChanged.removeListener(onDownloadChanged);
      chrome.downloads.onDeterminingFilename.removeListener(onDeterminingFilename);
    };
  });
};
