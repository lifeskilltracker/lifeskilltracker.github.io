import { describe, expect, it } from 'vitest';
import { axialToPixel, compileMap, hexCorners, unionTiles } from './map.js';
import type { AxialTile, MapFile } from '../validate/types.js';

const SIZE = 40;
const SQRT3 = Math.sqrt(3);

/** Pulls the coordinate pairs out of an `M x,y L x,y … Z` path. */
function pointsOf(path: string): Array<[number, number]> {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(
    (match) => [Number(match[1]), Number(match[2])] as [number, number],
  );
}

describe('§10.2 — axial to pixel', () => {
  it('matches the formula exactly for hand-computed pairs', () => {
    const cases: Array<[AxialTile, [number, number]]> = [
      [[0, 0], [0, 0]],
      [[1, 0], [SIZE * SQRT3, 0]],
      [[0, 1], [SIZE * SQRT3 * 0.5, SIZE * 1.5]],
      [[2, 1], [SIZE * SQRT3 * 2.5, SIZE * 1.5]],
      [[-1, 2], [SIZE * SQRT3 * 0, SIZE * 3]],
      [[3, -2], [SIZE * SQRT3 * 2, SIZE * -3]],
    ];

    for (const [tile, [x, y]] of cases) {
      const point = axialToPixel(tile, SIZE);
      expect(point.x).toBeCloseTo(x, 9);
      expect(point.y).toBeCloseTo(y, 9);
    }
  });

  it('scales linearly with hexSize, since size is the only unit', () => {
    const at40 = axialToPixel([3, -2], 40);
    const at80 = axialToPixel([3, -2], 80);

    expect(at80.x).toBeCloseTo(at40.x * 2, 9);
    expect(at80.y).toBeCloseTo(at40.y * 2, 9);
  });
});

describe('§10.2 — the six corners at 30° + 60°·i', () => {
  it('puts a pointy-top hexagon √3·size wide and 2·size tall', () => {
    const corners = hexCorners(axialToPixel([0, 0], SIZE), SIZE);

    expect(corners).toHaveLength(6);
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(SIZE * SQRT3, 9);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(SIZE * 2, 9);
  });

  it('gives adjacent tiles bit-identical shared corners after snapping', () => {
    // §10.4 step 1's whole purpose. Without it the shared edge of two adjacent
    // hexes appears once from each side at coordinates differing in the last
    // bits, step 2 discards neither, and the interior edge survives into the
    // outline.
    const left = unionTiles([[0, 0]], SIZE)[0];
    const pair = unionTiles(
      [
        [0, 0],
        [1, 0],
      ],
      SIZE,
    );

    expect(pointsOf(left)).toHaveLength(6);
    // Two hexes: 12 edges, 2 of them the same shared edge → 10 exterior.
    expect(pair).toHaveLength(1);
    expect(pointsOf(pair[0])).toHaveLength(10);
  });
});

describe('§10.4 — region union', () => {
  /** Three mutually adjacent tiles: 18 edges, 3 shared pairs, 12 exterior. */
  const triangle: AxialTile[] = [
    [0, 0],
    [1, 0],
    [0, 1],
  ];

  it('emits one closed path with exterior edges only', () => {
    const paths = unionTiles(triangle, SIZE);

    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^M /);
    expect(paths[0].endsWith('Z')).toBe(true);
    expect(pointsOf(paths[0])).toHaveLength(12);
  });

  it('never emits an interior vertex', () => {
    // The three tiles meet at one point, and every edge touching it is shared.
    // If that point appears in the outline, step 2 kept an interior edge.
    const shared = hexCorners(axialToPixel([0, 0], SIZE), SIZE).find((corner) =>
      hexCorners(axialToPixel([1, 0], SIZE), SIZE).some(
        (other) =>
          Math.abs(other.x - corner.x) < 1e-6 &&
          Math.abs(other.y - corner.y) < 1e-6 &&
          hexCorners(axialToPixel([0, 1], SIZE), SIZE).some(
            (third) => Math.abs(third.x - corner.x) < 1e-6 && Math.abs(third.y - corner.y) < 1e-6,
          ),
      ),
    );
    expect(shared).toBeDefined();

    const points = pointsOf(unionTiles(triangle, SIZE)[0]);

    expect(
      points.some(
        ([x, y]) => Math.abs(x - shared!.x) < 0.01 && Math.abs(y - shared!.y) < 0.01,
      ),
    ).toBe(false);
  });

  it('traces the outline as a walk, so consecutive points are one edge apart', () => {
    const points = pointsOf(unionTiles(triangle, SIZE)[0]);

    for (let i = 0; i < points.length; i += 1) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      expect(Math.hypot(bx - ax, by - ay)).toBeCloseTo(SIZE, 2);
    }
  });

  it('emits two sub-paths for a ring, which is the hole case §10.4 warns about', () => {
    // A ring around (1,1): contiguous under adjacency, so M3 passes it, and it
    // is loop count alone that cannot tell a hole from a broken region.
    const ring: AxialTile[] = [
      [1, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ];

    const paths = unionTiles(ring, SIZE);

    expect(paths).toHaveLength(2);
    for (const path of paths) expect(path.endsWith('Z')).toBe(true);
  });

  it('emits one loop per cluster for a disconnected region, which M3 rejects first', () => {
    const split: AxialTile[] = [
      [0, 0],
      [1, 0],
      [20, 20],
    ];

    expect(unionTiles(split, SIZE)).toHaveLength(2);
  });
});

