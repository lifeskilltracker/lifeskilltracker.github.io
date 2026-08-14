// @vitest-environment jsdom

/**
 * §15 for the tree (T20, D-10, N5, R-07).
 *
 * Separate from `TreeView.test.ts` because the two ask different questions.
 * That file asks whether §9 renders; this one asks whether §15's five
 * requirements hold — the accessible names and descriptions, the whole of
 * §15.2's key table, one polite live region, the never-colour-alone table, and
 * the axe gate. §15.8 is explicit that axe "catches roughly a third of real
 * issues", so most of this file is assertions axe cannot make.
 *
 * The fixtures are built by the real engines, as in `TreeView.test.ts`: a
 * description that named prerequisites the Scoring Engine considers unmet would
 * be a passing test against a state no user can reach.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { layoutTree } from '$lib/layout';
import { scoreSkill } from '$lib/scoring';
import { makeScoringTree, progressOf, uidOf } from '$lib/scoring/fixtures.js';
import type { CompiledTree, MilestoneState } from '$lib/types';
import TreeView from './TreeView.svelte';
import { auditAccessibility } from './axe.js';
import { PANEL_SHEET_BELOW } from './breakpoints.js';
import { TOUCH_TARGET_MIN } from './node-state.js';
import { cleanup, click, flushSync, focus, press, render } from './test-harness.svelte.js';

afterEach(cleanup);

const SOURCE = readFileSync(join(process.cwd(), 'src/lib/components/TreeView.svelte'), 'utf8');

/**
 * Three levels over two tracks, which is the smallest tree that makes every row
 * of §15.2's table mean something: `←`/`→` need two nodes in one level, `↑`/`↓`
 * need a track that some level does *not* fill, and `.` needs two available
 * nodes with something else between them in document order.
 *
 * `b2` sits in both of level 2's groups (§5.6 allows it), so the "counts toward"
 * clause has a plural case to state.
 */
function a11yTree(): CompiledTree {
	return makeScoringTree({
		id: 'a11y',
		tracks: ['heat', 'metal'],
		track: { a1: 'heat', a2: 'metal', b1: 'heat', b3: 'heat', b2: 'metal', c1: 'heat', c2: 'metal' },
		levels: [
			{ level: 1, milestones: ['a1', 'a2'] },
			{
				level: 2,
				milestones: ['b1', 'b2', 'b3'],
				requirements: [
					{ rule: 'all', milestones: ['b1', 'b2'] },
					{ rule: 'n_of', n: 1, milestones: ['b2', 'b3'] }
				]
			},
			{ level: 3, milestones: ['c1', 'c2'] }
		],
		requires: { b1: ['a1'], b3: ['a1', 'a2'], c1: ['b1', 'b2'] }
	});
}

/**
 * Level 1 done; `b3` set aside. The setting-aside is what puts something between
 * two `available` nodes in document order, which is what F36's shortcut has to
 * step over.
 */
const A11Y_STATES: Record<string, MilestoneState> = {
	a1: 'complete',
	a2: 'complete',
	b3: 'dismissed'
};

/** The same five-state tree `TreeView.test.ts` uses, for the §15.4 table. */
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

const FIVE_STATES: Record<string, MilestoneState> = {
	a1: 'complete',
	b1: 'complete',
	b2: 'complete',
	nope: 'dismissed'
};

function mountTree(
	tree: CompiledTree,
	states: Record<string, MilestoneState>,
	viewport: 'wide' | 'narrow' = 'wide'
) {
	const positions = layoutTree(tree, viewport);
	const progress = scoreSkill(tree, progressOf(tree, states));
	return render(TreeView, { tree, positions, progress, viewport });
}

const node = (container: HTMLElement, tree: CompiledTree, slug: string): Element => {
	const found = container.querySelector(`.node[data-uid="${uidOf(tree, slug)}"]`);
	if (found === null) throw new Error(`no rendered node for "${slug}"`);
	return found;
};

