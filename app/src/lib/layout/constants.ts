/**
 * Layout units (§8.1).
 *
 * These are **abstract units**, not pixels — §9 rescales them through the SVG
 * `viewBox`, so any internally consistent set draws the same picture and what
 * carries meaning is the ratios. No value here is normative; they ship as
 * tunable data in one module so the whole set can be retuned in one diff.
 *
 * Two are constrained rather than free, and breaking either is a bug rather
 * than a matter of taste. `assertConstraints` states both mechanically:
 *
 *   1. ROW_GUTTER > 0, or §8.4's edges have no channel to route through.
 *   2. SIDE_GUTTER_LANE × (max same-level edges in one row) ≤ SIDE_GUTTER,
 *      or the outermost lane escapes the tree.
 */

/** One lane's horizontal slot. */
export const SLOT_WIDTH = 100;

/** A node's height. */
export const SLOT_HEIGHT = 44;

/** A level's row — equal for all ten (§8.2 step 1). */
export const ROW_HEIGHT = 96;

/** `ROW_HEIGHT − SLOT_HEIGHT`; the channel §8.4 routes through. */
export const ROW_GUTTER = ROW_HEIGHT - SLOT_HEIGHT;

/** Between adjacent columns. */
export const COLUMN_GUTTER = 24;

/** The same-level channel on the right of the whole tree (§8.4). */
export const SIDE_GUTTER = 72;

/** Depth step between two same-level edges sharing a row. */
export const SIDE_GUTTER_LANE = 18;

/** Vertical offset that stops a same-level path retracing itself. */
export const SAME_LEVEL_BOW = 12;

/**
 * The §8.1 constraint that the side channel can hold the edges assigned to it.
 * Called by the engine with the busiest row's edge count, and asserted directly
 * by the constant tests.
 */
export function sideChannelFits(maxSameLevelEdgesInOneRow: number): boolean {
  return SIDE_GUTTER_LANE * maxSameLevelEdgesInOneRow <= SIDE_GUTTER;
}
