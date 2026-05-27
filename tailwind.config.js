const { nextui } = require('@nextui-org/react');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
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
        primaryBlue: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          DEFAULT: '#0EA5E9',
          foreground: '#1a1a1a',
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
      },
      borderRadius: {
        'cal-xs': '4px',
        'cal-sm': '6px',
        'cal-md': '8px',
        'cal-lg': '12px',
        'cal-xl': '16px',
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
    // NextUI 构建期无法解析 CSS 变量，色值须与 src/styles/tokens.css 保持同步
    nextui({
      themes: {
        dark: {
          colors: {
            background: '#09090b',
            foreground: '#e4e4e7',
            focus: '#d4af37',
            primary: {
              50: '#fffbeb',
              100: '#fef3c7',
              200: '#fde68a',
              300: '#fcd34d',
              400: '#fbbf24',
              500: '#eab308',
              600: '#ca8a04',
              700: '#a16207',
              800: '#854d0e',
              900: '#713f12',
              DEFAULT: '#b8860b',
              foreground: '#09090b',
            },
            default: {
              50: '#fafafa',
              100: '#f4f4f5',
              200: '#e4e4e7',
              300: '#d4d4d8',
              400: '#a1a1aa',
              500: '#71717a',
              600: '#52525b',
              700: '#3f3f46',
              800: '#27272a',
              900: '#18181b',
              DEFAULT: '#1c1c1f',
              foreground: '#e4e4e7',
            },
          },
        },
      },
    }),
  ],
};
