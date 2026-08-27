import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/**
 * `resolve.conditions: ['browser']` is what lets a component test mount a real
 * Svelte 5 component: without it Vite resolves `svelte` to its server export,
 * whose `mount` throws. It is scoped to test runs so the production build is
 * untouched.
 *
 * The default environment stays `node` — the engines, the loader, and the store
 * are all testable without a DOM and paying for jsdom in 170 files to serve a
 * handful would be a poor trade. Component tests opt in per file with
 * `// @vitest-environment jsdom`.
 */
export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		/**
		 * Above vitest's 5 s default, and deliberately.
		 *
		 * §15.8's axe gate runs a full accessibility audit over a mounted page, and
		 * the whole-page audits (`page-render.test.ts`, `data-page.a11y.test.ts`)
		 * take upwards of four seconds *on their own* — axe is CPU-bound and the
		 * files run in parallel with everything else, so the wall time each one
		 * sees depends on what else the pool happens to be doing. At the default
		 * they passed alone and failed in a full run, which is the worst possible
		 * shape for a gate: a red CI that is not about the change.
		 *
		 * The number is a ceiling, not a budget. Nothing waits for it in the
		 * ordinary case, and a test that genuinely hangs still fails.
		 */
		testTimeout: 20_000
	},
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined
});
