/**
 * Arrow-key traversal over the hexes (§5.5, §15.2 — T31).
 *
 * The properties worth asserting are the ones a reader depends on without being
 * able to see the arrangement: that a press always moves in the direction it
 * names, that it never wraps, and that the same keys from the same place always
 * land in the same hex.
 */

import { describe, expect, it } from 'vitest';
import { type Cell, cellCentre } from './skill-hex.js';
import { neighbourInDirection } from './hex-neighbours.js';

const cell = (q: number, r: number): Cell => ({ q, r });

/** A small patch of the sub-lattice: three rows of three, `r` the row. */
const PATCH: readonly Cell[] = [
  cell(0, 0), cell(1, 0), cell(2, 0),
  cell(0, 1), cell(1, 1), cell(2, 1),
  cell(0, 2), cell(1, 2), cell(2, 2),
];

describe('§5.5 — a press moves in the direction it names', () => {
  it('goes right along a row', () => {
    expect(neighbourInDirection(cell(0, 1), PATCH, 'right')).toEqual(cell(1, 1));
  });

  it('goes left along a row', () => {
    expect(neighbourInDirection(cell(2, 1), PATCH, 'left')).toEqual(cell(1, 1));
  });

  it('goes down a row, not along one', () => {
    const down = neighbourInDirection(cell(1, 0), PATCH, 'down');
    expect(down).not.toBeNull();
    expect(cellCentre(down!).y).toBeGreaterThan(cellCentre(cell(1, 0)).y);
  });

  it('goes up a row, not along one', () => {
    const up = neighbourInDirection(cell(1, 2), PATCH, 'up');
    expect(up).not.toBeNull();
    expect(cellCentre(up!).y).toBeLessThan(cellCentre(cell(1, 2)).y);
  });

  it('never returns the cell it started from', () => {
    for (const from of PATCH) {
      for (const dir of ['up', 'down', 'left', 'right'] as const) {
        expect(neighbourInDirection(from, PATCH, dir)).not.toEqual(from);
      }
    }
  });
});

describe('§5.5 — it stops at the edge rather than wrapping', () => {
  it('returns null pressing right from the rightmost cell on the map', () => {
    // (2,2) is furthest right of all nine: rows stagger rightwards, so the
    // bottom row's last cell is the extreme, not the middle row's.
    expect(neighbourInDirection(cell(2, 2), PATCH, 'right')).toBeNull();
  });

  it('still moves at the end of a row, because the diagonal is genuinely next', () => {
    // The cone's cost, asserted rather than hidden: → from the end of the middle
    // row lands down-and-right at 60°, which on this lattice is the nearest cell
    // rightwards there is. A narrower cone would strand the reader here.
    expect(neighbourInDirection(cell(2, 1), PATCH, 'right')).toEqual(cell(2, 2));
  });

  it('returns null on an arrangement of one', () => {
    const only = [cell(4, 4)];
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      expect(neighbourInDirection(cell(4, 4), only, dir)).toBeNull();
    }
  });

  it('returns null on an empty arrangement', () => {
    expect(neighbourInDirection(cell(0, 0), [], 'right')).toBeNull();
  });
});

describe('§5.5 — sparse domains still move', () => {
  /**
   * The case a six-direction adjacency walk gets wrong, and the reason for the
   * cone. Three skills scattered across a region sized for 112 have no adjacent
   * cells at all; a walk would be stuck on the first press, forever.
   */
  const SPARSE = [cell(0, 0), cell(9, 0), cell(0, 7)];

  it('reaches a distant cell in the same direction', () => {
    expect(neighbourInDirection(cell(0, 0), SPARSE, 'right')).toEqual(cell(9, 0));
  });

  it('reaches a distant cell downward', () => {
    expect(neighbourInDirection(cell(0, 0), SPARSE, 'down')).toEqual(cell(0, 7));
  });
});

describe('§5.5 — traversal is reproducible', () => {
  it('does not depend on the order the cells arrive in', () => {
    const shuffled = [...PATCH].reverse();
    for (const from of PATCH) {
      for (const dir of ['up', 'down', 'left', 'right'] as const) {
        expect(neighbourInDirection(from, shuffled, dir)).toEqual(
          neighbourInDirection(from, PATCH, dir),
        );
      }
    }
  });

  it('answers for a `from` that is not itself in the arrangement', () => {
    // The manifest changed under the focused cell. A reader should still be able
    // to move rather than meet an exception.
    // (0,0) rather than (0,1): the rows stagger, so from far to the left the
    // upper row's first cell is the nearer of the two.
    expect(neighbourInDirection(cell(-5, 1), PATCH, 'right')).toEqual(cell(0, 0));
  });
});
