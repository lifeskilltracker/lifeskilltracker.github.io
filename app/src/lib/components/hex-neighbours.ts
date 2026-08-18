/**
 * Arrow-key traversal over the skill hexes (§5.5, §15.2 — T31). Pure: no DOM,
 * no framework, no manifest.
 *
 * **A hex layer has no rows and no columns**, which is the whole difficulty.
 * §15.2's tree grid can navigate by index because the tree *is* a grid — level,
 * track, lane — and the keyboard model falls out of the layout. Skills are
 * placed on a spiral by T29, so "the hex to the right" is not an index
 * arithmetic; it is a question about geometry, and it has to be answered in a
 * way that is stable, total, and reversible enough to feel like a grid to a
 * reader who cannot see the arrangement.
 *
 * The model is a **directional cone**: from the focused cell, consider only the
 * cells whose bearing lies within ±60° of the pressed direction, and take the
 * nearest of those. Three properties make this the right shape:
 *
 * - **It is total in the useful sense.** Every cell outside the cone is excluded
 *   by direction alone, so a sparse domain — three skills in a corner of a
 *   region sized for 112 — still moves, rather than requiring a neighbour to
 *   exist at an exact axial offset. A strict six-direction adjacency walk would
 *   be stuck on the very first press for almost every real domain.
 * - **±60° is set by the lattice, not chosen for tidiness.** A pointy-top hex has
 *   neighbours at 0°, 60°, 120°, 180°, 240° and 300°, and *nothing* sits at 90°:
 *   the cell below `(q, r)` is `(q − 1, r + 2)`, two rows away. So four arrow
 *   keys cannot partition six directions, and any cone narrow enough to keep
 *   `down` off the diagonals — ±45°, say — makes `down` skip a whole row on a
 *   dense patch. ±60° instead lets the two lower diagonals both answer `down`,
 *   with the nearer one winning. The cost is that a diagonal neighbour is
 *   reachable by two different keys, and that is the right trade: on a hex grid
 *   it is unavoidable, and the alternative strands the reader.
 * - **It degrades to "nothing" honestly.** From the last hex in the direction
 *   pressed there is no candidate in the cone at all, and the answer is `null`
 *   rather than a wrap. Wrapping is right for the tree, where `.` already jumps
 *   and the grid order is documented; here it would teleport the reader across
 *   a region with no announcement able to explain the jump. Note that "last in
 *   the direction pressed" means last in the *cone*: pressing → at the end of a
 *   row still moves, down-and-right, because that cell genuinely is the next one
 *   rightwards. Only the rightmost hex on the map has nowhere to go.
 *
 * Ties — two cells at the same distance and the same bearing — are broken by
 * cell order, `q` then `r`, so traversal is a pure function of the input and
 * two readers pressing the same keys land in the same place.
 */

import { cellCentre, type Cell } from './skill-hex.js';

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * The bearing each arrow points at, in radians, in **screen** space — `y` grows
 * downward, so `up` is −π/2. Stated as a table rather than as a `switch` over
 * axes because the cone test below is one piece of arithmetic for all four.
 */
const BEARINGS: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/** ±60°, inclusive — see the note above on why the lattice fixes this number. */
const CONE = Math.PI / 3;

/** Signed angular difference in (−π, π]. */
function angleDelta(a: number, b: number): number {
  let delta = a - b;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  return delta;
}

const sameCell = (a: Cell, b: Cell): boolean => a.q === b.q && a.r === b.r;

/**
 * The nearest cell in `dir`, or `null` at the edge of the arrangement.
 *
 * `from` need not be a member of `cells`; a caller that has lost its focused
 * cell — the manifest changed under it — can still ask, and gets the nearest
 * cell in that direction rather than an exception.
 */
export function neighbourInDirection(
  from: Cell,
  cells: readonly Cell[],
  dir: Direction,
): Cell | null {
  const origin = cellCentre(from);
  const bearing = BEARINGS[dir];

  let best: Cell | null = null;
  let bestDistance = Infinity;

  for (const cell of cells) {
    if (sameCell(cell, from)) continue;

    const point = cellCentre(cell);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;

    // Two cells at the same centre cannot be ordered by bearing. It cannot
    // happen — T29 partitions the sub-lattice and M2 forbids double claims — so
    // this is a guard against a malformed manifest, not a real case.
    if (dx === 0 && dy === 0) continue;

    if (Math.abs(angleDelta(Math.atan2(dy, dx), bearing)) > CONE) continue;

    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = cell;
      bestDistance = distance;
      continue;
    }
    // The tie-break, and the reason traversal is reproducible: `q` then `r`,
    // never insertion order, which the manifest's sort could change under us.
    if (distance === bestDistance && best !== null) {
      if (cell.q < best.q || (cell.q === best.q && cell.r < best.r)) best = cell;
    }
  }

  return best;
}
