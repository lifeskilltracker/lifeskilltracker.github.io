// @vitest-environment jsdom

/**
 * §9.4's milestone panel, driven end to end against the real store (T19).
 *
 * `TreeView.test.ts` covers the intercept as a *component* contract: given a
 * blocked tree, which clicks produce which warning and which intent. This file
 * asks the question that one cannot — **did anything get written?** — by wiring
 * the panel's intents through the real `TreeSession` into the real
 * `UserStateStore` over `fake-indexeddb`, and spying on `setMilestoneState`
 * itself. §11.10's promise is that the user is told the consequence *before* the
 * action commits, and "before it commits" is a claim about the write path, not
 * about the wording.
 *
 * **Two placement decisions, both forced rather than chosen.**
 *
 * The panel is inside `TreeView.svelte` rather than in a `MilestonePanel.svelte`
 * of its own: T08 built it there, §9.4 describes it as part of the renderer, and
 * splitting it out now would move markup with no behaviour attached to the move.
 * The file keeps the name the task doc gave it because the subject is the panel,
 * not the tree.
 *
 * The file lives under the route rather than beside the component because
 * §14.1 forbids anything in `lib/components` from importing `lib/state` — and
 * `eslint.config.js` enforces that on tests too, deliberately: a component test
 * that reached the store would be testing more than a component. This is the
 * skill page's wiring, so it sits where the wiring does, next to
 * `SkillPage.svelte`.
 */

import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutTree } from '$lib/layout';
import { scoreSkill } from '$lib/scoring';
import { makeScoringTree, uidOf } from '$lib/scoring/fixtures.js';
import { openTreeSession, type TreeSession } from '$lib/actions/tree-session.svelte.js';
import { exportPrompt } from '$lib/state/export-prompt.svelte.js';
import { progress as progressStore } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { CompiledTree } from '$lib/types';
import TreeView from '$lib/components/TreeView.svelte';
import { cleanup, click, flushSync, render } from '$lib/components/test-harness.svelte.js';

afterEach(cleanup);

let counter = 0;

beforeEach(async () => {
	progressStore.reset();
	progressStore.writable = true;
	progressStore.hydrated = true;
	ui.reset();
	exportPrompt.reset();
	await store.close();
	vi.restoreAllMocks();
});

/**
 * Level 1 is one `all` group; level 2 holds one `all` group and one `n_of`;
 * level 3 sits above the blocker. Those are the three cases §11.10's dismissal
 * rule distinguishes, and completing level 1 puts the blocker at level 2.
 */
function blockedTree(): CompiledTree {
	return makeScoringTree({
		id: `panel-${(counter += 1)}`,
		levels: [
			{ level: 1, milestones: ['a', 'b'] },
			{
				level: 2,
				milestones: ['c', 'd', 'e', 'f'],
				requirements: [
					{ rule: 'all', milestones: ['c', 'd'] },
					{ rule: 'n_of', n: 1, milestones: ['e', 'f'] }
				]
			},
			{ level: 3, milestones: ['g', 'h'] }
		]
	});
}

interface Harness {
	container: HTMLElement;
	session: TreeSession;
	tree: CompiledTree;
	/** Awaits whatever the last click set in motion, then repaints from the store. */
	settle(): Promise<void>;
	open(slug: string): void;
	act(action: string): void;
}

/**
 * Mounts the renderer over a live session, exactly as `SkillPage` does: values
 * down, intents up, and the store between them. Nothing here stubs the write
 * path — a test that did could not tell "warned first" from "wrote anyway".
 */
async function mountOverStore(tree: CompiledTree, complete: string[]): Promise<Harness> {
	const session = openTreeSession(tree);
	await session.ready;
	for (const slug of complete) {
		await session.apply({ kind: 'complete', uid: uidOf(tree, slug) });
	}

	let pending: Promise<void> = Promise.resolve();

	const view = render(TreeView, {
		tree,
		positions: layoutTree(tree, 'wide'),
		progress: session.progress,
		viewport: 'wide' as const,
		hidden: session.hidden,
		uncheckConsequence: (uid: string) => session.uncheckConsequence(uid),
		onintent: (intent: Parameters<TreeSession['apply']>[0]) => {
			pending = session.apply(intent).catch(() => undefined);
		}
	});

	const settle = async (): Promise<void> => {
		await pending;
		view.props.progress = session.progress;
		view.props.hidden = session.hidden;
		flushSync();
	};

	return {
		container: view.container,
		session,
		tree,
		settle,
		open(slug: string) {
			const node = view.container.querySelector(`.node[data-uid="${uidOf(tree, slug)}"]`);
			if (node === null) throw new Error(`no rendered node for "${slug}"`);
			click(node);
		},
		act(action: string) {
			const button = view.container.querySelector(`[data-action="${action}"]`);
			if (button === null) throw new Error(`no "${action}" control on screen`);
			click(button);
		}
	};
}

