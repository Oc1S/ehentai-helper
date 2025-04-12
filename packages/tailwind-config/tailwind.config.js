const { nextui } = require('@nextui-org/react');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['../../node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
    },
  },
  darkMode: 'class',
  plugins: [nextui()],
};
