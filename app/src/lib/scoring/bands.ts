/**
 * §11.6's five named bands over `fill` (T26/F18) — one table, one resolver, and
 * nothing else in the module.
 *
 * **The table is expected to move, and that is the design.** Names, count, and
 * boundaries are provisional and the owner expects to tune them from real use,
 * so the bar F18 set is that renaming a band or moving a boundary is a one-line
 * data edit with no type change and no component change. That is why `name` is
 * `string` and not a union: `TierName` is closed only because F7 fixes tiers as
 * pairs of levels 1–10, and bands have no such anchor. **Do not "tighten" it.**
 *
 * `DomainScore` deliberately carries no band field — the band is a presentation
 * mapping over `fill`, and keeping it out of the engine's output is what makes
 * moving a boundary free of property tests to re-derive.
 *
 * The boundaries are landmark-anchored rather than quintiles: the top band opens
 * just under a lone level-10 skill's 74.7%, so **one skill taken all the way
 * reaches it**. That is the claim R-19's depth premium exists to make, and
 * `domain.test.ts` asserts it as a landmark.
 */

export interface Band {
  /** Display name. `string`, not a union — see the module note. */
  readonly name: string;
  /** Inclusive lower bound on `fill`. Bands are half-open `[from, next)`. */
  readonly from: number;
}

/** Ascending by `from`; the first bound is 0 and every bound lies in `[0, 1)`. */
export const BANDS: readonly Band[] = [
  { name: 'Quiet', from: 0 }, //      nothing attained, up to one skill at level 1
  { name: 'Emerging', from: 0.15 }, //  one skill around levels 2–3
  { name: 'Moderate', from: 0.35 }, //  one skill around levels 3–5
  { name: 'Active', from: 0.55 }, //    one skill around levels 6–9
  { name: 'Deep', from: 0.72 }, //      a mastered skill, and beyond
];

/**
 * The band containing `fill`, resolving half-open `[from, next)`. Total: `fill`
 * is in `[0, 1)` by construction (§11.6), and the first band starts at 0.
 */
export function bandFor(fill: number): string {
  let resolved = BANDS[0];
  for (const band of BANDS) {
    if (fill >= band.from) resolved = band;
  }
  return resolved.name;
}
