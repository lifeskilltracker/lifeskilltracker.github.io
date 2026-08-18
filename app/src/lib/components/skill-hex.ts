/**
 * Skill-cell geometry (§5.3, §5.4 — T31).
 *
 * **Its own module because it is level-1 only.** §17.1 budgets 52 kB for the
 * first route's JavaScript, and level 0 — the route every visitor lands on —
 * draws eight region paths and no hexes. Living in `camera.ts` put the corner
 * table and the path builder into the first frame's chunk for no first-frame
 * benefit; here, they ride the same lazily-imported chunk as `SkillHexLayer`.
 *
 * T29 assigns each published tree a sub-lattice cell and `lst compile` writes it
 * into the manifest. **The assignment is never re-derived here** — re-running
 * the spiral client-side would put an N11 guarantee in two places, and two
 * places disagree. What the app does have to do is turn that cell into a
 * position, because the manifest ships cells and paths, not hex centres.
 *
 * That conversion is §10.2's, restated rather than imported: `app/` may not
 * import `tools/`, so the formula appears in both workspaces by necessity. The
 * restatement is safe because it is *checked* — `skill-hex.test.ts` places every
 * shipped tree and asserts the point lands inside its own domain's region path,
 * which is exactly the property that fails if the two conversions drift apart.
 *
 * The sub-lattice is the parent lattice scaled by `1 / cellDivisor` about the
 * same origin, so cell `(q, r)` sits at parent-axial `(q/d, r/d)` — which is
 * §10.2 evaluated at `CELL_SIZE` instead of at `HEX_SIZE`. No division is
 * performed and no fractional axial coordinate is ever formed.
 */

import { CELL_SIZE } from './camera.js';

export interface Cell {
  readonly q: number;
  readonly r: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

const SQRT3 = Math.sqrt(3);

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The six corners at 30° + 60°·i as offsets in half-widths and half-heights —
 * the same offsets, in the same angle order, as the compiler's own
 * `CORNER_OFFSETS`. One description of a corner per workspace.
 */
const CORNER_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
  [0, -2],
  [1, -1],
];

/** §10.2, at the cell scale: x = size × √3 × (q + r/2), y = size × 3/2 × r. */
export function cellCentre(cell: Cell): Point {
  return {
    x: CELL_SIZE * SQRT3 * (cell.q + cell.r / 2),
    y: CELL_SIZE * 1.5 * cell.r,
  };
}

/**
 * The skill hex is drawn a little inside its cell, so that two adjacent skills
 * read as two hexes rather than as a honeycomb. The gap is what carries §5.4's
 * "individually legible" at level 1: a full-size cell hex tiles seamlessly, and
 * the border channel — solid versus dashed — stops being readable at the seam,
 * which would lose §5.4's started/unstarted distinction to the packing.
 */
export const SKILL_HEX_INSET = 0.86;

/** One skill hex as an SVG path, pointy-top, centred on its cell. */
export function skillHexPath(cell: Cell, inset = SKILL_HEX_INSET): string {
  const centre = cellCentre(cell);
  const size = CELL_SIZE * inset;
  const halfWidth = (size * SQRT3) / 2;
  const halfHeight = size / 2;
  return `${CORNER_OFFSETS.map(([dx, dy], i) => {
    const x = round2(centre.x + halfWidth * dx);
    const y = round2(centre.y + halfHeight * dy);
    return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(' ')} Z`;
}
