/**
 * §5.10's version chain for the export file, and the ingest normalization that
 * runs after it (§12.6) — T16.
 *
 * **Migrate rather than reject.** §14.6 makes this the only contract whose
 * consumer the project can never update, so a file written by a version of the
 * app that no longer exists is still a file someone is holding. Older versions
 * are walked forward through the chain; only a *newer* one is refused, and that
 * refusal lives in `validate-export.ts` where it happens before anything reads
 * the body.
 *
 * The chain is **empty of version steps today**, because `schemaVersion` has
 * only ever been 1. It is here rather than deferred so that the next bump has a
 * shape to land in and a test that already checks the window is covered — a
 * migration path invented at the moment it is first needed is a migration path
 * written under pressure, against files that already exist.
 *
 * What is *not* empty is the normalization below, which is where §5.10's "one
 * prior" actually bites today: T26/F19 made `lastActivityAt` required and
 * T26/F15 made `MILESTONE.contentVersion` required, both after files had been
 * written without them. Filling them in is the migration those two findings
 * describe, and it is why the validator tolerates their absence exactly once.
 */

import type { ExportFile } from '$lib/types';
import { CURRENT_EXPORT_SCHEMA_VERSION, UTC_MILLIS } from './export-types.js';

type Row = Record<string, unknown>;

export interface MigrationStep {
  readonly from: number;
  readonly to: number;
  apply(file: ExportFile): ExportFile;
}

/** One entry per `schemaVersion` bump, oldest first. See §16.2's checklist. */
export const EXPORT_MIGRATIONS: readonly MigrationStep[] = [];

/**
 * §12.2's timestamp form, applied to every timestamp entering the store.
 *
 * `lib/scoring/domain.ts` throws on anything else, because §11.7's recency
 * rollup is a lexicographic `max` and a second-precision or offset-bearing
 * stamp sorts wrongly with no error anywhere. Normalizing here rather than
 * propagating that throw is deliberate: the instant is perfectly readable, and
 * refusing someone's backup over a formatting difference would be refusing
 * their data to protect a string comparison.
 */
export function normalizeInstant(value: string): string {
  if (UTC_MILLIS.test(value)) return value;
  return new Date(value).toISOString();
}

const asRow = (value: unknown): Row => value as Row;

/**
 * Walks `file` from `from` to the current version, then normalizes. Returns a
 * new object; nothing here mutates its argument, so a caller that rejects
 * downstream has not already changed the file it was handed.
 */
export function migrateExportFile(file: ExportFile, from: number): ExportFile {
  let migrated = file;
  let version = from;

  for (const step of EXPORT_MIGRATIONS) {
    if (step.from !== version) continue;
    migrated = step.apply(migrated);
    version = step.to;
  }

  if (version !== CURRENT_EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `no migration path from export schemaVersion ${from} to ` +
        `${CURRENT_EXPORT_SCHEMA_VERSION}; the chain stopped at ${version}`,
    );
  }

  return normalizeExportFile(migrated);
}

/**
 * The backfills T26/F19 and T26/F15 require, plus §12.2's timestamp form.
 *
 * `lastActivityAt` is filled from the newest milestone `at` for that tree, and
 * from `startedAt` when the tree has none. **Never from the clock**: an import
 * is not activity in the skill (T26/F19), and stamping "now" would make every
 * imported skill the most recently touched thing the user owns, which §11.7
 * renders as the brightest region on the map.
 */
export function normalizeExportFile(file: ExportFile): ExportFile {
  const newestByTree = new Map<string, string>();
  for (const milestone of file.milestones) {
    const at = normalizeInstant(milestone.at);
    const seen = newestByTree.get(milestone.treeId);
    if (seen === undefined || at > seen) newestByTree.set(milestone.treeId, at);
  }

  const seenVersionByTree = new Map<string, number>();
  for (const skill of file.skills) seenVersionByTree.set(skill.treeId, skill.contentVersionSeen);

  const skills = file.skills.map((skill) => {
    const row = asRow(skill);
    const startedAt = normalizeInstant(skill.startedAt);
    const declared = row.lastActivityAt;
    const lastActivityAt =
      typeof declared === 'string'
        ? normalizeInstant(declared)
        : (newestByTree.get(skill.treeId) ?? startedAt);

    return {
      ...skill,
      startedAt,
      lastActivityAt,
      grandfathered: skill.grandfathered ?? {},
    };
  });

  const milestones = file.milestones.map((milestone) => {
    const row = asRow(milestone);
    const declared = row.contentVersion;
    return {
      // Spread first: an unrecognised key — `photo` in phase 2 (§12.8, R-06) —
      // survives the migration it never knew about.
      ...milestone,
      at: normalizeInstant(milestone.at),
      contentVersion:
        typeof declared === 'number' ? declared : (seenVersionByTree.get(milestone.treeId) ?? 1),
    };
  });

  const orphans = file.orphans.map((orphan) => ({ ...orphan, at: normalizeInstant(orphan.at) }));

  return {
    ...file,
    schemaVersion: CURRENT_EXPORT_SCHEMA_VERSION,
    exportedAt: normalizeInstant(file.exportedAt),
    generated: normalizeInstant(file.generated),
    skills,
    milestones,
    orphans,
  };
}
