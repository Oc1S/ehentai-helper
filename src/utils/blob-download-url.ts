import offscreenDocumentUrl from 'url:../assets/offscreen.html';

export type DownloadUrl = {
  url: string;
  revoke?: () => void;
};

const MAX_DATA_URL_BYTES = 1_500_000;
const DB_NAME = 'eh-helper-download-blobs';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

let creatingOffscreenDocument: Promise<void> | null = null;

type DownloadBlobRow = {
  key: string;
  blob: Blob;
  createdAt: number;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });

const createBlobKey = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const openDownloadBlobDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const putDownloadBlob = async (key: string, blob: Blob) => {
  const db = await openDownloadBlobDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const row: DownloadBlobRow = { key, blob, createdAt: Date.now() };
    transaction.objectStore(STORE_NAME).put(row);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

const deleteDownloadBlob = async (key: string) => {
  const db = await openDownloadBlobDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

const ensureOffscreenDocument = async () => {
  if (!chrome.offscreen?.createDocument) {
    throw new Error('Offscreen API unavailable');
  }
  if (await chrome.offscreen.hasDocument()) return;

  creatingOffscreenDocument ??= chrome.offscreen
    .createDocument({
      url: new URL(offscreenDocumentUrl, chrome.runtime.getURL('/')).toString(),
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'Create blob URLs for converted image downloads',
    })
    .finally(() => {
      creatingOffscreenDocument = null;
    });

  await creatingOffscreenDocument;
};

const createUrlViaOffscreen = async (blob: Blob): Promise<DownloadUrl> => {
  await ensureOffscreenDocument();

  const key = createBlobKey();
  await putDownloadBlob(key, blob);

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'create-blob-url',
      key,
    })) as { url?: string; error?: string } | undefined;

    if (!response?.url) {
      throw new Error(response?.error || 'Offscreen document failed to create blob URL');
    }
    return { url: response.url, revoke: () => revokeOffscreenUrl(response.url!, key) };
  } catch (error) {
    await deleteDownloadBlob(key).catch(() => undefined);
    throw error;
  }
};

const revokeOffscreenUrl = (url: string, key?: string) => {
  void chrome.runtime
    .sendMessage({ type: 'revoke-blob-url', url, key })
    .catch(() => (key ? deleteDownloadBlob(key) : undefined));
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
    return await createUrlViaOffscreen(blob);
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
