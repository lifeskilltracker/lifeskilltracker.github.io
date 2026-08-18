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
import { anchorFor, type CameraTarget } from './tree-camera.js';
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

describe('§9.2, §15.7 — a node’s label stays inside its node', () => {
	it('confines the title to the node box, so it cannot cover its neighbours', () => {
		const tree = fiveStateTree();
		const positions = layoutTree(tree, 'wide');
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		const label = node(container, tree, 'a1').querySelector('foreignObject.node-label');
		expect(label).not.toBeNull();

		const box = positions.nodes.find((n) => n.uid === uidOf(tree, 'a1'))!;
		expect(Number(label?.getAttribute('width'))).toBeLessThanOrEqual(box.w);
		expect(Number(label?.getAttribute('height'))).toBeLessThanOrEqual(box.h);
		expect(label?.textContent?.trim()).toBe('a1');
	});

	it('leaves hit-testing to the node box, whatever the title length', () => {
		const tree = fiveStateTree();
		tree.milestones.find((m) => m.id === 'a1')!.title =
			'Cook dried pasta to al dente and drain it without rinsing';
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		const label = node(container, tree, 'a1').querySelector('.node-label');
		// The label is decoration over the box; the box is the target (§15.7).
		expect(label?.getAttribute('pointer-events')).toBe('none');
	});
});

describe('§9.2 — the node box shows the short label when the author wrote one (T10)', () => {
	it('prefers `label` over `title` on the node, in both viewports', () => {
		const tree = fiveStateTree();
		const target = tree.milestones.find((m) => m.id === 'a1')!;
		target.title = 'Cook dried pasta to al dente and drain it without rinsing';
		target.label = 'Cook pasta al dente';

		for (const viewport of ['wide', 'narrow'] as const) {
			const { container } = mountTree(tree, FIVE_STATE_MILESTONES, { viewport });
			expect(node(container, tree, 'a1').querySelector('.node-title')?.textContent?.trim()).toBe(
				'Cook pasta al dente'
			);
		}
	});

	it('falls back to the title, so a label is never required', () => {
		const tree = fiveStateTree();
		tree.milestones.find((m) => m.id === 'a1')!.title = 'No short form was written';
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		expect(node(container, tree, 'a1').querySelector('.node-title')?.textContent?.trim()).toBe(
			'No short form was written'
		);
	});

	it('keeps the full title in the panel, which has room for it', () => {
		const tree = fiveStateTree();
		const target = tree.milestones.find((m) => m.id === 'a1')!;
		target.title = 'Cook dried pasta to al dente and drain it without rinsing';
		target.label = 'Cook pasta al dente';

		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);
		click(node(container, tree, 'a1').querySelector('.node-box')!);

		expect(container.querySelector('.milestone-panel')?.textContent).toContain(
			'Cook dried pasta to al dente and drain it without rinsing'
		);
	});
});

describe('§9.6 — the level readouts cannot collide with the tier name (T10)', () => {
	it('flows the group readouts after the label instead of at a fixed x', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);
		const row = container.querySelector('.row[data-level="1"]')!;

		// "Level 6 · Journeyman" overran the readout parked at x=90. Anything
		// positioned absolutely reintroduces that, so the readouts must live in
		// the label's own <text> and be offset from where it ends.
		for (const readout of row.querySelectorAll('.group-progress')) {
			expect(readout.getAttribute('x')).toBeNull();
			expect(readout.closest('text')).toBe(row.querySelector('text.row-label'));
		}
	});
});

/**
 * F29 — §9 computed `columns[].title` and `CompiledMilestone.module` and drew
 * neither, so a three-column tree gave the reader its structure in x-positions
 * with nothing naming them, and a tree grouped into modules rendered exactly
 * like a plain linear one.
 *
 * These assert the two channels are *drawn*, and that they stay off trees that
 * declare neither — a track-less tree gets §8.2's synthetic column, whose empty
 * `trackId` is precisely the marker that says "draw no header".
 */