/** Every field the score is made of, for a byte-for-byte comparison. */
function scoreOf(tree: CompiledTree) {
	const result = scoreSkill(tree, store.progressFor(tree.id));
	return {
		attainedLevel: result.attainedLevel,
		cleared: result.cleared,
		tier: result.tier,
		blocker: result.blocker ?? null,
		levels: result.levels
	};
}

const stateOf = (tree: CompiledTree, slug: string) =>
	store.progressFor(tree.id).milestones.get(uidOf(tree, slug));

const nodeFor = (container: HTMLElement, tree: CompiledTree, slug: string) =>
	container.querySelector(`.node[data-uid="${uidOf(tree, slug)}"]`);

describe('§11.10 — the intercept runs before the write, not beside it', () => {
	it('has not called setMilestoneState while the warning is on screen', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);
		const spy = vi.spyOn(store, 'setMilestoneState');

		harness.open('c');
		harness.act('dismiss');
		await harness.settle();

		expect(harness.container.querySelector('.consequence')?.textContent).toContain(
			"Level 2 can't be completed without this"
		);
		expect(spy).not.toHaveBeenCalled();
		expect(stateOf(tree, 'c')).toBeUndefined();

		harness.act('confirm');
		await harness.settle();

		expect(spy).toHaveBeenCalledWith(uidOf(tree, 'c'), 'dismissed');
		expect(stateOf(tree, 'c')).toBe('dismissed');
	});

	it('writes immediately for an `n_of` milestone at the blocker — the intercept is conditional', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);
		const spy = vi.spyOn(store, 'setMilestoneState');

		harness.open('e');
		harness.act('dismiss');
		await harness.settle();

		expect(harness.container.querySelector('.consequence')).toBeNull();
		expect(spy).toHaveBeenCalledWith(uidOf(tree, 'e'), 'dismissed');
	});

	it('writes immediately above the blocker, where nothing further can be capped', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);
		const spy = vi.spyOn(store, 'setMilestoneState');

		harness.open('g');
		harness.act('dismiss');
		await harness.settle();

		expect(harness.container.querySelector('.consequence')).toBeNull();
		expect(spy).toHaveBeenCalledWith(uidOf(tree, 'g'), 'dismissed');
	});

	it('states the before and after level for an un-check, and holds the write until confirmed', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);
		const spy = vi.spyOn(store, 'setMilestoneState');

		harness.open('a');
		harness.act('undo');
		await harness.settle();

		const warning = harness.container.querySelector('.consequence');
		expect(warning?.textContent).toContain('from Level 1 to Level 0');
		expect(spy).not.toHaveBeenCalled();
		expect(stateOf(tree, 'a')).toBe('complete');

		harness.act('confirm');
		await harness.settle();

		expect(spy).toHaveBeenCalledWith(uidOf(tree, 'a'), null);
		expect(stateOf(tree, 'a')).toBeUndefined();
	});

	/**
	 * §11.10's second sentence is what makes the first tolerable: the user loses
	 * a rank, not their history. A level that was cleared stays cleared.
	 */
	it('leaves the surviving cleared levels alone after the un-check commits', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b', 'c', 'd', 'e']);

		expect(scoreOf(tree).attainedLevel).toBe(2);

		harness.open('a');
		harness.act('undo');
		await harness.settle();
		harness.act('confirm');
		await harness.settle();

		const after = scoreOf(tree);
		expect(after.attainedLevel).toBe(0);
		// Level 2's requirements are still met — the rank is gone, the work is not.
		expect(after.cleared).toContain(2);
	});
});

