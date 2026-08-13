/**
 * §11.2 — requirement group evaluation.
 *
 * Compiled bundles contain only `all` and `n_of`; `any` was normalized to
 * `n_of` with `n: 1` at build time (§7.3). `all` over a set of size *m* is
 * evaluated as `n_of` with `n = m`, which collapses this to **one branch** —
 * the only place the two rules differ is where the threshold comes from.
 *
 * **A dismissed milestone counts exactly as incomplete.** Not as complete, and
 * not as removed from the denominator. §11.10 is why that is an invariant
 * rather than a convenience, and D-22 makes it permanent: dismissal is
 * reversible (F46), so a denominator that shrank would let un-dismissing
 * *un-satisfy* a level and lower the score — an N12 violation reachable in two
 * clicks by an honest, additive user action. It would also make an
 * all-dismissed group vacuously satisfied, letting a user dismiss their way to
 * level 10.
 */

import type { CompiledTree, RequirementGroup, TreeProgress } from '$lib/types';

export interface GroupProgress {
  rule: 'all' | 'n_of';
  n: number; // threshold
  completed: number; // raw count, may exceed n
  ratio: number; // min(completed, n) / n — F11
  satisfied: boolean;
}

export interface GroupEvaluation {
  progress: GroupProgress;
  /** Every complete uid in the group, surplus included — see `satisfiedBy` in levels.ts. */
  completedUids: string[];
}

/** `all` over *m* milestones is `n_of` with `n = m`. */
export function thresholdOf(group: RequirementGroup): number {
  return group.rule === 'all' ? group.milestones.length : group.n;
}

export function evaluateGroup(
  group: RequirementGroup,
  tree: CompiledTree,
  progress: TreeProgress,
): GroupEvaluation {
  const n = thresholdOf(group);

  const completedUids: string[] = [];
  for (const ref of group.milestones) {
    // Groups hold resolved refs, not slugs (§7.3).
    const uid = tree.milestones[ref.index]?.uid;
    if (uid !== undefined && progress.milestones.get(uid) === 'complete') {
      completedUids.push(uid);
    }
  }

  const completed = completedUids.length;
  return {
    progress: {
      rule: group.rule,
      n,
      completed,
      // Capped at 1: a group cannot be more than satisfied (F11).
      ratio: Math.min(completed, n) / n,
      satisfied: completed >= n,
    },
    completedUids,
  };
}
