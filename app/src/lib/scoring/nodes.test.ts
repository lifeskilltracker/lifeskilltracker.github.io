import { describe, expect, it } from 'vitest';
import { scoreSkill } from './index.js';
import { makeScoringTree, progressOf, uidOf } from './fixtures.js';

/** One `n_of` group with slack, so a surplus completion is reachable. */
const surplusTree = () =>
  makeScoringTree({
    id: 'nodes',
    levels: [
      {
        level: 1,
        milestones: ['a', 'b', 'c', 'd'],
        requirements: [{ rule: 'n_of', n: 2, milestones: ['a', 'b', 'c', 'd'] }],
      },
      { level: 2, milestones: ['e', 'f'] },
    ],
    requires: { e: ['a'], f: ['b'] },
  });

describe('§11.4 — the five node states', () => {
  it('produces each of them', () => {
    const tree = surplusTree();
    const result = scoreSkill(
      tree,
      progressOf(tree, {
        a: 'complete',
        b: 'complete', // exactly the threshold: neither is surplus
        d: 'dismissed',
      }),
    );

    const state = (slug: string) => result.nodeStates.get(uidOf(tree, slug));

    expect(state('a')).toBe('complete');
    expect(state('b')).toBe('complete');
    expect(state('c')).toBe('available');
    expect(state('d')).toBe('dismissed');
    expect(state('e')).toBe('available'); // requires a, which is complete
  });

  it('marks every completion bonus once a group has more than it needs', () => {
    const tree = surplusTree();
    const result = scoreSkill(
      tree,
      progressOf(tree, { a: 'complete', b: 'complete', c: 'complete' }),
    );

    // The surplus test is per-milestone and order-independent: with three
    // completions against n: 2, removing any one still satisfies the group, so
    // each is individually surplus. Selecting "the first two" would make the
    // display depend on iteration order, which §11.5 rejects for the same
    // reason. See the note in nodes.ts — flagged for T08.
    for (const slug of ['a', 'b', 'c']) {
      expect(result.nodeStates.get(uidOf(tree, slug))).toBe('bonus');
    }
  });

  it('locks a milestone whose prerequisite is only dismissed', () => {
    const tree = surplusTree();
    const result = scoreSkill(tree, progressOf(tree, { a: 'dismissed', b: 'complete' }));

    // Dismissal is not completion (F36).
    expect(result.nodeStates.get(uidOf(tree, 'e'))).toBe('locked');
    expect(result.nodeStates.get(uidOf(tree, 'f'))).toBe('available');
  });

  it('locks a milestone with an incomplete prerequisite', () => {
    const tree = surplusTree();
    const result = scoreSkill(tree, progressOf(tree, {}));
    expect(result.nodeStates.get(uidOf(tree, 'e'))).toBe('locked');
  });
});

describe('§11.4, F36 — the available set', () => {
  it('holds exactly the unlocked, incomplete, undismissed uids', () => {
    const tree = surplusTree();
    const result = scoreSkill(tree, progressOf(tree, { a: 'complete', d: 'dismissed' }));

    const expected = ['b', 'c', 'e'].map((s) => uidOf(tree, s));
    expect([...result.available].sort()).toEqual(expected.sort());

    for (const uid of result.available) {
      expect(result.nodeStates.get(uid)).toBe('available');
    }
  });

  it('is derived on every call, never read from the input', () => {
    const tree = surplusTree();
    const before = scoreSkill(tree, progressOf(tree, {})).available;
    const after = scoreSkill(tree, progressOf(tree, { a: 'complete' })).available;

    expect(before).not.toEqual(after);
    expect(after).toContain(uidOf(tree, 'e'));
  });
});

describe('§11.4 — bonus for a milestone in more than one group', () => {
  it('is bonus only when it is surplus in every group containing it', () => {
    // `shared` sits in a slack n_of group and in an `all` group that needs it.
    const tree = makeScoringTree({
      id: 'multi-group',
      levels: [
        {
          level: 1,
          milestones: ['shared', 'x', 'y', 'z'],
          requirements: [
            { rule: 'n_of', n: 1, milestones: ['shared', 'x'] },
            { rule: 'all', milestones: ['shared', 'y'] },
          ],
        },
      ],
    });

    const result = scoreSkill(
      tree,
      progressOf(tree, { shared: 'complete', x: 'complete', y: 'complete' }),
    );

    // Surplus in the n_of group (x alone satisfies it) but load-bearing in the
    // `all` group, so it is NOT decoration. The rule is documented in nodes.ts.
    expect(result.nodeStates.get(uidOf(tree, 'shared'))).toBe('complete');
    // `x` is surplus in the only group containing it.
    expect(result.nodeStates.get(uidOf(tree, 'x'))).toBe('bonus');
  });
});
