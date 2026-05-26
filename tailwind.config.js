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
        canvas: '#09090b',
        ink: '#fafafa',
        body: '#e4e4e7',
        muted: {
          DEFAULT: '#a1a1aa',
          soft: '#71717a',
        },
        hairline: {
          DEFAULT: 'rgba(250, 250, 250, 0.12)',
          soft: 'rgba(250, 250, 250, 0.06)',
        },
        surface: {
          soft: '#18181b',
          card: '#27272a',
          strong: '#3f3f46',
          dark: '#09090b',
          'dark-elevated': '#18181b',
        },
        brand: {
          accent: '#10b981',
          primary: '#065f46',
          'primary-active': '#047857',
        },
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: '#065f46',
          foreground: '#ffffff',
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
          primary: '#ecfdf5',
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
        glow: '0 0 0 1px rgba(143, 181, 168, 0.14), 0 4px 16px rgba(42, 61, 54, 0.22)',
      },
    },
  },
  plugins: [nextui()],
};