describe('§11.10 — "hide it instead" is the option that costs nothing', () => {
	it('writes no MilestoneState and moves no score field', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);
		const before = scoreOf(tree);
		const spy = vi.spyOn(store, 'setMilestoneState');

		harness.open('c');
		harness.act('dismiss');
		await harness.settle();
		harness.act('hide');
		await harness.settle();

		expect(spy).not.toHaveBeenCalled();
		expect(stateOf(tree, 'c')).toBeUndefined();
		expect(scoreOf(tree)).toEqual(before);
	});

	it('suppresses the milestone from view without removing it from its group', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);

		harness.open('c');
		harness.act('dismiss');
		await harness.settle();
		harness.act('hide');
		await harness.settle();

		expect(nodeFor(harness.container, tree, 'c')).toBeNull();
		// The denominator is the whole point: level 2's `all` group still needs
		// both `c` and `d` (§11.2, §11.10).
		const level2 = scoreOf(tree).levels.find((level) => level.level === 2);
		expect(level2?.groups[0].n).toBe(2);
		expect(level2?.groups[0].satisfied).toBe(false);
	});

	it('is reversible from the same view that performed it', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);

		harness.open('c');
		harness.act('dismiss');
		await harness.settle();
		harness.act('hide');
		await harness.settle();

		const reveal = harness.container.querySelector('[data-action="reveal-hidden"]');
		expect(reveal?.textContent).toContain('(1)');

		click(reveal!);
		flushSync();

		const node = nodeFor(harness.container, tree, 'c');
		expect(node?.getAttribute('data-hidden')).toBe('true');
		// Hiding says nothing about the milestone's state, so it must not borrow
		// `dismissed`'s presentation (§9.3).
		expect(node?.getAttribute('data-state')).toBe('available');

		harness.open('c');
		harness.act('unhide');
		await harness.settle();

		expect(harness.container.querySelector('[data-action="reveal-hidden"]')).toBeNull();
		expect(nodeFor(harness.container, tree, 'c')).not.toBeNull();
		expect(stateOf(tree, 'c')).toBeUndefined();
	});

	it('draws no edge into the empty space a hidden node left behind', async () => {
		const tree = makeScoringTree({
			id: `panel-edges-${(counter += 1)}`,
			levels: [{ level: 1, milestones: ['root', 'leaf'] }],
			requires: { leaf: ['root'] }
		});
		const harness = await mountOverStore(tree, []);

		expect(harness.container.querySelectorAll('.edge')).toHaveLength(1);

		harness.open('leaf');
		harness.act('hide');
		await harness.settle();

		expect(harness.container.querySelectorAll('.edge')).toHaveLength(0);
	});
});

describe('§9.3 — a dismissed milestone is set aside, not deleted', () => {
	it('renders the recessed fill, the dotted border, and the ✕ once dismissed', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);

		harness.open('e');
		harness.act('dismiss');
		await harness.settle();

		const node = nodeFor(harness.container, tree, 'e');
		expect(node?.getAttribute('data-state')).toBe('dismissed');
		expect(node?.classList.contains('is-dismissed')).toBe(true);
		expect(node?.querySelector('.node-box')?.getAttribute('stroke-dasharray')).toBe('1 4');
		expect(node?.querySelector('.state-glyph')?.getAttribute('href')).toBe('#glyph-dismissed');
	});

	it('is neither hidden nor struck through — in the DOM or in the stylesheet', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);

		harness.open('e');
		harness.act('dismiss');
		await harness.settle();

		const node = nodeFor(harness.container, tree, 'e') as SVGGElement;
		expect(node.getAttribute('hidden')).toBeNull();
		expect(node.getAttribute('display')).toBeNull();
		expect(getComputedStyle(node).display).not.toBe('none');

		// The rules are scoped styles that jsdom does not apply, so the guarantee is
		// asserted against the source. §9.3's distinction between "set aside" and
		// "failed" survives only if neither of these ever appears.
		const source = readFileSync(
			join(process.cwd(), 'src/lib/components/TreeView.svelte'),
			'utf8'
		);
		expect(source).not.toContain('line-through');
		const dismissedRules = source
			.split('\n')
			.filter((line) => line.includes('is-dismissed'))
			.join('\n');
		expect(dismissedRules).not.toContain('display: none');
	});

	it('returns the score to where it was when the dismissal is undone', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);
		const before = scoreOf(tree);

		harness.open('e');
		harness.act('dismiss');
		await harness.settle();
		expect(scoreOf(tree)).toEqual(before);

		harness.open('e');
		harness.act('undo');
		await harness.settle();

		expect(stateOf(tree, 'e')).toBeUndefined();
		expect(scoreOf(tree)).toEqual(before);
	});

	it('never reaches the un-check intercept, because there is no drop to warn about', async () => {
		const tree = blockedTree();
		const harness = await mountOverStore(tree, ['a', 'b']);

		harness.open('e');
		harness.act('dismiss');
		await harness.settle();

		harness.open('e');
		harness.act('undo');
		await harness.settle();

		expect(harness.container.querySelector('.consequence')).toBeNull();
	});
});
