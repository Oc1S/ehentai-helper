import { useState } from 'react';

export const useForceRerender = () => {
  const [, setTick] = useState(0);
  const forceRerender = () => setTick(tick => (Number.MAX_SAFE_INTEGER === tick ? 0 : tick + 1));
  return forceRerender;
};
