/**
 * Generators for arbitrary valid `CompiledTree` and `TreeProgress` values.
 *
 * **Exported, because T11b extends them** rather than writing its own — the two
 * halves of §11 must property-test against the same corpus or an invariant that
 * holds tree-locally and breaks under aggregation has nowhere to show up.
 *
 * `fast-check` is the choice this task makes (no property-testing library is
 * named anywhere in the architecture) and T11b inherits it. It is a
 * devDependency of `app/` only: `tools/` declares no application dependencies
 * (§4.2).
 */

import fc from 'fast-check';
import type { CompiledTree, MilestoneState, TreeProgress } from '$lib/types';
import { makeScoringTree, type GroupSpec, type LevelSpec } from './fixtures.js';

/** §5.3: four to eight milestones per level. */
const MILESTONES_PER_LEVEL = { min: 4, max: 8 };

/**
 * Requirement groups over one level's milestones: an `all` over the whole set,
 * or an `n_of` with a threshold inside the set's size, or both.
 */
function groupsFor(slugs: string[]): fc.Arbitrary<GroupSpec[]> {
  const all: GroupSpec = { rule: 'all', milestones: slugs };
  const nOf = fc
    .integer({ min: 1, max: slugs.length })
    .map((n): GroupSpec => ({ rule: 'n_of', n, milestones: slugs }));

  return fc.oneof(
    fc.constant<GroupSpec[]>([all]),
    nOf.map((g) => [g]),
    nOf.map((g) => [{ rule: 'all' as const, milestones: slugs.slice(0, 2) }, g]),
  );
}

/**
 * All ten levels are populated, always.
 *
 * T11a's acceptance criteria say "1–10 levels populated", but §5.3 fixes
 * `levels` at exactly ten entries of four to eight milestones each, so a tree
 * with an empty level is not a valid `CompiledTree` and no compiled bundle can
 * contain one. Generating them found a real consequence rather than a real bug:
 * an `all` group over zero milestones has `n = 0`, so `completed >= n` holds
 * vacuously and every empty level reads as satisfied. The engine is right to
 * have no defensive branch there — §14.3 makes it total over *valid* bundles,
 * and the group schema's `minItems: 1` is what guarantees `n >= 1`. The
 * generator is what was wrong.
 */
export function arbitraryTree(): fc.Arbitrary<CompiledTree> {
  return fc
    .constant(10)
    .chain((populatedLevels) =>
      fc
        .tuple(
          ...Array.from({ length: populatedLevels }, (_, i) =>
            fc
              .integer(MILESTONES_PER_LEVEL)
              .chain((count) => {
                const slugs = Array.from({ length: count }, (_, j) => `l${i + 1}-m${j}`);
                return groupsFor(slugs).map(
                  (requirements): LevelSpec => ({
                    level: i + 1,
                    milestones: slugs,
                    requirements,
                  }),
                );
              }),
          ),
        )
        .map((levels) => {
          // `requires` edges point strictly downward in the flat order, so the
          // graph is acyclic by construction (§6.2 rules 4–5).
          const requires: Record<string, string[]> = {};
          const flat = levels.flatMap((l) => l.milestones);
          flat.forEach((slug, index) => {
            if (index > 0 && index % 3 === 0) requires[slug] = [flat[index - 1]];
          });
          return makeScoringTree({ levels, requires });
        }),
    );
}

/** Arbitrary progress over a tree's uids, with an empty `grandfathered` map (T11b fills it). */
export function arbitraryProgress(tree: CompiledTree): fc.Arbitrary<TreeProgress> {
  const uids = tree.milestones.map((m) => m.uid);
  return fc
    .array(fc.constantFrom<MilestoneState>('complete', 'dismissed', null), {
      minLength: uids.length,
      maxLength: uids.length,
    })
    .map((states) => {
      const milestones = new Map<string, MilestoneState>();
      uids.forEach((uid, i) => {
        if (states[i] !== null) milestones.set(uid, states[i]);
      });
      return { milestones, grandfathered: new Map() };
    });
}

/** A tree paired with progress over its own uids. */
export function arbitraryTreeAndProgress(): fc.Arbitrary<[CompiledTree, TreeProgress]> {
  return arbitraryTree().chain((tree) =>
    arbitraryProgress(tree).map((progress): [CompiledTree, TreeProgress] => [tree, progress]),
  );
}

/** A boolean mask over a tree's uids, for invariant 6's dismissal mask. */
export function arbitraryDismissalMask(tree: CompiledTree): fc.Arbitrary<boolean[]> {
  return fc.array(fc.boolean(), {
    minLength: tree.milestones.length,
    maxLength: tree.milestones.length,
  });
}

/**
 * Applies a dismissal mask to the milestones that are **not complete**.
 * Dismissing a complete milestone would change its state rather than test the
 * invariant, which is about `dismissed` versus absent (§11.10).
 */
export function withDismissals(
  tree: CompiledTree,
  progress: TreeProgress,
  mask: boolean[],
): TreeProgress {
  const milestones = new Map(progress.milestones);
  tree.milestones.forEach((milestone, i) => {
    if (!mask[i]) return;
    if (milestones.get(milestone.uid) === 'complete') return;
    milestones.set(milestone.uid, 'dismissed');
  });
  return { ...progress, milestones };
}
