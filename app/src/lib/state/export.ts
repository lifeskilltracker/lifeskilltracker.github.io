/**
 * §12.6's export file, assembled (T16).
 *
 * The assembly is a pure function over the four stores' contents so that the
 * ordering guarantee below is testable without a database. The store performs
 * the reads and the `lastExportAt` write; this decides what the file says.
 *
 * **The file carries redundant human-readable fields on purpose** (§14.6). It
 * has two readers with different needs: the application matches on `uid`, and a
 * person reading it in ten years reads `title` and `note`. N7's "survives the
 * project itself" is only satisfied if the second reader gets what they need
 * without the codebase, which is what the `slug`/`title` snapshot buys.
 *
 * **Order is stable — `treeId` then `uid`** — so two exports of the same
 * progress diff cleanly. Someone keeping backups in version control is exactly
 * the user N7 describes, and an unstable order would make every export a full
 * rewrite.
 *
 * **There is no top-level `contentVersion`** (T26/F8): §7.2 has no library-wide
 * counter. `generated` is copied from the manifest the export was taken against
 * — archaeology for a human reader, never read by the import path.
 */

import type { ExportFile } from '$lib/types';
import { CURRENT_EXPORT_SCHEMA_VERSION, EXPORT_FORMAT } from './export-types.js';
import type { MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';

export interface ExportSources {
  readonly skills: readonly SkillRecord[];
  readonly milestones: readonly MilestoneRecord[];
  readonly orphans: readonly OrphanRecord[];
  /** §16.1's app semver. Human-facing; never branched on. */
  readonly appVersion: string;
  /** The manifest's `generated` (§7.2), or the epoch when none was ever read. */
  readonly generated: string;
  readonly exportedAt: string;
}

const byTreeThenUid = <T extends { treeId: string; uid: string }>(a: T, b: T): number =>
  a.treeId === b.treeId ? a.uid.localeCompare(b.uid) : a.treeId.localeCompare(b.treeId);

export function buildExportFile(sources: ExportSources): ExportFile {
  return {
    format: EXPORT_FORMAT,
    schemaVersion: CURRENT_EXPORT_SCHEMA_VERSION,
    exportedAt: sources.exportedAt,
    appVersion: sources.appVersion,
    generated: sources.generated,
    skills: [...sources.skills]
      .sort((a, b) => a.treeId.localeCompare(b.treeId))
      .map((skill) => ({
        treeId: skill.treeId,
        startedAt: skill.startedAt,
        attainedLevel: skill.attainedLevel,
        lastActivityAt: skill.lastActivityAt,
        contentVersionSeen: skill.contentVersionSeen,
        // Keys are numbers in the record and strings in JSON; `grandfathered` is
        // read back by level number, so the round trip goes through `Number()`
        // in `import.ts` rather than being assumed here.
        grandfathered: { ...skill.grandfathered },
      })),
    milestones: [...sources.milestones].sort(byTreeThenUid).map((milestone) => ({
      // Spread first so an unrecognised key stored by a future version — the
      // `photo` reservation of §12.8 (R-06) — round-trips instead of being
      // silently dropped by an export written before it existed.
      ...milestone,
      uid: milestone.uid,
      treeId: milestone.treeId,
      slug: milestone.slug,
      title: milestone.title,
      state: milestone.state,
      at: milestone.at,
      ...(milestone.note === undefined ? {} : { note: milestone.note }),
      contentVersion: milestone.contentVersion,
    })),
    orphans: [...sources.orphans].sort(byTreeThenUid).map((orphan) => ({
      uid: orphan.uid,
      treeId: orphan.treeId,
      title: orphan.title,
      state: orphan.state,
      at: orphan.at,
      ...(orphan.note === undefined ? {} : { note: orphan.note }),
      reason: orphan.reason,
    })),
  };
}

/** A stable, obviously-an-export filename. Dated, so backups sort. */
export function exportFileName(exportedAt: string): string {
  return `life-skill-tracker-${exportedAt.slice(0, 10)}.json`;
}

/**
 * Two spaces, and a trailing newline. The file is meant to be read by a human
 * in a text editor years from now (N7) and to diff cleanly in version control;
 * minifying it would save bytes that nothing is short of.
 */
export function serializeExportFile(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
