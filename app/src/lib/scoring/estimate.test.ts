/**
 * F30's estimator (§11.8, D20) — T15.
 *
 * The claim worth testing is not "it returns some uids" but the one §11.8 makes
 * about the result: accepting the estimate unmodified yields attained **L**.
 * That is checked here against the real `scoreSkill`, so the estimator and the
 * definition of attainment cannot drift apart without a failure.
 */

import { describe, expect, it } from 'vitest';
import type { CompiledTree } from '$lib/types';
import { CoarseLevelRangeError, estimateMilestones } from './estimate.js';
import { makeScoringTree, progressOf, uidOf, type LevelSpec } from './fixtures.js';
import { scoreSkill } from './index.js';

/** Ten full levels, four milestones each, plus one mastery achievement. */
function fullTree(): CompiledTree {
  const levels: LevelSpec[] = [];
  for (let level = 1; level <= 10; level += 1) {
    levels.push({ level, milestones: [1, 2, 3, 4].map((i) => `l${level}-m${i}`) });
  }
  const tree = makeScoringTree({ id: 'estimator-fixture', levels });
  tree.mastery = [{ id: 'the-crown', uid: 'MASTERY0', title: 'A mastery achievement' }];
  return tree;
}

const levelOf = (tree: CompiledTree, uid: string): number =>
  tree.milestones.find((m) => m.uid === uid)!.level;

describe('§11.8 / D20 — the estimator is a contiguous prefix', () => {
  const tree = fullTree();

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'returns exactly every milestone uid in levels 1..%i',
    (coarse) => {
      const estimate = estimateMilestones(tree, coarse);
      const expected = tree.milestones.filter((m) => m.level <= coarse).map((m) => m.uid);

      expect([...estimate].sort()).toEqual([...expected].sort());
      // No skipped level below the estimate: every level 1..L is represented.
      const levels = new Set(estimate.map((uid) => levelOf(tree, uid)));
      for (let level = 1; level <= coarse; level += 1) expect(levels.has(level)).toBe(true);
      expect(Math.max(...levels)).toBe(coarse);
    },
  );

  it('never includes a mastery achievement', () => {
    const masteryUid = tree.mastery![0].uid;
    expect(estimateMilestones(tree, 10)).not.toContain(masteryUid);
  });

  it('is pure: the same inputs give the same output, twice', () => {
    expect(estimateMilestones(tree, 6)).toEqual(estimateMilestones(tree, 6));
  });

  it.each([0, 11, -1, 1.5, Number.NaN])('refuses the out-of-domain input %s', (coarse) => {
    expect(() => estimateMilestones(tree, coarse)).toThrow(CoarseLevelRangeError);
  });
});

describe('§11.8 — accepting the estimate unmodified yields attained L', () => {
  const tree = fullTree();

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('at L = %i', (coarse) => {
    const states = Object.fromEntries(
      estimateMilestones(tree, coarse).map((uid) => [
        tree.milestones.find((m) => m.uid === uid)!.id,
        'complete' as const,
      ]),
    );
    expect(scoreSkill(tree, progressOf(tree, states)).attainedLevel).toBe(coarse);
  });
});

describe('R-22 — the Guttman interaction the estimator creates', () => {
  it('un-checking one pre-checked milestone can drop attained level sharply', () => {
    const tree = fullTree();
    const states: Record<string, 'complete'> = {};
    for (const uid of estimateMilestones(tree, 6)) {
      states[tree.milestones.find((m) => m.uid === uid)!.id] = 'complete';
    }
    expect(scoreSkill(tree, progressOf(tree, states)).attainedLevel).toBe(6);

    // The user corrects one level-2 milestone they had not actually done.
    delete states['l2-m1'];
    const after = scoreSkill(tree, progressOf(tree, states));
    expect(after.attainedLevel).toBe(1);
    // §11.10's mitigation: the history survives the rank.
    expect(after.cleared).toEqual([1, 3, 4, 5, 6]);
  });
});

describe('the estimator reads no field a compiled tree does not already have', () => {
  it('works on a tree carrying only uid and level on its milestones', () => {
    const tree = fullTree();
    const minimal = {
      milestones: tree.milestones.map((m) => ({ uid: m.uid, level: m.level })),
    } as unknown as CompiledTree;

    expect(estimateMilestones(minimal, 3)).toEqual(estimateMilestones(tree, 3));
    expect(estimateMilestones(minimal, 3)).toContain(uidOf(tree, 'l3-m4'));
  });
});
