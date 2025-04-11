const { nextui } = require('@nextui-org/react');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['../../node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#3B096C',
          100: '#520F83',
          200: '#7318A2',
          300: '#9823C2',
          400: '#c031e2',
          500: '#DD62ED',
          600: '#F182F6',
          700: '#FCADF9',
          800: '#FDD5F9',
          900: '#FEECFE',
          DEFAULT: '#DD62ED',
          foreground: '#ffffff',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [nextui()],
};
