import { defineConfig } from 'tsup';

export default defineConfig({
  treeshake: true,
  format: ['esm'],
  dts: true,
  external: [
    'chrome',
    'react',
    'react-dom',
    'sonner',
    'scheduler',
    '@ehentai-helper/storage',
    '@ehentai-helper/tsconfig',
    '../../node_modules/*',
    'node_modules/*',
    /^@nextui-org\//,
    /^..\/..\/node_modules\//,
    /^@nextui-org\/.*/,
    /^node_modules\/.*/,
    /^[^./]|^\.[^./]|^\.\.[^/]/,
  ],
});
