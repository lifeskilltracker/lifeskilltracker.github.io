/**
 * §5.4's rows — one per published tree in a domain, carrying the four channels
 * the hex draws and the phone list writes out (T31).
 *
 * **This is `lib/actions` for the same reason `domain-scores.ts` is.** A row
 * needs the manifest (title, domain, cell, mastery) and the `SKILL` mirror
 * (attained level, started, tier) at once, and §14.1 gives exactly one layer
 * permission to hold both. `SkillHexLayer` and `DomainSkillList` import neither
 * the loader nor `lib/state`; they are handed rows.
 *
 * **Two consumers, one order.** A5's convergence claim is that the hex layer and
 * the list carry the same skills in the same order, so the ordering happens here
 * — in `readingOrder`, once — rather than in either component. A component that
 * sorted its own rows would make the claim false the first time one changed.
 *
 * **The cell is read, never derived.** T29 owns placement; re-running the spiral
 * client-side would put an N11 guarantee in two places and they would disagree.
 * A tree whose manifest entry carries no cell is dropped rather than placed at a
 * guessed one — an invented position is worse than an absent hex, because it
 * moves the next time the guess changes.
 */

import { tierFor } from '$lib/scoring';
import type { Cell } from '$lib/components/skill-hex.js';
import type { SkillRecord } from '$lib/state/types.js';
import type { DomainId, Manifest, TierName } from '$lib/types';

export interface SkillHexRow {
	readonly treeId: string;
	readonly title: string;
	readonly domain: DomainId;
	readonly cell: Cell;
	/** 0–10. The water line is `attainedLevel / 10` (§5.4). */
	readonly attainedLevel: number;
	/** Border: solid when started, dashed when not. */
	readonly started: boolean;
	/** Glyph: the library publishes mastery content for this tree (§5.4). */
	readonly hasMastery: boolean;
	/** Glyph: this reader has attained level 10 (§5.4). */
	readonly attainedMax: boolean;
	readonly tier: TierName | null;
}

/** §11.4's ceiling, and the denominator of the hex's water line. */
export const MAX_LEVEL = 10;

export function skillHexRows(
	manifest: Manifest,
	domain: DomainId,
	skills: Record<string, SkillRecord>
): SkillHexRow[] {
	const rows: SkillHexRow[] = [];

	for (const tree of manifest.trees) {
		// Primary domain only, exactly as §11.6 scores it. A tree listed under a
		// secondary domain is counted elsewhere, and drawing it in both places
		// would show the same progress twice on one map.
		if (tree.domain !== domain) continue;
		if (tree.cell === undefined) continue;

		const record = skills[tree.id];
		const attainedLevel = record?.attainedLevel ?? 0;

		rows.push({
			treeId: tree.id,
			title: tree.title,
			domain: tree.domain,
			cell: tree.cell,
			attainedLevel,
			// Presence of a record, not a non-zero level: a reader who has opened a
			// tree and completed nothing has still started it, and §5.4's border is
			// the channel that says so.
			started: record !== undefined,
			hasMastery: tree.hasMastery,
			attainedMax: attainedLevel >= MAX_LEVEL,
			tier: tierFor(attainedLevel)
		});
	}

	return readingOrder(rows);
}

/**
 * §15.3's documented order, and the order the phone list renders in: reading
 * order over the hexes — top to bottom, then left to right within a row.
 *
 * **It is integer arithmetic on the cell, not a comparison of pixel centres.**
 * On a pointy-top lattice `y` is `1.5 · size · r` and `x` is monotonic in `q`
 * within a fixed `r`, so sorting by `(r, q)` *is* sorting by `(y, x)` — with no
 * geometry imported, which is what keeps `skill-hex.ts` off the first route's
 * chunk (§17.1). `skill-hex.test.ts` pins the lattice this relies on.
 *
 * It lives here rather than in either component because **the list and the
 * layer have to agree**, and A5's convergence claim is exactly that they do. A
 * component that sorted its own rows would make the claim false the first time
 * one of them changed.
 */
export function readingOrder<T extends { readonly cell: Cell }>(rows: readonly T[]): T[] {
	return [...rows].sort((a, b) => a.cell.r - b.cell.r || a.cell.q - b.cell.q);
}

/**
 * §15.3's name, carrying every channel the hex draws as words.
 *
 * The level arrives as `n of 10` rather than as a percentage: F34 forbids the
 * raw fill on the map, and the hex's water line is the same quantity in the same
 * discipline. The tier is named because it is the vocabulary the rest of the
 * application uses for the same number, and a reader who hears only "3 of 10"
 * has to convert it themselves.
 */
export function skillHexName(row: SkillHexRow): string {
	const parts = [`${row.title}.`];

	if (!row.started) {
		parts.push('Not started.');
	} else {
		parts.push(`Level ${row.attainedLevel} of ${MAX_LEVEL}.`);
		if (row.tier !== null) parts.push(`${row.tier}.`);
	}

	if (row.attainedMax) parts.push('Every level attained.');
	if (row.hasMastery) parts.push('Has mastery content.');

	return parts.join(' ');
}
