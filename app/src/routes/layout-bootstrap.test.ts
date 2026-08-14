// @vitest-environment jsdom

/**
 * The shell is actually wired to the route (T10, narrowed by T14).
 *
 * `shell.test.ts` covers §13.3's branches with injected dependencies, and
 * `cold-start.test.ts` covers the sequence itself. Neither would notice if
 * `+layout.svelte` stopped rendering `Shell`, or if the shell stopped reaching
 * for the real store — and that gap is exactly the Phase 0 failure mode: every
 * unit green, the store never hydrated, and a completion gone after a reload.
 *
 * So this file mounts the real layout with no injection at all. The manifest
 * fetch fails here (there is no `caches` in jsdom), which is itself the point:
 * hydration is independent of it and must still happen.
 */

import 'fake-indexeddb/auto';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '$lib/components/test-harness.svelte.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<main>page</main>' }));

beforeEach(async () => {
	progress.reset();
	progress.writable = true;
	content.reset();
	ui.reset();
	await store.close();
});

afterEach(cleanup);

describe('the root layout', () => {
	it('hydrates the user state store on mount', async () => {
		expect(store.hydrated).toBe(false);

		render(Layout, { children });
		// Hydration is a transaction; the effect that starts it cannot finish
		// synchronously and the shell renders before it does, by design.
		await vi.waitFor(() => expect(store.hydrated).toBe(true));
	});

	it('puts its chrome up immediately, before anything has resolved', () => {
		const { container } = render(Layout, { children });
		expect(container.querySelector('nav')).not.toBeNull();
		expect(container.textContent).toContain('page');
	});
});