/** The description `aria-describedby` actually resolves to, not one built here. */
function describedBy(container: HTMLElement, element: Element): string {
	const id = element.getAttribute('aria-describedby');
	const target = container.querySelector(`#${id}`);
	if (target === null) throw new Error(`aria-describedby="${id}" resolves to nothing`);
	return target.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const focusedSlug = (tree: CompiledTree): string | undefined => {
	const uid = document.activeElement?.getAttribute('data-uid');
	return tree.milestones.find((m) => m.uid === uid)?.id;
};

describe('§15.2 — the node accessible name and description', () => {
	it('names the node by its full authored title, never the clipped label', () => {
		const tree = a11yTree();
		const target = tree.milestones.find((m) => m.id === 'b1')!;
		target.title = 'Light a fire and bring stock to forging heat';
		target.label = 'Bring to forging heat';

		for (const viewport of ['wide', 'narrow'] as const) {
			const { container } = mountTree(tree, A11Y_STATES, viewport);
			expect(node(container, tree, 'b1').getAttribute('aria-label')).toBe(
				'Light a fire and bring stock to forging heat'
			);
			cleanup();
		}
	});

	it('states level, state, prerequisites with whether they are met, and the group served', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		// §15.2's worked example, in this fixture's vocabulary.
		expect(describedBy(container, node(container, tree, 'b1'))).toBe(
			"Level 2. Available. Requires: a1 — complete. Counts toward: all of Level 2's required group."
		);
	});

	it('says "both complete" when two prerequisites agree', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		expect(describedBy(container, node(container, tree, 'b3'))).toContain(
			'Requires: a1; a2 — both complete.'
		);
	});

	it('annotates each prerequisite when they disagree, so the outstanding one is named', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, { ...A11Y_STATES, b1: 'complete' });

		// `c1` requires b1 (now complete) and b2 (not). A count would hide which.
		expect(describedBy(container, node(container, tree, 'c1'))).toContain(
			'Requires: b1 (complete); b2 (not complete).'
		);
	});

	it('names every group a milestone serves, since §5.6 allows more than one', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		const description = describedBy(container, node(container, tree, 'b2'));
		expect(description).toContain("all of Level 2's required group");
		expect(description).toContain("any 1 of 2 in Level 2's choice group");
	});

	it.each([
		['a1', 'Complete'],
		['b1', 'Available'],
		['b3', 'Set aside'],
		['c1', 'Locked']
	])('describes %s as "%s"', (slug, text) => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		expect(describedBy(container, node(container, tree, slug))).toContain(`${text}.`);
	});

	it('spells the surplus state out, because "bonus" tells a listener nothing', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATES);

		expect(describedBy(container, node(container, tree, 'b1'))).toContain(
			'Complete — surplus for this level.'
		);
	});

	it('carries the same description in the narrow list, which is the primary view (D-10)', () => {
		const tree = a11yTree();
		const wide = mountTree(tree, A11Y_STATES, 'wide');
		const wideText = describedBy(wide.container, node(wide.container, tree, 'b1'));
		cleanup();

		const narrow = mountTree(tree, A11Y_STATES, 'narrow');
		expect(describedBy(narrow.container, node(narrow.container, tree, 'b1'))).toBe(wideText);
	});

	it('describes every node in every state — no state renders a bare state name', () => {
		const tree = fiveStateTree();
		for (const viewport of ['wide', 'narrow'] as const) {
			const { container } = mountTree(tree, FIVE_STATES, viewport);
			for (const rendered of container.querySelectorAll('.node[data-uid]')) {
				const description = describedBy(container, rendered);
				expect(description).toMatch(/^Level \d+\. /);
				expect(description).toContain('Counts toward');
			}
			cleanup();
		}
	});
});

