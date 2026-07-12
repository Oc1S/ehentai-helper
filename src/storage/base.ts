export enum StorageType {
  Local = 'local',
  Sync = 'sync',
  Managed = 'managed',
  Session = 'session',
}

export enum SessionAccessLevel {
  ExtensionPagesOnly = 'TRUSTED_CONTEXTS',
  ExtensionPagesAndContentScripts = 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
}

type ValueOrUpdate<D> = D | ((prev: D) => Promise<D> | D);

export type BaseStorage<D> = {
  get: () => Promise<D>;
  set: (value: ValueOrUpdate<D>) => Promise<void>;
  getSnapshot: () => D | null;
  subscribe: (listener: () => void) => () => void;
};

type StorageConfig<D = string> = {
  storageType?: StorageType;
  sessionAccessForContentScripts?: boolean;
  liveUpdate?: boolean;
  serialization?: {
    serialize: (value: D) => string;
    deserialize: (text: string) => D;
  };
};

async function updateCache<D>(valueOrUpdate: ValueOrUpdate<D>, cache: D | null): Promise<D> {
  function isFunction<T>(value: ValueOrUpdate<T>): value is (prev: T) => T | Promise<T> {
    return typeof value === 'function';
  }

  function returnsPromise<T>(func: (prev: T) => T | Promise<T>): func is (prev: T) => Promise<T> {
    return (func as (prev: T) => Promise<T>) instanceof Promise;
  }

  if (isFunction(valueOrUpdate)) {
    if (returnsPromise(valueOrUpdate)) {
      return await valueOrUpdate(cache as D);
    }
    return valueOrUpdate(cache as D);
  }
  return valueOrUpdate;
}

let globalSessionAccessLevelFlag: StorageConfig['sessionAccessForContentScripts'] = false;

function checkStoragePermission(storageType: StorageType): void {
  if (chrome.storage[storageType] === undefined) {
    throw new Error(
      `Check your storage permission in manifest.json: ${storageType} is not defined`
    );
  }
}

export function createStorage<D = string>(
  key: string,
  fallback: D,
  config?: StorageConfig<D>
): BaseStorage<D> {
  let cache: D | null = null;
  let listeners: Array<() => void> = [];
  const storageType = config?.storageType ?? StorageType.Local;
  const liveUpdate = config?.liveUpdate ?? false;
  const serialize = config?.serialization?.serialize ?? ((v: D) => v);
  const deserialize = config?.serialization?.deserialize ?? ((v) => v as D);

  if (
    globalSessionAccessLevelFlag === false &&
    storageType === StorageType.Session &&
    config?.sessionAccessForContentScripts === true
  ) {
    checkStoragePermission(storageType);
    chrome.storage[storageType]
      .setAccessLevel({
        accessLevel: SessionAccessLevel.ExtensionPagesAndContentScripts,
      })
      .catch((error) => {
        console.warn(error);
        console.warn(
          'Please call setAccessLevel into different context, like a background script.'
        );
      });
    globalSessionAccessLevelFlag = true;
  }

  const _getDataFromStorage = async (): Promise<D> => {
    checkStoragePermission(storageType);
    const value = await chrome.storage[storageType].get([key]);
    return deserialize(value[key] as string) ?? fallback;
  };

  const _emitChange = () => {
    listeners.forEach((listener) => listener());
  };

  // 本地写入进行中时忽略 onChanged，避免回声覆盖尚未落盘的合并结果
  let persisting = false;
  let pendingUpdates: ValueOrUpdate<D>[] = [];
  let writeChain: Promise<void> = Promise.resolve();
  // 与 cache 分离：cache 合法值可为 null（如 download-active-task 清空后）
  let hydrated = false;

  let ready = _getDataFromStorage().then((data) => {
    // set 可能已先写入；勿用过期快照覆盖
    if (!hydrated) {
      cache = data;
      hydrated = true;
      _emitChange();
    }
  });

  const flushPendingUpdates = async () => {
    if (pendingUpdates.length === 0) return;

    const batch = pendingUpdates;
    pendingUpdates = [];

    try {
      await ready;
      if (!hydrated) {
        cache = await _getDataFromStorage();
        hydrated = true;
      }

      for (const valueOrUpdate of batch) {
        cache = await updateCache(valueOrUpdate, cache);
      }
      hydrated = true;

      persisting = true;
      try {
        await chrome.storage[storageType].set({ [key]: serialize(cache as D) });
      } finally {
        persisting = false;
      }

      _emitChange();
    } catch (error) {
      pendingUpdates = [...batch, ...pendingUpdates];
      throw error;
    }
  };

  const set = (valueOrUpdate: ValueOrUpdate<D>): Promise<void> => {
    pendingUpdates.push(valueOrUpdate);
    writeChain = writeChain.then(flushPendingUpdates, flushPendingUpdates);
    return writeChain;
  };

  const get = async (): Promise<D> => {
    if (hydrated) return cache as D;
    await ready;
    if (hydrated) return cache as D;
    cache = await _getDataFromStorage();
    hydrated = true;
    return cache as D;
  };

  const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  };

  const getSnapshot = () => {
    return hydrated ? cache : null;
  };

  async function _updateFromStorageOnChanged(changes: {
    [key: string]: chrome.storage.StorageChange;
  }) {
    if (changes[key] === undefined) return;
    // 本上下文正在合并/落盘时，以本地 cache 为准
    if (persisting || pendingUpdates.length > 0) return;

    const raw = changes[key].newValue;
    const next =
      raw === undefined ? fallback : ((deserialize(raw as string) as D | undefined) ?? fallback);

    if (hydrated && cache === next) return;

    cache = next;
    hydrated = true;
    _emitChange();
  }

  if (liveUpdate) {
    chrome.storage[storageType].onChanged.addListener(_updateFromStorageOnChanged);
  }

  return {
    get,
    set,
    getSnapshot,
    subscribe,
  };
}
