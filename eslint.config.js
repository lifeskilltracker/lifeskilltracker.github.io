import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Root ESLint flat config. Each task adds a disjoint `no-restricted-imports`
 * slice for the §14.1 forbidden edge it owns — T06 layout, T07 content, T09
 * components, T11a scoring. Serialize edits to this file.
 *
 * Together these are §14.7's first and sixth enforcement items: a boundary
 * nobody checks is a comment.
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

/**
 * T06 — layout purity (§14.1 forbidden edges for lib/layout).
 *
 * The Layout Engine is a pure function with no framework, DOM, or I/O (§8), and
 * §14.1 forbids `lib/layout ⇢ lib/state` outright: user state must not reach the
 * signature, or completing a milestone could trigger a re-layout (§8.6, §9.3).
 * `purity.test.ts` asserts the same thing over the file contents; this rule is
 * the half that fires in the editor.
 */
/** @type {import('eslint').Linter.Config} */
const layoutRestrictions = {
  files: ['app/src/lib/layout/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [],
        patterns: [
          {
            group: ['$lib/state', '$lib/state/*', '../state', '../state/*', './state/*'],
            message:
              '§14.1: lib/layout must not import lib/state — layout never depends on user state (§8.6).',
          },
          {
            group: ['svelte', 'svelte/*', '$app', '$app/*', '$lib/content', '$lib/content/*'],
            message:
              '§14.3: lib/layout is a pure engine — no framework, no DOM, no I/O.',
          },
        ],
      },
    ],
  },
};

/**
 * T07 — §14.7's second `no-restricted-imports` rule, confining cross-subsystem
 * orchestration to `lib/actions`. The two I/O owners may not import each other:
 * that is what keeps "the only content reader" and "the only user-data writer"
 * true statements rather than aspirations. Without this the newest forbidden
 * pair in §14.1 is a diagram rather than a constraint.
 */
/** @type {import('eslint').Linter.Config} */
const contentRestrictions = {
  files: ['app/src/lib/content/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [],
        patterns: [
          {
            group: ['$lib/state', '$lib/state/*', '../state', '../state/*'],
            message:
              '§14.1: lib/content may not import lib/state — the startSkill → pin sequence belongs to lib/actions.',
          },
        ],
      },
    ],
  },
};

/**
 * T09 — §14.1's `lib/components ⇢ lib/state` forbidden edge. Components
 * importing the store directly would create writers outside §12.4's single
 * path; scores and progress arrive as derived values through props (§13.4).
 */
/** @type {import('eslint').Linter.Config} */
const componentRestrictions = {
  files: ['app/src/lib/components/**/*.{ts,svelte}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [],
        patterns: [
          {
            group: ['$lib/state', '$lib/state/*', '../state', '../state/*', '../../state/*'],
            message:
              '§14.1: components must not import lib/state — progress arrives as props (§13.4).',
          },
        ],
      },
    ],
  },
};

/**
 * T11a — scoring purity (§14.1 forbidden edges for lib/scoring).
 *
 * `lib/scoring ⇢ lib/content` is forbidden outright: an engine that did I/O
 * would stop being testable as arithmetic, and §11's invariants are only
 * checkable because scoring is arithmetic over its two arguments.
 */
/** @type {import('eslint').Linter.Config} */
const scoringRestrictions = {
  files: ['app/src/lib/scoring/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [],
        patterns: [
          {
            group: ['$lib/content', '$lib/content/*', '../content', '../content/*'],
            message:
              '§14.1: lib/scoring must not import lib/content — scoring does no I/O (§14.4).',
          },
          {
            group: ['$lib/state', '$lib/state/*', '../state', '../state/*'],
            message:
              '§14.1: lib/scoring must not import lib/state — the store produces TreeProgress and passes it in.',
          },
          {
            group: ['svelte', 'svelte/*', '$app', '$app/*'],
            message: '§14.3: lib/scoring is a pure engine — no framework, no DOM.',
          },
        ],
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
  contentRestrictions,
  componentRestrictions,
  scoringRestrictions,
);
