// @vitest-environment jsdom

/**
 * §9's renderer, tested through a real mount (T08).
 *
 * The fixtures build the three inputs the way the application does: a compiled
 * tree from `lib/scoring`'s builder, positions from the real Layout Engine, and
 * `SkillProgress` from the real Scoring Engine. Nothing here stubs an engine —
 * a renderer test that invented its own `nodeStates` would pass against a state
 * table no engine produces.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layoutTree } from '$lib/layout';
import { scoreSkill, tierFor } from '$lib/scoring';
import { makeScoringTree, progressOf, uidOf } from '$lib/scoring/fixtures.js';
import type { CompiledTree, MilestoneState } from '$lib/types';
import TreeView from './TreeView.svelte';
import type { MilestoneIntent } from './intents.js';
import { cleanup, click, flushSync, focus, press, render } from './test-harness.svelte.js';

afterEach(cleanup);

/**
 * One tree exhibiting all five §9.3 states at once.
 *
 * - `a1` sits alone in an `all` group, so completing it is never surplus → `complete`
 * - `b1`/`b2` are both complete inside `n_of n:1`, so both are surplus → `bonus`
 * - `open` has no prerequisite and is incomplete → `available`
 * - `gated` requires `open` → `locked`
 * - `nope` is dismissed → `dismissed`
 */
function fiveStateTree(): CompiledTree {
	return makeScoringTree({
		id: 'five-states',
		levels: [
			{
				level: 1,
				milestones: ['a1', 'b1', 'b2'],
				requirements: [
					{ rule: 'all', milestones: ['a1'] },
					{ rule: 'n_of', n: 1, milestones: ['b1', 'b2'] }
				]
			},
			{
				level: 2,
				milestones: ['open', 'gated', 'nope'],
				requirements: [{ rule: 'all', milestones: ['open', 'gated', 'nope'] }]
			}
		],
		requires: { gated: ['open'] }
	});
}

const FIVE_STATE_MILESTONES: Record<string, MilestoneState> = {
	a1: 'complete',
	b1: 'complete',
	b2: 'complete',
	nope: 'dismissed'
};

interface MountOptions {
	viewport?: 'wide' | 'narrow';
	onintent?: (intent: MilestoneIntent) => void;
	uncheckConsequence?: (uid: string) => { before: number; after: number; cleared: number[] } | null;
}

function mountTree(
	tree: CompiledTree,
	states: Record<string, MilestoneState>,
	options: MountOptions = {}
) {
	const viewport = options.viewport ?? 'wide';
	const treeProgress = progressOf(tree, states);
	const positions = layoutTree(tree, viewport);
	const progress = scoreSkill(tree, treeProgress);
	return render(TreeView, { tree, positions, progress, viewport, ...options });
}

/** `makeScoringTree` has no `detail` field; §9.4's panel shows one. */
function withDetail(tree: CompiledTree, slug: string, detail: string): CompiledTree {
	tree.milestones.find((m) => m.id === slug)!.detail = detail;
	return tree;
}

const node = (container: HTMLElement, tree: CompiledTree, slug: string): Element => {
	const found = container.querySelector(`.node[data-uid="${uidOf(tree, slug)}"]`);
	if (found === null) throw new Error(`no rendered node for "${slug}"`);
	return found;
};

describe('§9.2 — SVG structure', () => {
	it('marks the edge group aria-hidden, because a drawn line tells a screen reader nothing', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		const edges = container.querySelector('g.edges');
		expect(edges).not.toBeNull();
		expect(edges?.getAttribute('aria-hidden')).toBe('true');
	});

	it('renders one focusable node per positioned milestone, keyed by uid', () => {
		const tree = fiveStateTree();
		const positions = layoutTree(tree, 'wide');
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		const nodes = [...container.querySelectorAll('.node[data-uid]')];
		expect(nodes).toHaveLength(positions.nodes.length);
		for (const rendered of nodes) {
			expect(rendered.getAttribute('role')).toBe('button');
			expect(rendered.getAttribute('tabindex')).not.toBeNull();
			expect(rendered.getAttribute('aria-describedby')).toBe(
				`ms-${rendered.getAttribute('data-uid')}-desc`
			);
		}
	});
});

