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
import { CONTRIBUTION, K, domainScores, scoreSkill } from './index.js';
import { evaluateGroup } from './groups.js';
import type { CompiledTree, TreeProgress } from '$lib/types';
import {
  arbitraryDismissalMask,
  arbitraryTaxonomy,
  arbitraryTaxonomyAndRows,
  arbitraryTree,
  arbitraryTreeAndProgress,
  frozenAs,
  isoAt,
  withAddedMilestones,
  withDismissals,
  withOneMoreCompletion,
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

/* ------------------------------------------------------------------------- *
 * T11b — §11.9 invariants 1–5, the score half of 6, and 7.
 *
 * Invariant 8 and the tree-local half of 6 are above, and green since phase 0.
 * A reviewer should be able to read all eight off the test names across the two
 * halves of this file.
 * ------------------------------------------------------------------------- */

describe('§11.9 invariant 1 — completing a milestone never decreases any DomainScore field', () => {
  /**
   * N12 is the invariant the PRD states most emphatically, and it earns the
   * suite's headline slot. **No exemption** — including `lastActivityAt`, which
   * is a maximum over timestamps and so rises with the activity that produced
   * the completion (D-20, T26/F5).
   *
   * The completion is a real one: a generated tree's progress gains one
   * milestone, `scoreSkill` recomputes `attainedLevel`, and that number is what
   * reaches the row. An invariant tested by incrementing a number directly
   * would not connect the two halves of §11 at all.
   */
  it('holds over a thousand generated completions', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          arbitraryTreeAndProgress(),
          arbitraryTaxonomyAndRows(),
          fc.integer({ min: 0, max: 1000 }),
        ),
        ([[tree, progress], [taxonomy, others], pick]) => {
          const domain = taxonomy.domains[0].id;
          const before = scoreSkill(tree, progress).attainedLevel;
          const after = scoreSkill(tree, withOneMoreCompletion(tree, progress, pick))
            .attainedLevel;

          const rowBefore = {
            treeId: tree.id,
            domain,
            attainedLevel: before,
            lastActivityAt: isoAt(Date.UTC(2026, 5, 1)),
          };
          const rowAfter = {
            ...rowBefore,
            attainedLevel: after,
            lastActivityAt: isoAt(Date.UTC(2026, 5, 2)),
          };

          const scoresBefore = domainScores(taxonomy, [...others, rowBefore]);
          const scoresAfter = domainScores(taxonomy, [...others, rowAfter]);

          for (const id of taxonomy.domains.map((d) => d.id)) {
            const a = scoresBefore.get(id)!;
            const b = scoresAfter.get(id)!;
            expect(b.score).toBeGreaterThanOrEqual(a.score);
            expect(b.fill).toBeGreaterThanOrEqual(a.fill);
            expect(b.breadth).toBeGreaterThanOrEqual(a.breadth);
            // Compared as strings, which §12.2's fixed-precision UTC form makes
            // an ordering — `toBeGreaterThanOrEqual` takes numbers only.
            expect((b.lastActivityAt ?? '') >= (a.lastActivityAt ?? '')).toBe(true);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('§11.9 invariant 2 — starting a skill adds 0 to score and 1 to breadth', () => {
  it('holds over generated taxonomies and row sets (N12, F33)', () => {
    fc.assert(
      fc.property(
        arbitraryTaxonomyAndRows(),
        ([taxonomy, rows]) => {
          const domain = taxonomy.domains[0].id;
          const started = {
            treeId: 'freshly-started',
            domain,
            attainedLevel: 0,
            lastActivityAt: isoAt(Date.UTC(2026, 0, 1)),
          };

          const before = domainScores(taxonomy, rows).get(domain)!;
          const after = domainScores(taxonomy, [...rows, started]).get(domain)!;

          expect(after.score).toBe(before.score);
          expect(after.fill).toBe(before.fill);
          expect(after.breadth).toBe(before.breadth + 1);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('§11.9 invariant 3 — fill strictly increases with every level attained', () => {
  it('holds for every L → L+1 over generated surrounding rows (F34)', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbitraryTaxonomyAndRows(), fc.integer({ min: 0, max: 9 })),
        ([[taxonomy, rows], level]) => {
          const domain = taxonomy.domains[0].id;
          const at = (attainedLevel: number) =>
            domainScores(taxonomy, [
              ...rows,
              {
                treeId: 'climber',
                domain,
                attainedLevel,
                lastActivityAt: isoAt(Date.UTC(2026, 0, 1)),
              },
            ]).get(domain)!.fill;

          expect(at(level + 1)).toBeGreaterThan(at(level));
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('§11.9 invariant 4 — the first level is the largest step in fill', () => {
  /**
   * Computed **from the shipped `CONTRIBUTION` and `K`, never from `L ** 1.25`**.
   * The earlier spec failed this invariant and failed it invisibly, precisely
   * because the test was written against the continuous curve rather than the
   * rounded integers the app ships (T26/F1). There is **no tolerance**: the
   * invariant is `≥`, exact.
   */
  const fillOf = (score: number) => score / (score + K);

  it('gives Δfill(0→1) ≥ Δfill(L→L+1) for every L ≥ 1 on a lone skill', () => {
    const first = fillOf(CONTRIBUTION[0]) - fillOf(0);

    for (let level = 1; level < CONTRIBUTION.length; level += 1) {
      const step = fillOf(CONTRIBUTION[level]) - fillOf(CONTRIBUTION[level - 1]);
      expect(first).toBeGreaterThanOrEqual(step);
    }
  });

  it('reproduces the ten quoted deltas in percentage points', () => {
    const deltas = CONTRIBUTION.map(
      (contribution, i) => (fillOf(contribution) - fillOf(i === 0 ? 0 : CONTRIBUTION[i - 1])) * 100,
    );

    const quoted = [14.29, 14.07, 11.64, 8.39, 7.17, 5.42, 4.49, 3.76, 3.02, 2.48];
    deltas.forEach((delta, i) => expect(delta).toBeCloseTo(quoted[i], 2));
  });

  it('is checked against the engine, not only against the constants', () => {
    // The same claim, routed through `domainScores`, so a future `fill` that
    // stopped being `s / (s + K)` could not slip past a constants-only test.
    const taxonomy = fc.sample(arbitraryTaxonomy(), 1)[0];
    const domain = taxonomy.domains[0].id;
    const fillAt = (attainedLevel: number) =>
      domainScores(taxonomy, [
        {
          treeId: 'lone',
          domain,
          attainedLevel,
          lastActivityAt: isoAt(Date.UTC(2026, 0, 1)),
        },
      ]).get(domain)!.fill;

    const first = fillAt(1) - fillAt(0);
    for (let level = 1; level <= 9; level += 1) {
      expect(first).toBeGreaterThanOrEqual(fillAt(level + 1) - fillAt(level));
    }
  });
});

describe('§11.9 invariant 5 — fill never reaches 1', () => {
  it('holds over generated row sets (F34)', () => {
    fc.assert(
      fc.property(arbitraryTaxonomyAndRows(), ([taxonomy, rows]) => {
        for (const score of domainScores(taxonomy, rows).values()) {
          expect(score.fill).toBeGreaterThanOrEqual(0);
          expect(score.fill).toBeLessThan(1);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('does not saturate on five hundred mastered skills in one domain', () => {
    const taxonomy = fc.sample(arbitraryTaxonomy(), 1)[0];
    const domain = taxonomy.domains[0].id;
    const rows = Array.from({ length: 500 }, (_, i) => ({
      treeId: `t${i}`,
      domain,
      attainedLevel: 10,
      lastActivityAt: isoAt(Date.UTC(2026, 0, 1)),
    }));

    const fill = domainScores(taxonomy, rows).get(domain)!.fill;

    expect(fill).toBeLessThan(1);
    expect(fill).toBeGreaterThan(0.99);
  });
});

describe('§11.9 invariant 6, score half — dismissal changes no DomainScore field', () => {
  it('holds over a generated dismissal mask applied to a generated progress map', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          arbitraryTreeAndProgress().chain(([tree, progress]) =>
            arbitraryDismissalMask(tree).map(
              (mask): [CompiledTree, TreeProgress, boolean[]] => [tree, progress, mask],
            ),
          ),
          arbitraryTaxonomyAndRows(),
        ),
        ([[tree, progress, mask], [taxonomy, others]]) => {
          const domain = taxonomy.domains[0].id;
          const rowsFor = (p: TreeProgress) => [
            ...others,
            {
              treeId: tree.id,
              domain,
              attainedLevel: scoreSkill(tree, p).attainedLevel,
              lastActivityAt: isoAt(Date.UTC(2026, 0, 1)),
            },
          ];

          const before = domainScores(taxonomy, rowsFor(progress));
          const after = domainScores(
            taxonomy,
            rowsFor(withDismissals(tree, progress, mask)),
          );

          expect([...after.entries()]).toEqual([...before.entries()]);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('§11.9 invariant 7 — tree revision alone never decreases attained', () => {
  /**
   * The scenario §11.5 exists for: a satisfied level grows a milestone the user
   * has not done. The store freezes each satisfied level's `satisfiedBy` before
   * the revision lands (§12.4), and the frozen record is what holds the level
   * up afterwards. The user did nothing — so nothing may fall.
   *
   * T26/F2 is what made this expressible: before `TreeProgress` carried
   * `grandfathered`, this invariant had nowhere to be tested and shipped as a
   * documented gap.
   */
  it('holds over a thousand generated revisions', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbitraryTreeAndProgress(), fc.array(fc.integer({ min: 1, max: 10 }), {
          minLength: 1,
          maxLength: 10,
        })),
        ([[tree, progress], levels]) => {
          const before = scoreSkill(tree, progress);
          // Freeze exactly what T09 would, at the pre-revision contentVersion.
          const frozen = frozenAs(progress, tree.contentVersion, before.levels);

          const revised = withAddedMilestones(tree, [...new Set(levels)]);
          const after = scoreSkill(revised, frozen);

          expect(after.attainedLevel).toBeGreaterThanOrEqual(before.attainedLevel);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('drops the grandfathered level again if the user un-checks a frozen milestone', () => {
    // The counterpart that proves invariant 7 is not a ratchet (R-22), and so
    // does not contradict the honest recompute. Sampled for the case that
    // actually exercises it: a level 1 that survives the revision *only*
    // because of its record. (A level whose sole group is `n_of` keeps its
    // threshold when a milestone is added and never becomes grandfathered.)
    const found = fc
      .sample(arbitraryTreeAndProgress(), 500)
      .map(([tree, progress]) => {
        const before = scoreSkill(tree, progress);
        const frozen = frozenAs(progress, tree.contentVersion, before.levels);
        const revised = withAddedMilestones(tree, [1]);
        return { before, frozen, revised, after: scoreSkill(revised, frozen) };
      })
      .find(({ after }) => after.levels[0].grandfathered);

    expect(found).toBeDefined();
    const { before, frozen, revised, after } = found!;

    expect(after.attainedLevel).toBeGreaterThanOrEqual(before.attainedLevel);
    expect(after.attainedLevel).toBeGreaterThanOrEqual(1);

    const unchecked = new Map(frozen.milestones);
    unchecked.delete(after.levels[0].satisfiedBy[0]);
    const reverted = scoreSkill(revised, { ...frozen, milestones: unchecked });

    expect(reverted.levels[0].satisfied).toBe(false);
    expect(reverted.levels[0].grandfathered).toBe(false);
    expect(reverted.attainedLevel).toBe(0);
  });
});
