/**
 * §5.4's rows — the join that feeds both the hex layer and the phone list (T31).
 *
 * The properties here are the ones two surfaces have to agree on. A5's claim is
 * that the list and the layer carry the same skills in the same order, and the
 * only way that stays true is if neither of them decides it.
 */

import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, readingOrder, skillHexName, skillHexRows } from './skill-hexes.js';
import type { SkillRecord } from '$lib/state/types.js';
import type { Manifest } from '$lib/types';

const tree = (
	id: string,
	domain: string,
	cell: { q: number; r: number } | undefined,
	hasMastery = false
) => ({ id, title: id, domain, cell, hasMastery });

const MANIFEST = {
	trees: [
		tree('piano', 'making', { q: 2, r: 1 }, true),
		tree('cooking', 'home', { q: 0, r: 0 }),
		tree('drawing', 'making', { q: 0, r: 0 }),
		tree('welding', 'making', { q: 1, r: 0 })
	]
} as unknown as Manifest;

const record = (treeId: string, attainedLevel: number): SkillRecord =>
	({
		treeId,
		attainedLevel,
		startedAt: '2026-01-01T00:00:00.000Z',
		lastActivityAt: '2026-01-01T00:00:00.000Z',
		contentVersionSeen: 1,
		grandfathered: {}
	}) as SkillRecord;

describe('§5.4 — one row per published tree in the domain', () => {
	it('takes the focused domain and no other', () => {
		const rows = skillHexRows(MANIFEST, 'making', {});
		expect(rows.map((row) => row.treeId).sort()).toEqual(['drawing', 'piano', 'welding']);
	});

	it('returns nothing for a domain the library has no trees for', () => {
		expect(skillHexRows(MANIFEST, 'play', {})).toEqual([]);
	});

	it('drops a tree with no committed cell rather than guessing one', () => {
		// An invented position is worse than an absent hex: it moves the next time
		// the guess changes, which is the N11 failure the ledger exists to prevent.
		const unplaced = { trees: [tree('sketching', 'making', undefined)] } as unknown as Manifest;
		expect(skillHexRows(unplaced, 'making', {})).toEqual([]);
	});
});

describe('§5.4 — the four channels', () => {
	it('reads started from the record’s existence, not from a non-zero level', () => {
		// A reader who opened a tree and completed nothing has still started it,
		// and the border is the channel that says so.
		const rows = skillHexRows(MANIFEST, 'making', { drawing: record('drawing', 0) });
		const drawing = rows.find((row) => row.treeId === 'drawing')!;
		const welding = rows.find((row) => row.treeId === 'welding')!;

		expect(drawing.started).toBe(true);
		expect(drawing.attainedLevel).toBe(0);
		expect(welding.started).toBe(false);
	});

	it('carries mastery from the manifest, so no bundle is fetched to draw a glyph', () => {
		const rows = skillHexRows(MANIFEST, 'making', {});
		expect(rows.find((row) => row.treeId === 'piano')!.hasMastery).toBe(true);
		expect(rows.find((row) => row.treeId === 'welding')!.hasMastery).toBe(false);
	});

	it('marks the ceiling separately from mastery — they are different facts', () => {
		const rows = skillHexRows(MANIFEST, 'making', { welding: record('welding', MAX_LEVEL) });
		const welding = rows.find((row) => row.treeId === 'welding')!;
		expect(welding.attainedMax).toBe(true);
		// The library publishes no mastery for it; attaining every level does not
		// invent any.
		expect(welding.hasMastery).toBe(false);
	});

	it('names the tier, so the level is not the only vocabulary', () => {
		const rows = skillHexRows(MANIFEST, 'making', { piano: record('piano', 5) });
		expect(rows.find((row) => row.treeId === 'piano')!.tier).toBe('Journeyman');
	});
});

