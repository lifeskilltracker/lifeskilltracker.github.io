/**
 * §8.3's stability guarantee, one named case per row of the table.
 *
 * Each case asserts exactly what its row says moves, and — by diffing the full
 * node set — that nothing else does. F13 and N11 are the claims under test, and
 * a guarantee is only worth as much as the diff that would catch it breaking.
 */

import { describe, expect, it } from 'vitest';
import type { TreeLayout } from './index.js';
import { layoutTree } from './index.js';
import { SLOT_WIDTH } from './constants.js';
import type { MilestoneSpec } from './fixtures.js';
import { makeTree } from './fixtures.js';

const TRACKS = [
  { id: 'prep', title: 'Prep' },
  { id: 'forge', title: 'Forge' },
  { id: 'finishing', title: 'Finishing' },
];

/** Column lane maxima: prep 2, forge 3, finishing 2. */
function baseMilestones(): MilestoneSpec[] {
  return [
    { id: 'prep-a', level: 1, track: 'prep' },
    { id: 'prep-b', level: 1, track: 'prep' },
    { id: 'prep-c', level: 3, track: 'prep' },
    { id: 'prep-d', level: 3, track: 'prep' },
    { id: 'light-forge', level: 1, track: 'forge' },
    { id: 'draw-taper', level: 1, track: 'forge' },
    { id: 'forge-a-leaf', level: 2, track: 'forge' },
    { id: 'punch', level: 2, track: 'forge' },
    { id: 'drift', level: 2, track: 'forge' },
    { id: 'hot-cut', level: 3, track: 'forge' },
    { id: 'quench', level: 1, track: 'finishing' },
    { id: 'temper', level: 2, track: 'finishing' },
    { id: 'polish', level: 2, track: 'finishing' },
  ];
}

let variantCount = 0;
function layoutOf(milestones: MilestoneSpec[], tracks = TRACKS): TreeLayout {
  variantCount += 1;
  return layoutTree(makeTree({ id: `stability-${variantCount}`, tracks, milestones }), 'wide');
}

/** Uids are content-derived in the fixture, so compare by slug across variants. */
function positionsBySlug(layout: TreeLayout): Map<string, { x: number; y: number }> {
  return new Map(layout.nodes.map((n) => [n.slug, { x: n.x, y: n.y }]));
}

function movedBySlug(before: TreeLayout, after: TreeLayout): string[] {
  const afterPositions = positionsBySlug(after);
  return [...positionsBySlug(before)]
    .filter(([slug, pos]) => {
      const other = afterPositions.get(slug);
      return other !== undefined && (other.x !== pos.x || other.y !== pos.y);
    })
    .map(([slug]) => slug)
    .sort();
}

const base = () => layoutOf(baseMilestones());

describe('§8.3 — reword a milestone', () => {
  it('moves nothing', () => {
    const before = base();
    const after = layoutOf(
      baseMilestones().map((m) =>
        m.id === 'punch' ? { ...m, title: 'Punch a clean hole through hot stock' } : m,
      ),
    );

    expect(movedBySlug(before, after)).toEqual([]);
    expect(JSON.stringify(after.columns)).toBe(JSON.stringify(before.columns));
  });
});

describe('§8.3 — add a milestone to a cell below its column lane maximum', () => {
  it("re-centres that cell's own siblings and nothing else, in any row or column", () => {
    const before = base();
    const after = layoutOf([...baseMilestones(), { id: 'anvil', level: 1, track: 'forge' }]);

    // forge level 1 goes from two lanes to three; the column maximum stays 3.
    expect(movedBySlug(before, after)).toEqual(['draw-taper', 'light-forge']);
    expect(JSON.stringify(after.columns)).toBe(JSON.stringify(before.columns));
  });
});

describe('§8.3 — remove a milestone', () => {
  it('re-centres its cell and moves nothing else', () => {
    const before = base();
    const after = layoutOf(baseMilestones().filter((m) => m.id !== 'draw-taper'));

    expect(movedBySlug(before, after)).toEqual(['light-forge']);
    expect(JSON.stringify(after.columns)).toBe(JSON.stringify(before.columns));
  });
});

describe('§8.3 — reorder within a cell', () => {
  it('moves that cell only', () => {
    const before = base();
    const after = layoutOf(
      baseMilestones().map((m) => {
        if (m.id === 'forge-a-leaf') return { ...m, order: 2 };
        if (m.id === 'drift') return { ...m, order: 0 };
        return m;
      }),
    );

    // `punch` holds lane 1 through the swap; the other two exchange lanes.
    expect(movedBySlug(before, after)).toEqual(['drift', 'forge-a-leaf']);
    expect(JSON.stringify(after.columns)).toBe(JSON.stringify(before.columns));
  });
});

