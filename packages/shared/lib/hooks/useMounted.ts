import { useEffect } from 'react';

export const useMounted = (effect: React.EffectCallback) => useEffect(effect, []);
