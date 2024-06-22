import { useRef } from 'react';

export const useCreation = <T>(create: () => T): T => {
  const ref = useRef<T>();
  const initRef = useRef(true);

  if (initRef.current) {
    ref.current = create();
    initRef.current = false;
  }
  return ref.current as T;
};
