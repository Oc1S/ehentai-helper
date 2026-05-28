import { useRef } from 'react';

export const useLatest = <T>(val: T) => {
  const ref = useRef(val);
  ref.current = val;
  return ref;
};
