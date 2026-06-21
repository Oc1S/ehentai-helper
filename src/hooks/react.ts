import { useEffect, useRef, useState } from 'react';

export const useMounted = (effect: React.EffectCallback) => useEffect(effect, []);

export const useStateRef = <T>(initialValue: T | (() => T)) => {
  const [state, _setState] = useState<T>(initialValue);
  const ref = useRef(state);
  ref.current = state;
  const setState = (newState: T | (() => T)) => {
    typeof newState !== 'function' && (ref.current = newState);
    _setState(newState);
  };
  return [state, setState, ref] as const;
};

export const useCreation = <T>(create: () => T): T => {
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
  return () => setTick((tick) => (Number.MAX_SAFE_INTEGER === tick ? 0 : tick + 1));
};
