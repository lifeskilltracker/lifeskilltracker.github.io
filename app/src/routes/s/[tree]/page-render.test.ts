// @vitest-environment jsdom

/**
 * The rendered skill page (T08).
 *
 * `page.test.ts` covers resolution — which tree, and what happens when there
 * isn't one. This covers the half that had no automated coverage at all until
 * now: that the page actually puts a tree on the screen, and that opening it
 * registers the bundle with the store, without which the first click on any
 * milestone rejects with `TreeNotOpenError`.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundleFixture } from '$lib/content/fixtures/bundles.js';
import { auditAccessibility } from '$lib/components/axe.js';
import { cleanup, render } from '$lib/components/test-harness.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import type { CompiledTree } from '$lib/types';
import SkillPage from './+page.svelte';
import type { SkillPageData } from './+page.js';

let counter = 0;

function tree(): CompiledTree {
	return bundleFixture({ id: `page-${(counter += 1)}` }) as unknown as CompiledTree;
}

function pageData(bundle: CompiledTree): SkillPageData {
	return { treeId: bundle.id, tree: bundle, unavailable: null, reason: null, offline: false };
}

beforeEach(async () => {
	progress.reset();
	progress.writable = true;
	progress.hydrated = true;
	await store.close();
});

afterEach(cleanup);

describe('/s/[tree] — the rendered page', () => {
	it('puts all ten levels on the screen', () => {
		const bundle = tree();
		const { container } = render(SkillPage, { data: pageData(bundle) });

		const bands = [...container.querySelectorAll('.row[data-level]')];
		expect(bands).toHaveLength(10);
		expect(bands.map((b) => b.getAttribute('data-level'))).toEqual([
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
			'10'
		]);
		for (const band of bands) {
			expect(band.textContent).toContain(`Level ${band.getAttribute('data-level')}`);
		}
	});

	it('renders one node per milestone in the bundle', () => {
		const bundle = tree();
		const { container } = render(SkillPage, { data: pageData(bundle) });

		expect(container.querySelectorAll('.node[data-uid]')).toHaveLength(bundle.milestones.length);
	});

	it('registers the bundle with the store, so a completion can be written', async () => {
		const bundle = tree();
		render(SkillPage, { data: pageData(bundle) });

		await expect(
			store.setMilestoneState(bundle.milestones[0].uid, 'complete')
		).resolves.toBeUndefined();
	});

	/**
	 * §15.8's gate on the *composed* page (T20), not only on `TreeView` in
	 * isolation. Half of what axe checks is about a document — heading order,
	 * duplicate ids, landmark naming — and none of that is visible from a
	 * component test that mounts one subtree.
	 */
	it('passes the axe gate as a whole page (§15.8)', async () => {
		const bundle = tree();
		const { container } = render(SkillPage, { data: pageData(bundle) });

		expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
	});

	it('passes the axe gate with a milestone panel open', async () => {
		const bundle = tree();
		const { container } = render(SkillPage, {
			data: pageData(bundle),
			openUid: bundle.milestones[0].uid
		});

		await auditAccessibility(container);
	});

	it('still reports an unavailable tree rather than a blank page (§7.4, §16.3)', () => {
		const { container } = render(SkillPage, {
			data: {
				treeId: 'nope',
				tree: null,
				unavailable: 'not in the manifest',
				reason: 'unreachable' as const,
				offline: false
			}
		});

		expect(container.textContent).toContain('Skill unavailable');
		expect(container.querySelector('.node[data-uid]')).toBeNull();
	});
});
