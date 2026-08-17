/**
 * §5.3 / §10.4 steps 5–7 — the skill sub-lattice, the spiral, and the ledger.
 *
 * **Everything here is exact integer arithmetic on the lattice**, for the reason
 * A2-D taught `map.ts`: a sub-cell centre that lands on a parent tile's edge is
 * shared by two tiles that reach it through different arithmetic, and reconciling
 * that in pixels works only until a coordinate falls near a rounding boundary.
 * The sub-lattice would inherit the same latent failure, one level finer.
 *
 * The escape is to stop asking a polygon whether it contains a point. §5.3 says
 * "keep every cell whose centre lies inside the region polygon", and the region
 * polygon *is* the union of the region's tiles — so the question is equivalently
 * "which parent tile is this cell's centre in?", which is a total function of the
 * cell's own coordinates, computable in integers, and independent of any region.
 * Two consequences fall out for free:
 *
 * - **Cells partition.** Every cell has exactly one parent tile, tiles are never
 *   claimed twice (validate rule M2), so no cell can be claimed by two regions.
 *   Boundary ties cannot produce a skill hex drawn over another region's.
 * - **Every tile carries exactly `cellDivisor²` cells**, because the rounding is
 *   equivariant under lattice translation. Region capacity is `16 × tiles` at
 *   divisor 4 and needs no measuring.
 */

import type {
  AxialTile,
  Cell,
  DomainId,
  MapFile,
  Placement,
  PlacementLedger,
} from '../validate/types.js';

/**
 * Nearest integer to `value / divisor`, with halves resolved toward +∞ at every
 * magnitude. `Math.round` is not usable here: it sends −0.5 to −0 and +0.5 to 1,
 * so it is not translation-equivariant across the origin and tiles either side
 * of it would take different cell counts.
 */
function nearestQuotient(value: number, divisor: number): number {
  return Math.floor((2 * value + divisor) / (2 * divisor));
}

/**
 * The parent tile containing a sub-cell's centre — cube rounding (§10.2) carried
 * out in units of `1 / cellDivisor` so that no fractional value is ever formed.
 *
 * The sub-lattice is the parent lattice scaled by `1 / cellDivisor` about the
 * same origin, so sub-cell `(a, b)` sits at parent-axial `(a/d, b/d)` exactly.
 */
export function parentTileOf(cell: Cell, cellDivisor: number): AxialTile {
  const d = cellDivisor;
  const x = cell.q;
  const z = cell.r;
  const y = -x - z;

  let rx = nearestQuotient(x, d);
  const ry = nearestQuotient(y, d);
  let rz = nearestQuotient(z, d);

  const dx = Math.abs(rx * d - x);
  const dy = Math.abs(ry * d - y);
  const dz = Math.abs(rz * d - z);

  // Cube rounding resets whichever coordinate drifted furthest, so that the three
  // still sum to zero. Strict comparisons in a fixed order keep the tie-break a
  // pure function of the cell, which is what makes the partition well defined on
  // a region boundary. The third case — `y` drifted furthest — is deliberately
  // absent: correcting `y` leaves `x` and `z` untouched, and those are the axial
  // pair returned.
  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy <= dz) {
    rz = -rx - ry;
  }

  return [rx, rz];
}

const tileKey = (tile: AxialTile): string => `${tile[0]},${tile[1]}`;

/**
 * A cell's offset from the region centroid, multiplied through by the tile count
 * so it stays integral. The centroid of `n` tile centres has denominator `n`;
 * scaling every offset by the same positive `n` changes no ordering.
 */
interface Offset {
  readonly u: number;
  readonly v: number;
}

/**
 * Pixel-space offset, up to one positive scale factor on each axis. The true
 * offset is `(√3/2·(2Δq + Δr), 3/2·Δr)`; dropping the √3 leaves a diagonal linear
 * map with positive determinant, which preserves both the radial order and the
 * cyclic order around the centroid — the only two things the spiral asks for —
 * while keeping every value an exact integer.
 */
function offsetFrom(cell: Cell, tiles: readonly AxialTile[], cellDivisor: number): Offset {
  const n = tiles.length;
  const sumQ = tiles.reduce((total, [q]) => total + q, 0);
  const sumR = tiles.reduce((total, [, r]) => total + r, 0);
  const dq = n * cell.q - cellDivisor * sumQ;
  const dr = n * cell.r - cellDivisor * sumR;
  return { u: 2 * dq + dr, v: 3 * dr };
}

