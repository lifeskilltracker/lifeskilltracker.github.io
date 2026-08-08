import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Root ESLint flat config. T06 and T11a add disjoint no-restricted-imports slices
 * to the layout and scoring blocks below; serialize edits to this file.
 */

/** @type {import('eslint').Linter.Config} */
const baseRestrictions = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [],
        patterns: [],
      },
    ],
  },
};

/** T06 — layout purity (§14.1 forbidden edges for lib/layout) */
/** @type {import('eslint').Linter.Config} */
const layoutRestrictions = {
  files: ['app/src/lib/layout/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [],
        patterns: [],
      },
    ],
  },
};

/** T11a — scoring purity (§14.1 forbidden edges for lib/scoring) */
/** @type {import('eslint').Linter.Config} */
const scoringRestrictions = {
  files: ['app/src/lib/scoring/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [],
        patterns: [],
      },
    ],
  },
};

/** Node globals for config files executed by Node (no extra dependency). */
const nodeGlobals = {
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  clearImmediate: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  exports: 'readonly',
  global: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setImmediate: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
};

/** @type {import('eslint').Linter.Config} */
const nodeConfigFiles = {
  files: ['*.config.js', 'app/*.config.js'],
  languageOptions: {
    globals: nodeGlobals,
  },
};

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/build/**', '**/.svelte-kit/**', '**/dist/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  nodeConfigFiles,
  baseRestrictions,
  layoutRestrictions,
  scoringRestrictions,
);
