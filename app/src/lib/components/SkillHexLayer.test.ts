// @vitest-environment jsdom

/**
 * §5.4/§5.5 — the skill hexes (T31).
 *
 * Three claims carry the section and each has a way of quietly becoming false:
 *
 * - **No channel is colour-only.** The easy regression is a started hex that
 *   differs from an unstarted one only in opacity, which is invisible to a
 *   reader with low vision and gone entirely under `forced-colors`.
 * - **A click opens the panel and does not navigate.** §5.5 declines the
 *   one-click shortcut by name, and it is the first thing an implementer adds.
 * - **The name carries what the drawing carries.** A hex whose `aria-label` is
 *   just its title has silently made four visual channels unavailable.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, flushSync, press, render } from './test-harness.svelte.js';
import SkillHexLayer from './SkillHexLayer.svelte';
import type { SkillHexRow } from '$lib/actions/skill-hexes.js';

/**
 * Rows are built literally rather than through `skillHexRows`. Two reasons: a
 * component may not import `lib/state` (§14.1) and `SkillRecord` is one of its
 * types, and the join has its own test — this file is about what the *drawing*
 * does with a row, so handing it one directly is the smaller claim.
 */
function row(overrides: Partial<SkillHexRow> & Pick<SkillHexRow, 'treeId' | 'cell'>): SkillHexRow {
	return {
		title: overrides.treeId,
		domain: 'making',
		attainedLevel: 0,
		started: false,
		hasMastery: false,
		attainedMax: false,
		tier: null,
		...overrides
	};
}

/** §15.3's order, applied — the layer never re-sorts what it is handed. */
const ROWS: readonly SkillHexRow[] = [
	row({ treeId: 'drawing', cell: { q: 0, r: 0 } }),
	row({ treeId: 'welding', cell: { q: 1, r: 0 } }),
	row({ treeId: 'piano', cell: { q: 2, r: 1 }, hasMastery: true })
];

function withRow(treeId: string, overrides: Partial<SkillHexRow>): readonly SkillHexRow[] {
	return ROWS.map((entry) => (entry.treeId === treeId ? { ...entry, ...overrides } : entry));
}

function mount(rows: readonly SkillHexRow[] = ROWS) {
	const onselect = vi.fn();
	const onleave = vi.fn();
	const mounted = render(SkillHexLayer, { rows, selected: null, onselect, onleave });
	return { ...mounted, onselect, onleave };
}

const hexOf = (container: HTMLElement, treeId: string): HTMLElement =>
	container.querySelector(`[data-skill="${treeId}"]`) as HTMLElement;

afterEach(cleanup);

describe('§5.4 — one hex per published tree, at its ledger cell', () => {
	it('draws every row and nothing else', () => {
		const { container } = mount();
		expect([...container.querySelectorAll('[data-skill]')].map((el) => el.getAttribute('data-skill'))).toEqual([
			'drawing',
			'welding',
			'piano'
		]);
	});

	it('draws nothing at all for an empty domain', () => {
		const { container } = mount([]);
		expect(container.querySelectorAll('[data-skill]')).toHaveLength(0);
	});

	it('places two skills at different points', () => {
		const { container } = mount();
		const d = hexOf(container, 'drawing').querySelector('.hex-plate')!.getAttribute('d');
		const w = hexOf(container, 'welding').querySelector('.hex-plate')!.getAttribute('d');
		expect(d).not.toBe(w);
	});
});

