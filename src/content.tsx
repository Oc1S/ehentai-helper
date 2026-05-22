import { useEffect } from 'react';

export const config = {
  matches: ['https://*/*']
};

export default function Content() {
  useEffect(() => {
    console.log('content script loaded');
  }, []);

  return null;
}
