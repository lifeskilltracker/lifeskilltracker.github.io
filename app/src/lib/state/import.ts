/**
 * §12.6's import — validate, migrate, then merge or replace (T16).
 *
 * The whole of the decision-making is the pure `planImport` below. The store
 * opens **one** transaction and applies the plan; nothing here touches
 * IndexedDB. That split is not tidiness — §16.3's recurring rule is that a read
 * failure must never become a write, and the mechanical form of it is that
 * validation, migration and merging all complete before a transaction exists.
 *
 * **Three arrays, three merge rules** (§12.6, T26/F12). They differ because the
 * arrays differ:
 *
 * - **`milestones`** union by `uid`, newest `at` wins, and the *whole record*
 *   travels together: `slug`, `title`, `note` and `contentVersion` are all
 *   provenance of the completion that `at` identifies, so mixing fields across
 *   the two sides would describe a completion that never happened (T26/F15).
 * - **`skills`** merged field by field, because the fields mean different
 *   things — see the table in `mergeSkill`.
 * - **`orphans`** by `reason` specificity, because §12.2 freezes `at` at
 *   completion time, so two devices holding the same orphan carry an identical
 *   value and `at` ties on exactly the conflicts it would have to settle.
 *
 * **A live milestone beats an orphan across the arrays.** Orphaning is
 * re-derivable from an append-only ledger; a discarded live record is not.
 */

