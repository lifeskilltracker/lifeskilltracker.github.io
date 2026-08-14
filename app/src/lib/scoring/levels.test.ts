import { describe, expect, it } from 'vitest';
import { scoreSkill, tierFor } from './index.js';
import {
  makeScoringTree,
  progressOf,
  scatteredProgress,
  scatteredTree,
  uidOf,
} from './fixtures.js';

describe('§11.3 — the worked case: satisfied {1,3,4,6}, one short at level 2', () => {
  it('reports attained 1, cleared [1,3,4,6], and level 2 as the blocker', () => {
    const tree = scatteredTree();
    const result = scoreSkill(tree, scatteredProgress(tree));

    // attained is the highest contiguous prefix — the only input to F33.
    expect(result.attainedLevel).toBe(1);
    // cleared is the satisfied set, contiguous or not, and is never summed.
    expect(result.cleared).toEqual([1, 3, 4, 6]);
    expect(result.blocker?.level).toBe(2);
    expect(result.blocker?.shortfall.length).toBeGreaterThan(0);
  });

  it('moves attained 1 → 4 when that one milestone closes', () => {
    const tree = scatteredTree();
    const progress = scatteredProgress(tree);
    // "One milestone stands between you and Level 4."
    const closed = new Map(progress.milestones);
    closed.set(uidOf(tree, 'l2-m4'), 'complete');

    const result = scoreSkill(tree, { ...progress, milestones: closed });

    expect(result.attainedLevel).toBe(4);
    expect(result.cleared).toEqual([1, 2, 3, 4, 6]);
    expect(result.blocker?.level).toBe(5);
    // The +37 domain-score consequence (table[4] − table[1] = 45 − 8) is T11b's.
  });
});

describe('§11.3 — attained 0 is a real state', () => {
  it('reports no tier rather than promoting an unranked skill to Novice', () => {
    const tree = scatteredTree();
    const result = scoreSkill(tree, progressOf(tree, {}));

    expect(result.attainedLevel).toBe(0);
    expect(result.cleared).toEqual([]);
    expect(result.tier).toBeNull();
  });
});

describe('§11.3, F7 — the tier mapping', () => {
  const expected: [number, string | null][] = [
    [0, null],
    [1, 'Novice'],
    [2, 'Novice'],
    [3, 'Apprentice'],
    [4, 'Apprentice'],
    [5, 'Journeyman'],
    [6, 'Journeyman'],
    [7, 'Expert'],
    [8, 'Expert'],
    [9, 'Master'],
    [10, 'Master'],
  ];

  it.each(expected)('attained %i reads %s', (attained, tier) => {
    expect(tierFor(attained)).toBe(tier);
  });
});

describe('§14.4 — the level array', () => {
  it('always holds ten entries regardless of progress', () => {
    const tree = scatteredTree();
    expect(scoreSkill(tree, progressOf(tree, {})).levels).toHaveLength(10);
    expect(scoreSkill(tree, scatteredProgress(tree)).levels).toHaveLength(10);
  });

  it('leaves blocker undefined when every level is satisfied', () => {
    const tree = scatteredTree();
    const states: Record<string, 'complete'> = {};
    for (let level = 1; level <= 10; level += 1) {
      for (const i of [1, 2, 3, 4]) states[`l${level}-m${i}`] = 'complete';
    }

    const result = scoreSkill(tree, progressOf(tree, states));

    expect(result.attainedLevel).toBe(10);
    expect(result.blocker).toBeUndefined();
    expect(result.tier).toBe('Master');
  });
});

describe('§11.5 — satisfiedBy is what the store freezes', () => {
  it('lists every complete uid of a satisfied level, and nothing for an unsatisfied one', () => {
    const tree = scatteredTree();
    const result = scoreSkill(tree, scatteredProgress(tree));

    const level1 = result.levels.find((l) => l.level === 1)!;
    expect([...level1.satisfiedBy].sort()).toEqual(
      [1, 2, 3, 4].map((i) => uidOf(tree, `l1-m${i}`)).sort(),
    );

    const level2 = result.levels.find((l) => l.level === 2)!;
    expect(level2.satisfiedBy).toEqual([]);
  });

  it('includes surplus completions rather than the first n', () => {
    const tree = makeScoringTree({
      id: 'surplus-freeze',
      levels: [
        {
          level: 1,
          milestones: ['a', 'b', 'c', 'd'],
          requirements: [{ rule: 'n_of', n: 2, milestones: ['a', 'b', 'c', 'd'] }],
        },
      ],
    });

    const result = scoreSkill(
      tree,
      progressOf(tree, { a: 'complete', b: 'complete', c: 'complete' }),
    );

    // Picking n of them would make the frozen set depend on iteration order;
    // the store freezes what the user actually did.
    expect([...result.levels[0].satisfiedBy].sort()).toEqual(
      ['a', 'b', 'c'].map((s) => uidOf(tree, s)).sort(),
    );
  });
});

/**
 * §11.5, D-19 — grandfathered satisfaction, the replacement for T11a's
 * placeholder assertion that `grandfathered` is always false.
 *
 * The scenario is a tree revision: the user satisfied level 2 under an older
 * `contentVersion`, the level then grew a milestone they have not done, and the
 * frozen record is what keeps their attained level from falling out from under
 * them. It is **not a ratchet** — un-checking any frozen uid drops the level —
 * which is what keeps R-22 honest while still making tree revision safe.
 */