function trackedTree(): CompiledTree {
	return makeScoringTree({
		id: 'f29-tracks',
		tracks: ['technique', 'musicianship'],
		track: { t1: 'technique', t2: 'musicianship', t3: 'technique' },
		levels: [
			{ level: 1, milestones: ['t1', 't2'] },
			{ level: 2, milestones: ['t3'] }
		]
	});
}

/** `makeScoringTree` has no `module` field; §5 makes it optional per milestone. */
function withModules(tree: CompiledTree, modules: Record<string, string>): CompiledTree {
	for (const [slug, name] of Object.entries(modules)) {
		tree.milestones.find((m) => m.id === slug)!.module = name;
	}
	return tree;
}

describe('F29 — track titles are drawn', () => {
	it('draws one head per declared track, carrying the authored title', () => {
		const tree = trackedTree();
		const { container } = mountTree(tree, {});

		const heads = [...container.querySelectorAll('.column-head')];
		expect(heads.map((h) => h.textContent?.trim())).toEqual(['technique', 'musicianship']);
	});

	it('aligns each head to its column as a percentage of the same width the viewBox maps', () => {
		const tree = trackedTree();
		const { container } = mountTree(tree, {});
		const positions = layoutTree(tree, 'wide');

		const heads = [...container.querySelectorAll('.column-head')];
		positions.columns.forEach((column, index) => {
			const style = heads[index].getAttribute('style') ?? '';
			expect(style).toContain(`left: ${(column.x / positions.width) * 100}%`);
			expect(style).toContain(`width: ${(column.w / positions.width) * 100}%`);
		});
	});

	it('hides the strip from assistive technology, since every node names its own track', () => {
		const tree = trackedTree();
		const { container } = mountTree(tree, {});

		expect(container.querySelector('.column-heads')?.getAttribute('aria-hidden')).toBe('true');
	});

	it('draws no head for a track-less tree, whose synthetic column has an empty trackId', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		expect(container.querySelector('.column-heads')).toBeNull();
	});

	it('draws no head in narrow, which has one synthetic column and no track geometry', () => {
		const tree = trackedTree();
		const { container } = mountTree(tree, {}, { viewport: 'narrow' });

		expect(container.querySelector('.column-heads')).toBeNull();
	});
});

describe('F29 — module labels are drawn', () => {
	it('labels each node with its module in wide', () => {
		const tree = withModules(fiveStateTree(), { a1: 'Foundations', open: 'Attention' });
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		expect(node(container, tree, 'a1').querySelector('.node-module')?.textContent?.trim()).toBe(
			'Foundations'
		);
		expect(node(container, tree, 'open').querySelector('.node-module')?.textContent?.trim()).toBe(
			'Attention'
		);
	});

	it('omits the label on a milestone that declares no module', () => {
		const tree = withModules(fiveStateTree(), { a1: 'Foundations' });
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		expect(node(container, tree, 'b1').querySelector('.node-module')).toBeNull();
	});

	it('uses neither colour nor glyph for the module, both being spent on §9.3 state (N5)', () => {
		const tree = withModules(fiveStateTree(), { a1: 'Foundations' });
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);
		const label = node(container, tree, 'a1').querySelector('.node-module')!;

		// Text only: no fill/stroke of its own, and no <use> pulling in a glyph.
		expect(label.getAttribute('fill')).toBeNull();
		expect(label.querySelector('use')).toBeNull();
		expect(label.textContent?.trim()).toBe('Foundations');
	});

	it('carries track and module together in narrow, which has no column header', () => {
		const tree = withModules(trackedTree(), { t1: 'Foundations' });
		const { container } = mountTree(tree, {}, { viewport: 'narrow' });

		expect(node(container, tree, 't1').querySelector('.node-meta')?.textContent?.trim()).toBe(
			'technique · Foundations'
		);
		// Track alone when the milestone declares no module.
		expect(node(container, tree, 't2').querySelector('.node-meta')?.textContent?.trim()).toBe(
			'musicianship'
		);
	});
});

