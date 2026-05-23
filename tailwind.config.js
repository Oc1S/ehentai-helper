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
        canvas: '#040608',
        ink: '#f4f4f5',
        body: '#d4d4d8',
        muted: {
          DEFAULT: '#a1a1aa',
          soft: '#71717a',
        },
        hairline: {
          DEFAULT: 'rgba(255, 255, 255, 0.14)',
          soft: 'rgba(255, 255, 255, 0.08)',
        },
        surface: {
          soft: '#0f1115',
          card: '#141820',
          strong: '#1e2430',
          dark: '#101010',
          'dark-elevated': '#1a1a1a',
        },
        brand: {
          accent: '#3b82f6',
          primary: '#f4f4f5',
          'primary-active': '#e4e4e7',
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
          primary: '#111111',
          dark: '#ffffff',
          'dark-soft': '#a1a1aa',
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
        card: '0 1px 2px rgba(0, 0, 0, 0.3)',
        'card-elevated': '0 4px 12px rgba(0, 0, 0, 0.4)',
        pill: '0 1px 2px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [nextui()],
};
