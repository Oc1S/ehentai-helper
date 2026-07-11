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
  plugins: ['react', '@typescript-eslint', 'react-hooks', 'prettier', 'simple-import-sort'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'simple-import-sort/imports': [
      'warn',
      {
        groups: [['^\\u0000'], ['^node:'], ['^react', '^@?\\w'], ['^'], ['^\\.']],
      },
    ],
    'simple-import-sort/exports': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    'import/no-named-as-default': 'off',
    'import/named': 'off',
    'prefer-const': 'off',
    'react/react-in-jsx-scope': 'off',
    'import/no-unresolved': 'off',
    'react-hooks/exhaustive-deps': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'react/self-closing-comp': 'warn',
    'react/prop-types': 'off',
    'react/display-name': 'off',
  },
  globals: {
    chrome: 'readonly',
  },
  ignorePatterns: ['watch.js', 'dist/**', 'build/**', 'mode_modules', '.plasmo'],
};