/* -------------------------------------------------------------------------- *
 * T34 — the Survey restyle and the level camera.
 *
 * The restyle's whole risk is that it stops being one. Everything below either
 * pins a coordinate the restyle may not move, or checks a Survey rule that the
 * restyle exists to satisfy.
 * -------------------------------------------------------------------------- */

const TREE_SOURCE = readFileSync(join(process.cwd(), 'src/lib/components/TreeView.svelte'), 'utf8');

/** Ten levels, two milestones each — the fixture the camera and the guardrail share. */
function tenLevelTree(): CompiledTree {
	return makeScoringTree({
		id: 'restyle-fixture',
		levels: Array.from({ length: 10 }, (_, i) => ({
			level: i + 1,
			milestones: [`l${i + 1}-a`, `l${i + 1}-b`]
		})),
		requires: { 'l2-a': ['l1-a'] }
	});
}

function completeThrough(level: number): Record<string, MilestoneState> {
	const states: Record<string, MilestoneState> = {};
	for (let l = 1; l <= level; l += 1) {
		states[`l${l}-a`] = 'complete';
		states[`l${l}-b`] = 'complete';
	}
	return states;
}

/**
 * §8's output for `tenLevelTree()`, frozen at the moment T34 began.
 *
 * **This is the guardrail that keeps T34 a restyle.** §8 is settled — F27 closed
 * its last five silences — and N11's reproducibility claim is stated in these
 * numbers. Every restyle drifts toward a "small" layout improvement; a diff that
 * moves one of these is a T06 change and belongs in T06.
 */
const LAYOUT_FIXTURE = {
	width: 272,
	height: 960,
	rows: [864, 768, 672, 576, 480, 384, 288, 192, 96, 0],
	nodes: {
		'l1-a': { x: 0, y: 890 },
		'l1-b': { x: 100, y: 890 },
		'l5-a': { x: 0, y: 506 },
		'l10-b': { x: 100, y: 26 }
	} as Record<string, { x: number; y: number }>,
	edge: 'M 50 890 V 864 H 50 V 838'
} as const;

describe('T34 — the layout is untouched (§8, N11)', () => {
	it('lays the fixture tree out at exactly the coordinates it did before the restyle', () => {
		const layout = layoutTree(tenLevelTree(), 'wide');

		expect([layout.width, layout.height]).toEqual([
			LAYOUT_FIXTURE.width,
			LAYOUT_FIXTURE.height
		]);
		expect(layout.rows.map((row) => row.y)).toEqual([...LAYOUT_FIXTURE.rows]);
		expect(layout.rows.every((row) => row.h === 96)).toBe(true);
		expect(layout.edges.map((edge) => edge.path)).toEqual([LAYOUT_FIXTURE.edge]);
	});

	it('draws every node at the position the engine gave it, and nowhere else', () => {
		const tree = tenLevelTree();
		const layout = layoutTree(tree, 'wide');
		const { container } = mountTree(tree, {});

		for (const positioned of layout.nodes) {
			const rendered = container.querySelector(`.node[data-uid="${positioned.uid}"]`);
			expect(rendered?.getAttribute('transform')).toBe(
				`translate(${positioned.x}, ${positioned.y})`
			);
		}

		// And the frozen sample, so a change in the *engine* fails here too rather
		// than being carried silently into the drawing.
		for (const [slug, at] of Object.entries(LAYOUT_FIXTURE.nodes)) {
			expect(node(container, tree, slug).getAttribute('transform')).toBe(
				`translate(${at.x}, ${at.y})`
			);
		}
	});

	it('maps the viewBox onto the engine’s own extent, so a unit is still a unit', () => {
		const tree = tenLevelTree();
		const { container } = mountTree(tree, {});

		expect(container.querySelector('svg.tree')?.getAttribute('viewBox')).toBe(
			`0 0 ${LAYOUT_FIXTURE.width} ${LAYOUT_FIXTURE.height}`
		);
	});

	it('routes every edge along the engine’s own path string', () => {
		const tree = tenLevelTree();
		const layout = layoutTree(tree, 'wide');
		const { container } = mountTree(tree, {});

		const drawn = [...container.querySelectorAll('path.edge')].map((p) => p.getAttribute('d'));
		expect(drawn).toEqual(layout.edges.map((edge) => edge.path));
	});
});

