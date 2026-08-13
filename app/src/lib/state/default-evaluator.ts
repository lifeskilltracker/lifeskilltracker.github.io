/**
 * The phase-0 stand-in for §12.4 step 2's recompute.
 *
 * The store must not implement level semantics of its own — that is the Scoring
 * Engine's `scoreSkill` (§14.4, T11a). This exists only so the write path is
 * complete and testable before the engine lands, and T10 is the gate where the
 * swap is checked. **Deleting this file is the intended end state**: T11a
 * supplies a real evaluator through the same injection point `applyLineage`
 * already uses for its evaluator argument (§14.5).
 *
 * It implements the narrow thing §12.4 needs and nothing more: which levels are
 * satisfied by the current records, which uids satisfy them, and the highest
 * contiguous satisfied prefix (§11.3).
 */

import type { CompiledTree, TreeProgress } from '$lib/types';

export interface AttainedLevelEvaluation {
  attainedLevel: number;
  /** Per satisfied level, the uids that satisfy it now — what the store freezes (§11.5). */
  satisfiedBy: ReadonlyMap<number, readonly string[]>;
}

export type AttainedLevelEvaluator = (
  tree: CompiledTree,
  progress: TreeProgress,
) => AttainedLevelEvaluation;

export const evaluateAttainedLevel: AttainedLevelEvaluator = (tree, progress) => {
  // Requirement groups hold resolved refs, not slugs: §7.3 resolves every slug
  // reference to an array index at compile time so the runtime builds no map.
  const uidAt = (index: number): string | undefined => tree.milestones[index]?.uid;
  const isComplete = (index: number): boolean => {
    const uid = uidAt(index);
    return uid !== undefined && progress.milestones.get(uid) === 'complete';
  };

  const satisfiedBy = new Map<number, readonly string[]>();

  for (const level of tree.levels) {
    const satisfying: string[] = [];
    // A compiled bundle always carries explicit requirement groups (§7.3), and
    // `any` has already become `n_of` with n: 1, so there are two rules here.
    const satisfied = level.requirements.every((group) => {
      const completed = group.milestones.filter((ref) => isComplete(ref.index));
      const threshold = group.rule === 'all' ? group.milestones.length : group.n;
      if (completed.length < threshold) return false;
      for (const ref of completed.slice(0, threshold)) {
        const uid = uidAt(ref.index);
        if (uid !== undefined && !satisfying.includes(uid)) satisfying.push(uid);
      }
      return true;
    });

    if (satisfied) satisfiedBy.set(level.level, satisfying);
  }

  // §11.3: the highest contiguous satisfied prefix, never a count of satisfied levels.
  let attainedLevel = 0;
  for (let level = 1; level <= 10; level += 1) {
    if (!satisfiedBy.has(level)) break;
    attainedLevel = level;
  }

  return { attainedLevel, satisfiedBy };
};
