// @vitest-environment jsdom

/**
 * The shell hydrates (T10).
 *
 * `bootstrap.test.ts` proves the sequence works; this proves something calls
 * it. That gap is exactly the Phase 0 failure mode — every unit green, the
 * store never hydrated, and a completion gone after a reload — so it is worth
 * a test of its own rather than trusting a line in a layout.
 */

import 'fake-indexeddb/auto';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, flushSync, render } from '$lib/components/test-harness.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<main>page</main>' }));

beforeEach(async () => {
	progress.reset();
	progress.writable = true;
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

	it('renders its page whether or not hydration has landed', () => {
		const { container } = render(Layout, { children });
		expect(container.querySelector('main')).not.toBeNull();
	});

	it('says so when the session is not writable, rather than looking normal', async () => {
		const { container } = render(Layout, { children });
		await vi.waitFor(() => expect(store.hydrated).toBe(true));
		expect(container.querySelector('[data-degraded]')).toBeNull();

		// §13.3's latch, set by a hydration failure and never cleared.
		progress.writable = false;
		flushSync();
		expect(container.querySelector('[data-degraded]')).not.toBeNull();
	});
});
