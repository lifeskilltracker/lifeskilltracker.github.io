/**
 * §11.9's invariant 6, taken all the way: **dismissing or un-dismissing changes
 * no score, ever** (T19, F46, D-22).
 *
 * `invariants.test.ts` already checks a single dismissal *mask*, which is the
 * one-way half. This file is the reversible half, and reversibility is the whole
 * argument. §11.10's catastrophe is not that a shrinking denominator reads
 * oddly; it is that dismissal is undoable, so a denominator that shrinks on
 * dismissal **grows again on un-dismissal** — and a level satisfied at three of
 * three becomes unsatisfied at three of five, dropping the user's rank through
 * an action that added information and took nothing away. That is an N12
 * violation reachable in two clicks. So the property here is stated over
 * *sequences* of dismissals and un-dismissals rather than over one mask, and it
 * compares against the baseline after every step.
 *
 * **What is deliberately not asserted invariant: `nodeStates`.** A dismissed
 * milestone renders as `dismissed` (§9.3) and that is the point — D-22 makes
 * `dismissed` presentation-only, not invisible. The separation this file draws
 * is exactly that line: every field the score is made of is frozen, and the
 * presentation channel is free to move.
 *
 * A dismissal is only ever applied to a milestone that is **not complete**.
 * "Not for me" on something already recorded as done is an un-check wearing a
 * different button, governed by §11.10's other rule and by
 * `uncheck-consequence.ts` — folding it in here would test two rules at once and
 * pass for the wrong reason.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { domainScores, evaluateGroup, scoreSkill } from './index.js';
import { makeScoringTree, progressOf, uidOf } from './fixtures.js';
import { arbitraryTaxonomy, arbitraryTreeAndProgress, isoAt } from './invariants.prop.js';
import type { CompiledTree, DomainSkillRow, MilestoneState, TreeProgress } from '$lib/types';

const RUNS = 500;

/** One step of a user's session: hit "Not for me", or take it back. */
interface DismissalStep {
  /** Modulo the tree's milestone count, so any `nat` names a real milestone. */
  index: number;
  dismiss: boolean;
}

function arbitrarySequence(): fc.Arbitrary<DismissalStep[]> {
  return fc.array(fc.record({ index: fc.nat(), dismiss: fc.boolean() }), { maxLength: 24 });
}

/**
 * Applies one step. Un-dismissal deletes the record rather than storing a third
 * value: §12.2 makes incomplete the *absence* of a record, and F46 makes
 * dismissal reversible into that absence rather than into a state of its own.
 */
function step(tree: CompiledTree, progress: TreeProgress, op: DismissalStep): TreeProgress {
  const milestone = tree.milestones[op.index % tree.milestones.length];
  const current = progress.milestones.get(milestone.uid);
  if (current === 'complete') return progress;

  const milestones = new Map<string, MilestoneState>(progress.milestones);
  if (op.dismiss) milestones.set(milestone.uid, 'dismissed');
  else milestones.delete(milestone.uid);
  return { ...progress, milestones };
}

/**
 * Every field of `SkillProgress` the score is made of, and nothing else.
 * `nodeStates` and `available` are the presentation channel (§9.3, F36) and are
 * excluded on purpose — see the module note.
 */
function scoreFields(tree: CompiledTree, progress: TreeProgress) {
  const result = scoreSkill(tree, progress);
  return {
    attainedLevel: result.attainedLevel,
    cleared: result.cleared,
    tier: result.tier,
    blocker: result.blocker ?? null,
    levels: result.levels.map((level) => ({
      level: level.level,
      ratio: level.ratio,
      satisfied: level.satisfied,
      grandfathered: level.grandfathered,
      satisfiedBy: level.satisfiedBy,
      groups: level.groups,
    })),
  };
}

