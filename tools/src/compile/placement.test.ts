import { describe, expect, it } from 'vitest';

import {
  assignPlacements,
  enumerateCells,
  type Cell,
  type PlacementLedger,
} from './placement.js';
import type { AxialTile, DomainId, MapFile } from '../validate/types.js';
import path from 'node:path';
import { defaultRepoRoot, taxonomyDir } from '../shared/paths.js';
import { readYamlFile } from '../shared/yaml-source.js';

const DIVISOR = 4;

describe('§5.3 — the sub-lattice', () => {
  it('gives a one-tile region exactly divisor² cells', () => {
    const tiles: AxialTile[] = [[0, 0]];

    expect(enumerateCells(tiles, DIVISOR)).toHaveLength(DIVISOR * DIVISOR);
  });
});

describe('§5.3 — the spiral', () => {
  it('puts the cell nearest the centroid at index 0', () => {
    expect(enumerateCells([[0, 0]], DIVISOR)[0]).toEqual({ q: 0, r: 0 });
  });

  it('starts from the centroid wherever the region sits on the lattice', () => {
    expect(enumerateCells([[3, 1]], DIVISOR)[0]).toEqual({ q: 12, r: 4 });
  });

  it('never moves outward and then back in', () => {
    const tiles: AxialTile[] = [[2, 0], [3, 0], [2, 1], [3, 1]];
    const cells = enumerateCells(tiles, DIVISOR);
    const centroid = centroidOf(tiles, DIVISOR);

    const distances = cells.map((cell) => squaredPixelDistance(cell, centroid));
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });
});

describe('§5.3 — append-only assignment', () => {
  const lattices = new Map<DomainId, readonly Cell[]>([
    ['making', enumerateCells([[2, 0], [3, 0]], DIVISOR)],
    ['body', enumerateCells([[-1, 2], [0, 2]], DIVISOR)],
  ]);

  const empty: PlacementLedger = { schemaVersion: 1, cellDivisor: DIVISOR, placements: [] };

  it('gives an unplaced tree the lowest free cell in its domain', () => {
    const { ledger } = assignPlacements(empty, [{ id: 'blacksmithing', domain: 'making' }], lattices);

    expect(ledger.placements).toEqual([
      { tree: 'blacksmithing', domain: 'making', cell: lattices.get('making')![0] },
    ]);
  });

  it('never moves a tree that is already placed', () => {
    const seeded: PlacementLedger = {
      ...empty,
      placements: [{ tree: 'piano', domain: 'making', cell: lattices.get('making')![7] }],
    };

    const { ledger } = assignPlacements(
      seeded,
      [{ id: 'piano', domain: 'making' }, { id: 'pottery', domain: 'making' }],
      lattices,
    );

    expect(placementFor(ledger, 'piano').cell).toEqual(lattices.get('making')![7]);
    expect(placementFor(ledger, 'pottery').cell).toEqual(lattices.get('making')![0]);
  });

  it('adds exactly one line and rewrites none of the others', () => {
    const first = assignPlacements(
      empty,
      [{ id: 'piano', domain: 'making' }, { id: 'running', domain: 'body' }],
      lattices,
    ).ledger;

    const second = assignPlacements(
      first,
      [
        { id: 'piano', domain: 'making' },
        { id: 'running', domain: 'body' },
        { id: 'pottery', domain: 'making' },
      ],
      lattices,
    ).ledger;

    expect(second.placements.slice(0, first.placements.length)).toEqual(first.placements);
    expect(second.placements).toHaveLength(first.placements.length + 1);
  });

  it('frees a retired tree’s cell for the next arrival, lowest-free not next-highest', () => {
    const seeded = assignPlacements(
      empty,
      [{ id: 'piano', domain: 'making' }, { id: 'pottery', domain: 'making' }],
      lattices,
    ).ledger;
    const freed = placementFor(seeded, 'piano').cell;

    const afterRetirement = assignPlacements(seeded, [{ id: 'pottery', domain: 'making' }], lattices).ledger;
    expect(afterRetirement.placements.map((entry) => entry.tree)).toEqual(['pottery']);

    const afterArrival = assignPlacements(
      afterRetirement,
      [{ id: 'pottery', domain: 'making' }, { id: 'welding', domain: 'making' }],
      lattices,
    ).ledger;

    expect(placementFor(afterArrival, 'welding').cell).toEqual(freed);
  });

  it('moves a tree that changes primary domain, and frees the cell it left', () => {
    const seeded = assignPlacements(empty, [{ id: 'yoga', domain: 'making' }], lattices).ledger;
    const vacated = placementFor(seeded, 'yoga').cell;

    const { ledger } = assignPlacements(
      seeded,
      [{ id: 'yoga', domain: 'body' }, { id: 'pottery', domain: 'making' }],
      lattices,
    );

    expect(placementFor(ledger, 'yoga').domain).toBe('body');
    expect(placementFor(ledger, 'yoga').cell).toEqual(lattices.get('body')![0]);
    expect(placementFor(ledger, 'pottery').cell).toEqual(vacated);
  });

  it('names every tree it had to reflow when the lattice no longer holds its cell', () => {
    const seeded = assignPlacements(empty, [{ id: 'piano', domain: 'making' }], lattices).ledger;

    const shrunk = new Map(lattices);
    shrunk.set('making', enumerateCells([[9, 9]], DIVISOR));

    const { ledger, reflowed } = assignPlacements(seeded, [{ id: 'piano', domain: 'making' }], shrunk);

    expect(reflowed).toEqual(['piano']);
    expect(placementFor(ledger, 'piano').cell).toEqual(shrunk.get('making')![0]);
  });

  it('refuses to place a tree when the region is full rather than dropping it', () => {
    const oneCell = new Map<DomainId, readonly Cell[]>([['making', [{ q: 0, r: 0 }]]]);
    const trees = [{ id: 'aaa', domain: 'making' as DomainId }, { id: 'bbb', domain: 'making' as DomainId }];

    expect(() => assignPlacements(empty, trees, oneCell)).toThrow(/making/);
  });

  it('is idempotent: recompiling unchanged content rewrites nothing', () => {
    const trees = [{ id: 'piano', domain: 'making' as DomainId }, { id: 'running', domain: 'body' as DomainId }];
    const once = assignPlacements(empty, trees, lattices).ledger;
    const twice = assignPlacements(once, trees, lattices).ledger;

    expect(twice).toEqual(once);
  });
});

