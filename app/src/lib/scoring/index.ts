/**
 * The Scoring Engine (§11, §14.4) — `scoreSkill` over one tree, and
 * `domainScores` across all of them.
 *
 * One pure function over one compiled tree and that tree's progress. It imports
 * nothing from Svelte, the DOM, `$app`, `lib/content`, or `lib/state` — §14.1
 * forbids `lib/scoring ⇢ lib/content` outright, because an engine that did I/O
 * would stop being testable as arithmetic.
 *
 * **`scoreSkill` never writes.** It *reads* `grandfathered` and *reports*
 * `satisfiedBy`; the User State Store decides what to freeze and performs the
 * write (§3.2's single-writer rule). An engine that froze its own records would
 * be a second writer with no transaction.
 *
 * **`domainScores` never reads tree content** (§14.4). It takes attained levels
 * joined from the manifest and the `SKILL` store, which is what lets §3.3's
 * world map render before any bundle is fetched.
 *
 * Two things §11 mentions are still deliberately absent rather than stubbed:
 * F30's level estimator, whose *rule* (D20) is unresolved and is T15's, and
 * F29 placement, which §11.8 says needs no engine mode at all — it is ordinary
 * milestone completion in bulk.
 */

import type { CompiledTree, NodeState, TierName, TreeProgress } from '$lib/types';
import type { GroupProgress } from './groups.js';
import { evaluateLevel, summarizeLevels, tierFor, type LevelProgress } from './levels.js';
import { evaluateNodes } from './nodes.js';

export interface SkillProgress {
  levels: LevelProgress[]; // always 10 entries
  attainedLevel: number; // §11.3 — highest contiguous satisfied prefix
  cleared: number[]; // §11.3 — satisfied levels; never summed
  blocker?: { level: number; shortfall: GroupProgress[] }; // §11.3
  tier: TierName | null; // null iff attainedLevel === 0 — §11.3
  nodeStates: ReadonlyMap<string, NodeState>;
  available: string[]; // uids, prerequisites met, incomplete — F36
}

export function scoreSkill(tree: CompiledTree, progress: TreeProgress): SkillProgress {
  const levels = tree.levels.map((level) => evaluateLevel(level, tree, progress));
  const summary = summarizeLevels(levels);
  const { nodeStates, available } = evaluateNodes(tree, progress);

  return {
    levels,
    attainedLevel: summary.attainedLevel,
    cleared: summary.cleared,
    ...(summary.blocker === undefined ? {} : { blocker: summary.blocker }),
    tier: tierFor(summary.attainedLevel),
    nodeStates,
    available,
  };
}

export { evaluateGroup, thresholdOf } from './groups.js';
export { evaluateLevel, summarizeLevels, tierFor } from './levels.js';
export { evaluateNodes } from './nodes.js';
export type { GroupProgress } from './groups.js';
export type { LevelProgress } from './levels.js';

/**
 * The aggregation surface (§11.6, §11.7). `domainScores` crosses tree
 * boundaries, and does so without ever touching tree content — the property
 * that lets §3.3's world map render before a single bundle is fetched.
 *
 * `BANDS` and `bandFor` are re-exported for T13's regions and T20's copy, so
 * neither has to reach past this barrel into the data module and neither has a
 * reason to inline a threshold.
 */
export { domainScores } from './domain.js';
export { BANDS, bandFor } from './bands.js';
export { CONTRIBUTION, K, contribution } from './table.js';
export type { Band } from './bands.js';
