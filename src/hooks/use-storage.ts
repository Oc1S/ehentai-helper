import { useSyncExternalStore } from 'react';

import type { BaseStorage } from '@/storage/base';

type StorageCacheEntry<D> = {
  read: () => D;
  /** 值曾由 getSnapshot 同步；snapshot 变为 null 时应信任 null 而非旧缓存 */
  fromSnapshot: boolean;
};

const storageMap = new Map<BaseStorage<unknown>, StorageCacheEntry<unknown>>();

function readStorageValue<Data>(
  storage: BaseStorage<Data>,
  snapshot: Data | null
): Data {
  if (!storageMap.has(storage)) {
    storageMap.set(storage, {
      ...wrapPromise(storage.get()),
      fromSnapshot: false,
    });
  }

  const cached = storageMap.get(storage) as StorageCacheEntry<Data>;

  if (snapshot !== null) {
    const entry: StorageCacheEntry<Data> = { read: () => snapshot, fromSnapshot: true };
    storageMap.set(storage, entry);
    return snapshot;
  }

  if (cached.fromSnapshot) {
    const entry: StorageCacheEntry<Data> = { read: () => null as Data, fromSnapshot: true };
    storageMap.set(storage, entry);
    return null as Data;
  }

  return cached.read();
}

export function useStorage<
  Storage extends BaseStorage<Data>,
  Data = Storage extends BaseStorage<infer D> ? D : unknown,
>(storage: Storage) {
  const snapshot = useSyncExternalStore<Data | null>(storage.subscribe, storage.getSnapshot);
  return readStorageValue(storage, snapshot);
}

export function useStorageSuspense<
  Storage extends BaseStorage<Data>,
  Data = Storage extends BaseStorage<infer D> ? D : unknown,
>(storage: Storage) {
  const snapshot = useSyncExternalStore<Data | null>(storage.subscribe, storage.getSnapshot);
  return readStorageValue(storage, snapshot);
}

function wrapPromise<R>(promise: Promise<R>) {
  let status = 'pending';
  let result: R;
  const suspender = promise.then(
    (r) => {
      status = 'success';
      result = r;
    },
    (e) => {
      status = 'error';
      result = e;
    }
  );

  return {
    read() {
      switch (status) {
        case 'pending':
          throw suspender;
        case 'error':
          throw result;
        default:
          return result;
      }
    },
  };
}