describe('§9.3 — five states, never colour alone (N5)', () => {
	const expected: [string, string][] = [
		['a1', 'complete'],
		['b1', 'bonus'],
		['open', 'available'],
		['gated', 'locked'],
		['nope', 'dismissed']
	];

	it.each(expected)('renders %s in state %s', (slug, state) => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		expect(node(container, tree, slug).getAttribute('data-state')).toBe(state);
	});

	it('gives every state its own glyph, as a real <use> element', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		const hrefs = expected.map(([slug]) => {
			const glyph = node(container, tree, slug).querySelector('use.state-glyph');
			expect(glyph).not.toBeNull();
			return glyph?.getAttribute('href');
		});

		expect(new Set(hrefs).size).toBe(5);
		for (const href of hrefs) expect(href).toMatch(/^#glyph-/);
	});

	it('gives every state its own border, so the five survive without colour', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		const borders = expected.map(([slug, state]) => {
			const box = node(container, tree, slug).querySelector('rect.node-box');
			return `${state}:${box?.getAttribute('stroke-dasharray')}/${box?.getAttribute('stroke-width')}`;
		});

		// `complete` and `bonus` share a solid border by §9.3 and are separated by
		// their glyph; the other three must each be drawn differently.
		const strokes = expected.map(
			([slug]) =>
				`${node(container, tree, slug).querySelector('rect.node-box')?.getAttribute('stroke-dasharray')}`
		);
		expect(new Set(strokes.slice(2)).size).toBe(3);
		expect(new Set(borders).size).toBe(5);
	});
});

describe('§9.4 — opening a milestone', () => {
	it('opens the detail panel on click, with the prose and prerequisites by title', () => {
		const tree = withDetail(fiveStateTree(), 'gated', 'Bring the stock to a rolling boil.');
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		expect(container.querySelector('.milestone-panel')).toBeNull();
		click(node(container, tree, 'gated'));

		const panel = container.querySelector('.milestone-panel');
		expect(panel?.textContent).toContain('Bring the stock to a rolling boil.');
		// Prerequisites by title, not by uid or slug.
		expect(panel?.querySelector('.prerequisites')?.textContent).toContain('open');
	});

	it.each(['Enter', ' '])('opens the panel on %s', (key) => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		press(node(container, tree, 'open'), key);

		expect(container.querySelector('.milestone-panel')).not.toBeNull();
	});

	it('offers complete, note, dismiss, and undo', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		click(node(container, tree, 'open'));

		const actions = [...container.querySelectorAll('.milestone-panel [data-action]')].map((b) =>
			b.getAttribute('data-action')
		);
		expect(actions).toEqual(expect.arrayContaining(['complete', 'note', 'dismiss', 'undo']));
	});

	it('closes on Escape and returns focus to the node', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);
		const target = node(container, tree, 'open') as SVGElement;

		click(target);
		press(container.querySelector('.milestone-panel')!, 'Escape');

		expect(container.querySelector('.milestone-panel')).toBeNull();
		expect(document.activeElement).toBe(target);
	});
});

describe('§9.4 — completion is one action (F31)', () => {
	it('emits the intent immediately, with no confirmation dialog', () => {
		const tree = fiveStateTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES, { onintent });

		click(node(container, tree, 'open'));
		click(container.querySelector('[data-action="complete"]')!);

		expect(onintent).toHaveBeenCalledWith({ kind: 'complete', uid: uidOf(tree, 'open') });
		expect(container.querySelector('dialog, [role="dialog"], [role="alertdialog"]')).toBeNull();
	});

	it('emits undo for a completed milestone whose level does not drop', () => {
		const tree = fiveStateTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES, {
			onintent,
			uncheckConsequence: () => null
		});

		click(node(container, tree, 'b1'));
		click(container.querySelector('[data-action="undo"]')!);

		expect(onintent).toHaveBeenCalledWith({ kind: 'undo', uid: uidOf(tree, 'b1') });
	});
});

/** Two edges that cross: `n1` requires `m2`, `n2` requires `m1` (§8.4). */
function crossingTree(): CompiledTree {
	return makeScoringTree({
		id: 'crossing',
		levels: [
			{ level: 1, milestones: ['m1', 'm2'] },
			{ level: 2, milestones: ['n1', 'n2'] }
		],
		requires: { n1: ['m2'], n2: ['m1'] }
	});
}

