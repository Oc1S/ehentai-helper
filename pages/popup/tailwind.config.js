const baseConfig = require('@ehentai-helper/tailwindcss-config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    'node_modules/@ehentai-helper/**/*.{js,ts,jsx,tsx}',
  ],
};
