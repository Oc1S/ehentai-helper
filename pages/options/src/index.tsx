import '@ehentai-helper/shared/styles/global.css';
import './index.css';

import { NextUIProvider } from '@nextui-org/react';
import { createRoot } from 'react-dom/client';

import Options from '@/Options';

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);
  root.render(
    <NextUIProvider>
      <Options />
    </NextUIProvider>
  );
}

init();