describe('§9.4 — focus makes one node’s dependencies legible (§8.4)', () => {
	it('lights the focused node’s edges and dims the rest', () => {
		const tree = crossingTree();
		const { container } = mountTree(tree, {});

		focus(node(container, tree, 'n1'));

		const mine = container.querySelector(`path.edge[data-to="${uidOf(tree, 'n1')}"]`);
		const theirs = container.querySelector(`path.edge[data-to="${uidOf(tree, 'n2')}"]`);
		expect(mine?.classList.contains('is-lit')).toBe(true);
		expect(theirs?.classList.contains('is-dim')).toBe(true);
	});

	it('lights incoming and outgoing edges alike', () => {
		const tree = makeScoringTree({
			id: 'chain',
			levels: [
				{ level: 1, milestones: ['bottom'] },
				{ level: 2, milestones: ['middle'] },
				{ level: 3, milestones: ['top'] }
			],
			requires: { middle: ['bottom'], top: ['middle'] }
		});
		const { container } = mountTree(tree, {});

		focus(node(container, tree, 'middle'));

		const lit = [...container.querySelectorAll('path.edge.is-lit')].map((e) => [
			e.getAttribute('data-from'),
			e.getAttribute('data-to')
		]);
		expect(lit).toHaveLength(2);
		expect(lit.flat()).toContain(uidOf(tree, 'middle'));
	});

	it('leaves every edge undimmed when nothing has focus', () => {
		const tree = crossingTree();
		const { container } = mountTree(tree, {});

		expect(container.querySelectorAll('path.edge.is-dim')).toHaveLength(0);
		expect(container.querySelectorAll('path.edge.is-lit')).toHaveLength(0);
	});
});

describe('§9.3, §8.6 — toggling state is a class change, never a re-layout', () => {
	it('keeps the same DOM node and only changes its class', () => {
		const tree = fiveStateTree();
		const mounted = mountTree(tree, FIVE_STATE_MILESTONES);
		const before = node(mounted.container, tree, 'open');
		const positionsBefore = mounted.props.positions;

		mounted.props.progress = scoreSkill(
			tree,
			progressOf(tree, { ...FIVE_STATE_MILESTONES, open: 'complete' })
		);
		flushSync();

		const after = node(mounted.container, tree, 'open');
		expect(after).toBe(before);
		expect(after.getAttribute('data-state')).toBe('complete');
		expect(after.getAttribute('transform')).toBe(
			before.getAttribute('transform')
		);
		// The positions prop is the same object it was handed: nothing recomputed it.
		expect(mounted.props.positions).toBe(positionsBefore);
	});

	it('cannot re-run layout or re-score, because it imports neither at runtime', () => {
		const source = readFileSync(join(process.cwd(), 'src/lib/components/TreeView.svelte'), 'utf8');
		const imports = [...source.matchAll(/^\s*import\s+(type\s+)?.*from\s+'(\$lib\/[^']+)'/gm)];
		const runtimeLibImports = imports
			.filter((match) => match[1] === undefined)
			.map((match) => match[2]);

		expect(runtimeLibImports).not.toContain('$lib/layout');
		expect(runtimeLibImports).not.toContain('$lib/scoring');
		expect(source).not.toContain('$lib/state');
	});
});

/**
 * Level 1 satisfied; level 2 blocked, holding one `all` group and one `n_of`
 * group; level 3 untouched above the blocker. That is every case §11.10's
 * dismissal rule distinguishes, in one tree.
 */
