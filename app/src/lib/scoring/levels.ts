/**
 * §11.3 — attained, cleared, and blocker.
 *
 * **Three distinct outputs. Conflating them is the failure this design exists
 * to avoid.** `attained` is the highest *L* with levels 1..*L* all satisfied and
 * is the only input to F33; `cleared` is the satisfied set and is **never
 * summed**; `blocker` is the lowest unsatisfied level with its per-group
 * shortfall. The word "level," unqualified, always means `attained` (D-18).
 *
 * The case this exists for is not an edge case — F29 makes it the normal one. A
 * fifteen-year cook self-assessing satisfies scattered levels and misses low
 * ones they never happened to do, and the design converts that gap's cost into
 * pull: closing one milestone can move attained 1 → 4.
 */

import type { CompiledLevel, CompiledTree, TierName, TreeProgress } from '$lib/types';
import { evaluateGroup, type GroupProgress } from './groups.js';

export interface LevelProgress {
  level: number;
  groups: GroupProgress[];
  ratio: number; // unweighted mean of group ratios — F11
  satisfied: boolean;
  /** §11.5 — true exactly when a frozen record is the only thing satisfying it. */
  grandfathered: boolean;
  /** Uids satisfying this level now; the store freezes this (§11.5). */
  satisfiedBy: readonly string[];
}

const LEVELS = 10;

export function evaluateLevel(
  level: CompiledLevel,
  tree: CompiledTree,
  progress: TreeProgress,
): LevelProgress {
  const evaluations = level.requirements.map((group) => evaluateGroup(group, tree, progress));
  const groups = evaluations.map((e) => e.progress);

  // A level is satisfied when every one of its groups is satisfied.
  const evaluatedSatisfied = groups.every((g) => g.satisfied);

  // §11.5's second disjunct (D-19). The record is read, never written: T09
  // decides what to freeze and writes it inside §12.4's transaction.
  //
  // `uids.length > 0` is not defensive noise — `[].every(…)` is `true`, so
  // without it an empty record would hand out the level for nothing, and an
  // empty record is a store bug this must not reward.
  const frozen = progress.grandfathered.get(level.level);
  const frozenHolds =
    frozen !== undefined &&
    frozen.uids.length > 0 &&
    frozen.uids.every((uid) => progress.milestones.get(uid) === 'complete');

  const satisfied = evaluatedSatisfied || frozenHolds;

  // Per-group ratios survive individually: a level with an `all` group and an
  // `n_of` group has two independent things to report, and §9.6 renders them
  // separately.
  const ratio = groups.length === 0 ? 1 : groups.reduce((sum, g) => sum + g.ratio, 0) / groups.length;

  // Every complete uid across the level's groups, surplus included. Picking
  // only `n` of them would make the frozen set depend on iteration order, and
  // the store freezes what the user actually did (§11.5).
  const satisfiedBy: string[] = [];
  if (evaluatedSatisfied) {
    for (const evaluation of evaluations) {
      for (const uid of evaluation.completedUids) {
        if (!satisfiedBy.includes(uid)) satisfiedBy.push(uid);
      }
    }
  } else if (frozenHolds) {
    // What actually holds the level up. The evaluator found it short, so its
    // completed set is not the answer, and reporting nothing would leave T09
    // unable to re-freeze the record it is about to carry forward.
    satisfiedBy.push(...frozen.uids);
  }

  return {
    level: level.level,
    groups,
    ratio,
    satisfied,
    // True exactly when the frozen record is what carried it — not merely when
    // one exists. A level satisfied by evaluation *and* covered by a record
    // reports `false`, because nothing is being preserved.
    grandfathered: !evaluatedSatisfied && frozenHolds,
    satisfiedBy,
  };
}

export interface LevelSummary {
  attainedLevel: number;
  cleared: number[];
  blocker?: { level: number; shortfall: GroupProgress[] };
}

export function summarizeLevels(levels: LevelProgress[]): LevelSummary {
  // Highest L such that levels 1..L are ALL satisfied.
  let attainedLevel = 0;
  for (let level = 1; level <= LEVELS; level += 1) {
    const entry = levels.find((l) => l.level === level);
    if (entry === undefined || !entry.satisfied) break;
    attainedLevel = level;
  }

  // The satisfied set, contiguous or not — reported, never summed.
  const cleared = levels.filter((l) => l.satisfied).map((l) => l.level);

  const blocking = levels.find((l) => !l.satisfied);
  const summary: LevelSummary = { attainedLevel, cleared };
  if (blocking !== undefined) {
    summary.blocker = {
      level: blocking.level,
      // NOTE for T08/T14: `GroupProgress` carries no group identity — no index,
      // id, or milestone list — so §9.6's per-group readout cannot attribute a
      // shortfall to a specific group. Flagged rather than fixed by adding a
      // field unilaterally.
      shortfall: blocking.groups.filter((g) => !g.satisfied),
    };
  }
  return summary;
}

/**
 * F7's tiers are pairs over levels 1–10, and there is **no name below them**.
 * `null` at `attainedLevel: 0`, displayed as "Level 0 — not yet ranked" (§11.3):
 * defaulting to Novice would let an unranked skill read as ranked, and a
 * nullable field makes every consumer handle a case a default would hide.
 */
export function tierFor(attainedLevel: number): TierName | null {
  if (attainedLevel <= 0) return null;
  const tiers: TierName[] = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];
  return tiers[Math.floor((attainedLevel - 1) / 2)] ?? null;
}
