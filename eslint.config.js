import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  // browser app code (and its tests, which run in jsdom). GLOBALS is the
  // config injected as an inline <script> by scripts/generate_no_js.js -
  // read-only everywhere except freezeGlobals.js below
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        GLOBALS: 'readonly',
      },
    },
  },
  // the one module that legitimately reassigns GLOBALS (to its frozen copy)
  {
    files: ['src/freezeGlobals.js'],
    languageOptions: {
      globals: {
        GLOBALS: 'writable',
      },
    },
  },
  // build-time Node scripts and tool config
  {
    files: ['scripts/**/*.js', '*.config.js', 'vitest.setup.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // their tests run in vitest's jsdom environment, so parse output with DOMParser
  {
    files: ['scripts/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  prettierConfig,
];