describe('§15.2 — level headings carry number, tier, and per-group progress', () => {
	it('names each level section with all three, as words rather than "2 / 2"', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES, 'narrow');

		const heading = container.querySelector('.row[data-level="2"] h3');
		expect(heading?.getAttribute('aria-label')).toBe(
			'Level 2, Novice — 0 of 2, 0 of 1 complete across two requirement groups.'
		);
		// The section takes its name from the heading, so heading traversal and
		// landmark traversal agree.
		expect(container.querySelector('.row[data-level="2"]')?.getAttribute('aria-labelledby')).toBe(
			heading?.id
		);
	});

	it('names the level groups in the wide SVG too', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		const row = container.querySelector('g.row[data-level="1"]');
		expect(row?.getAttribute('role')).toBe('group');
		expect(row?.getAttribute('aria-label')).toBe('Level 1, Novice — 2 of 2 complete.');
	});

	it('puts the milestones of a level in an ordered list (§15.2)', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES, 'narrow');

		const list = container.querySelector('.row[data-level="2"] ol');
		expect(list).not.toBeNull();
		expect(list?.querySelectorAll(':scope > li')).toHaveLength(3);
	});
});

describe('§15.2 — a single tab stop with roving tabindex', () => {
	it('leaves exactly one node tabbable', () => {
		const tree = a11yTree();
		for (const viewport of ['wide', 'narrow'] as const) {
			const { container } = mountTree(tree, A11Y_STATES, viewport);
			const tabbable = [...container.querySelectorAll('.node[data-uid]')].filter(
				(n) => n.getAttribute('tabindex') === '0'
			);
			expect(tabbable).toHaveLength(1);
			// The tab stop is the first node in reading order, not an arbitrary one.
			expect(tabbable[0].getAttribute('data-uid')).toBe(uidOf(tree, 'a1'));
			cleanup();
		}
	});

	it('moves the tab stop to wherever focus went, so returning by Tab resumes there', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		focus(node(container, tree, 'b2'));
		flushSync();

		expect(node(container, tree, 'b2').getAttribute('tabindex')).toBe('0');
		expect(node(container, tree, 'a1').getAttribute('tabindex')).toBe('-1');
	});
});

describe('§15.2 — every row of the key table', () => {
	/** Focus `from`, press `key`, and report which milestone holds focus after. */
	function traverse(
		viewport: 'wide' | 'narrow',
		from: string,
		key: string
	): { tree: CompiledTree; landed: string | undefined } {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES, viewport);
		const start = node(container, tree, from);
		focus(start);
		press(start, key);
		return { tree, landed: focusedSlug(tree) };
	}

	it.each([
		['ArrowRight', 'a1', 'a2'],
		['ArrowLeft', 'a2', 'a1'],
		// Wide draws level 1 at the bottom (§8.2), so up is a deeper level.
		['ArrowUp', 'a1', 'b1'],
		['ArrowDown', 'b1', 'a1'],
		['Home', 'c2', 'a1'],
		['End', 'a1', 'c1']
	])('wide: %s from %s lands on %s', (key, from, expected) => {
		const { tree, landed } = traverse('wide', from, key);
		expect(landed).toBe(expected);
		expect(tree.milestones.some((m) => m.id === expected)).toBe(true);
	});

	it.each([
		// Narrow draws level 1 at the top (§8.5, F27), so the arrows flip.
		['ArrowDown', 'a1', 'b1'],
		['ArrowUp', 'b1', 'a1']
	])('narrow: %s from %s lands on %s', (key, from, expected) => {
		expect(traverse('narrow', from, key).landed).toBe(expected);
	});

	it('stays put at the edge of a level rather than wrapping into another', () => {
		expect(traverse('wide', 'a1', 'ArrowLeft').landed).toBe('a1');
		expect(traverse('wide', 'a2', 'ArrowRight').landed).toBe('a2');
	});

	it('keeps ↑ and ↓ within one track, skipping levels that track does not fill', () => {
		const tree = makeScoringTree({
			id: 'gappy',
			tracks: ['heat', 'metal'],
			track: { a1: 'heat', a2: 'metal', b2: 'metal', c1: 'heat' },
			levels: [
				{ level: 1, milestones: ['a1', 'a2'] },
				{ level: 2, milestones: ['b2'] },
				{ level: 3, milestones: ['c1'] }
			]
		});
		const { container } = mountTree(tree, {});
		const start = node(container, tree, 'a1');
		focus(start);
		press(start, 'ArrowUp');

		// `heat` has nothing at level 2, so up from level 1 reaches level 3.
		expect(focusedSlug(tree)).toBe('c1');
	});

	it.each(['Enter', ' '])('opens the panel on %s', (key) => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);
		press(node(container, tree, 'b1'), key);

		expect(container.querySelector('.milestone-panel')).not.toBeNull();
	});

	it('closes the panel on Esc pressed at the node, and leaves focus there', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);
		const target = node(container, tree, 'b1');

		focus(target);
		press(target, 'Enter');
		expect(container.querySelector('.milestone-panel')).not.toBeNull();

		press(target, 'Escape');
		expect(container.querySelector('.milestone-panel')).toBeNull();
		expect(document.activeElement).toBe(target);
	});
});

