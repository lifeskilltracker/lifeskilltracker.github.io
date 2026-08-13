/**
 * §8.4 edge routing.
 *
 * Not in T06's deliverables list, which folded edge coverage into `wide.test.ts`
 * — split out because F27 turned §8.4 from two sentences into a geometry with a
 * lane assignment and a degenerate case worth naming.
 */

import { describe, expect, it } from 'vitest';
import type { CompiledTree } from '$lib/types';
import { layoutTree } from './index.js';
import { SAME_LEVEL_BOW, SIDE_GUTTER, SIDE_GUTTER_LANE, sideChannelFits } from './constants.js';
import { forgeTree, makeTree } from './fixtures.js';

interface Segment {
  from: [number, number];
  to: [number, number];
}

/** Parses the `V`/`H` subset the engine emits into absolute segments. */
function segments(path: string): Segment[] {
  const tokens = path.trim().split(/\s+/);
  const out: Segment[] = [];
  let cursor: [number, number] = [0, 0];
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i];
    if (command === 'M') {
      cursor = [Number(tokens[i + 1]), Number(tokens[i + 2])];
      i += 3;
    } else if (command === 'V') {
      const next: [number, number] = [cursor[0], Number(tokens[i + 1])];
      out.push({ from: cursor, to: next });
      cursor = next;
      i += 2;
    } else if (command === 'H') {
      const next: [number, number] = [Number(tokens[i + 1]), cursor[1]];
      out.push({ from: cursor, to: next });
      cursor = next;
      i += 2;
    } else {
      throw new Error(`unexpected path command "${command}" in ${path}`);
    }
  }
  return out;
}

const nodeBy = (layout: ReturnType<typeof layoutTree>, uid: string) =>
  layout.nodes.find((n) => n.uid === uid)!;

describe('§8.4 — every edge', () => {
  it('parses into three orthogonal segments', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    expect(layout.edges.length).toBeGreaterThan(0);

    for (const edge of layout.edges) {
      const parsed = segments(edge.path);
      expect(parsed).toHaveLength(3);
      for (const seg of parsed) {
        const horizontal = seg.from[1] === seg.to[1];
        const vertical = seg.from[0] === seg.to[0];
        expect(horizontal || vertical).toBe(true);
      }
    }
  });

  it('never points downward — the source level is at or below the target', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    for (const edge of layout.edges) {
      expect(nodeBy(layout, edge.fromUid).level).toBeLessThanOrEqual(
        nodeBy(layout, edge.toUid).level,
      );
    }
  });

  it('starts on the source top edge and ends on the target bottom edge across rows', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    const crossLevel = layout.edges.filter(
      (e) => nodeBy(layout, e.fromUid).level !== nodeBy(layout, e.toUid).level,
    );
    expect(crossLevel.length).toBeGreaterThan(0);

    for (const edge of crossLevel) {
      const source = nodeBy(layout, edge.fromUid);
      const target = nodeBy(layout, edge.toUid);
      const parsed = segments(edge.path);
      expect(parsed[0].from).toEqual([source.x + source.w / 2, source.y]);
      expect(parsed[2].to).toEqual([target.x + target.w / 2, target.y + target.h]);
    }
  });

  it('runs the horizontal leg through the inter-row gutter, clear of both nodes', () => {
    const layout = layoutTree(forgeTree(), 'wide');
    const edge = layout.edges.find(
      (e) => nodeBy(layout, e.fromUid).level !== nodeBy(layout, e.toUid).level,
    )!;
    const source = nodeBy(layout, edge.fromUid);
    const horizontal = segments(edge.path)[1];

    expect(horizontal.from[1]).toBe(horizontal.to[1]);
    expect(horizontal.from[1]).toBeLessThan(source.y); // above the source
  });
});

/** Two same-level prerequisites in one row, and one more in another row. */
function sameLevelTree(): CompiledTree {
  return makeTree({
    id: 'same-level',
    milestones: [
      { id: 'a', level: 1 },
      { id: 'b', level: 1, requires: ['a'] },
      { id: 'c', level: 1 },
      { id: 'd', level: 1, requires: ['c'] },
      { id: 'e', level: 2 },
      { id: 'f', level: 2, requires: ['e'] },
    ],
  });
}

