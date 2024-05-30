import { createRoot } from 'react-dom/client';
import '@chrome-extension-boilerplate/shared/styles/global.css';
import './index.css';
import Popup from '@/Popup';

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);

  root.render(<Popup />);
}

init();