describe('§15.2, F36 — the `.` shortcut', () => {
	it('jumps to the next available milestone in document order, over what lies between', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		// Document order is a1, a2, b1, b3, b2, c1, c2 — and `b3` is set aside, so
		// the two available nodes b1 and b2 are not adjacent in the DOM.
		const order = [...container.querySelectorAll('.node[data-uid]')].map((n) =>
			n.getAttribute('data-uid')
		);
		expect(order.indexOf(uidOf(tree, 'b2')) - order.indexOf(uidOf(tree, 'b1'))).toBeGreaterThan(1);

		const start = node(container, tree, 'a1');
		focus(start);
		press(start, '.');
		expect(focusedSlug(tree)).toBe('b1');

		press(node(container, tree, 'b1'), '.');
		expect(focusedSlug(tree)).toBe('b2');
	});

	it('wraps, so the last available milestone leads back to the first', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);
		const last = node(container, tree, 'c2');

		focus(last);
		press(last, '.');

		expect(focusedSlug(tree)).toBe('b1');
	});

	it('moves nothing when there is nothing available', () => {
		const tree = a11yTree();
		const everything: Record<string, MilestoneState> = {
			a1: 'complete',
			a2: 'complete',
			b1: 'complete',
			b2: 'complete',
			b3: 'complete',
			c1: 'complete',
			c2: 'complete'
		};
		const { container } = mountTree(tree, everything);
		const start = node(container, tree, 'a1');

		focus(start);
		press(start, '.');

		expect(focusedSlug(tree)).toBe('a1');
	});
});

