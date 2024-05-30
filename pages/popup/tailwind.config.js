const baseConfig = require('@chrome-extension-boilerplate/tailwindcss-config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    'node_modules/@chrome-extension-boilerplate/**/*.{js,ts,jsx,tsx}',
  ],
};
