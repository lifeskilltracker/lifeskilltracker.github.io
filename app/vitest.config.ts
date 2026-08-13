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
		environment: 'node'
	},
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined
});
