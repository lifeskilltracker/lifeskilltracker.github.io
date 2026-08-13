import { describe, expect, it } from 'vitest';
import { layoutTree } from './index.js';
import { SLOT_WIDTH } from './constants.js';
import { forgeTree, makeTree } from './fixtures.js';

describe('§8.5 — the narrow layout', () => {
  it('returns one synthetic column and no edges', () => {
    const layout = layoutTree(forgeTree(), 'narrow');

    expect(layout.columns).toHaveLength(1);
    expect(layout.columns[0]).toEqual({ trackId: '', title: '', x: 0, w: layout.width });
    expect(layout.edges).toEqual([]);
    expect(layout.viewport).toBe('narrow');
  });

  it('resolves columns[node.col] for every node, exactly as wide does', () => {
    const layout = layoutTree(forgeTree(), 'narrow');
    for (const node of layout.nodes) {
      expect(node.col).toBe(0);
      expect(layout.columns[node.col]).toBeDefined();
    }
  });

  it('orders nodes by (level, track index, order, slug)', () => {
    const layout = layoutTree(forgeTree(), 'narrow');

    expect(layout.nodes.map((n) => n.slug)).toEqual([
      // level 1: forge (index 0) then finishing (index 1)
      'light-forge',
      'draw-taper',
      'quench',
      // level 2
      'forge-a-leaf',
      'punch',
      'drift',
      'temper',
      // level 3
      'hot-cut',
      'polish',
      'etch',
    ]);
  });

  it('breaks an order tie by slug', () => {
    const tree = makeTree({
      milestones: [
        { id: 'zebra', level: 1, order: 0 },
        { id: 'alpha', level: 1, order: 0 },
      ],
    });
    expect(layoutTree(tree, 'narrow').nodes.map((n) => n.slug)).toEqual(['alpha', 'zebra']);
  });

  it('puts level 1 at the TOP, the opposite of wide', () => {
    const layout = layoutTree(forgeTree(), 'narrow');
    const first = layout.nodes.find((n) => n.level === 1)!;
    const last = layout.nodes.find((n) => n.level === 3)!;
    expect(first.y).toBeLessThan(last.y);

    const rowFor = (level: number) => layout.rows.find((r) => r.level === level)!;
    expect(rowFor(1).y).toBeLessThan(rowFor(3).y);
  });

  it('stacks nodes without overlap', () => {
    const layout = layoutTree(forgeTree(), 'narrow');
    const ys = layout.nodes.map((n) => n.y);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1] + layout.nodes[i - 1].h);
    }
    expect(layout.width).toBe(SLOT_WIDTH);
  });

  it('keeps lane as the index within the level, not a running index over the stack', () => {
    const layout = layoutTree(forgeTree(), 'narrow');

    // Level 2 holds four milestones; its lanes restart at 0.
    const level2 = layout.nodes.filter((n) => n.level === 2).map((n) => n.lane);
    expect(level2).toEqual([0, 1, 2, 3]);

    // (level, lane) still recovers the stack order.
    const recovered = [...layout.nodes]
      .sort((a, b) => a.level - b.level || a.lane - b.lane)
      .map((n) => n.slug);
    expect(recovered).toEqual(layout.nodes.map((n) => n.slug));
  });
});
