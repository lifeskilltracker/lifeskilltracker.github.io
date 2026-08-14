// @vitest-environment jsdom

/**
 * `/s/<treeId>/m/<slug>` — the deep link (T14, §13.1, §5.4).
 *
 * §13.1 chose the slug over the uid knowing the cost: slugs are mutable, so
 * every one of these cases is a consequence of that choice rather than an edge
 * case around it. The two that must not regress are the **alias** hit — the
 * whole reason `aliases` is carried in the compiled bundle — and the
 * **unresolvable** miss, which opens the tree rather than 404ing, because the
 * user asked for a skill that exists.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '$lib/components/test-harness.svelte.js';
import { bundleFixture } from '$lib/content/fixtures/bundles.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { CompiledTree } from '$lib/types';
import MilestonePage from './+page.svelte';
import { resolveMilestoneUid, type MilestonePageData } from './+page.js';

let counter = 0;

/**
 * A tree whose first milestone was renamed: its current slug is `forge-a-leaf`
 * and `hammer-a-leaf` is the name links in the wild still use (§5.4).
 */
function renamedTree(): CompiledTree {
	const tree = bundleFixture({ id: `deep-${(counter += 1)}` }) as unknown as CompiledTree;
	tree.milestones[0].id = 'forge-a-leaf';
	tree.milestones[0].aliases = ['hammer-a-leaf'];
	return tree;
}

function pageData(tree: CompiledTree | null, slug: string): MilestonePageData {
	return {
		page: {
			treeId: tree?.id ?? 'nope',
			tree,
			unavailable: tree === null ? 'not in the manifest' : null,
			reason: tree === null ? ('unreachable' as const) : null,
			offline: false
		},
		slug,
		uid: tree === null ? null : resolveMilestoneUid(tree, slug)
	};
}

beforeEach(async () => {
	progress.reset();
	progress.writable = true;
	progress.hydrated = true;
	ui.reset();
	await store.close();
});

afterEach(cleanup);

describe('resolveMilestoneUid', () => {
	it('resolves a current slug', () => {
		const tree = renamedTree();
		expect(resolveMilestoneUid(tree, 'forge-a-leaf')).toBe(tree.milestones[0].uid);
	});

	it('resolves an old slug through the aliases list (§5.4)', () => {
		const tree = renamedTree();
		expect(resolveMilestoneUid(tree, 'hammer-a-leaf')).toBe(tree.milestones[0].uid);
	});

	it('returns null for a slug in neither', () => {
		expect(resolveMilestoneUid(renamedTree(), 'never-existed')).toBeNull();
	});

	it('prefers a live slug over another milestone’s alias', () => {
		const tree = renamedTree();
		// The second milestone once went by the first's *current* name.
		tree.milestones[1].aliases = ['forge-a-leaf'];

		expect(resolveMilestoneUid(tree, 'forge-a-leaf')).toBe(tree.milestones[0].uid);
	});
});

describe('the rendered deep link', () => {
	it('opens the panel for the named milestone', () => {
		const tree = renamedTree();
		const { container } = render(MilestonePage, { data: pageData(tree, 'forge-a-leaf') });

		const panel = container.querySelector('.milestone-panel');
		expect(panel).not.toBeNull();
		expect(panel?.textContent).toContain(tree.milestones[0].title);
		expect(container.querySelector('[data-page-notice]')).toBeNull();
	});

	it('opens the same panel from a renamed slug', () => {
		const tree = renamedTree();
		const { container } = render(MilestonePage, { data: pageData(tree, 'hammer-a-leaf') });

		expect(container.querySelector('.milestone-panel')?.textContent).toContain(
			tree.milestones[0].title
		);
	});

	it('records the open panel in §13.2’s ui store, so the URL and the panel agree', () => {
		const tree = renamedTree();
		render(MilestonePage, { data: pageData(tree, 'forge-a-leaf') });

		expect(ui.panel).toEqual({ treeId: tree.id, uid: tree.milestones[0].uid });
	});

	it('opens the tree with a notice for an unresolvable slug — never a 404', () => {
		const tree = renamedTree();
		const { container } = render(MilestonePage, { data: pageData(tree, 'never-existed') });

		const notice = container.querySelector('[data-page-notice]');
		expect(notice).not.toBeNull();
		expect(notice?.textContent).toContain('never-existed');

		// The tree itself is on screen: the valid half of the request is honoured.
		expect(container.querySelectorAll('.node[data-uid]')).toHaveLength(tree.milestones.length);
		expect(container.querySelector('.milestone-panel')).toBeNull();
	});

	it('still reports an unavailable tree rather than a milestone notice', () => {
		const { container } = render(MilestonePage, { data: pageData(null, 'forge-a-leaf') });

		expect(container.textContent).toContain('Skill unavailable');
		expect(container.querySelector('[data-page-notice]')).toBeNull();
	});
});