/** Squared distance from the centroid, in the same scaled pixel space. */
function radius(offset: Offset): number {
  return 3 * offset.u ** 2 + offset.v ** 2;
}

/**
 * Which half-turn the offset falls in, so that a full sweep orders as one range
 * rather than wrapping. Cells due east start each ring; the centre cell, whose
 * offset is zero, sorts into the first half and is then separated by radius.
 */
function halfTurn(offset: Offset): number {
  return offset.v < 0 || (offset.v === 0 && offset.u < 0) ? 1 : 0;
}

/**
 * Ring by ring outward, and within a ring by angle. Exact: the angular
 * comparison is a cross product on integers, never an `atan2` on floats.
 */
function compareSpiral(a: Offset, b: Offset): number {
  const byRadius = radius(a) - radius(b);
  if (byRadius !== 0) return byRadius;

  const byHalf = halfTurn(a) - halfTurn(b);
  if (byHalf !== 0) return byHalf;

  const cross = a.u * b.v - a.v * b.u;
  return cross > 0 ? -1 : cross < 0 ? 1 : 0;
}

/**
 * Every cell whose centre lies in the region, in a stable outward order from the
 * region centroid. Deterministic given the tiles and the divisor.
 */
export function enumerateCells(
  tiles: readonly AxialTile[],
  cellDivisor: number,
): readonly Cell[] {
  const owned = new Set(tiles.map(tileKey));
  const cells: Cell[] = [];
  const seen = new Set<string>();

  for (const [q, r] of tiles) {
    // A cell belonging to this tile is within one parent step of its centre, so
    // one divisor's reach in each direction covers every candidate.
    for (let a = cellDivisor * q - cellDivisor; a <= cellDivisor * q + cellDivisor; a += 1) {
      for (let b = cellDivisor * r - cellDivisor; b <= cellDivisor * r + cellDivisor; b += 1) {
        const cell: Cell = { q: a, r: b };
        const key = `${a},${b}`;
        if (seen.has(key)) continue;
        if (!owned.has(tileKey(parentTileOf(cell, cellDivisor)))) continue;
        seen.add(key);
        cells.push(cell);
      }
    }
  }

  // The final `q`/`r` tie-break is not decoration: two cells can be exactly
  // coincident in radius and angle only if they are the same cell, but a stable
  // total order is what makes the fixture assertion meaningful across engines,
  // whose `Array#sort` need not agree on equal elements.
  return cells
    .map((cell) => ({ cell, offset: offsetFrom(cell, tiles, cellDivisor) }))
    .sort(
      (a, b) =>
        compareSpiral(a.offset, b.offset) || a.cell.q - b.cell.q || a.cell.r - b.cell.r,
    )
    .map((entry) => entry.cell);
}

export interface PlacedTree {
  id: string;
  domain: DomainId;
}

export interface AssignmentResult {
  ledger: PlacementLedger;
  /** Trees whose cell the lattice no longer contains, so the compiler can warn. */
  reflowed: readonly string[];
}

const cellKey = (cell: Cell): string => `${cell.q},${cell.r}`;

export class RegionFullError extends Error {
  readonly domain: DomainId;
  constructor(domain: DomainId, capacity: number) {
    super(
      `region "${domain}" has ${capacity} cells and they are all taken; no cell is left for ` +
        'the next tree. Give the domain more tiles in map.yaml — raising cellDivisor is not ' +
        'available, it is frozen and would renumber the spiral (UI-SPEC Q2).',
    );
    this.name = 'RegionFullError';
    this.domain = domain;
  }
}

/**
 * §10.4 step 7. Pure: existing assignments in, assignments for trees lacking one
 * out, and **nothing already placed is ever moved.**
 *
 * An entry is kept only while all three of its premises hold — the tree still
 * exists, it is still in that domain, and the lattice still contains its cell.
 * Each failure is a different event and only the third is a reflow:
 *
 * - the tree is gone → a **retirement**, and its cell goes back in the pool;
 * - the domain changed → the old cell is freed and a new one taken in the
 *   destination, which is safe *because* assignment is lowest-free rather than
 *   by count;
 * - the cell is no longer in the lattice → the region's tiles were edited, which
 *   is the one place N11 is knowingly traded. Those trees are named to the
 *   caller so the compiler can warn loudly.
 */