describe('§8.3 — add a milestone beyond the column lane maximum', () => {
  it('widens that column, shifts columns to its right, and leaves the left untouched', () => {
    const before = base();
    const after = layoutOf([...baseMilestones(), { id: 'scarf', level: 2, track: 'forge' }]);

    expect(before.columns[1].w).toBe(3 * SLOT_WIDTH);
    expect(after.columns[1].w).toBe(4 * SLOT_WIDTH);

    // Columns to the left are untouched.
    expect(after.columns[0]).toEqual(before.columns[0]);
    // Columns to the right shift right, by exactly the widening.
    expect(after.columns[2].x).toBe(before.columns[2].x + SLOT_WIDTH);
    expect(after.columns[2].w).toBe(before.columns[2].w);

    // Every row keeps its y.
    expect(JSON.stringify(after.rows)).toBe(JSON.stringify(before.rows));

    // Every node in the untouched column keeps its exact x.
    for (const node of before.nodes.filter((n) => n.col === 0)) {
      const other = after.nodes.find((n) => n.slug === node.slug)!;
      expect(other.x).toBe(node.x);
    }
  });
});

describe('§8.3 — add or remove a track', () => {
  it('shifts columns from that point rightward', () => {
    const before = base();
    const inserted = [TRACKS[0], { id: 'etch', title: 'Etch' }, TRACKS[1], TRACKS[2]];
    const after = layoutOf(
      [...baseMilestones(), { id: 'acid-bath', level: 1, track: 'etch' }],
      inserted,
    );

    expect(after.columns.map((c) => c.trackId)).toEqual(['prep', 'etch', 'forge', 'finishing']);
    // The column to the left of the insertion is untouched.
    expect(after.columns[0]).toEqual(before.columns[0]);
    // Everything from the insertion point rightward shifts right.
    expect(after.columns[2].x).toBeGreaterThan(before.columns[1].x);
    expect(after.columns[3].x).toBeGreaterThan(before.columns[2].x);
    expect(JSON.stringify(after.rows)).toBe(JSON.stringify(before.rows));
  });

  it('shifts columns leftward when a track is removed', () => {
    const before = base();
    const after = layoutOf(
      baseMilestones().filter((m) => m.track !== 'prep'),
      [TRACKS[1], TRACKS[2]],
    );

    expect(after.columns.map((c) => c.trackId)).toEqual(['forge', 'finishing']);
    expect(after.columns[0].x).toBe(0);
    expect(JSON.stringify(after.rows)).toBe(JSON.stringify(before.rows));
  });
});

describe('§8.3 — re-level a milestone', () => {
  it('moves it, re-centres both affected cells, and leaves every column alone', () => {
    const before = base();
    const after = layoutOf(
      baseMilestones().map((m) => (m.id === 'prep-b' ? { ...m, level: 2 } : m)),
    );

    // prep level 1 drops to one lane and re-centres `prep-a`; `prep-b` itself moves.
    expect(movedBySlug(before, after)).toEqual(['prep-a', 'prep-b']);
    // prep's lane maximum is still 2 thanks to level 3, so no column changes.
    expect(JSON.stringify(after.columns)).toBe(JSON.stringify(before.columns));
  });
});

describe('§8.3 — vertical position is invariant under every content edit', () => {
  const edits: [string, MilestoneSpec[], typeof TRACKS][] = [
    [
      'reword',
      baseMilestones().map((m) => (m.id === 'punch' ? { ...m, title: 'Reworded' } : m)),
      TRACKS,
    ],
    ['add below the maximum', [...baseMilestones(), { id: 'anvil', level: 1, track: 'forge' }], TRACKS],
    ['remove', baseMilestones().filter((m) => m.id !== 'draw-taper'), TRACKS],
    [
      'reorder within a cell',
      baseMilestones().map((m) => (m.id === 'drift' ? { ...m, order: 0 } : m)),
      TRACKS,
    ],
    ['add beyond the maximum', [...baseMilestones(), { id: 'scarf', level: 2, track: 'forge' }], TRACKS],
    [
      'add a track',
      [...baseMilestones(), { id: 'acid-bath', level: 1, track: 'etch' }],
      [TRACKS[0], { id: 'etch', title: 'Etch' }, TRACKS[1], TRACKS[2]],
    ],
    [
      're-level',
      baseMilestones().map((m) => (m.id === 'prep-b' ? { ...m, level: 2 } : m)),
      TRACKS,
    ],
  ];

  it.each(edits)('keeps every row band and every unmoved level at the same y: %s', (_name, milestones, tracks) => {
    const before = base();
    const after = layoutOf(milestones, tracks);

    // Rows are fixed-height and there are always exactly ten, so the row bands
    // themselves never move — the strongest form of the property, and the one
    // that holds for all seven edits without qualification.
    expect(JSON.stringify(after.rows)).toBe(JSON.stringify(before.rows));

    // A node's y is a function of its level alone, so it is invariant for every
    // node the edit did not re-level. Re-levelling is the one row of the §8.3
    // table that moves a node vertically, and that table says so ("it moves").
    const beforeByLevel = new Map(before.nodes.map((n) => [n.slug, { level: n.level, y: n.y }]));
    for (const node of after.nodes) {
      const previous = beforeByLevel.get(node.slug);
      if (previous === undefined || previous.level !== node.level) continue;
      expect(node.y).toBe(previous.y);
    }
  });
});