describe('§10.3, §10.4 — compileMap', () => {
  const map: MapFile = {
    schemaVersion: 1,
    hexSize: SIZE,
    regions: [
      {
        domain: 'making',
        tiles: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        subregions: [
          { id: 'expression', tiles: [[0, 0]] },
          { id: 'objects', tiles: [[1, 0]] },
          { id: 'systems', tiles: [[0, 1]] },
        ],
      },
      {
        domain: 'mind',
        tiles: [
          [5, 0],
          [6, 0],
        ],
        label: { q: 5, r: 0 },
      },
    ],
  };

  it('emits one region per authored region, in authored order', () => {
    const { regions } = compileMap(map);

    expect(regions.map((r) => r.domain)).toEqual(['making', 'mind']);
    for (const region of regions) expect(region.path.length).toBeGreaterThan(0);
  });

  it('compiles each subregion to its own path', () => {
    const { regions } = compileMap(map);
    const making = regions.find((r) => r.domain === 'making')!;

    expect(making.subregions?.map((s) => s.id)).toEqual(['expression', 'objects', 'systems']);
    // A lone tile is a hexagon: six corners, none of them shared.
    for (const sub of making.subregions!) expect(pointsOf(sub.path)).toHaveLength(6);
  });

  it('omits subregions entirely rather than emitting an empty array', () => {
    const { regions } = compileMap(map);

    expect('subregions' in regions.find((r) => r.domain === 'mind')!).toBe(false);
  });

  it('defaults the label to the centroid and honours an authored one', () => {
    const { regions } = compileMap(map);
    const making = regions.find((r) => r.domain === 'making')!;
    const mind = regions.find((r) => r.domain === 'mind')!;

    // Centroid of the three tile centres.
    const centres = making.domain === 'making' ? [axialToPixel([0, 0], SIZE), axialToPixel([1, 0], SIZE), axialToPixel([0, 1], SIZE)] : [];
    expect(making.label!.x).toBeCloseTo(centres.reduce((s, c) => s + c.x, 0) / 3, 3);
    expect(making.label!.y).toBeCloseTo(centres.reduce((s, c) => s + c.y, 0) / 3, 3);

    // Authored `label: {q, r}` is an axial tile, converted like any other.
    const authored = axialToPixel([5, 0], SIZE);
    expect(mind.label!.x).toBeCloseTo(authored.x, 3);
    expect(mind.label!.y).toBeCloseTo(authored.y, 3);
  });

  it('computes a bounding box that contains every corner of the region', () => {
    const { regions } = compileMap(map);
    const making = regions.find((r) => r.domain === 'making')!;

    for (const [x, y] of pointsOf(making.path)) {
      expect(x).toBeGreaterThanOrEqual(making.bounds!.x - 0.01);
      expect(y).toBeGreaterThanOrEqual(making.bounds!.y - 0.01);
      expect(x).toBeLessThanOrEqual(making.bounds!.x + making.bounds!.width + 0.01);
      expect(y).toBeLessThanOrEqual(making.bounds!.y + making.bounds!.height + 0.01);
    }
    expect(making.bounds!.width).toBeCloseTo(SIZE * SQRT3 * 2, 2);
  });

  it('warns about a hole rather than failing, and names the domain', () => {
    const ringed: MapFile = {
      schemaVersion: 1,
      hexSize: SIZE,
      regions: [
        {
          domain: 'mind',
          tiles: [
            [1, 0],
            [2, 0],
            [0, 1],
            [2, 1],
            [0, 2],
            [1, 2],
          ],
        },
      ],
    };

    const { regions, warnings } = compileMap(ringed);

    // Non-blocking: §10.4 calls a hole "far more likely to be an authoring
    // mistake than an intention", and a hard failure would be stricter than
    // the spec asks for.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('mind');
    expect(regions).toHaveLength(1);
    // Both loops ship, as sub-paths of one `d`.
    expect(regions[0].path.match(/Z/g)).toHaveLength(2);
  });

  it('emits nothing quantitative — only geometry (§10.3, NG9)', () => {
    const { regions } = compileMap(map);

    for (const region of regions) {
      expect(Object.keys(region).sort()).toEqual(
        region.subregions === undefined
          ? ['bounds', 'domain', 'label', 'path']
          : ['bounds', 'domain', 'label', 'path', 'subregions'],
      );
    }
  });
});