describe('§11.9 invariant 6 — dismissing and un-dismissing move no score, over sequences', () => {
  it('holds after every step of a generated dismiss/undismiss sequence', () => {
    fc.assert(
      fc.property(
        arbitraryTreeAndProgress().chain(([tree, progress]) =>
          arbitrarySequence().map(
            (sequence): [CompiledTree, TreeProgress, DismissalStep[]] => [
              tree,
              progress,
              sequence,
            ],
          ),
        ),
        ([tree, progress, sequence]) => {
          const baseline = scoreFields(tree, progress);

          let current = progress;
          for (const op of sequence) {
            current = step(tree, current, op);
            // Compared after *every* step, not only at the end: a sequence that
            // ends where it started would hide a score that moved in the middle,
            // and the middle is what the user sees.
            expect(scoreFields(tree, current)).toEqual(baseline);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });

  /**
   * The guard that stops the two properties above from passing for the wrong
   * reason. A sequence that never lands a dismissal — because every generated
   * index hit an already-complete milestone, say — satisfies "nothing moved"
   * trivially, and a suite of those would go green against any engine at all.
   */
  it('actually dismisses things — the vacuity guard', () => {
    let sequencesThatDismissed = 0;
    let nodeStatesObservedChanging = 0;

    fc.assert(
      fc.property(
        arbitraryTreeAndProgress().chain(([tree, progress]) =>
          arbitrarySequence()
            .filter((sequence) => sequence.length > 0)
            .map(
              (sequence): [CompiledTree, TreeProgress, DismissalStep[]] => [
                tree,
                progress,
                sequence,
              ],
            ),
        ),
        ([tree, progress, sequence]) => {
          let current = progress;
          for (const op of sequence) current = step(tree, current, { ...op, dismiss: true });

          const dismissed = [...current.milestones.values()].filter((s) => s === 'dismissed');
          const wasDismissed = [...progress.milestones.values()].filter((s) => s === 'dismissed');
          if (dismissed.length > wasDismissed.length) sequencesThatDismissed += 1;

          // The presentation channel is the one thing that *must* move (§9.3).
          const before = scoreSkill(tree, progress).nodeStates;
          const after = scoreSkill(tree, current).nodeStates;
          for (const [uid, state] of after) {
            if (before.get(uid) !== state) {
              nodeStatesObservedChanging += 1;
              break;
            }
          }
        },
      ),
      { numRuns: 100 },
    );

    expect(sequencesThatDismissed).toBeGreaterThan(50);
    expect(nodeStatesObservedChanging).toBeGreaterThan(50);
  });

  it('returns every field to its starting value when the sequence is undone', () => {
    fc.assert(
      fc.property(
        arbitraryTreeAndProgress().chain(([tree, progress]) =>
          arbitrarySequence().map(
            (sequence): [CompiledTree, TreeProgress, DismissalStep[]] => [
              tree,
              progress,
              sequence,
            ],
          ),
        ),
        ([tree, progress, sequence]) => {
          const baseline = scoreFields(tree, progress);

          let current = progress;
          for (const op of sequence) current = step(tree, current, { ...op, dismiss: true });
          for (const op of [...sequence].reverse()) {
            current = step(tree, current, { ...op, dismiss: false });
          }

          expect(scoreFields(tree, current)).toEqual(baseline);
        },
      ),
      { numRuns: RUNS },
    );
  });

  /**
   * The aggregation half (§11.7). `domainScores` reads `attainedLevel` and
   * nothing else about a tree, so this follows from the property above — but it
   * follows only as long as that stays true, and a `DomainScore` that moved on a
   * dismissal is the failure a user would actually notice: the world map
   * changing colour because they said "not for me".
   */
  it('moves no DomainScore field — score, fill, breadth, or recency', () => {
    const taxonomy = fc.sample(arbitraryTaxonomy(), 1)[0];
    const domain = taxonomy.domains[0].id;

    fc.assert(
      fc.property(
        arbitraryTreeAndProgress().chain(([tree, progress]) =>
          arbitrarySequence().map(
            (sequence): [CompiledTree, TreeProgress, DismissalStep[]] => [
              tree,
              progress,
              sequence,
            ],
          ),
        ),
        ([tree, progress, sequence]) => {
          const rowFor = (p: TreeProgress): DomainSkillRow[] => [
            {
              treeId: tree.id,
              domain,
              attainedLevel: scoreSkill(tree, p).attainedLevel,
              lastActivityAt: isoAt(Date.UTC(2026, 0, 1)),
            },
          ];

          const before = domainScores(taxonomy, rowFor(progress));

          let current = progress;
          for (const op of sequence) current = step(tree, current, op);

          expect([...domainScores(taxonomy, rowFor(current))]).toEqual([...before]);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * §11.10's catastrophe, named and pinned as a regression rather than left to the
 * generators to rediscover.
 *
 * Five milestones in one `all` group, two dismissed, three complete. The honest
 * reading is 3 of 5 and unsatisfied. The "improvement" D-22 forbids reads 3 of 3
 * and satisfied — and then un-dismissing either milestone takes the level back
 * off the user.
 */
describe('§11.10 — an `all` group of five with two dismissed', () => {
  function fiveGroupTree(): CompiledTree {
    return makeScoringTree({
      id: 'all-of-five',
      levels: [
        {
          level: 1,
          milestones: ['m1', 'm2', 'm3', 'm4', 'm5'],
          requirements: [{ rule: 'all', milestones: ['m1', 'm2', 'm3', 'm4', 'm5'] }],
        },
      ],
    });
  }

  const THREE_DONE_TWO_DISMISSED: Record<string, MilestoneState> = {
    m1: 'complete',
    m2: 'complete',
    m3: 'complete',
    m4: 'dismissed',
    m5: 'dismissed',
  };

  it('evaluates completed = 3 against n = 5, unsatisfied — the denominator did not shrink', () => {
    const tree = fiveGroupTree();
    const progress = progressOf(tree, THREE_DONE_TWO_DISMISSED);

    const group = tree.levels[0].requirements[0];
    const { progress: evaluated } = evaluateGroup(group, tree, progress);

    expect(evaluated.completed).toBe(3);
    expect(evaluated.n).toBe(5);
    expect(evaluated.ratio).toBe(3 / 5);
    expect(evaluated.satisfied).toBe(false);
    expect(scoreSkill(tree, progress).attainedLevel).toBe(0);
  });

  it('reads identically once the two dismissals are taken back', () => {
    const tree = fiveGroupTree();
    const dismissed = progressOf(tree, THREE_DONE_TWO_DISMISSED);
    const undismissed = progressOf(tree, { m1: 'complete', m2: 'complete', m3: 'complete' });

    expect(scoreFields(tree, dismissed)).toEqual(scoreFields(tree, undismissed));
  });

  it('does not become satisfied when the remaining three are dismissed as well', () => {
    const tree = fiveGroupTree();
    const progress = progressOf(tree, {
      m1: 'dismissed',
      m2: 'dismissed',
      m3: 'dismissed',
      m4: 'dismissed',
      m5: 'dismissed',
    });

    const { progress: evaluated } = evaluateGroup(tree.levels[0].requirements[0], tree, progress);

    // Under a shrinking denominator this group is `0 of 0`, vacuously satisfied —
    // dismissing your way to a level (§11.10).
    expect(evaluated.completed).toBe(0);
    expect(evaluated.n).toBe(5);
    expect(evaluated.satisfied).toBe(false);
    expect(scoreSkill(tree, progress).attainedLevel).toBe(0);
  });

  it('is unaffected by which milestone the dismissal lands on', () => {
    const tree = fiveGroupTree();
    const uids = ['m1', 'm2', 'm3', 'm4', 'm5'].map((slug) => uidOf(tree, slug));
    const baseline = scoreFields(tree, progressOf(tree, {}));

    for (const uid of uids) {
      const milestones = new Map<string, MilestoneState>([[uid, 'dismissed']]);
      expect(scoreFields(tree, { milestones, grandfathered: new Map() })).toEqual(baseline);
    }
  });
});
