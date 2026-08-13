/**
 * F7's tier names for a *level band* (T08).
 *
 * The Scoring Engine's `tierFor` answers the same question for an **attained**
 * level, where 0 is a real answer and maps to `null` (§11.3). A band is a row of
 * the tree, always 1–10, so the null case cannot arise here — and §13.4 keeps
 * components out of the engine, so the mapping is restated rather than
 * imported.
 *
 * `TreeView.test.ts` asserts the rendered band labels against `tierFor` for all
 * ten levels, so the two cannot drift without a test failing.
 */

import type { TierName } from '$lib/types';

const TIERS: TierName[] = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];

/** Levels are paired: 1–2 Novice, 3–4 Apprentice, … 9–10 Master. */
export function bandTier(level: number): TierName {
	return TIERS[Math.floor((level - 1) / 2)] ?? TIERS[TIERS.length - 1];
}

/** §11.3 — "Level 0 — not yet ranked". Defaulting it to Novice would lie. */
export function attainmentLabel(attainedLevel: number, tier: TierName | null): string {
	if (attainedLevel <= 0 || tier === null) return 'Level 0 — not yet ranked';
	return `Level ${attainedLevel} · ${tier}`;
}
