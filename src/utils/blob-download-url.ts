export type DownloadUrl = {
  url: string;
  revoke?: () => void;
};

const MAX_DATA_URL_BYTES = 1_500_000;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });

const ensureOffscreenDocument = async () => {
  if (!chrome.offscreen?.createDocument) {
    throw new Error('Offscreen API unavailable');
  }
  if (await chrome.offscreen.hasDocument()) return;

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: 'Create blob URLs for converted image downloads',
  });
};

const createUrlViaOffscreen = async (blob: Blob): Promise<string> => {
  await ensureOffscreenDocument();
  const buffer = await blob.arrayBuffer();
  const response = (await chrome.runtime.sendMessage({
    type: 'create-blob-url',
    buffer,
    mime: blob.type,
  })) as { url?: string } | undefined;

  if (!response?.url) {
    throw new Error('Offscreen document failed to create blob URL');
  }
  return response.url;
};

const revokeOffscreenUrl = (url: string) => {
  void chrome.runtime.sendMessage({ type: 'revoke-blob-url', url });
};

/** 优先 Object URL / Offscreen，避免 data URL 撑爆 Service Worker 内存 */
export const createDownloadUrl = async (blob: Blob): Promise<DownloadUrl> => {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const url = URL.createObjectURL(blob);
      return { url, revoke: () => URL.revokeObjectURL(url) };
    } catch {
      /* MV3 background may expose API but throw at runtime */
    }
  }

  try {
    const url = await createUrlViaOffscreen(blob);
    return { url, revoke: () => revokeOffscreenUrl(url) };
  } catch (error) {
    console.warn('offscreen blob URL failed@', error);
  }

  if (blob.size > MAX_DATA_URL_BYTES) {
    throw new Error(
      `Image blob too large (${blob.size} bytes) for fallback download; use original format or smaller range`
    );
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
