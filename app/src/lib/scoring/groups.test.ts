import { describe, expect, it } from 'vitest';
import type { MilestoneState } from '$lib/types';
import { scoreSkill } from './index.js';
import { makeScoringTree, progressOf } from './fixtures.js';

const fiveAll = () =>
  makeScoringTree({
    id: 'five-all',
    levels: [{ level: 1, milestones: ['a', 'b', 'c', 'd', 'e'] }],
  });

const twoOfFour = () =>
  makeScoringTree({
    id: 'two-of-four',
    levels: [
      {
        level: 1,
        milestones: ['a', 'b', 'c', 'd'],
        requirements: [{ rule: 'n_of', n: 2, milestones: ['a', 'b', 'c', 'd'] }],
      },
    ],
  });

describe('§11.2 — all is n_of with n = m', () => {
  it('reports the raw count, the capped ratio, and satisfaction', () => {
    const tree = fiveAll();
    const group = scoreSkill(tree, progressOf(tree, { a: 'complete', b: 'complete', c: 'complete' }))
      .levels[0].groups[0];

    expect(group).toEqual({ rule: 'all', n: 5, completed: 3, ratio: 0.6, satisfied: false });
  });

  it('satisfies at the full set', () => {
    const tree = fiveAll();
    const complete: Record<string, MilestoneState> = {
      a: 'complete',
      b: 'complete',
      c: 'complete',
      d: 'complete',
      e: 'complete',
    };
    const group = scoreSkill(tree, progressOf(tree, complete)).levels[0].groups[0];

    expect(group.ratio).toBe(1);
    expect(group.satisfied).toBe(true);
  });
});

describe('§11.2 — n_of', () => {
  it('never reports a ratio above 1, however many surplus completions there are', () => {
    const tree = twoOfFour();
    const all: Record<string, MilestoneState> = {
      a: 'complete',
      b: 'complete',
      c: 'complete',
      d: 'complete',
    };
    const group = scoreSkill(tree, progressOf(tree, all)).levels[0].groups[0];

    // The raw count survives; the ratio is min(completed, n) / n (F11).
    expect(group.completed).toBe(4);
    expect(group.n).toBe(2);
    expect(group.ratio).toBe(1);
    expect(group.satisfied).toBe(true);
  });
});

describe('§11.2 — a level over two groups', () => {
  it('reports the mean ratio while both group ratios survive individually', () => {
    const tree = makeScoringTree({
      id: 'mixed',
      levels: [
        {
          level: 1,
          milestones: ['a', 'b', 'c', 'd'],
          requirements: [
            { rule: 'all', milestones: ['a', 'b'] },
            { rule: 'n_of', n: 2, milestones: ['c', 'd'] },
          ],
        },
      ],
    });

    const level = scoreSkill(
      tree,
      progressOf(tree, { a: 'complete', b: 'complete', c: 'complete' }),
    ).levels[0];

    expect(level.groups[0].ratio).toBe(1);
    expect(level.groups[1].ratio).toBe(0.5);
    // The unweighted mean — §9.6 renders the two independently.
    expect(level.ratio).toBe(0.75);
    expect(level.satisfied).toBe(false);
  });
});

describe('§11.2, §11.10, D-22 — dismissed counts exactly as incomplete', () => {
  it('produces a GroupProgress identical to leaving the milestone untouched', () => {
    const tree = fiveAll();

    const dismissed = scoreSkill(
      tree,
      progressOf(tree, { a: 'complete', b: 'complete', c: 'dismissed' }),
    ).levels[0].groups[0];

    const untouched = scoreSkill(tree, progressOf(tree, { a: 'complete', b: 'complete' })).levels[0]
      .groups[0];

    // Deep equality, not inspection: not counted as complete, and NOT removed
    // from the denominator.
    expect(dismissed).toEqual(untouched);
  });

  it('does not let an all-dismissed group become vacuously satisfied', () => {
    const tree = fiveAll();
    const allDismissed: Record<string, MilestoneState> = {
      a: 'dismissed',
      b: 'dismissed',
      c: 'dismissed',
      d: 'dismissed',
      e: 'dismissed',
    };

    const group = scoreSkill(tree, progressOf(tree, allDismissed)).levels[0].groups[0];

    // A shrinking denominator would let a user dismiss their way to level 10.
    expect(group.n).toBe(5);
    expect(group.completed).toBe(0);
    expect(group.satisfied).toBe(false);
  });
});
