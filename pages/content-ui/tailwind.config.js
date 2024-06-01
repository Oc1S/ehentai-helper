const baseConfig = require('@ehentai-helper/tailwindcss-config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: ['src/**/*.{ts,tsx}'],
};
