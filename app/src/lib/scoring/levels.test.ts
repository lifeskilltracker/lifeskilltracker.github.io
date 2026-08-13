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

describe('phase boundary — grandfathered is always false until T11b', () => {
  it('stays false even when TreeProgress carries a non-empty frozen map', () => {
    const tree = scatteredTree();
    const grandfathered = new Map([[2, { uids: [uidOf(tree, 'l2-m1')], contentVersion: 1 }]]);
    const progress = { ...scatteredProgress(tree), grandfathered };

    const result = scoreSkill(tree, progress);

    // T11b adds §11.5's disjunct. This assertion is the failing counterpart
    // that change has to flip; the map is accepted and unread until then.
    for (const level of result.levels) expect(level.grandfathered).toBe(false);
    expect(result.attainedLevel).toBe(1);
  });
});
