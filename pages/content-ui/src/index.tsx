import App from '@src/app';
// eslint-disable-next-line
// @ts-ignore
import tailwindcssOutput from '@src/tailwind-output.css?inline';
import { createRoot } from 'react-dom/client';

const root = document.createElement('div');
root.id = 'ehentai-helper-content-view-root';

document.body.append(root);

const rootIntoShadow = document.createElement('div');
rootIntoShadow.id = 'shadow-root';

const shadowRoot = root.attachShadow({ mode: 'open' });
shadowRoot.appendChild(rootIntoShadow);

/** Inject styles into shadow dom */
const styleElement = document.createElement('style');
styleElement.innerHTML = tailwindcssOutput;
shadowRoot.appendChild(styleElement);

createRoot(rootIntoShadow).render(<App />);
