const DB_NAME = 'eh-helper-cbz';
const STORE = 'images';
const DB_VERSION = 1;

type CachedImage = {
  key: string;
  taskId: string;
  index: number;
  ext: string;
  sourceUrl: string;
  blob: Blob;
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const cacheKey = (taskId: string, index: number) => `${taskId}:${index}`;

export const putCbzImage = async (
  taskId: string,
  index: number,
  blob: Blob,
  ext: string,
  sourceUrl: string
): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const entry: CachedImage = {
      key: cacheKey(taskId, index),
      taskId,
      index,
      ext,
      sourceUrl,
      blob,
    };
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const listCbzImages = async (taskId: string): Promise<CachedImage[]> => {
  const db = await openDb();
  const rows = await new Promise<CachedImage[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result as CachedImage[]).filter((row) => row.taskId === taskId);
      all.sort((a, b) => a.index - b.index);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
};

export const clearCbzTask = async (taskId: string): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      for (const row of req.result as CachedImage[]) {
        if (row.taskId === taskId) store.delete(row.key);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};
