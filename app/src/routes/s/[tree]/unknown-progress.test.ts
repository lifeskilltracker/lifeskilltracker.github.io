// @vitest-environment jsdom

/**
 * Unknown progress is not zero progress (T14, §13.3, T26/F23).
 *
 * This is the display-side twin of §13.3's "read as empty, then wrote".
 * `store.progressFor` is **total** — it returns empty maps for an unstarted tree
 * — so a view that does not branch on `store.hydrated` renders an unhydrated
 * store as "Level 0 — not yet ranked", which tells the user their progress is
 * gone rather than that it could not be read.
 *
 * Two moments have to be right, and only the first is obvious: permanently
 * after a hydration failure, and transiently during the first paint of a cold
 * deep link, when §13.3 step 4 has not yet run.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, flushSync, render } from '$lib/components/test-harness.svelte.js';
import { bundleFixture } from '$lib/content/fixtures/bundles.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { CompiledTree } from '$lib/types';
import SkillPage from './+page.svelte';
import type { SkillPageData } from './+page.js';

let counter = 0;

const tree = (): CompiledTree =>
	bundleFixture({ id: `unknown-${(counter += 1)}` }) as unknown as CompiledTree;

const pageData = (bundle: CompiledTree): SkillPageData => ({
	treeId: bundle.id,
	tree: bundle,
	unavailable: null,
	reason: null,
	offline: false
});

beforeEach(async () => {
	progress.reset();
	ui.reset();
	await store.close();
});

afterEach(cleanup);

describe('a tree route rendered without hydration', () => {
	it('says the progress is unknown rather than showing level 0', () => {
		// §13.3's failure branch: hydrated false, writable latched false.
		progress.hydrated = false;
		progress.writable = false;

		const { container } = render(SkillPage, { data: pageData(tree()) });

		const standing = container.querySelector('[data-standing]');
		expect(standing?.textContent).toContain('Progress unknown');
		expect(standing?.textContent).not.toContain('Level 0');
		expect(standing?.getAttribute('data-known')).toBe('false');
	});

	it('says why, rather than describing a level the user has not got', () => {
		progress.hydrated = false;
		progress.writable = false;

		const { container } = render(SkillPage, { data: pageData(tree()) });

		expect(container.querySelector('[data-to-next]')?.textContent).toContain(
			'could not read your saved progress'
		);
	});

	it('does not paint a zeroed tree on the first paint of a cold deep link', () => {
		// Nothing has resolved: §13.3 runs route data after first paint, so this
		// is exactly the state a deep-linked tree renders in before hydration.
		expect(store.hydrated).toBe(false);

		const { container } = render(SkillPage, { data: pageData(tree()) });

		expect(container.querySelector('[data-standing]')?.textContent).toContain(
			'Progress unknown'
		);
		// The tree itself renders — content does not wait on user state.
		expect(container.querySelectorAll('.node[data-uid]').length).toBeGreaterThan(0);
	});

	it('switches to a real standing the moment hydration lands', () => {
		const { container, props } = render(SkillPage, { data: pageData(tree()) });
		expect(container.querySelector('[data-standing]')?.textContent).toContain(
			'Progress unknown'
		);

		progress.hydrated = true;
		flushSync();
		void props;

		const standing = container.querySelector('[data-standing]');
		expect(standing?.getAttribute('data-known')).toBe('true');
		// An unstarted skill, honestly: level 0 is a real answer once it is read.
		expect(standing?.textContent).toContain('Level 0 — not yet ranked');
	});
});
