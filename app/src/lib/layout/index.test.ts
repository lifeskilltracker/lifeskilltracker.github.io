/**
 * The public surface: memoization (§8.6), the shape of the signature (§14.1),
 * and the §17.3 budget.
 */

import { describe, expect, it } from 'vitest';
import { layoutTree } from './index.js';
import { ROW_GUTTER, SIDE_GUTTER, SIDE_GUTTER_LANE } from './constants.js';
import { layoutWide } from './wide.js';
import { forgeTree, makeTree } from './fixtures.js';
import type { MilestoneSpec } from './fixtures.js';

describe('§8.6 — memoization', () => {
  it('returns the same object for the same (id, contentVersion, viewport)', () => {
    const first = layoutTree(forgeTree(), 'wide');
    const second = layoutTree(forgeTree(), 'wide');
    expect(second).toBe(first);
  });

  it('returns a different object when only contentVersion differs', () => {
    const v1 = layoutTree(makeTree({ id: 'versioned', contentVersion: 1, milestones: [{ id: 'a', level: 1 }] }), 'wide');
    const v2 = layoutTree(makeTree({ id: 'versioned', contentVersion: 2, milestones: [{ id: 'a', level: 1 }] }), 'wide');
    expect(v2).not.toBe(v1);
  });

  it('keys the two viewports separately', () => {
    const wide = layoutTree(forgeTree(), 'wide');
    const narrow = layoutTree(forgeTree(), 'narrow');
    expect(narrow).not.toBe(wide);
    expect(wide.viewport).toBe('wide');
    expect(narrow.viewport).toBe('narrow');
  });
});

describe('§8.6, §14.1 — user state is absent from the signature', () => {
  it('takes exactly two parameters', () => {
    expect(layoutTree).toHaveLength(2);
  });

  it('rejects a third argument at compile time', () => {
    // Two `TreeProgress`-shaped values (§14.4). Neither can reach the engine:
    // completing a milestone must never trigger a re-layout (§9.3), which is
    // structural here rather than an optimization.
    const empty = { treeId: 'smithing', attainedLevel: 0, levels: [], grandfathered: false };
    const started = { treeId: 'smithing', attainedLevel: 3, levels: [], grandfathered: false };

    for (const progress of [empty, started]) {
      // @ts-expect-error — layoutTree has arity 2; user state has no way in.
      expect(() => layoutTree(forgeTree(), 'wide', progress)).not.toThrow();
    }
  });
});

describe('§8.1 — the constrained constants', () => {
  it('keeps a positive row gutter, or §8.4 edges have no channel', () => {
    expect(ROW_GUTTER).toBeGreaterThan(0);
  });

  it('keeps the side channel wide enough for the lanes it hands out', () => {
    expect(SIDE_GUTTER_LANE).toBeLessThanOrEqual(SIDE_GUTTER);
  });
});

describe('§17.3 — layout budget', () => {
  it('lays out an eighty-node tree in under 2 ms', () => {
    const milestones: MilestoneSpec[] = [];
    for (let level = 1; level <= 10; level += 1) {
      for (let i = 0; i < 8; i += 1) {
        milestones.push({
          id: `m-${level}-${i}`,
          level,
          track: `t${i % 4}`,
          requires: level > 1 ? [`m-${level - 1}-${i}`] : [],
        });
      }
    }
    const tree = makeTree({
      id: 'benchmark',
      tracks: [0, 1, 2, 3].map((i) => ({ id: `t${i}`, title: `Track ${i}` })),
      milestones,
    });
    expect(tree.milestones).toHaveLength(80);

    // Measured against the engine directly, so the memo cannot flatter it.
    const samples: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const start = performance.now();
      layoutWide(tree);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    expect(samples[Math.floor(samples.length / 2)]).toBeLessThan(2);
  });
});
