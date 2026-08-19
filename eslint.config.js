import eslint from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
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

/**
 * T14 — §13.4's two view-layer rules, which are the ones §14.7 says are
 * "checkable by inspection" and therefore worth making checkable by machine.
 *
 * **No route imports the Scoring Engine.** Scores arrive as derived values
 * through props; the derivations live in `lib/actions`, which is where §14.1
 * puts anything that needs both a manifest and a `SKILL` row (T26/F4).
 *
 * **`TreeView` is the only component that consumes the Layout Engine.** It
 * consumes it as a *prop*, so what this rule actually enforces is that nobody
 * else calls `layoutTree` from the view layer at all — §8.6 requires that
 * toggling a milestone never re-runs layout, and the call site is in
 * `lib/actions/tree-session.svelte.ts` where user state cannot reach it.
 *
 * The component rules restate T09's `lib/state` pattern because
 * `no-restricted-imports` replaces wholesale rather than merging: a later config
 * object listing only the layout pattern would silently drop the state one.
 */
const STATE_PATTERN = {
  group: ['$lib/state', '$lib/state/*', '../state', '../state/*', '../../state/*'],
  message: '§14.1: components must not import lib/state — progress arrives as props (§13.4).',
};

const LAYOUT_PATTERN = {
  group: ['$lib/layout', '$lib/layout/*'],
  message:
    '§13.4: TreeView is the only component that consumes the Layout Engine, and it consumes it as a prop — the call belongs in lib/actions (§8.6).',
};

const SCORING_PATTERN = {
  group: ['$lib/scoring', '$lib/scoring/*'],
  message:
    '§13.4: routes must not import the Scoring Engine — scores arrive as derived props from lib/actions (T26/F4).',
};

/** @type {import('eslint').Linter.Config} */
const viewLayoutRestrictions = {
  files: ['app/src/lib/components/**/*.{ts,svelte}'],
  // TreeView consumes the engine's *type*; a test may build a layout to hand it
  // one, which is the fixture, not the forbidden edge.
  ignores: ['app/src/lib/components/TreeView.svelte', 'app/src/lib/components/**/*.test.ts'],
  rules: {
    'no-restricted-imports': ['error', { paths: [], patterns: [STATE_PATTERN, LAYOUT_PATTERN] }],
  },
};

/** @type {import('eslint').Linter.Config} */
const routeRestrictions = {
  files: ['app/src/routes/**/*.{ts,svelte}'],
  ignores: ['app/src/routes/**/*.test.ts'],
  rules: {
    'no-restricted-imports': ['error', { paths: [], patterns: [LAYOUT_PATTERN, SCORING_PATTERN] }],
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

/**
 * T20 — §15.8's driven keyboard pass (`app/a11y/`). Node scripts, so they get
 * the Node globals; and they carry browser globals too, because the bodies
 * passed to `page.evaluate` are serialised and run inside the page. Those
 * closures are the one place in this repository where Node and DOM globals are
 * legitimately in the same file.
 */
const a11yHarness = {
  files: ['app/a11y/**/*.mjs'],
  languageOptions: {
    globals: {
      ...nodeGlobals,
      URL: 'readonly',
      document: 'readonly',
      getComputedStyle: 'readonly',
      window: 'readonly',
      // T35's two composed-surface audits reach for two more of them: the
      // once-ever reveal flag lives in `localStorage`, and "did this move in one
      // frame or over 420 ms" is a question only `requestAnimationFrame` can ask.
      localStorage: 'readonly',
      requestAnimationFrame: 'readonly',
    },
  },
};

/**
 * T08 — components arrive as `.svelte` files, and the TypeScript parser cannot
 * read one. Without the Svelte parser the `lib/components ⇢ lib/state` rule
 * above applies to a set of files that does not include a single component,
 * which is the same as not having it: §14.1's forbidden edge is only checkable
 * where components actually live.
 */
/** @type {import('eslint').Linter.Config[]} */
const svelteFiles = [
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // TypeScript already resolves DOM globals in a component, and
      // `npm run typecheck` runs `svelte-check` over exactly these files.
      // ESLint's own scope analysis has no lib.dom, so leaving it on reports
      // `HTMLElement` as undefined — noise, not a finding.
      'no-undef': 'off',
    },
  },
];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/build/**', '**/.svelte-kit/**', '**/dist/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelteFiles,
  nodeConfigFiles,
  a11yHarness,
  baseRestrictions,
  layoutRestrictions,
  contentRestrictions,
  componentRestrictions,
  scoringRestrictions,
  viewLayoutRestrictions,
  routeRestrictions,
);
