const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const { nextui } = require('@nextui-org/react');

const requireFromRoot = createRequire(path.join(__dirname, 'package.json'));

/** NextUI 组件 class 定义在 @nextui-org/theme；pnpm 下常未提升到 node_modules 根目录，需显式解析。 */
const resolveNextuiThemeContentGlobs = () => {
  const globs = [];

  try {
    const themeRoot = path.dirname(requireFromRoot.resolve('@nextui-org/theme/package.json'));
    globs.push(path.join(themeRoot, 'dist/**/*.{js,ts,jsx,tsx}').replace(/\\/g, '/'));
    return globs;
  } catch {
    /* fall through to pnpm store scan */
  }

  const pnpmRoot = path.join(__dirname, 'node_modules/.pnpm');
  if (!fs.existsSync(pnpmRoot)) return globs;

  for (const entry of fs.readdirSync(pnpmRoot)) {
    if (!entry.startsWith('@nextui-org+theme@')) continue;

    const distDir = path.join(pnpmRoot, entry, 'node_modules/@nextui-org/theme/dist');
    if (fs.existsSync(distDir)) {
      globs.push(path.join(distDir, '**/*.{js,ts,jsx,tsx}').replace(/\\/g, '/'));
    }
  }

  return globs;
};

const nextuiThemeGlobs = resolveNextuiThemeContentGlobs();

if (nextuiThemeGlobs.length === 0) {
  console.warn(
    '[tailwind] @nextui-org/theme not found — NextUI component styles will be missing. Install @nextui-org/theme.'
  );
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', ...nextuiThemeGlobs],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--eh-canvas) / <alpha-value>)',
        ink: 'rgb(var(--eh-ink) / <alpha-value>)',
        body: 'rgb(var(--eh-body) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--eh-muted) / <alpha-value>)',
          soft: 'rgb(var(--eh-muted-soft) / <alpha-value>)',
        },
        hairline: {
          DEFAULT: 'var(--eh-hairline)',
          soft: 'var(--eh-hairline-soft)',
        },
        surface: {
          soft: 'rgb(var(--eh-surface-soft) / <alpha-value>)',
          card: 'rgb(var(--eh-surface-card) / <alpha-value>)',
          strong: 'rgb(var(--eh-surface-strong) / <alpha-value>)',
          dark: 'rgb(var(--eh-surface-dark) / <alpha-value>)',
          'dark-elevated': 'var(--eh-surface-dark-elevated-hex)',
        },
        brand: {
          accent: 'rgb(var(--eh-brand-accent) / <alpha-value>)',
          primary: 'rgb(var(--eh-brand-primary) / <alpha-value>)',
          'primary-active': 'var(--eh-brand-primary-active-hex)',
        },
        primary: {
          50: 'var(--eh-primary-50)',
          100: 'var(--eh-primary-100)',
          200: 'var(--eh-primary-200)',
          300: 'var(--eh-primary-300)',
          400: 'var(--eh-primary-400)',
          500: 'var(--eh-primary-500)',
          600: 'var(--eh-primary-600)',
          700: 'var(--eh-primary-700)',
          800: 'var(--eh-primary-800)',
          900: 'var(--eh-primary-900)',
          DEFAULT: 'rgb(var(--eh-primary) / <alpha-value>)',
          foreground: 'rgb(var(--eh-primary-fg) / <alpha-value>)',
        },
        success: 'var(--eh-success-hex)',
        warning: 'var(--eh-warning-hex)',
        error: 'var(--eh-error-hex)',
        on: {
          primary: 'var(--eh-on-primary-hex)',
          dark: 'var(--eh-ink-hex)',
          'dark-soft': 'var(--eh-muted-hex)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-sm': ['28px', { lineHeight: '1.2', letterSpacing: '-0.5px', fontWeight: '600' }],
        'title-lg': ['22px', { lineHeight: '1.3', letterSpacing: '-0.3px', fontWeight: '600' }],
        'title-md': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'title-sm': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      width: {
        popup: '800px',
      },
      height: {
        popup: '600px',
        'popup-header': '48px',
        'popup-content': '480px',
        'popup-footer': 'var(--popup-footer-h)',
      },
      borderRadius: {
        'eh-xs': '4px',
        'eh-sm': '6px',
        'eh-md': '8px',
        'eh-lg': '12px',
        'eh-xl': '16px',
        'eh-cta': '8px',
        'eh-2xl': '20px',
        'eh-3xl': '24px',
      },
      boxShadow: {
        card: 'var(--eh-shadow-card)',
        'card-elevated': 'var(--eh-shadow-card-elevated)',
        pill: 'var(--eh-shadow-pill)',
        glow: 'var(--eh-glow)',
      },
    },
  },
  plugins: [
    // NextUI 主题色在构建期写入 Tailwind，无法使用 CSS 变量；与 tokens.css 无重复定义
    nextui({
      defaultTheme: 'dark',
      themes: {
        dark: {
          colors: {
            background: '#09090b',
            foreground: '#e4e4e7',
            focus: '#34d399',
            divider: 'rgba(250, 250, 250, 0.08)',
            overlay: 'rgba(0, 0, 0, 0.75)',
            content1: '#18181b',
            content2: '#27272a',
            content3: '#27272a',
            content4: '#3f3f46',
            primary: {
              50: '#021a14',
              100: '#042f24',
              200: '#064e3b',
              300: '#047857',
              400: '#059669',
              500: '#10b981',
              600: '#34d399',
              700: '#6ee7b7',
              800: '#a7f3d0',
              900: '#d1fae5',
              DEFAULT: '#059669',
              foreground: '#ecfdf5',
            },
            // 暗色主题：50 最深、900 最浅；Input/Table 等用 bg-default-100，若 100 配成浅色会发白
            default: {
              50: '#09090b',
              100: '#141414',
              200: '#1c1c1f',
              300: '#27272a',
              400: '#6b6b74',
              500: '#84848e',
              600: '#9a9aa3',
              700: '#b4b4bc',
              800: '#d8d8de',
              900: '#f4f4f5',
              DEFAULT: '#27272a',
              foreground: '#e4e4e7',
            },
            success: {
              50: '#021a14',
              100: '#042f24',
              200: '#064e3b',
              300: '#047857',
              400: '#059669',
              500: '#4ade80',
              600: '#6ee7b7',
              700: '#a7f3d0',
              800: '#c0dcc8',
              900: '#d1fae5',
              DEFAULT: '#4ade80',
              foreground: '#09090b',
            },
            danger: {
              50: '#1a0810',
              100: '#2d0f18',
              200: '#4c1524',
              300: '#9f1239',
              400: '#e11d48',
              500: '#f43f5e',
              600: '#fb7185',
              700: '#fda4af',
              800: '#fecdd3',
              900: '#ffe4e6',
              DEFAULT: '#f43f5e',
              foreground: '#ffe4e6',
            },
          },
        },
      },
    }),
  ],
};
