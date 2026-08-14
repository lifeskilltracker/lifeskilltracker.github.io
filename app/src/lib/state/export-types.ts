/**
 * The export file's vocabulary (§12.6, §14.5) — T16.
 *
 * `ExportFile` and `ImportReport` are **declared in `$lib/types`** (T26/F3 typed
 * them into §14.5, and `ExportFile` is generated from
 * `schema/export.schema.json` so the type and the schema cannot drift). They are
 * re-exported here because §14.5's task list names this module and because
 * everything else about the format — the supported version window, the row
 * shapes, the merge vocabulary — belongs beside them rather than in the general
 * type barrel. A second declaration would have been a second source of truth for
 * the one contract the project can never update.
 *
 * §14.6: the export file's consumer is **users, forever**. Every oddity of the
 * format follows from that — the redundant `title` snapshot, the migration on
 * read, the refusal to guess at a version from the future.
 */

import type { ExportFile, ImportReport, OrphanReason } from '$lib/types';
import type { MilestoneRow, OrphanRow, SkillRow } from '$lib/types/authored.js';

export type { ExportFile, ImportReport, MilestoneRow, OrphanReason, OrphanRow, SkillRow };

/** §12.6's `format` discriminator. Anything else is not this file. */
export const EXPORT_FORMAT = 'life-xp-skill-tracker/progress';

/**
 * §5.10: the app reads the current version and one prior; older versions are
 * migrated through the chain, and anything newer is refused rather than guessed
 * at. `assert-shape.ts` states the same window for compiled bundles.
 */
export const CURRENT_EXPORT_SCHEMA_VERSION = 1;
export const OLDEST_SUPPORTED_EXPORT_SCHEMA_VERSION = CURRENT_EXPORT_SCHEMA_VERSION - 1;

/**
 * §12.2's timestamp form: ISO-8601 UTC at millisecond precision, invariantly.
 *
 * §11.7 rolls recency up as a lexicographic `max` inside a pure engine, and both
 * halves of that fail silently — `Z` (0x5A) sorts above `.` (0x2E), so a
 * second-precision stamp beats a later millisecond one, and an offset sorts by
 * wall clock rather than by instant. `lib/scoring/domain.ts` throws on anything
 * else, which is why every timestamp entering the store through an import is
 * normalized to this form on the way in rather than left to detonate later.
 */
export const UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * §12.6's orphan precedence: a specific disposition beats `unknown`, and `at`
 * cannot be the discriminator because §12.2 freezes it at completion time — two
 * devices holding the same orphan normally carry an identical value, so it ties
 * on exactly the conflicts it would have to settle.
 */
export const ORPHAN_SPECIFICITY: Record<OrphanReason, number> = {
  retired: 2,
  merged: 2,
  unknown: 1,
};

/** An empty report, so every counter has to be filled in deliberately. */
export function emptyReport(mode: 'merge' | 'replace', schemaVersionIn: number): ImportReport {
  return {
    mode,
    schemaVersionIn,
    migrated: schemaVersionIn !== CURRENT_EXPORT_SCHEMA_VERSION,
    skills: { added: 0, updated: 0 },
    milestones: { added: 0, updated: 0 },
    orphans: { added: 0, updated: 0, droppedForLiveRecord: 0 },
    grandfatheredLevelsReplaced: 0,
    treesRewound: 0,
    skillsWithNoManifestEntry: 0,
  };
}