describe('§8.4 — same-level edges', () => {
  it('leaves the row band through the side gutter rather than the row gutter', () => {
    const layout = layoutTree(sameLevelTree(), 'wide');
    const channelX = layout.width - SIDE_GUTTER;

    const sameLevel = layout.edges.filter(
      (e) => nodeBy(layout, e.fromUid).level === nodeBy(layout, e.toUid).level,
    );
    expect(sameLevel).toHaveLength(3);

    for (const edge of sameLevel) {
      const xs = segments(edge.path).flatMap((s) => [s.from[0], s.to[0]]);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(channelX);
      // and stays inside the tree
      expect(Math.max(...xs)).toBeLessThanOrEqual(layout.width);
    }
  });

  it('bows vertically so the outbound and return legs are not the same line', () => {
    const layout = layoutTree(sameLevelTree(), 'wide');
    const edge = layout.edges.find(
      (e) => nodeBy(layout, e.fromUid).level === nodeBy(layout, e.toUid).level,
    )!;
    const [out, bow, back] = segments(edge.path);

    expect(out.from[1]).not.toBe(back.from[1]);
    expect(Math.abs(bow.to[1] - bow.from[1])).toBe(SAME_LEVEL_BOW);
  });

  it('leaves both ends on the nodes right edges, because they share a row', () => {
    const layout = layoutTree(sameLevelTree(), 'wide');
    const edge = layout.edges.find(
      (e) => nodeBy(layout, e.fromUid).level === nodeBy(layout, e.toUid).level,
    )!;
    const source = nodeBy(layout, edge.fromUid);
    const target = nodeBy(layout, edge.toUid);
    const parsed = segments(edge.path);

    expect(parsed[0].from[0]).toBe(source.x + source.w);
    expect(parsed[2].to[0]).toBe(target.x + target.w);
    // The return leg still lands within the target's right edge.
    expect(parsed[2].to[1]).toBeGreaterThanOrEqual(target.y);
    expect(parsed[2].to[1]).toBeLessThanOrEqual(target.y + target.h);
  });

  it('gives two edges in one row different lanes, and lets separate rows reuse lane 0', () => {
    const layout = layoutTree(sameLevelTree(), 'wide');
    const channelX = layout.width - SIDE_GUTTER;
    const laneOf = (uid: string) => {
      const edge = layout.edges.find((e) => e.toUid === uid)!;
      const depth = Math.max(...segments(edge.path).flatMap((s) => [s.from[0], s.to[0]]));
      return (depth - channelX) / SIDE_GUTTER_LANE;
    };

    const level1 = layout.nodes.filter((n) => n.level === 1);
    const b = level1.find((n) => n.slug === 'b')!;
    const d = level1.find((n) => n.slug === 'd')!;
    const f = layout.nodes.find((n) => n.slug === 'f')!;

    // Two edges share row 1, so they must not share a lane.
    expect(laneOf(b.uid)).not.toBe(laneOf(d.uid));
    expect(new Set([laneOf(b.uid), laneOf(d.uid)])).toEqual(new Set([0, 1]));
    // A different row starts again from the inside.
    expect(laneOf(f.uid)).toBe(0);
  });

  it('keeps the busiest row inside the channel', () => {
    // The §8.1 constraint, asserted rather than assumed.
    expect(sideChannelFits(4)).toBe(true);
    expect(sideChannelFits(5)).toBe(false);

    const layout = layoutTree(sameLevelTree(), 'wide');
    const channelX = layout.width - SIDE_GUTTER;
    for (const edge of layout.edges) {
      const xs = segments(edge.path).flatMap((s) => [s.from[0], s.to[0]]);
      expect(Math.max(...xs) - channelX).toBeLessThanOrEqual(SIDE_GUTTER);
    }
  });
});

describe('§8.2 step 7 — mastery achievements are dropped, not degraded', () => {
  it('emits no edge for a mastery prerequisite', () => {
    const tree = forgeTree();
    const withMastery = {
      ...tree,
      mastery: [
        {
          id: 'master-smith',
          uid: 'MASTER01',
          title: 'Master smith',
          // §5.7 lets a mastery entry require a milestone; it has no position.
          requires: [{ kind: 'milestone', index: 0 }],
        },
      ],
    } as unknown as CompiledTree;

    const before = layoutTree(tree, 'wide');
    const after = layoutTree({ ...withMastery, id: 'smithing-mastery' }, 'wide');

    expect(after.edges).toHaveLength(before.edges.length);
    expect(after.nodes.some((n) => n.uid === 'MASTER01')).toBe(false);
  });
});
