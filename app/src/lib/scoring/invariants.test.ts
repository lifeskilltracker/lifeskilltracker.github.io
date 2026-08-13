/**
 * §11.9's invariants, tree-local half, as property tests over generated inputs.
 *
 * These are the invariants the PRD states most emphatically, and they deserve to
 * be checked exhaustively rather than anecdotally. The counter-test at the
 * bottom is what proves the suite has teeth — and it runs in **phase 0**, before
 * any content is authored against the engine.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { scoreSkill } from './index.js';
import { evaluateGroup } from './groups.js';
import type { CompiledTree, TreeProgress } from '$lib/types';
import {
  arbitraryDismissalMask,
  arbitraryTree,
  arbitraryTreeAndProgress,
  withDismissals,
} from './invariants.prop.js';

const RUNS = 1000;

describe('§11.9 invariant 8 — attained is a prefix of cleared', () => {
  it('holds over a thousand generated trees', () => {
    fc.assert(
      fc.property(arbitraryTreeAndProgress(), ([tree, progress]) => {
        const result = scoreSkill(tree, progress);

        expect(result.attainedLevel).toBeLessThanOrEqual(result.cleared.length);
        // `cleared` contains 1..attainedLevel as a prefix.
        for (let level = 1; level <= result.attainedLevel; level += 1) {
          expect(result.cleared).toContain(level);
        }
        expect(result.cleared.slice(0, result.attainedLevel)).toEqual(
          Array.from({ length: result.attainedLevel }, (_, i) => i + 1),
        );
      }),
      { numRuns: RUNS },
    );
  });
});

describe('§11.9 invariant 6, tree-local — a dismissal mask changes nothing', () => {
  it('leaves attainedLevel, cleared, and every GroupProgress untouched', () => {
    fc.assert(
      fc.property(
        arbitraryTreeAndProgress().chain(([tree, progress]) =>
          arbitraryDismissalMask(tree).map(
            (mask): [CompiledTree, TreeProgress, boolean[]] => [tree, progress, mask],
          ),
        ),
        ([tree, progress, mask]) => {
          const before = scoreSkill(tree, progress);
          const after = scoreSkill(tree, withDismissals(tree, progress, mask));

          expect(after.attainedLevel).toBe(before.attainedLevel);
          expect(after.cleared).toEqual(before.cleared);
          expect(after.levels.map((l) => l.groups)).toEqual(before.levels.map((l) => l.groups));
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('§11.10 — the counter-test that proves the suite has teeth', () => {
  /**
   * The catastrophe, implemented exactly as an improver would: a dismissed
   * milestone is removed from its group's denominator.
   *
   * On an `all` group over five, dismissing two would let the level satisfy with
   * three completions — and **un-dismissing them would then un-satisfy it and
   * reduce the score**, an N12 violation reachable in two clicks by an honest,
   * additive user action. D-22 makes the correct behaviour permanent.
   */
  function evaluateGroupShrinkingDenominator(
    group: Parameters<typeof evaluateGroup>[0],
    tree: CompiledTree,
    progress: TreeProgress,
  ) {
    const uids = group.milestones
      .map((ref) => tree.milestones[ref.index]?.uid)
      .filter((u): u is string => u !== undefined);

    const live = uids.filter((uid) => progress.milestones.get(uid) !== 'dismissed');
    const completed = live.filter((uid) => progress.milestones.get(uid) === 'complete').length;
    const n = group.rule === 'all' ? live.length : Math.min(group.n, live.length);

    return { completed, n, satisfied: n === 0 || completed >= n };
  }

  it('finds a case where dismissal changes satisfaction, and reports it', () => {
    let counterexample: { completed: number; n: number } | null = null;

    const failed = !fc.check(
      fc.property(
        arbitraryTreeAndProgress().chain(([tree, progress]) =>
          arbitraryDismissalMask(tree).map(
            (mask): [CompiledTree, TreeProgress, boolean[]] => [tree, progress, mask],
          ),
        ),
        ([tree, progress, mask]) => {
          const dismissed = withDismissals(tree, progress, mask);

          for (const level of tree.levels) {
            for (const group of level.requirements) {
              const honest = evaluateGroup(group, tree, dismissed).progress;
              const improved = evaluateGroupShrinkingDenominator(group, tree, dismissed);
              if (honest.satisfied !== improved.satisfied) {
                counterexample = { completed: improved.completed, n: improved.n };
                return false;
              }
            }
          }
          return true;
        },
      ),
      { numRuns: RUNS },
    ).failed;

    // The property FAILS under the shrinking denominator — which is the point.
    expect(failed).toBe(false);
    expect(counterexample).not.toBeNull();
  });

  it('makes an all-dismissed group vacuously satisfied, which the real engine refuses', () => {
    fc.assert(
      fc.property(arbitraryTree(), (tree) => {
        // Dismiss everything.
        const milestones = new Map(
          tree.milestones.map((m) => [m.uid, 'dismissed' as const]),
        );
        const allDismissed: TreeProgress = { milestones, grandfathered: new Map() };

        const result = scoreSkill(tree, allDismissed);

        // Under a shrinking denominator this would be attained 10 — dismissing
        // your way to Master.
        expect(result.attainedLevel).toBe(0);
        expect(result.cleared).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});

describe('§17.3 — scoring budget', () => {
  it('scores an eighty-milestone tree in under 1 ms', () => {
    const tree = fc.sample(arbitraryTree(), 1)[0];
    const big = fc
      .sample(arbitraryTree(), 40)
      .find((t) => t.milestones.length >= 60) ?? tree;

    const progress: TreeProgress = {
      milestones: new Map(big.milestones.map((m) => [m.uid, 'complete' as const])),
      grandfathered: new Map(),
    };

    const samples: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const start = performance.now();
      scoreSkill(big, progress);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);

    expect(samples[Math.floor(samples.length / 2)]).toBeLessThan(1);
  });
});
