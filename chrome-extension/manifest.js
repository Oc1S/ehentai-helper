import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'));

const isFirefox = process.env.__FIREFOX__ === 'true';

const features = {
  background: false,
  content: false,
  sidePanel: false,
};

const sidePanelConfig = {
  side_panel: {
    default_path: 'sidepanel/index.html',
  },
  permissions: !isFirefox ? ['sidePanel'] : [],
};

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */
const manifest = Object.assign(
  {
    manifest_version: 3,
    default_locale: 'en',
    /**
     * if you want to support multiple languages, you can use the following reference
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
     */
    name: 'E-Hentai Helper',
    version: packageJson.version,
    description: 'ehentai helper',
    permissions: ['storage', 'tabs', 'downloads', 'activeTab'].concat(
      features.sidePanel ? sidePanelConfig.permissions : []
    ),
    options_page: 'options/index.html',
    background: features.background
      ? {
          service_worker: 'background.iife.js',
          type: 'module',
        }
      : undefined,
    action: {
      default_popup: 'popup/index.html',
      default_icon: 'icon-48.png',
    },
    icons: {
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    content_scripts: features.content
      ? [
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['content/index.iife.js'],
          },
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['content-ui/index.iife.js'],
          },
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            css: ['content.css'], // public folder
          },
        ]
      : [],
    web_accessible_resources: [
      {
        resources: ['*.js', '*.css', '*.svg', 'icon-128.png', 'icon-34.png'],
        matches: ['*://*/*'],
      },
    ],
  },
  !isFirefox && features.sidePanel && { side_panel: sidePanelConfig.side_panel }
);

export default manifest;
