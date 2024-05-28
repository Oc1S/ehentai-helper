import { createRoot } from 'react-dom/client';
import '@src/index.css';
import Options from '@src/Options';
import { NextUIProvider } from '@nextui-org/react';

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
