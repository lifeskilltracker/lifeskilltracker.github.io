/**
 * The Scoring Engine, tree-local half (§11.1–§11.4, §14.4).
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
 * Everything from §11.5 onward — grandfathered satisfaction, the contribution
 * table, `score`, `fill`, breadth, recency, `domainScores` — is **T11b**, and is
 * deliberately absent rather than stubbed: a `domainScores` returning zeros is
 * worse than its absence, because T13 and T14 would render it.
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