describe('§4.6 — the five states in Survey terms, encoding unchanged', () => {
	const expected: [string, string, string, string][] = [
		// slug, state, stroke-dasharray, stroke-width
		['a1', 'complete', 'none', '1.3'],
		['b1', 'bonus', 'none', '1.3'],
		['open', 'available', 'none', '2.2'],
		['gated', 'locked', '6 4', '1.3'],
		['nope', 'dismissed', '1 4', '1.3']
	];

	it.each(expected)('draws %s (%s) with the §4.6 border', (slug, _state, dash, width) => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);
		const box = node(container, tree, slug).querySelector('rect.node-box');

		expect(box?.getAttribute('stroke-dasharray')).toBe(dash);
		expect(box?.getAttribute('stroke-width')).toBe(width);
	});

	it('carries §4.6’s plate strength as an attribute, not only as a colour', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		const plates = expected.map(
			([slug]) => node(container, tree, slug).getAttribute('data-plate')
		);
		expect(plates).toEqual(['full', 'bonus', 'open', 'open', 'open']);
	});

	it('keeps the glyphs real <use> elements, which is what survives forced colours', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		for (const [slug] of expected) {
			const glyph = node(container, tree, slug).querySelector('use.state-glyph');
			expect(glyph?.tagName.toLowerCase()).toBe('use');
			expect(container.querySelector(`symbol${glyph?.getAttribute('href')}`)).not.toBeNull();
		}
	});

	it('is distinguishable with the plate thrown away entirely', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		// Strip fill: keep only what `forced-colors: active` leaves standing.
		const signatures = expected.map(([slug]) => {
			const rendered = node(container, tree, slug);
			const box = rendered.querySelector('rect.node-box');
			return [
				rendered.querySelector('use.state-glyph')?.getAttribute('href'),
				box?.getAttribute('stroke-dasharray'),
				box?.getAttribute('stroke-width')
			].join('|');
		});
		expect(new Set(signatures).size).toBe(5);
	});
});

describe('§4 — the tree wears the token sheet and names no colour of its own', () => {
	it('has no colour literal anywhere in the file (T27 owns hue)', () => {
		const styles = TREE_SOURCE.slice(TREE_SOURCE.indexOf('<style>'));
		// §4.3 gives hue one source. A hex, an rgb()/hsl() call or a CSS named
		// colour here is a second source, and a second source drifts silently.
		expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(styles).not.toMatch(/\b(rgba?|hsla?)\s*\(/);
		expect(styles).not.toMatch(/:\s*(white|black|red|green|blue|grey|gray)\b/);
	});

	it('draws its ink, paper and rules from the token sheet', () => {
		for (const token of ['var(--ink)', 'var(--paper)', 'var(--rule)', 'var(--plate-open)']) {
			expect(TREE_SOURCE).toContain(token);
		}
	});

	it('takes the plate from the tree’s own domain, resolved by the theme (§4.2, A7)', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);
		const root = container.querySelector('.tree-view');

		expect(root?.getAttribute('style')).toContain(`var(--domain-${tree.domain}`);
	});

	it('sets the level and tier labels in the display face, with the knockout halo', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);
		const label = container.querySelector('.row[data-level="1"] text.row-label');

		// §4.5's halo is an accessibility mechanism, not a flourish: label ink on a
		// full-strength plate runs 1.45:1 without it.
		expect(label?.getAttribute('class')).toContain('display');
		expect(label?.getAttribute('class')).toContain('halo');
	});

	it('sets the counts in the data face, so digits do not jitter as they change', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATE_MILESTONES);

		for (const readout of container.querySelectorAll('.row .group-progress')) {
			expect(readout.getAttribute('class')).toContain('tabular');
		}
	});

	it('never fogs a tree — hachure belongs to the map (§4.4, §7)', () => {
		expect(TREE_SOURCE).not.toMatch(/hachure|--plate-fog/);
	});

	it('offers no zoom or pan control in any form (§7)', () => {
		// Declined by name in §7: §15.2's arrow grid and roving `tabindex` both
		// assume stable positions. Asserted against the machinery rather than the
		// prose — a `transform: scale`, a `zoom`, a wheel or a gesture handler are
		// the four ways one gets in.
		expect(TREE_SOURCE).not.toMatch(/transform:\s*scale/);
		expect(TREE_SOURCE).not.toMatch(/\bzoom:/);
		expect(TREE_SOURCE).not.toMatch(/onwheel|ongesture|ontouchmove|pinch-zoom/);
	});
});

