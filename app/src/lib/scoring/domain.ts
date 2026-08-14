/**
 * §11.6 and §11.7 — the three map channels, computed together.
 *
 * **This function never reads tree content.** §3.3 requires the world map to
 * render before any bundle is fetched, and §12.3 denormalizes
 * `SKILL.attainedLevel` precisely so that it can. Every field of
 * `DomainSkillRow` comes from a manifest entry or a `SKILL` row; the App Shell
 * assembles that join in its derived layer (T26/F4). A `domainScores` that
 * reached for a compiled bundle would defeat N4's incremental loading for
 * exactly the view that must be fastest. The bundle type is therefore named
 * nowhere in this file, and `domain.test.ts` greps for it to keep that true.
 *
 * Score, breadth, and recency are three reductions over the same row set, so
 * they are one pass. The result is **total over the taxonomy**: every domain
 * gets an entry, so the Map Renderer never handles `undefined`.
 *
 * `fill` is a rendering function, not a progress bar. It is not claiming a
 * domain is 70% complete — domains have no denominator and F34 forbids ever
 * showing the number. Only the ordering across a user's own eight regions
 * carries information.
 */

import type { DomainId, DomainScore, DomainSkillRow, Taxonomy } from '$lib/types';
import { K, contribution } from './table.js';

/**
 * §11.7's recency rollup is a `max` performed as a **lexicographic string
 * comparison**, which §12.2 says is correct "only if the format and precision
 * never vary." Both halves of that fail silently, so both are asserted here
 * rather than trusted:
 *
 * - **Zone.** `2026-03-12T09:00:00+02:00` sorts *after* `2026-03-12T10:00:00Z`
 *   while being the earlier instant.
 * - **Precision.** `Z` (0x5A) sorts above `.` (0x2E), so `…T09:00:00Z` beats
 *   `…T09:00:00.500Z` — the later stamp loses. The store only ever writes
 *   `toISOString()`'s fixed `.sssZ` (§12.2), but an imported file (T16) is not
 *   the store, and this engine is where the wrong answer would be produced.
 */
const UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertUtc(row: DomainSkillRow): void {
  if (!UTC_MILLIS.test(row.lastActivityAt)) {
    throw new Error(
      `§12.2: lastActivityAt must be ISO-8601 UTC at millisecond precision ` +
        `(YYYY-MM-DDTHH:MM:SS.sssZ); tree "${row.treeId}" carries "${row.lastActivityAt}"`,
    );
  }
}

export function domainScores(
  taxonomy: Taxonomy,
  skills: ReadonlyArray<DomainSkillRow>,
): Map<DomainId, DomainScore> {
  // Mutable accumulators, one per declared domain. A row naming a domain the
  // taxonomy does not declare joins nothing and is summed nowhere — the same
  // way a `SKILL` row with no manifest entry never becomes a row at all
  // (T26/F22). There is no fallback domain.
  const accumulators = new Map<
    DomainId,
    { score: number; breadth: number; lastActivityAt: string | null }
  >();
  for (const domain of taxonomy.domains) {
    accumulators.set(domain.id, { score: 0, breadth: 0, lastActivityAt: null });
  }

  for (const row of skills) {
    const accumulator = accumulators.get(row.domain);
    if (accumulator === undefined) continue;
    assertUtc(row);

    // A level-0 skill contributes 0 to the score and 1 to breadth: the channels
    // are independent, which is what stops an empty-looking region from sitting
    // beside a skills-started count of four (§11.7, F35).
    accumulator.score += contribution(row.attainedLevel);
    accumulator.breadth += 1;
    if (accumulator.lastActivityAt === null || row.lastActivityAt > accumulator.lastActivityAt) {
      accumulator.lastActivityAt = row.lastActivityAt;
    }
  }

  const scores = new Map<DomainId, DomainScore>();
  for (const [domain, { score, breadth, lastActivityAt }] of accumulators) {
    scores.set(domain, {
      domain,
      score,
      // s / (s + K) ∈ [0, 1) — asymptotic, so it never saturates (F34).
      fill: score / (score + K),
      breadth,
      lastActivityAt,
    });
  }
  return scores;
}
