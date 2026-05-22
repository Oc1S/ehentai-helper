export enum StorageType {
  Local = 'local',
  Sync = 'sync',
  Managed = 'managed',
  Session = 'session'
}

export enum SessionAccessLevel {
  ExtensionPagesOnly = 'TRUSTED_CONTEXTS',
  ExtensionPagesAndContentScripts = 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
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
    throw new Error(`Check your storage permission in manifest.json: ${storageType} is not defined`);
  }
}

export function createStorage<D = string>(key: string, fallback: D, config?: StorageConfig<D>): BaseStorage<D> {
  let cache: D | null = null;
  let listeners: Array<() => void> = [];
  const storageType = config?.storageType ?? StorageType.Local;
  const liveUpdate = config?.liveUpdate ?? false;
  const serialize = config?.serialization?.serialize ?? ((v: D) => v);
  const deserialize = config?.serialization?.deserialize ?? (v => v as D);

  if (
    globalSessionAccessLevelFlag === false &&
    storageType === StorageType.Session &&
    config?.sessionAccessForContentScripts === true
  ) {
    checkStoragePermission(storageType);
    chrome.storage[storageType]
      .setAccessLevel({
        accessLevel: SessionAccessLevel.ExtensionPagesAndContentScripts
      })
      .catch(error => {
        console.warn(error);
        console.warn('Please call setAccessLevel into different context, like a background script.');
      });
    globalSessionAccessLevelFlag = true;
  }

  const _getDataFromStorage = async (): Promise<D> => {
    checkStoragePermission(storageType);
    const value = await chrome.storage[storageType].get([key]);
    return deserialize(value[key]) ?? fallback;
  };

  const _emitChange = () => {
    listeners.forEach(listener => listener());
  };

  const set = async (valueOrUpdate: ValueOrUpdate<D>) => {
    cache = await updateCache(valueOrUpdate, cache);
    await chrome.storage[storageType].set({ [key]: serialize(cache) });
    _emitChange();
  };

  const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  const getSnapshot = () => {
    return cache;
  };

  _getDataFromStorage().then(data => {
    cache = data;
    _emitChange();
  });

  async function _updateFromStorageOnChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
    if (changes[key] === undefined) return;

    const valueOrUpdate: ValueOrUpdate<D> = deserialize(changes[key].newValue);

    if (cache === valueOrUpdate) return;

    cache = await updateCache(valueOrUpdate, cache);

    _emitChange();
  }

  if (liveUpdate) {
    chrome.storage[storageType].onChanged.addListener(_updateFromStorageOnChanged);
  }

  return {
    get: _getDataFromStorage,
    set,
    getSnapshot,
    subscribe
  };
}