describe('A5 — the list and the layer are given one order', () => {
	it('reads top to bottom, then left to right', () => {
		const rows = skillHexRows(MANIFEST, 'making', {});
		// drawing (0,0) and welding (1,0) share the top row; piano (2,1) is below.
		expect(rows.map((row) => row.treeId)).toEqual(['drawing', 'welding', 'piano']);
	});

	it('does not depend on the manifest’s own tree order', () => {
		const reversed = {
			trees: [...MANIFEST.trees].reverse()
		} as unknown as Manifest;
		expect(skillHexRows(reversed, 'making', {}).map((row) => row.treeId)).toEqual(
			skillHexRows(MANIFEST, 'making', {}).map((row) => row.treeId)
		);
	});

	it('does not depend on user state', () => {
		const withProgress = skillHexRows(MANIFEST, 'making', { piano: record('piano', 9) });
		expect(withProgress.map((row) => row.treeId)).toEqual(
			skillHexRows(MANIFEST, 'making', {}).map((row) => row.treeId)
		);
	});
});

describe('N11 — adding a tree moves none of the others', () => {
	it('leaves every existing cell where it was', () => {
		const before = skillHexRows(MANIFEST, 'making', {});
		const after = skillHexRows(
			{ trees: [...MANIFEST.trees, tree('turning', 'making', { q: 3, r: 2 })] } as unknown as Manifest,
			'making',
			{}
		);

		for (const row of before) {
			const still = after.find((entry) => entry.treeId === row.treeId)!;
			expect(still.cell, row.treeId).toEqual(row.cell);
		}
		expect(after).toHaveLength(before.length + 1);
	});
});

describe('§15.3 — the name carries every channel the hex draws', () => {
	it('says not started rather than level 0', () => {
		const [row] = skillHexRows(MANIFEST, 'home', {});
		expect(skillHexName(row)).toBe('cooking. Not started.');
	});

	it('gives the level as n of 10, never as a percentage (F34)', () => {
		const rows = skillHexRows(MANIFEST, 'making', { piano: record('piano', 3) });
		const name = skillHexName(rows.find((row) => row.treeId === 'piano')!);
		expect(name).toContain('Level 3 of 10.');
		expect(name).not.toContain('%');
	});

	it('names both glyph facts when both hold', () => {
		const rows = skillHexRows(MANIFEST, 'making', { piano: record('piano', MAX_LEVEL) });
		const name = skillHexName(rows.find((row) => row.treeId === 'piano')!);
		expect(name).toContain('Every level attained.');
		expect(name).toContain('Has mastery content.');
	});

	it('names the tier alongside the level', () => {
		const rows = skillHexRows(MANIFEST, 'making', { piano: record('piano', 7) });
		expect(skillHexName(rows.find((row) => row.treeId === 'piano')!)).toContain('Expert.');
	});
});

describe('§15.3 — the documented order, on integers', () => {
	/**
	 * `readingOrder` sorts by `(r, q)` and never converts to pixels. That is only
	 * correct because a pointy-top lattice makes `y` monotonic in `r` and, within
	 * a row, `x` monotonic in `q` — the property `skill-hex.test.ts` pins. These
	 * assert the consequence: the answer is the one a pixel sort would give.
	 */
	const cells = [
		{ id: 'c', cell: { q: 1, r: 1 } },
		{ id: 'a', cell: { q: 1, r: 0 } },
		{ id: 'd', cell: { q: 0, r: 2 } },
		{ id: 'b', cell: { q: 2, r: 0 } }
	];

	it('reads top to bottom, then left to right', () => {
		expect(readingOrder(cells).map((row) => row.id)).toEqual(['a', 'b', 'c', 'd']);
	});

	it('does not mutate what it is given', () => {
		const rows = [{ id: 'b', cell: { q: 0, r: 2 } }, { id: 'a', cell: { q: 0, r: 0 } }];
		readingOrder(rows);
		expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
	});

	it('is total: equal cells keep a defined order rather than throwing', () => {
		const rows = [{ id: 'a', cell: { q: 1, r: 1 } }, { id: 'b', cell: { q: 1, r: 1 } }];
		expect(readingOrder(rows)).toHaveLength(2);
	});
});