function blockedTree(): CompiledTree {
	return makeScoringTree({
		id: 'blocked',
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

const LEVEL_1_DONE: Record<string, MilestoneState> = { a: 'complete', b: 'complete' };

function dismissFrom(container: HTMLElement, tree: CompiledTree, slug: string) {
	click(node(container, tree, slug));
	click(container.querySelector('[data-action="dismiss"]')!);
}

describe('§11.10 — the dismissal intercept', () => {
	it('warns before dismissing an `all` milestone at the blocker, and does not commit', () => {
		const tree = blockedTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, LEVEL_1_DONE, { onintent });

		dismissFrom(container, tree, 'c');

		const warning = container.querySelector('.consequence');
		expect(warning?.textContent).toContain("Level 2 can't be completed without this");
		expect(warning?.textContent).toContain('will stay at Level 1');
		expect(onintent).not.toHaveBeenCalled();
	});

	it('offers hiding as the softer option, and hiding is not dismissal', () => {
		const tree = blockedTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, LEVEL_1_DONE, { onintent });

		dismissFrom(container, tree, 'c');
		const hide = container.querySelector('.consequence [data-action="hide"]');
		expect(hide?.textContent?.toLowerCase()).toContain('hide it instead');
		click(hide!);

		expect(onintent).toHaveBeenCalledWith({ kind: 'hide', uid: uidOf(tree, 'c') });
		expect(onintent).not.toHaveBeenCalledWith({ kind: 'dismiss', uid: uidOf(tree, 'c') });
	});

	it('commits the dismissal when the user confirms — the cap is recoverable (D-22)', () => {
		const tree = blockedTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, LEVEL_1_DONE, { onintent });

		dismissFrom(container, tree, 'c');
		click(container.querySelector('.consequence [data-action="confirm"]')!);

		expect(onintent).toHaveBeenCalledWith({ kind: 'dismiss', uid: uidOf(tree, 'c') });
	});

	it('does not warn for an `n_of` milestone at the blocker — nothing is capped', () => {
		const tree = blockedTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, LEVEL_1_DONE, { onintent });

		dismissFrom(container, tree, 'e');

		expect(container.querySelector('.consequence')).toBeNull();
		expect(onintent).toHaveBeenCalledWith({ kind: 'dismiss', uid: uidOf(tree, 'e') });
	});

	it('does not warn above the blocker, where the level is already unreachable', () => {
		const tree = blockedTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, LEVEL_1_DONE, { onintent });

		dismissFrom(container, tree, 'g');

		expect(container.querySelector('.consequence')).toBeNull();
		expect(onintent).toHaveBeenCalledWith({ kind: 'dismiss', uid: uidOf(tree, 'g') });
	});

	it('warns below the blocker too, where the cap is deeper', () => {
		const tree = blockedTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, LEVEL_1_DONE, { onintent });

		dismissFrom(container, tree, 'a');

		expect(container.querySelector('.consequence')?.textContent).toContain(
			"Level 1 can't be completed without this"
		);
		expect(container.querySelector('.consequence')?.textContent).toContain('stay at Level 0');
		expect(onintent).not.toHaveBeenCalled();
	});
});

describe('§11.10 — the un-check consequence', () => {
	it('states the before and after level, and what survives, before committing', () => {
		const tree = blockedTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, LEVEL_1_DONE, {
			onintent,
			uncheckConsequence: () => ({ before: 8, after: 1, cleared: [3, 4, 5, 6, 7, 8] })
		});

		click(node(container, tree, 'a'));
		click(container.querySelector('[data-action="undo"]')!);

		const warning = container.querySelector('.consequence');
		expect(warning?.textContent).toContain('from Level 8 to Level 1');
		expect(warning?.textContent).toContain('Levels 3–8 stay cleared');
		expect(onintent).not.toHaveBeenCalled();

		click(container.querySelector('.consequence [data-action="confirm"]')!);
		expect(onintent).toHaveBeenCalledWith({ kind: 'undo', uid: uidOf(tree, 'a') });
	});
});

describe('§9.6 — level chrome', () => {
	it('labels each band with its number and tier name (F7)', () => {
		const tree = blockedTree();
		const { container } = mountTree(tree, LEVEL_1_DONE);

		const band = container.querySelector('.row[data-level="3"]');
		expect(band?.textContent).toContain('Level 3');
		expect(band?.textContent).toContain('Apprentice');
	});

	it('names the tiers the Scoring Engine names', () => {
		const tree = blockedTree();
		const { container } = mountTree(tree, LEVEL_1_DONE);

		for (let level = 1; level <= 10; level += 1) {
			const band = container.querySelector(`.row[data-level="${level}"]`);
			expect(band?.textContent).toContain(tierFor(level));
		}
	});

	it('reports each requirement group separately, never averaged into one bar (F11)', () => {
		const tree = blockedTree();
		const { container } = mountTree(tree, LEVEL_1_DONE);

		const readouts = [
			...container.querySelectorAll('.row[data-level="2"] .group-progress')
		].map((el) => el.textContent?.trim());

		// Level 2 holds `all` over {c, d} and `n_of 1` over {e, f}: two readouts,
		// not one averaged 0/3.
		expect(readouts).toEqual(['0 / 2', '0 / 1']);
	});

	it('shows a satisfied group as its own full count', () => {
		const tree = blockedTree();
		const { container } = mountTree(tree, LEVEL_1_DONE);

		const readouts = [
			...container.querySelectorAll('.row[data-level="1"] .group-progress')
		].map((el) => el.textContent?.trim());
		expect(readouts).toEqual(['2 / 2']);
	});
});