import type { ExportFile, ImportReport, OrphanReason } from '$lib/types';
import { ORPHAN_SPECIFICITY, emptyReport } from './export-types.js';
import type { MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';

export interface StoreSnapshot {
  readonly skills: readonly SkillRecord[];
  readonly milestones: readonly MilestoneRecord[];
  readonly orphans: readonly OrphanRecord[];
}

/** What the store applies, inside one transaction. */
export interface ImportPlan {
  readonly skills: readonly SkillRecord[];
  readonly milestones: readonly MilestoneRecord[];
  readonly orphans: readonly OrphanRecord[];
  readonly deleteSkills: readonly string[];
  readonly deleteMilestones: readonly string[];
  readonly deleteOrphans: readonly string[];
  readonly report: ImportReport;
}

export interface PlanOptions {
  readonly mode: 'merge' | 'replace';
  readonly schemaVersionIn: number;
  /**
   * Tree ids the current library offers, recorded from the manifest at cold
   * start. `null` when no manifest has been read on this device, in which case
   * the count is reported as zero rather than as "everything is missing"
   * (T26/F22). Rows are **retained either way** — never deleted.
   */
  readonly knownTreeIds: ReadonlySet<string> | null;
}

const byUid = <T extends { uid: string }>(rows: readonly T[]): Map<string, T> =>
  new Map(rows.map((row) => [row.uid, row]));

function toMilestoneRecord(row: ExportFile['milestones'][number]): MilestoneRecord {
  // Spread first: §12.8's reserved `photo` key (R-06) is stored and re-exported
  // rather than dropped by the version that did not recognise it.
  return { ...row } as unknown as MilestoneRecord;
}

function toOrphanRecord(row: ExportFile['orphans'][number]): OrphanRecord {
  return {
    uid: row.uid,
    treeId: row.treeId,
    title: row.title,
    state: row.state,
    at: row.at,
    ...(row.note === undefined ? {} : { note: row.note }),
    reason: row.reason,
  };
}

function toSkillRecord(row: ExportFile['skills'][number]): SkillRecord {
  return {
    treeId: row.treeId,
    startedAt: row.startedAt,
    attainedLevel: row.attainedLevel,
    lastActivityAt: row.lastActivityAt,
    contentVersionSeen: row.contentVersionSeen,
    grandfathered: Object.fromEntries(
      Object.entries(row.grandfathered ?? {}).map(([level, frozen]) => [Number(level), frozen]),
    ),
  };
}

interface SkillMerge {
  readonly record: SkillRecord;
  readonly rewound: boolean;
  readonly grandfatheredReplaced: number;
}

/**
 * §12.6's per-field table, verbatim (T26/F12):
 *
 * | Field | Rule | Why |
 * |---|---|---|
 * | `startedAt` | earliest wins | When you started is a historical fact. |
 * | `lastActivityAt` | latest wins; present beats absent | §11.7's `max` rollup and §14.4's exemption-free monotonicity. |
 * | `contentVersionSeen` | **minimum** wins | Forces §12.5's replay. |
 * | `grandfathered` | per level, earliest `contentVersion` wins | D-19's first freeze is the protective one. |
 * | `attainedLevel` | never merged — from the side with the later `lastActivityAt` | Derived; a maximum would be a ratchet §11.10 forbids. |
 *
 * The `contentVersionSeen` minimum is load-bearing rather than conservative.
 * Without it a merge from a device two releases behind delivers pre-migration
 * records into a store whose counter is already current, and §12.5's `>` guard
 * means the pass **never runs again**: a milestone retired two releases ago
 * arrives live, scores nothing, and never surfaces as an orphan explaining
 * itself. Minimum-wins rewinds the skill so T17's pass replays on next open.
 *
 * `attainedLevel` from the later-activity side, never a maximum: a maximum is a
 * ratchet §11.10 forbids, and is concretely wrong when one device dismissed what
 * the other completed. It is a denormalization either way (§12.3) and
 * self-corrects the first time the tree is opened (R-17).
 */
function mergeSkill(stored: SkillRecord, incoming: SkillRecord): SkillMerge {
  const startedAt = incoming.startedAt < stored.startedAt ? incoming.startedAt : stored.startedAt;
  const incomingIsLater = incoming.lastActivityAt > stored.lastActivityAt;
  const lastActivityAt = incomingIsLater ? incoming.lastActivityAt : stored.lastActivityAt;
  const contentVersionSeen = Math.min(stored.contentVersionSeen, incoming.contentVersionSeen);

  const grandfathered: SkillRecord['grandfathered'] = { ...stored.grandfathered };
  let grandfatheredReplaced = 0;
  for (const [key, frozen] of Object.entries(incoming.grandfathered)) {
    const level = Number(key);
    const held = grandfathered[level];
    if (held === undefined) {
      grandfathered[level] = frozen;
      continue;
    }
    if (frozen.contentVersion < held.contentVersion) {
      // T26/F20: this can reintroduce a uid whose record a `split` consumed, and
      // that is tolerated rather than fixed — the level un-satisfies until the
      // next open of the tree folds the split over the set again. Do not "fix"
      // it by unioning uids (which defeats earliest-wins) or by pruning uids
      // with no record (which cannot tell a consumed predecessor from a
      // milestone the user un-checked).
      grandfathered[level] = frozen;
      grandfatheredReplaced += 1;
    }
  }

  return {
    record: {
      treeId: stored.treeId,
      startedAt,
      attainedLevel: incomingIsLater ? incoming.attainedLevel : stored.attainedLevel,
      lastActivityAt,
      contentVersionSeen,
      grandfathered,
    },
    rewound: contentVersionSeen < stored.contentVersionSeen,
    grandfatheredReplaced,
  };
}

const specificity = (reason: OrphanReason): number => ORPHAN_SPECIFICITY[reason] ?? 0;

/** More specific wins; `at` breaks ties among equally specific reasons. */
function mergeOrphan(stored: OrphanRecord, incoming: OrphanRecord): OrphanRecord {
  const difference = specificity(incoming.reason) - specificity(stored.reason);
  if (difference > 0) return incoming;
  if (difference < 0) return stored;
  return incoming.at > stored.at ? incoming : stored;
}

export function planImport(
  file: ExportFile,
  current: StoreSnapshot,
  options: PlanOptions,
): ImportPlan {
  const report = { ...emptyReport(options.mode, options.schemaVersionIn) };
  const counts = {
    skills: { added: 0, updated: 0 },
    milestones: { added: 0, updated: 0 },
    orphans: { added: 0, updated: 0, droppedForLiveRecord: 0 },
    grandfatheredLevelsReplaced: 0,
    treesRewound: 0,
    skillsWithNoManifestEntry: 0,
  };

  const incomingMilestones = file.milestones.map(toMilestoneRecord);
  const incomingOrphans = file.orphans.map(toOrphanRecord);
  const incomingSkills = file.skills.map(toSkillRecord);

  for (const skill of incomingSkills) {
    if (options.knownTreeIds !== null && !options.knownTreeIds.has(skill.treeId)) {
      counts.skillsWithNoManifestEntry += 1;
    }
  }

  if (options.mode === 'replace') {
    // Restoring a known-good backup: the file is the truth, whole. The
    // confirmation this needs is the `/data` page's, not this function's.
    const keptMilestones = byUid(incomingMilestones);
    const keptOrphans = new Map(
      incomingOrphans.filter((orphan) => !keptMilestones.has(orphan.uid)).map((o) => [o.uid, o]),
    );
    counts.orphans.droppedForLiveRecord = incomingOrphans.length - keptOrphans.size;
    counts.skills.added = incomingSkills.length;
    counts.milestones.added = keptMilestones.size;
    counts.orphans.added = keptOrphans.size;

    return {
      skills: incomingSkills,
      milestones: [...keptMilestones.values()],
      orphans: [...keptOrphans.values()],
      deleteSkills: current.skills
        .map((s) => s.treeId)
        .filter((treeId) => !incomingSkills.some((s) => s.treeId === treeId)),
      deleteMilestones: current.milestones
        .map((m) => m.uid)
        .filter((uid) => !keptMilestones.has(uid)),
      deleteOrphans: current.orphans.map((o) => o.uid).filter((uid) => !keptOrphans.has(uid)),
      report: { ...report, ...counts },
    };
  }

  const storedMilestones = byUid(current.milestones);
  const storedOrphans = byUid(current.orphans);
  const storedSkills = new Map(current.skills.map((skill) => [skill.treeId, skill]));

  const milestones: MilestoneRecord[] = [];
  const deleteOrphans: string[] = [];

  for (const incoming of incomingMilestones) {
    const stored = storedMilestones.get(incoming.uid);
    if (stored === undefined) {
      milestones.push(incoming);
      counts.milestones.added += 1;
    } else if (incoming.at > stored.at) {
      milestones.push(incoming);
      counts.milestones.updated += 1;
    }

    // The uid is live on the incoming side; a stored orphan for it loses.
    if (storedOrphans.has(incoming.uid)) {
      deleteOrphans.push(incoming.uid);
      storedOrphans.delete(incoming.uid);
      counts.orphans.droppedForLiveRecord += 1;
    }
  }

  const orphans: OrphanRecord[] = [];
  for (const incoming of incomingOrphans) {
    // The uid is live on the stored side, and stays that way.
    if (storedMilestones.has(incoming.uid)) {
      counts.orphans.droppedForLiveRecord += 1;
      continue;
    }
    const stored = storedOrphans.get(incoming.uid);
    if (stored === undefined) {
      orphans.push(incoming);
      counts.orphans.added += 1;
      continue;
    }
    const winner = mergeOrphan(stored, incoming);
    if (winner !== stored) {
      orphans.push(winner);
      counts.orphans.updated += 1;
    }
  }

  const skills: SkillRecord[] = [];
  for (const incoming of incomingSkills) {
    const stored = storedSkills.get(incoming.treeId);
    if (stored === undefined) {
      skills.push(incoming);
      counts.skills.added += 1;
      continue;
    }
    const merged = mergeSkill(stored, incoming);
    skills.push(merged.record);
    counts.skills.updated += 1;
    if (merged.rewound) counts.treesRewound += 1;
    counts.grandfatheredLevelsReplaced += merged.grandfatheredReplaced;
  }

  return {
    skills,
    milestones,
    orphans,
    // A merge removes nothing but an orphan a live record superseded (§12.6).
    deleteSkills: [],
    deleteMilestones: [],
    deleteOrphans,
    report: { ...report, ...counts },
  };
}