/**
 * UI-SPEC Q2 is frozen, so its two constraints are asserted here rather than
 * recorded in a comment. Capacity is the one this file can check; the 45 px
 * touch-target floor belongs to the level-1 camera and is T30's.
 */
describe('§5.3 Q2 — cellDivisor 4 against the real map.yaml', () => {
  const map = readYamlFile<MapFile>(path.join(taxonomyDir(defaultRepoRoot), 'map.yaml')).data;
  const regionOf = (domain: string) => map.regions.find((region) => region.domain === domain)!;

  it('is the divisor the ledger and the spec both name', () => {
    expect(map.hexSize).toBe(40);
    expect(DIVISOR).toBe(4);
  });

  it.each([
    ['making', 137],
    ['body', 82],
    ['home', 70],
    ['mind', 52],
    ['people', 52],
    ['work-money', 49],
    ['play', 43],
    ['outdoors-nature', 43],
  ])('holds %s’s 500-skill projection of %i', (domain, projected) => {
    expect(enumerateCells(regionOf(domain).tiles, DIVISOR).length).toBeGreaterThanOrEqual(projected);
  });

  it('gives every region exactly divisor² cells per tile, so capacity needs no measuring', () => {
    for (const region of map.regions) {
      expect(enumerateCells(region.tiles, DIVISOR)).toHaveLength(region.tiles.length * DIVISOR * DIVISOR);
    }
  });

  it('never lets two regions claim the same cell', () => {
    const owner = new Map<string, string>();
    for (const region of map.regions) {
      for (const cell of enumerateCells(region.tiles, DIVISOR)) {
        const key = `${cell.q},${cell.r}`;
        expect(owner.get(key)).toBeUndefined();
        owner.set(key, region.domain);
      }
    }
  });

  it('enumerates byte-identically across runs', () => {
    const once = JSON.stringify(enumerateCells(regionOf('making').tiles, DIVISOR));
    const twice = JSON.stringify(enumerateCells([...regionOf('making').tiles].reverse(), DIVISOR));

    expect(twice).toBe(once);
    expect(once).toMatchSnapshot();
  });
});

function placementFor(ledger: PlacementLedger, tree: string) {
  const found = ledger.placements.find((entry) => entry.tree === tree);
  if (!found) throw new Error(`no placement for ${tree}`);
  return found;
}

/** The centroid of the tile centres, in sub-lattice units. */
function centroidOf(tiles: readonly AxialTile[], divisor: number): { q: number; r: number } {
  const sum = tiles.reduce((acc, [q, r]) => ({ q: acc.q + q, r: acc.r + r }), { q: 0, r: 0 });
  return { q: (divisor * sum.q) / tiles.length, r: (divisor * sum.r) / tiles.length };
}

/** Pixel-space distance, up to a constant factor: x ∝ (2q + r)·√3/2, y ∝ 3r/2. */
function squaredPixelDistance(cell: Cell, to: { q: number; r: number }): number {
  const dq = cell.q - to.q;
  const dr = cell.r - to.r;
  return 3 * (2 * dq + dr) ** 2 + 9 * dr ** 2;
}
