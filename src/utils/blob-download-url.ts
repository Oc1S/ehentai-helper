export type DownloadUrl = {
  url: string;
  revoke?: () => void;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });

/** Service Worker 内 createObjectURL 不可用，回退为 data URL */
export const createDownloadUrl = async (blob: Blob): Promise<DownloadUrl> => {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const url = URL.createObjectURL(blob);
      return { url, revoke: () => URL.revokeObjectURL(url) };
    } catch {
      /* MV3 background may expose API but throw at runtime */
    }
  }
  return { url: await blobToDataUrl(blob) };
};

export const releaseDownloadUrlOnDownloadDone = (
  chromeDownloadId: number,
  revoke?: () => void
): void => {
  if (!revoke) return;

  const onChanged = (delta: chrome.downloads.DownloadDelta) => {
    if (delta.id !== chromeDownloadId) return;
    const next = delta.state?.current;
    if (next === 'complete' || next === 'interrupted') {
      revoke();
      chrome.downloads.onChanged.removeListener(onChanged);
    }
  };
  chrome.downloads.onChanged.addListener(onChanged);
};