describe('§4.3 — the water line on the level header', () => {
	function waterY(container: HTMLElement, level: number): number {
		const line = container.querySelector(`.row[data-level="${level}"] line.water-line`);
		return Number(line?.getAttribute('y1'));
	}

	it('rules one line per level, in ink at --rule-water', () => {
		const tree = tenLevelTree();
		const { container } = mountTree(tree, {});

		expect(container.querySelectorAll('line.water-line')).toHaveLength(10);
		expect(TREE_SOURCE).toContain('var(--rule-water)');
	});

	it('sits at the foot of an untouched level and at the head of a satisfied one', () => {
		const tree = tenLevelTree();
		const layout = layoutTree(tree, 'wide');
		const { container } = mountTree(tree, completeThrough(1));

		const row1 = layout.rows.find((row) => row.level === 1)!;
		const row2 = layout.rows.find((row) => row.level === 2)!;
		// Satisfied: the line is at the top of the header, the plate full beneath it.
		expect(waterY(container, 1)).toBe(row1.y);
		// Untouched: at the foot, with nothing below it.
		expect(waterY(container, 2)).toBeGreaterThan(row2.y);
	});

	it('renders the plate above the line at --plate-open, never as a faded hue (§4.3)', () => {
		const tree = tenLevelTree();
		const { container } = mountTree(tree, {});
		const plate = container.querySelector('.row[data-level="1"] rect.header-plate');

		expect(plate).not.toBeNull();
		expect(plate?.getAttribute('fill')).toBeNull(); // colour lives in CSS (§15.4)
		expect(TREE_SOURCE).toMatch(/\.header-plate\s*\{[^}]*var\(--plate-open\)/);
	});

	it('keeps §9.6’s per-group counts, which are the channel §15.4 makes load-bearing', () => {
		const tree = tenLevelTree();
		const { container } = mountTree(tree, completeThrough(1));

		expect(
			container.querySelector('.row[data-level="1"] .group-progress')?.textContent?.trim()
		).toBe('2 / 2');
	});
});

/** `matchMedia` is absent in jsdom; the camera asks for it and must survive both answers. */
function stubReducedMotion(reduce: boolean): void {
	Object.defineProperty(globalThis, 'matchMedia', {
		configurable: true,
		writable: true,
		value: (query: string) => ({
			matches: reduce && query.includes('prefers-reduced-motion'),
			media: query,
			addEventListener() {},
			removeEventListener() {}
		})
	});
}

interface CameraInstance {
	moveCamera(target: CameraTarget): void;
}