describe('§5.4 — no channel is colour-only', () => {
	it('separates started from unstarted by border style, not by colour', () => {
		const { container } = mount(withRow('drawing', { started: true, attainedLevel: 2, tier: 'Novice' }));

		expect(hexOf(container, 'drawing').getAttribute('data-started')).toBe('true');
		expect(hexOf(container, 'welding').getAttribute('data-started')).toBe('false');
		// The class is what the stylesheet keys the dash on, and the difference
		// survives `forced-colors`, where every fill is replaced.
		expect(hexOf(container, 'drawing').classList.contains('is-started')).toBe(true);
		expect(hexOf(container, 'welding').classList.contains('is-started')).toBe(false);
	});

	it('draws mastery as a real `<use>` glyph, not as a colour or a font character', () => {
		const { container } = mount();
		const glyph = hexOf(container, 'piano').querySelector('use.hex-glyph');
		expect(glyph).not.toBeNull();
		expect(glyph!.getAttribute('href')).toMatch(/-mastery$/);
		// The symbol it points at is really in the document.
		expect(container.querySelector(`symbol[id$="-mastery"]`)).not.toBeNull();
		expect(hexOf(container, 'welding').querySelector('use.hex-glyph')).toBeNull();
	});

	it('marks the ceiling with its own glyph, separate from mastery', () => {
		const { container } = mount(withRow('welding', { started: true, attainedLevel: 10, attainedMax: true, tier: 'Master' }));
		const glyph = hexOf(container, 'welding').querySelector('use.hex-glyph');
		expect(glyph!.getAttribute('href')).toMatch(/-max$/);
	});

	it('carries the level as a clipped rectangle, never as an opacity on the plate', () => {
		const { container } = mount(withRow('drawing', { started: true, attainedLevel: 5, tier: 'Journeyman' }));
		const below = hexOf(container, 'drawing').querySelector('.hex-below')!;
		expect(below.getAttribute('clip-path')).toMatch(/^url\(#.*-fill-drawing\)$/);

		// The plate itself is at open strength at every level — A3's rule, one
		// scale down. Two skills at different levels differ by the clip and by
		// nothing else.
		const plateA = hexOf(container, 'drawing').querySelector('.hex-plate')!;
		const plateB = hexOf(container, 'welding').querySelector('.hex-plate')!;
		expect(plateA.getAttribute('style')).toBe(plateB.getAttribute('style'));
	});
});

describe('§15.3 — the name carries everything the drawing carries', () => {
	it('names title, level, tier and both glyph facts', () => {
		const { container } = mount(withRow('piano', { started: true, attainedLevel: 10, attainedMax: true, tier: 'Master' }));
		const name = hexOf(container, 'piano').getAttribute('aria-label')!;

		expect(name).toContain('piano.');
		expect(name).toContain('Level 10 of 10.');
		expect(name).toContain('Master.');
		expect(name).toContain('Every level attained.');
		expect(name).toContain('Has mastery content.');
	});

	it('says not started rather than level 0, and never a percentage (F34)', () => {
		const { container } = mount();
		const name = hexOf(container, 'welding').getAttribute('aria-label')!;
		expect(name).toBe('welding. Not started.');
		expect(container.innerHTML).not.toContain('%');
	});
});

describe('§5.5 — two clicks, and the first one does not navigate', () => {
	it('opens the panel on click and prevents the navigation', () => {
		const { container, onselect } = mount();
		const hex = hexOf(container, 'welding');

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		hex.dispatchEvent(event);
		flushSync();

		expect(onselect).toHaveBeenCalledWith(expect.objectContaining({ treeId: 'welding' }));
		// The specific behaviour §5.5 declines: one click, one page load.
		expect(event.defaultPrevented).toBe(true);
	});

	it('is still a real link with a resolved href, so it works unhydrated', () => {
		const { container } = mount();
		expect(hexOf(container, 'piano').getAttribute('href')).toBe('/s/piano');
	});

	it('navigates normally when no handler is wired up', () => {
		const mounted = render(SkillHexLayer, { rows: ROWS });
		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		hexOf(mounted.container, 'piano').dispatchEvent(event);
		flushSync();
		expect(event.defaultPrevented).toBe(false);
	});
});

describe('§15.2 — one tab stop, and arrows move between hexes', () => {
	it('gives exactly one hex a positive tabindex', () => {
		const { container } = mount();
		const stops = [...container.querySelectorAll('[data-skill]')].filter(
			(el) => el.getAttribute('tabindex') === '0'
		);
		// Forty skills must not cost forty tabs.
		expect(stops).toHaveLength(1);
		expect(stops[0].getAttribute('data-skill')).toBe('drawing');
	});

	it('moves the roving stop with the arrow keys', () => {
		const { container } = mount();
		press(hexOf(container, 'drawing'), 'ArrowRight');

		expect(hexOf(container, 'welding').getAttribute('tabindex')).toBe('0');
		expect(hexOf(container, 'drawing').getAttribute('tabindex')).toBe('-1');
	});

	it('does not move at the edge, and does not wrap', () => {
		const { container } = mount();
		press(hexOf(container, 'drawing'), 'ArrowLeft');
		expect(hexOf(container, 'drawing').getAttribute('tabindex')).toBe('0');
	});

	it('activates on Enter without navigating', () => {
		const { container, onselect } = mount();
		press(hexOf(container, 'drawing'), 'Enter');
		expect(onselect).toHaveBeenCalledWith(expect.objectContaining({ treeId: 'drawing' }));
	});

	it('leaves level 1 on Esc, and lets the shell own the route', () => {
		const { container, onleave } = mount();
		press(hexOf(container, 'drawing'), 'Escape');
		expect(onleave).toHaveBeenCalled();
	});
});

describe('N11 — adding a skill moves none of the others', () => {
	it('leaves every existing hex path byte-identical', () => {
		const before = mount();
		const paths = new Map(
			[...before.container.querySelectorAll('[data-skill]')].map((el) => [
				el.getAttribute('data-skill'),
				el.querySelector('.hex-plate')!.getAttribute('d')
			])
		);
		cleanup();

		const after = render(SkillHexLayer, {
			rows: [...ROWS, row({ treeId: 'turning', cell: { q: 3, r: 2 } })]
		});

		for (const [treeId, d] of paths) {
			expect(
				hexOf(after.container, treeId!).querySelector('.hex-plate')!.getAttribute('d'),
				treeId!
			).toBe(d);
		}
		expect(after.container.querySelectorAll('[data-skill]')).toHaveLength(paths.size + 1);
	});
});
