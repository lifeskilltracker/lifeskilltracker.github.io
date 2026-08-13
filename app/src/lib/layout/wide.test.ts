import { describe, expect, it } from 'vitest';
import { layoutTree } from './index.js';
import { COLUMN_GUTTER, ROW_HEIGHT, SIDE_GUTTER, SLOT_HEIGHT, SLOT_WIDTH } from './constants.js';
import { forgeTree, makeTree } from './fixtures.js';

describe('§8.2 step 1 — rows', () => {
  it('produces ten equal-height rows with level 1 below level 10', () => {
    const layout = layoutTree(forgeTree(), 'wide');

    expect(layout.rows).toHaveLength(10);
    expect(new Set(layout.rows.map((r) => r.h))).toEqual(new Set([ROW_HEIGHT]));

    const level1 = layout.rows.find((r) => r.level === 1)!;
    const level10 = layout.rows.find((r) => r.level === 10)!;
    expect(level1.y).toBeGreaterThan(level10.y);
  });
});

describe('§8.2 step 2 — columns', () => {
  it('gives a tree with no tracks exactly one synthetic column', () => {
    const tree = makeTree({ milestones: [{ id: 'a', level: 1 }] });
    const layout = layoutTree(tree, 'wide');

    expect(layout.columns).toHaveLength(1);
    expect(layout.columns[0].trackId).toBe('');
    expect(layout.columns[0].title).toBe('');
    expect(layout.columns[0].x).toBe(0);
  });

  it('resolves columns[node.col] for every node', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    for (const node of layout.nodes) {
      expect(layout.columns[node.col]).toBeDefined();
    }
  });

  it('orders columns by declared track order, left to right', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    expect(layout.columns.map((c) => c.trackId)).toEqual(['forge', 'finishing']);
    expect(layout.columns[0].x).toBeLessThan(layout.columns[1].x);
  });
});

describe('§8.2 step 5 — column width', () => {
  it('sets each column width to its maximum cell lane count times slotWidth', () => {
    const layout = layoutTree(forgeTree(), 'wide');

    // §8.3's worked example: forge peaks at three lanes, finishing at two.
    expect(layout.columns[0].w).toBe(3 * SLOT_WIDTH);
    expect(layout.columns[1].w).toBe(2 * SLOT_WIDTH);
  });

  it('reserves the side gutter outside every column', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    const last = layout.columns[layout.columns.length - 1];
    expect(layout.width).toBe(last.x + last.w + SIDE_GUTTER);
  });

  it('separates adjacent columns by the column gutter', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    expect(layout.columns[1].x).toBe(layout.columns[0].x + layout.columns[0].w + COLUMN_GUTTER);
  });
});

describe('§8.2 step 6 — centring', () => {
  it('puts a two-node cell and a three-node cell on the same column centre line', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    const meanX = (level: number) => {
      const cell = layout.nodes.filter((n) => n.level === level && n.col === 0);
      return cell.reduce((sum, n) => sum + n.x, 0) / cell.length;
    };

    // level 1 of `forge` holds two nodes, level 2 holds three.
    expect(layout.nodes.filter((n) => n.level === 1 && n.col === 0)).toHaveLength(2);
    expect(layout.nodes.filter((n) => n.level === 2 && n.col === 0)).toHaveLength(3);
    expect(meanX(1)).toBeCloseTo(meanX(2), 10);
  });

  it('centres each cell on its own column, not on the tree', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    const column = layout.columns[0];
    const centre = column.x + column.w / 2;
    const cell = layout.nodes.filter((n) => n.level === 2 && n.col === 0);
    const cellCentre = cell.reduce((sum, n) => sum + n.x + n.w / 2, 0) / cell.length;
    expect(cellCentre).toBeCloseTo(centre, 10);
  });

  it('gives every node the slot dimensions', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    for (const node of layout.nodes) {
      expect(node.w).toBe(SLOT_WIDTH);
      expect(node.h).toBe(SLOT_HEIGHT);
    }
  });
});

describe('§8.2 step 4 — lane ordering reads no file position', () => {
  it('produces a byte-identical layout when a cell is shuffled in the input', () => {
    const ordered = layoutTree(forgeTree(), 'wide');

    const shuffled = forgeTree();
    // Reverse the flat milestone index; `requires` refs are re-pointed with it.
    const permutation = [...shuffled.milestones].reverse();
    const newIndexOf = new Map(permutation.map((m, i) => [m.uid, i]));
    const remapped = permutation.map((m) => ({
      ...m,
      requires: (m.requires ?? []).map((r) => ({
        ...r,
        index: newIndexOf.get(shuffled.milestones[r.index].uid)!,
      })),
    }));
    const shuffledTree = { ...shuffled, id: 'smithing-shuffled', milestones: remapped };

    const after = layoutTree(shuffledTree, 'wide');

    // Node identity travels with the uid, so compare on that rather than on order.
    const byUid = (layout: typeof ordered) =>
      JSON.stringify([...layout.nodes].sort((a, b) => a.uid.localeCompare(b.uid)));
    expect(byUid(after)).toBe(byUid(ordered));
    expect(JSON.stringify(after.columns)).toBe(JSON.stringify(ordered.columns));
    expect(JSON.stringify(after.rows)).toBe(JSON.stringify(ordered.rows));
  });

  it('sorts lanes by (order, slug), not by declaration', () => {
    const tree = makeTree({
      milestones: [
        { id: 'zebra', level: 1, order: 0 },
        { id: 'alpha', level: 1, order: 0 },
        { id: 'middle', level: 1, order: 1 },
      ],
    });
    const layout = layoutTree(tree, 'wide');
    const lane1 = layout.nodes
      .filter((n) => n.level === 1)
      .sort((a, b) => a.lane - b.lane)
      .map((n) => n.slug);

    // `alpha` and `zebra` tie on order, so slug breaks it; `middle` has order 1.
    expect(lane1.slice(0, 3)).toEqual(['alpha', 'zebra', 'middle']);
  });
});
