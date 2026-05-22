import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { BaseStorage } from '../storage/base';

export const useMounted = (effect: React.EffectCallback) => useEffect(effect, []);

export const useStateRef = <T,>(initialValue: T | (() => T)) => {
  const [state, _setState] = useState<T>(initialValue);
  const ref = useRef(state);
  ref.current = state;
  const setState = (newState: T | (() => T)) => {
    typeof newState !== 'function' && (ref.current = newState);
    _setState(newState);
  };
  return [state, setState, ref] as const;
};

export const useCreation = <T,>(create: () => T): T => {
  const ref = useRef<T>();
  const initRef = useRef(true);

  if (initRef.current) {
    ref.current = create();
    initRef.current = false;
  }
  return ref.current as T;
};

export const useForceRerender = () => {
  const [, setTick] = useState(0);
  return () => setTick(tick => (Number.MAX_SAFE_INTEGER === tick ? 0 : tick + 1));
};

type WrappedPromise = ReturnType<typeof wrapPromise>;
const storageMap = new Map<BaseStorage<unknown>, WrappedPromise>();

export function useStorage<Storage extends BaseStorage<Data>, Data = Storage extends BaseStorage<infer D> ? D : unknown>(
  storage: Storage
) {
  const _data = useSyncExternalStore<Data | null>(storage.subscribe, storage.getSnapshot);

  if (!storageMap.has(storage)) {
    storageMap.set(storage, wrapPromise(storage.get()));
  }
  if (_data !== null) {
    storageMap.set(storage, { read: () => _data });
  }

  return _data ?? (storageMap.get(storage)!.read() as Data);
}

export function useStorageSuspense<
  Storage extends BaseStorage<Data>,
  Data = Storage extends BaseStorage<infer D> ? D : unknown,
>(storage: Storage) {
  const _data = useSyncExternalStore<Data | null>(storage.subscribe, storage.getSnapshot);

  if (!storageMap.has(storage)) {
    storageMap.set(storage, wrapPromise(storage.get()));
  }
  if (_data !== null) {
    storageMap.set(storage, { read: () => _data });
  }

  return _data ?? (storageMap.get(storage)!.read() as Data);
}

function wrapPromise<R>(promise: Promise<R>) {
  let status = 'pending';
  let result: R;
  const suspender = promise.then(
    r => {
      status = 'success';
      result = r;
    },
    e => {
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
    }
  };
}
