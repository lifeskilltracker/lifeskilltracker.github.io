/**
 * §11.6, D-21 — the level contribution table, as **data**.
 *
 * The ten integers below are normative; `p = 1.25` is provenance. Invariant 4 is
 * asserted against these numbers and this `K`, never against `L ** p` — the
 * earlier spec shipped a curve whose rounded integers broke the invariant while
 * the continuous curve it was tested against did not (T26/F1).
 *
 * It is a table rather than a formula so that R-19 stays reversible: NG8 says
 * levels do not encode estimated effort, and D-21 arguably makes them do exactly
 * that. If the owner ever reverses the call, the flat `[8, 16, 24, …, 80]` is one
 * data edit away. **Do not replace this with `Math.round(L ** 1.25 * 8)`.**
 */

/**
 * `contribution(L)` for L = 1..10, **indexed by `L - 1`**. There is no entry for
 * level 0 because an unstarted or level-0 skill contributes nothing at all;
 * `contribution` is the accessor that says so.
 */
export const CONTRIBUTION: readonly number[] = [8, 19, 32, 45, 60, 75, 91, 108, 125, 142];

/**
 * The half-way constant of `fill = s / (s + K)` (§11.6). `K = 48` is `k = 6` on
 * the ×8 scale, and the two constants are **coupled**: `p ≤ log₂(2k/(k−1))`
 * puts the ceiling at 1.263 for `k = 6`. Neither may be retuned alone —
 * invariant 4 exists to catch exactly that, and can only do so because it reads
 * these shipped values.
 */
export const K = 48;

/** §11.6's `contribution(L)`. Levels outside 1..10 contribute 0. */
export function contribution(level: number): number {
  return CONTRIBUTION[level - 1] ?? 0;
}
