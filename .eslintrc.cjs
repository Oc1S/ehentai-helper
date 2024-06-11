module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    // 'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint', 'react-hooks', 'import', 'jsx-a11y', 'prettier', 'simple-import-sort'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    'react/react-in-jsx-scope': 'off',
    'import/no-unresolved': 'off',
    'react-hooks/exhaustive-deps': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    'react/self-closing-comp': 'warn',
  },
  globals: {
    chrome: 'readonly',
  },
  ignorePatterns: ['watch.js', 'dist/**'],
};