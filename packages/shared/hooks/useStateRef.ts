import { useRef, useState } from 'react';

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