describe('§11.3 — Level 0 is not a tier', () => {
	it('reads "Level 0 — not yet ranked", never Novice', () => {
		const tree = blockedTree();
		const { container } = mountTree(tree, {});

		const status = container.querySelector('.tree-status');
		expect(status?.textContent).toContain('Level 0 — not yet ranked');
		expect(status?.textContent).not.toContain('Novice');
	});

	it('names the tier once one is attained', () => {
		const tree = blockedTree();
		const { container } = mountTree(tree, LEVEL_1_DONE);

		expect(container.querySelector('.tree-status')?.textContent).toContain('Level 1');
		expect(container.querySelector('.tree-status')?.textContent).toContain('Novice');
	});
});

describe('§9.6, §5.7 — mastery is outside the scored structure', () => {
	function withMastery(tree: CompiledTree): CompiledTree {
		tree.mastery = [
			{
				id: 'feast',
				uid: 'MASTERY1',
				title: 'Cook a feast for twelve',
				requires: [{ kind: 'milestone', index: 0, slug: 'a' }]
			}
		];
		return tree;
	}

	it('renders mastery in its own panel, not as an eleventh row', () => {
		const tree = withMastery(blockedTree());
		const { container } = mountTree(tree, LEVEL_1_DONE);

		const panel = container.querySelector('.mastery-panel');
		expect(panel?.textContent).toContain('Cook a feast for twelve');
		expect(container.querySelector('g.rows')?.textContent).not.toContain(
			'Cook a feast for twelve'
		);
		expect(container.querySelectorAll('.row')).toHaveLength(10);
	});

	it('surfaces a mastery prerequisite as text, since §8.2 draws no edge for it', () => {
		const tree = withMastery(blockedTree());
		const { container } = mountTree(tree, LEVEL_1_DONE);

		expect(container.querySelector('.mastery-panel')?.textContent).toContain('a');
		expect(
			container.querySelector('path.edge[data-to="MASTERY1"]')
		).toBeNull();
	});
});

describe('§9.5 — narrow is the linear list (F16, D-10)', () => {
	it('draws no edges and states prerequisites as text instead', () => {
		const tree = crossingTree();
		const { container } = mountTree(tree, {}, { viewport: 'narrow' });

		expect(container.querySelectorAll('path.edge')).toHaveLength(0);
		const n1 = node(container, tree, 'n1');
		expect(n1.textContent).toContain('Requires: m2');
	});

	it('renders level bands as headings, level 1 first (§8.5)', () => {
		const tree = blockedTree();
		const { container } = mountTree(tree, LEVEL_1_DONE, { viewport: 'narrow' });

		const headings = [...container.querySelectorAll('.row h3')].map((h) =>
			h.textContent?.trim().split(' ').slice(0, 2).join(' ')
		);
		expect(headings.slice(0, 3)).toEqual(['Level 1', 'Level 2', 'Level 3']);
		expect(headings).toHaveLength(10);
	});

	it('stacks every node in one column, in (level, lane) order', () => {
		const tree = blockedTree();
		const positions = layoutTree(tree, 'narrow');
		const { container } = mountTree(tree, LEVEL_1_DONE, { viewport: 'narrow' });

		const rendered = [...container.querySelectorAll('.node[data-uid]')].map((n) =>
			n.getAttribute('data-uid')
		);
		const expectedOrder = [...positions.nodes]
			.sort((a, b) => a.level - b.level || a.lane - b.lane)
			.map((n) => n.uid);

		expect(rendered).toEqual(expectedOrder);
		expect(positions.columns).toHaveLength(1);
	});

	it('keeps every state channel that survives without colour', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES, { viewport: 'narrow' });

		const glyph = node(container, tree, 'nope').querySelector('use.state-glyph');
		expect(glyph?.getAttribute('href')).toBe('#glyph-dismissed');
		expect(node(container, tree, 'nope').getAttribute('data-state')).toBe('dismissed');
	});

	it('opens the same panel from the same interaction', () => {
		const tree = fiveStateTree();
		const onintent = vi.fn();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES, {
			viewport: 'narrow',
			onintent
		});

		click(node(container, tree, 'open'));
		click(container.querySelector('[data-action="complete"]')!);

		expect(onintent).toHaveBeenCalledWith({ kind: 'complete', uid: uidOf(tree, 'open') });
	});
});