describe('§15.2 — the live region states the consequence, not the click', () => {
	function announcerOf(container: HTMLElement): Element {
		const regions = [...container.querySelectorAll('[aria-live]')];
		expect(regions).toHaveLength(1);
		expect(regions[0].getAttribute('aria-live')).toBe('polite');
		return regions[0];
	}

	it('says nothing until something changes', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		expect(announcerOf(container).textContent?.trim()).toBe('');
	});

	it('announces the milestone, the level, the new attainment, and what opened up', () => {
		const tree = a11yTree();
		const mounted = mountTree(tree, A11Y_STATES);

		mounted.props.progress = scoreSkill(
			tree,
			progressOf(tree, { ...A11Y_STATES, b1: 'complete', b2: 'complete' })
		);
		flushSync();

		const spoken = announcerOf(mounted.container).textContent?.replace(/\s+/g, ' ').trim();
		expect(spoken).toBe(
			'b1 complete. b2 complete. Level 2 complete. Fixture is now Level 2, Novice. One milestone newly available.'
		);
	});

	it('announces a reversal as a reversal', () => {
		const tree = a11yTree();
		const done = { ...A11Y_STATES, b1: 'complete', b2: 'complete' } as Record<
			string,
			MilestoneState
		>;
		const mounted = mountTree(tree, done);

		mounted.props.progress = scoreSkill(tree, progressOf(tree, { ...done, b1: null }));
		flushSync();

		const spoken = mounted.container.querySelector('[aria-live]')?.textContent ?? '';
		expect(spoken).toContain('b1 un-checked.');
		expect(spoken).toContain('Level 2 is no longer complete.');
		expect(spoken).toContain('Fixture is now Level 1, Novice.');
	});

	it('has no assertive region anywhere in the app — assertive interrupts (§15.2)', () => {
		// The whole of `src/`, not only this component: "a single shared live
		// region" is the contract, and a second one added elsewhere — or an
		// assertive one — would break it silently.
		expect(grepSource(/aria-live=["'{]?\s*assertive/)).toEqual([]);
		expect(grepSource(/role=["'{]?\s*alert\b/)).toEqual([]);
	});
});

/** Every `src` file matching a pattern, so a rule can be stated app-wide. */
function grepSource(pattern: RegExp): string[] {
	const hits: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) walk(full);
			else if (/\.(svelte|ts)$/.test(entry) && pattern.test(readFileSync(full, 'utf8'))) {
				hits.push(full);
			}
		}
	};
	walk(join(process.cwd(), 'src'));
	return hits;
}

describe('§15.4 — never colour alone', () => {
	const states: [string, string][] = [
		['a1', 'complete'],
		['b1', 'bonus'],
		['open', 'available'],
		['gated', 'locked'],
		['nope', 'dismissed']
	];

	/** Glyph and border only: the two channels that are not colour (§9.3). */
	function signature(container: HTMLElement, tree: CompiledTree, slug: string): string {
		const rendered = node(container, tree, slug);
		const box = rendered.querySelector('rect.node-box');
		const glyph = rendered.querySelector('use.state-glyph');
		return [
			glyph?.getAttribute('href'),
			box?.getAttribute('stroke-dasharray'),
			box?.getAttribute('stroke-width')
		].join('|');
	}

	it('distinguishes all five milestone states with the palette thrown away', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATES);

		// `forced-colors: active` is the platform discarding author colour. Every
		// hue this component sets arrives through a class (`.is-complete` and its
		// four siblings) or an inline style, so the signature is built from neither
		// — only from attributes the platform leaves alone.
		const signatures = states.map(([slug]) => signature(container, tree, slug));
		expect(new Set(signatures).size).toBe(5);

		for (const rendered of container.querySelectorAll('.node')) {
			expect(rendered.getAttribute('style')).toBeNull();
			// A `fill` *attribute* would survive forced colours and defeat it; the
			// fill belongs in CSS precisely so the platform can override it.
			expect(rendered.querySelector('rect.node-box')?.getAttribute('fill')).toBeNull();
		}
	});

	it('keeps the glyph a real <use> element, so forced colours cannot drop it', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATES);

		for (const [slug] of states) {
			const glyph = node(container, tree, slug).querySelector('use.state-glyph');
			expect(glyph?.tagName.toLowerCase()).toBe('use');
			expect(glyph?.getAttribute('href')).toMatch(/^#glyph-/);
		}
		// And the symbols they point at are in the document, not in CSS.
		for (const [slug] of states) {
			const href = node(container, tree, slug)
				.querySelector('use.state-glyph')!
				.getAttribute('href')!;
			expect(container.querySelector(`symbol${href}`)).not.toBeNull();
		}
	});

	it('reports level progress as n / m text per group, not as a bar alone', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		const readouts = [...container.querySelectorAll('.row[data-level="2"] .group-progress')].map(
			(el) => el.textContent?.trim()
		);
		expect(readouts).toEqual(['0 / 2', '0 / 1']);
	});

	it('states the state in text as well, so no node depends on its fill at all', () => {
		const tree = fiveStateTree();
		const { container } = mountTree(tree, FIVE_STATES);

		for (const [slug] of states) {
			expect(describedBy(container, node(container, tree, slug))).not.toBe('');
		}
	});
});

describe('§15.5 — prefers-reduced-motion', () => {
	/**
	 * Asserted against the stylesheet rather than a computed style: jsdom applies
	 * no CSS, and the requirement is about a rule existing for every animated
	 * property — which is a property of the source, not of one rendered node.
	 */
	it('disables every transition it declares under reduce', () => {
		const reduced = SOURCE.split('@media (prefers-reduced-motion: reduce)').slice(1).join('\n');
		expect(reduced).not.toBe('');

		// Every selector that animates must appear in a reduce block turning it off.
		const animated = [...SOURCE.matchAll(/\.([a-z-]+)\s*\{[^}]*transition:/g)].map((m) => m[1]);
		expect(animated.length).toBeGreaterThan(0);
		for (const selector of new Set(animated)) {
			expect(reduced).toContain(`.${selector}`);
		}
		expect(reduced).toContain('transition: none');
	});

	it('has no animation the interface depends on — nothing here is motion-only', () => {
		// §15.5's premise. `@keyframes` or an `animation:` shorthand would be a new
		// channel, and a channel that vanishes under reduce is an information loss.
		expect(SOURCE).not.toContain('@keyframes');
		expect(SOURCE).not.toMatch(/\banimation:/);
	});
});

