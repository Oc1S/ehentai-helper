const DB_NAME = 'eh-helper-download-blobs';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

const openDownloadBlobDb = () =>
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

const readDownloadBlob = async (key) => {
  const db = await openDownloadBlobDb();
  const row = await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();

  if (!row?.blob) {
    throw new Error('Download blob not found');
  }
  return row.blob;
};

const deleteDownloadBlob = async (key) => {
  const db = await openDownloadBlobDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'create-blob-url') {
    readDownloadBlob(message.key)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        sendResponse({ url });
      })
      .catch((error) => {
        sendResponse({ error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message.type === 'revoke-blob-url') {
    URL.revokeObjectURL(message.url);
    if (message.key) {
      deleteDownloadBlob(message.key).catch(() => undefined);
    }
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
