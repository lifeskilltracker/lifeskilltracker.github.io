/**
 * F30's level estimator (§11.8, PRD D20) — T15.
 *
 * A pure function `(tree, coarseLevel) → uid[]` and nothing else. §11.8 is
 * explicit that the estimator "slots into this engine with no new subsystem and
 * no authored data", and both halves of that are load-bearing:
 *
 * - **No new subsystem.** F29 placement has no engine mode at all — it is bulk
 *   completion through §12.4's one write path — so the only thing the engine
 *   owes self-assessment is this prefix.
 * - **No authored data.** The rule reads `level` and `uid`, two fields every
 *   compiled milestone already has. Any design that asked tree authors to map
 *   self-assessment bands onto milestones would put authoring burden on every
 *   tree forever, and C4 already names authoring as the bottleneck.
 *
 * **The output is a suggestion, not a commitment.** §11.8 and §15.6 both require
 * every pre-checked milestone to be individually reversible and announced as
 * pre-checked; §12.2 has exactly two stored states and there is deliberately no
 * third "estimated" one, so the distinction lives in the flow before commit and
 * never in the durable record.
 *
 * **The prefix is contiguous and reaches downward**, per §11.3: attainment is
 * the highest *L* with levels 1..*L* all satisfied, so an estimator that
 * pre-checked only level *L* would produce an attained level of 0 and tell the
 * user their honest self-assessment was worth nothing.
 */

import type { CompiledTree } from '$lib/types';

/** D20's coarse input: an integer level. Bands are presentation only (§15.6). */
export const MIN_COARSE_LEVEL = 1;
export const MAX_COARSE_LEVEL = 10;

export class CoarseLevelRangeError extends RangeError {
  constructor(value: number) {
    super(
      `coarse level must be an integer in ${MIN_COARSE_LEVEL}..${MAX_COARSE_LEVEL} (D20); received ${value}`,
    );
    this.name = 'CoarseLevelRangeError';
  }
}

/**
 * Every milestone uid in levels 1..`coarseLevel`, in the compiled index's own
 * order — which is deterministic, and is the order §9.5 reads the tree in.
 *
 * Mastery achievements are never included. They are a separate array on the
 * tree, carry no level, and F5 excludes them from progress entirely (§5.7), so
 * the exclusion is structural here rather than a filter that could be dropped.
 *
 * Out-of-range input throws rather than clamping. Clamping would turn a caller's
 * arithmetic bug into a silent bulk write over someone's only copy of their
 * progress, and D20 fixes the domain narrowly enough that there is nothing to
 * be tolerant of.
 */
export function estimateMilestones(tree: CompiledTree, coarseLevel: number): string[] {
  if (
    !Number.isInteger(coarseLevel) ||
    coarseLevel < MIN_COARSE_LEVEL ||
    coarseLevel > MAX_COARSE_LEVEL
  ) {
    throw new CoarseLevelRangeError(coarseLevel);
  }

  return tree.milestones
    .filter((milestone) => milestone.level >= MIN_COARSE_LEVEL && milestone.level <= coarseLevel)
    .map((milestone) => milestone.uid);
}