describe('§15.7 — responsive behaviour', () => {
	it('sizes every SVG node’s hit rectangle to at least 44×44 (§15.7)', () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		const hits = [...container.querySelectorAll('.node rect.hit-area')];
		expect(hits).toHaveLength(layoutTree(tree, 'wide').nodes.length);
		for (const hit of hits) {
			expect(Number(hit.getAttribute('width'))).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
			expect(Number(hit.getAttribute('height'))).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
		}
	});

	it('grows the hit rectangle beyond a node drawn smaller than the minimum', () => {
		const tree = a11yTree();
		const positions = layoutTree(tree, 'wide');
		// A node drawn 20×20 must still be hit-testable at 44×44, centred on it.
		const shrunk = {
			...positions,
			nodes: positions.nodes.map((n) => ({ ...n, w: 20, h: 20 }))
		};
		const progress = scoreSkill(tree, progressOf(tree, A11Y_STATES));
		const { container } = render(TreeView, {
			tree,
			positions: shrunk,
			progress,
			viewport: 'wide' as const
		});

		const hit = container.querySelector('.node rect.hit-area')!;
		expect(hit.getAttribute('width')).toBe('44');
		expect(hit.getAttribute('height')).toBe('44');
		expect(hit.getAttribute('x')).toBe('-12');
		expect(hit.getAttribute('y')).toBe('-12');
	});

	it('moves the milestone panel to a sheet with a container query, not a media query', () => {
		expect(SOURCE).toContain(`@container (width < ${PANEL_SHEET_BELOW}px)`);
		expect(SOURCE).toContain('container-type: inline-size');

		// The only permitted global media queries are the two user preferences;
		// a width media query here would make the component behave by where the
		// window is rather than by how much room it was given (§15.7).
		const media = [...SOURCE.matchAll(/@media\s*\(([^)]*)\)/g)].map((m) => m[1]);
		for (const query of media) {
			expect(query).toMatch(/prefers-reduced-motion|forced-colors/);
		}
	});

	it('keeps the narrow list’s rows finger-sized', () => {
		// The list is the phone-sized view and the primary accessible one (D-10),
		// so its targets are held to the same floor as the SVG's.
		expect(SOURCE).toMatch(/\.narrow-stack \.node \{[^}]*min-height: 44px/);
	});
});

describe('§15.8 — the axe gate', () => {
	it('finds no violation in the wide tree', async () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);

		const passed = await auditAccessibility(container);
		expect(passed.length).toBeGreaterThan(0);
	});

	it('finds no violation in the narrow list, which is the primary view (D-10)', async () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES, 'narrow');

		await auditAccessibility(container);
	});

	it('finds no violation with the milestone panel open', async () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);
		click(node(container, tree, 'b1'));

		await auditAccessibility(container);
	});

	it('finds no violation with §11.10’s consequence intercept showing', async () => {
		const tree = a11yTree();
		const { container } = mountTree(tree, A11Y_STATES);
		click(node(container, tree, 'b1'));
		click(container.querySelector('[data-action="dismiss"]')!);

		expect(container.querySelector('.consequence')).not.toBeNull();
		await auditAccessibility(container);
	});

	it('finds no violation on a tree with mastery entries', async () => {
		const tree = a11yTree();
		tree.mastery = [
			{
				id: 'feast',
				uid: 'MASTERY1',
				title: 'Forge a full set of tools',
				requires: [{ kind: 'milestone', index: 0, slug: 'a1' }]
			}
		];
		const { container } = mountTree(tree, A11Y_STATES);

		await auditAccessibility(container);
	});
});