describe('§11.5 — grandfathered satisfaction (D-19)', () => {
  /** Level 2's four milestones, of which the user completed only three. */
  function shortOfLevelTwo() {
    const tree = scatteredTree();
    const progress = scatteredProgress(tree);
    const frozen = ['l2-m1', 'l2-m2', 'l2-m3'].map((slug) => uidOf(tree, slug));
    return { tree, progress, frozen };
  }

  it('carries a level that evaluates unsatisfied but whose frozen uids are all complete', () => {
    const { tree, progress, frozen } = shortOfLevelTwo();
    const grandfathered = new Map([[2, { uids: frozen, contentVersion: 1 }]]);

    const result = scoreSkill(tree, { ...progress, grandfathered });
    const levelTwo = result.levels.find((l) => l.level === 2)!;

    expect(levelTwo.satisfied).toBe(true);
    expect(levelTwo.grandfathered).toBe(true);
    // And the whole point: attained no longer stalls at 1.
    expect(result.attainedLevel).toBe(4);
  });

  it('drops the level the moment any single frozen uid is un-checked', () => {
    const { tree, progress, frozen } = shortOfLevelTwo();
    const grandfathered = new Map([[2, { uids: frozen, contentVersion: 1 }]]);
    const unchecked = new Map(progress.milestones);
    unchecked.delete(frozen[0]);

    const result = scoreSkill(tree, { milestones: unchecked, grandfathered });
    const levelTwo = result.levels.find((l) => l.level === 2)!;

    // Not a ratchet — R-22's blast radius is accepted, not engineered around.
    expect(levelTwo.satisfied).toBe(false);
    expect(levelTwo.grandfathered).toBe(false);
    expect(result.attainedLevel).toBe(1);
  });

  it('treats a dismissed frozen uid as un-checked, exactly as §11.10 requires', () => {
    const { tree, progress, frozen } = shortOfLevelTwo();
    const grandfathered = new Map([[2, { uids: frozen, contentVersion: 1 }]]);
    const dismissed = new Map(progress.milestones);
    dismissed.set(frozen[1], 'dismissed');

    const result = scoreSkill(tree, { milestones: dismissed, grandfathered });

    expect(result.levels.find((l) => l.level === 2)!.satisfied).toBe(false);
  });

  it('means "only the record holds it up", not "a record exists"', () => {
    const tree = scatteredTree();
    const progress = scatteredProgress(tree);
    // Level 1 is satisfied by evaluation, and also covered by a record.
    const frozen = [1, 2, 3, 4].map((i) => uidOf(tree, `l1-m${i}`));
    const grandfathered = new Map([[1, { uids: frozen, contentVersion: 1 }]]);

    const levelOne = scoreSkill(tree, { ...progress, grandfathered }).levels.find(
      (l) => l.level === 1,
    )!;

    expect(levelOne.satisfied).toBe(true);
    expect(levelOne.grandfathered).toBe(false);
  });

  it('refuses an empty frozen record rather than satisfying it vacuously', () => {
    const { tree, progress } = shortOfLevelTwo();
    const grandfathered = new Map([[2, { uids: [], contentVersion: 1 }]]);

    const result = scoreSkill(tree, { ...progress, grandfathered });

    // `[].every(…)` is true, so the naive disjunct would hand out level 2 for
    // nothing — and T09 writing an empty record is a bug this must not reward.
    expect(result.levels.find((l) => l.level === 2)!.satisfied).toBe(false);
    expect(result.attainedLevel).toBe(1);
  });

  it('still reports satisfiedBy for a grandfathered level', () => {
    const { tree, progress, frozen } = shortOfLevelTwo();
    const grandfathered = new Map([[2, { uids: frozen, contentVersion: 1 }]]);

    const levelTwo = scoreSkill(tree, { ...progress, grandfathered }).levels.find(
      (l) => l.level === 2,
    )!;

    // The uids holding the level up are the record's, not the evaluator's —
    // the evaluator found the level short.
    expect([...levelTwo.satisfiedBy].sort()).toEqual([...frozen].sort());
  });

  it('performs no write of any kind (§3.2 — the store is the only writer)', () => {
    const { tree, progress, frozen } = shortOfLevelTwo();
    const grandfathered = new Map([[2, { uids: frozen, contentVersion: 1 }]]);
    const input = { ...progress, grandfathered };
    const before = {
      milestones: [...input.milestones.entries()],
      grandfathered: [...input.grandfathered.entries()].map(([level, record]) => [
        level,
        { ...record, uids: [...record.uids] },
      ]),
    };

    scoreSkill(tree, input);

    expect({
      milestones: [...input.milestones.entries()],
      grandfathered: [...input.grandfathered.entries()].map(([level, record]) => [
        level,
        { ...record, uids: [...record.uids] },
      ]),
    }).toEqual(before);
  });

  it('ignores a record for a level the tree does not have', () => {
    const { tree, progress } = shortOfLevelTwo();
    const grandfathered = new Map([[99, { uids: [uidOf(tree, 'l2-m1')], contentVersion: 1 }]]);

    const result = scoreSkill(tree, { ...progress, grandfathered });

    expect(result.attainedLevel).toBe(1);
    expect(result.levels).toHaveLength(10);
  });
});