describe('§7 — the level camera', () => {
	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'matchMedia');
	});

	it('gives the wide tree a scroll viewport for the camera to move', () => {
		const tree = tenLevelTree();
		const { container } = mountTree(tree, {});

		expect(container.querySelector('.tree-camera')).not.toBeNull();
		expect(TREE_SOURCE).toMatch(/\.tree-camera\s*\{[^}]*overflow-y:\s*auto/);
	});

	it.each([
		['blocking', { kind: 'blocking' } as CameraTarget],
		['next-available', { kind: 'next-available' } as CameraTarget],
		['level 10', { kind: 'level', level: 10 } as CameraTarget]
	])('resolves the %s anchor through the pure camera, not through the DOM', (_name, target) => {
		const tree = tenLevelTree();
		const layout = layoutTree(tree, 'wide');
		const treeProgress = progressOf(tree, completeThrough(3));
		const progress = scoreSkill(tree, treeProgress);

		stubReducedMotion(true);
		const mounted = mountTree(tree, completeThrough(3));
		(mounted.instance as unknown as CameraInstance).moveCamera(target);
		flushSync();

		const camera = mounted.container.querySelector('.tree-camera')!;
		expect(camera.getAttribute('data-camera-anchor')).toBe(
			String(anchorFor(target, layout, progress))
		);
	});

	it('moves instantly under prefers-reduced-motion, losing nothing (§15.5)', () => {
		const tree = tenLevelTree();
		stubReducedMotion(true);
		const mounted = mountTree(tree, completeThrough(3));

		(mounted.instance as unknown as CameraInstance).moveCamera({ kind: 'level', level: 4 });
		flushSync();

		const camera = mounted.container.querySelector('.tree-camera') as HTMLElement;
		// Level 4's band, arrived at within the same tick — no frame in between.
		expect(camera.scrollTop).toBe(576);
		expect(camera.getAttribute('data-camera-anchor')).toBe('576');
	});

	it('has an anchor for a tree at level 10 and for one with nothing available', () => {
		const tree = tenLevelTree();
		const layout = layoutTree(tree, 'wide');
		stubReducedMotion(true);

		const finished = scoreSkill(tree, progressOf(tree, completeThrough(10)));
		expect(finished.available).toHaveLength(0);

		const mounted = mountTree(tree, completeThrough(10));
		(mounted.instance as unknown as CameraInstance).moveCamera({ kind: 'next-available' });
		flushSync();

		expect(
			mounted.container.querySelector('.tree-camera')?.getAttribute('data-camera-anchor')
		).toBe(String(anchorFor({ kind: 'next-available' }, layout, finished)));
	});

	it('declares no free zoom: the camera takes named anchors and nothing else', () => {
		// The type is the enforcement — this asserts the runtime honours it by
		// resolving an out-of-range level to a band rather than to a scale.
		const tree = tenLevelTree();
		stubReducedMotion(true);
		const mounted = mountTree(tree, {});

		(mounted.instance as unknown as CameraInstance).moveCamera({ kind: 'level', level: 99 });
		flushSync();

		expect(
			mounted.container.querySelector('.tree-camera')?.getAttribute('data-camera-anchor')
		).toBe('0');
	});
});

describe('§15.2, F36 — `.` moves focus AND the camera', () => {
	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'matchMedia');
	});

	it('brings the camera to the level the shortcut just put focus on', () => {
		const tree = tenLevelTree();
		const layout = layoutTree(tree, 'wide');
		stubReducedMotion(true);
		// Level 1 complete, so the next available milestone is at level 2.
		const { container } = mountTree(tree, completeThrough(1));

		const first = node(container, tree, 'l1-a');
		focus(first);
		press(first, '.');

		const focused = document.activeElement as Element;
		expect(focused.getAttribute('data-level')).toBe('2');

		const level2 = layout.rows.find((row) => row.level === 2)!.y;
		expect(container.querySelector('.tree-camera')?.getAttribute('data-camera-anchor')).toBe(
			String(level2)
		);
	});

	it('leaves the camera where it was when nothing is available', () => {
		const tree = tenLevelTree();
		stubReducedMotion(true);
		const { container } = mountTree(tree, completeThrough(10));

		const first = node(container, tree, 'l1-a');
		focus(first);
		press(first, '.');

		// `.` moved nothing, so the camera has nothing to report either.
		expect(container.querySelector('.tree-camera')?.getAttribute('data-camera-anchor')).toBeNull();
	});

	it('does not disturb the narrow list, whose presentation is unchanged (§9.5)', () => {
		const tree = tenLevelTree();
		stubReducedMotion(true);
		const { container } = mountTree(tree, completeThrough(1), { viewport: 'narrow' });

		expect(container.querySelector('.tree-camera')).toBeNull();
		const first = node(container, tree, 'l1-a');
		focus(first);
		press(first, '.');
		expect((document.activeElement as Element).getAttribute('data-level')).toBe('2');
	});
});