export function assignPlacements(
  ledger: PlacementLedger,
  trees: readonly PlacedTree[],
  lattices: ReadonlyMap<DomainId, readonly Cell[]>,
): AssignmentResult {
  const domainOf = new Map(trees.map((tree) => [tree.id, tree.domain]));
  const inLattice = new Map<DomainId, Set<string>>();
  for (const [domain, cells] of lattices) {
    inLattice.set(domain, new Set(cells.map(cellKey)));
  }

  const kept: Placement[] = [];
  const reflowed: string[] = [];

  for (const entry of ledger.placements) {
    const domain = domainOf.get(entry.tree);
    if (domain === undefined || domain !== entry.domain) {
      continue;
    }
    if (!inLattice.get(domain)?.has(cellKey(entry.cell))) {
      reflowed.push(entry.tree);
      continue;
    }
    kept.push(entry);
  }

  const taken = new Map<DomainId, Set<string>>();
  for (const entry of kept) {
    const set = taken.get(entry.domain) ?? new Set<string>();
    set.add(cellKey(entry.cell));
    taken.set(entry.domain, set);
  }

  // Sorted by id so the result never depends on the order trees were handed in.
  const unplaced = trees
    .filter((tree) => !kept.some((entry) => entry.tree === tree.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const placements = [...kept];
  for (const tree of unplaced) {
    const cells = lattices.get(tree.domain) ?? [];
    const occupied = taken.get(tree.domain) ?? new Set<string>();
    const cell = cells.find((candidate) => !occupied.has(cellKey(candidate)));
    if (cell === undefined) {
      throw new RegionFullError(tree.domain, cells.length);
    }
    occupied.add(cellKey(cell));
    taken.set(tree.domain, occupied);
    placements.push({ tree: tree.id, domain: tree.domain, cell });
  }

  return {
    ledger: { ...ledger, placements },
    reflowed: reflowed.sort(),
  };
}

/** Q2's frozen value. One global divisor; there is deliberately no override. */
export const CELL_DIVISOR = 4;

export function emptyLedger(): PlacementLedger {
  return { schemaVersion: 1, cellDivisor: CELL_DIVISOR, placements: [] };
}

/** One lattice per region, keyed by domain, from the authored map. */
export function latticesFor(
  map: MapFile,
  cellDivisor: number,
): ReadonlyMap<DomainId, readonly Cell[]> {
  return new Map(
    map.regions.map((region) => [region.domain, enumerateCells(region.tiles, cellDivisor)]),
  );
}

/**
 * The ledger as YAML. Hand-rolled rather than dumped by the `yaml` package for
 * the same reason `serializeJson` is hand-rolled: the file is diffed by CI and
 * read by humans, so one assignment must be exactly one line, forever, and the
 * header must carry the warning that the file is not editable by hand.
 */
export function serializeLedger(ledger: PlacementLedger): string {
  const lines = [
    '# Generated by `lst compile` (§5.3, ARCHITECTURE §10.4). DO NOT EDIT BY HAND.',
    '#',
    '# Each line is one skill\'s position on the map, assigned once — the lowest free cell',
    '# in its domain at the moment it was first compiled — and never recomputed. That is',
    '# what makes N11 true for skill positions: adding a skill moves nothing already',
    '# placed. `lst baseline` check 9 fails CI if a committed line changes.',
    '#',
    '# A gap in a region is CORRECT. It is a retired skill\'s cell, waiting for the next',
    '# arrival; closing it by hand would move whoever holds the next cell.',
    `schemaVersion: ${ledger.schemaVersion}`,
    `cellDivisor: ${ledger.cellDivisor}`,
    'placements:',
  ];
  for (const entry of ledger.placements) {
    lines.push(
      `  - { tree: ${entry.tree}, domain: ${entry.domain}, ` +
        `cell: { q: ${entry.cell.q}, r: ${entry.cell.r} } }`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export type { Cell, DomainId, Placement, PlacementLedger };
