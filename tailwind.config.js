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
        canvas: '#0c0a09',
        ink: '#fafaf9',
        body: '#e7e5e4',
        muted: {
          DEFAULT: '#a8a29e',
          soft: '#78716c',
        },
        hairline: {
          DEFAULT: 'rgba(250, 250, 249, 0.14)',
          soft: 'rgba(250, 250, 249, 0.07)',
        },
        surface: {
          soft: '#1c1917',
          card: '#292524',
          strong: '#44403c',
          dark: '#0c0a09',
          'dark-elevated': '#1c1917',
        },
        brand: {
          accent: '#2dd4bf',
          primary: '#14b8a6',
          'primary-active': '#0d9488',
        },
        primary: {
          50: '#E6FFFA',
          100: '#B2F5EA',
          200: '#81E6D9',
          300: '#4FD1C5',
          400: '#38B2AC',
          500: '#09B6A2',
          600: '#0C9488',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          DEFAULT: '#09B6A2',
          foreground: '#1a1a1a',
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
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        on: {
          primary: '#042f2e',
          dark: '#fafaf9',
          'dark-soft': '#a8a29e',
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
        card: '0 1px 3px rgba(0, 0, 0, 0.35)',
        'card-elevated': '0 8px 24px rgba(0, 0, 0, 0.45)',
        pill: '0 1px 2px rgba(0, 0, 0, 0.25)',
        glow: '0 0 0 1px rgba(45, 212, 191, 0.15), 0 4px 16px rgba(20, 184, 166, 0.12)',
      },
    },
  },
  plugins: [nextui()],
};
