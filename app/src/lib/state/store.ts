/**
 * The User State Store (§14.5) — the only code in the system that writes user
 * data (§3.2).
 *
 * §12 holds the only irreplaceable data here. Content can always be re-fetched;
 * a user's progress exists in exactly one place, with no account to recover it
 * from and no telemetry to notice it went missing (§16.5, R-15). Every decision
 * below is weighted by that, and correctness has to be structural rather than
 * observed.
 */

import type {
  CompiledTree,
  ExportFile,
  ImportReport,
  MilestoneState,
  MovedIndex,
  TreeProgress,
} from '$lib/types';
import { APP_VERSION } from '$lib/version.js';
import { BY_TREE, STORES, openDatabase, type Database } from './db.js';
import { evaluateAttainedLevel as defaultEvaluator } from './default-evaluator.js';
import type { AttainedLevelEvaluator } from './default-evaluator.js';
import { durability } from './durability.js';
import { buildExportFile } from './export.js';
import {
  EXPORT_PROMPT_DISMISSALS_KEY,
  readDismissals,
  type Dismissals,
} from './export-prompt.js';
import { planImport } from './import.js';
import { applyLineage } from './lineage.js';
import type { MigrationReport } from './lineage-types.js';
import { applyMoves } from './moves.js';
import { migrateExportFile } from './migrate-export.js';
import { refreshProgressMirror } from './mirror.js';
import { progress } from './progress.svelte.js';
import {
  LAST_EXPORT_AT_KEY,
  MANIFEST_KEY,
  UNKNOWN_GENERATED,
  type ManifestMeta,
  type MilestoneRecord,
  type OrphanRecord,
  type SkillRecord,
} from './types.js';
import { readSchemaVersion, validateExportFile } from './validate-export.js';

export interface UserStateStore {
  hydrate(): Promise<void>;
  progressFor(treeId: string): TreeProgress; // §11.1's input — synchronous, total
  setMilestoneState(uid: string, state: MilestoneState, opts?: { note?: string }): Promise<void>;
  startSkill(treeId: string, contentVersion: number): Promise<void>;
  reconcileAttainedLevel(treeId: string, attainedLevel: number): Promise<boolean>;
  applyLineage(
    tree: CompiledTree,
    evaluateAttainedLevel: (progress: TreeProgress) => number,
  ): Promise<MigrationReport>;
  applyMoves(moved: MovedIndex): Promise<readonly MigrationReport[]>;
  /** T16: §7.2's build stamp and the library's tree ids, injected by the shell. */
  recordManifest(meta: ManifestMeta): Promise<void>;
  export(): Promise<ExportFile>;
  import(file: ExportFile, mode: 'merge' | 'replace'): Promise<ImportReport>;
  storageStatus(): Promise<{ usage: number; quota: number; lastExportAt?: string }>;
  /** T18: what the user has already waved away, per §12.7 trigger (T26/F15). */
  exportPromptDismissals(): Promise<Dismissals>;
  recordExportPromptDismissal(dismissals: Dismissals): Promise<void>;
  readonly hydrated: boolean;
  readonly writable: boolean;
}

/**
 * Registering the open tree ahead of a write is not decoration.
 *
 * §14.5 fixes `setMilestoneState(uid, state, opts)` — no tree argument — while
 * §12.4 step 2 requires the recompute to run against **the in-memory tree
 * bundle**, and §14.1 forbids this module from fetching one. The bundle
 * therefore has to arrive some other way, and it arrives here. This is the same
 * injection `applyLineage(tree, evaluate)` already uses, moved earlier in time.
 */
export interface OpenTree {
  tree: CompiledTree;
  evaluate?: AttainedLevelEvaluator;
}

export class NotWritableError extends Error {
  constructor() {
    super(
      'user state is not writable: hydration failed this session, so writes are refused (§13.3)',
    );
    this.name = 'NotWritableError';
  }
}

export class TreeNotOpenError extends Error {
  constructor(uid: string) {
    super(`no open tree contains milestone "${uid}"; register it before writing (§12.4 step 2)`);
    this.name = 'TreeNotOpenError';
  }
}

export class NotImplementedHereError extends Error {
  constructor(method: string, owner: string) {
    super(`${method} is declared in §14.5 and implemented by ${owner}`);
    this.name = 'NotImplementedHereError';
  }
}

const nowIso = (): string => new Date().toISOString();

export interface StoreOptions {
  /** Varies only in tests, so each case gets an isolated database. */
  databaseName?: string;
  /**
   * Injected only by tests, to exercise §13.3's hydration-failure branch. A
   * transient IndexedDB error is otherwise unreachable, and it is the branch
   * protecting the only irreplaceable data in the system.
   */
  open?: (name?: string) => Promise<Database>;
}

export function createUserStateStore(options: StoreOptions = {}) {
  let db: Database | null = null;
  let hydrationFailed = false;
  const openTrees = new Map<string, OpenTree>();
  const open = options.open ?? openDatabase;

  async function database(): Promise<Database> {
    if (db === null) db = await open(options.databaseName);
    return db;
  }

  function requireWritable(): void {
    // A private latch set once and never cleared. The dangerous failure is not
    // "cannot read progress" but "read as empty, then wrote" (§13.3).
    if (hydrationFailed || !progress.writable) throw new NotWritableError();
  }

  function treeContaining(uid: string): OpenTree {
    for (const open of openTrees.values()) {
      if (open.tree.milestones.some((m) => m.uid === uid)) return open;
    }
    throw new TreeNotOpenError(uid);
  }

  /**
   * §12.7's "on first successful write, request `navigator.storage.persist()`"
   * (T18). Called after a transaction commits, never before, and never from
   * `hydrate` or `recordManifest` — a session that only read, or only wrote the
   * manifest stamp, has not produced a byte of user data worth protecting, and
   * requesting persistence there would be requesting it on session start.
   *
   * `durability` is idempotent and never rejects, so this is one line at each
   * commit rather than a branch (§12.7: request it, do not depend on it).
   */
  function noteWrite(): Promise<void> {
    return durability.noteSuccessfulWrite();
  }

  /** §12.4 step 2, from the object store rather than the mirror — see below. */
  function projectProgress(
    records: MilestoneRecord[],
    skill: SkillRecord | undefined,
  ): TreeProgress {
    const milestones = new Map<string, MilestoneState>();
    for (const record of records) milestones.set(record.uid, record.state);
    const grandfathered = new Map(
      Object.entries(skill?.grandfathered ?? {}).map(([level, frozen]) => [Number(level), frozen]),
    );
    return { milestones, grandfathered };
  }

  const store = {
    get hydrated(): boolean {
      return progress.hydrated;
    },

    get writable(): boolean {
      return progress.writable;
    },

    /**
     * Registers a loaded bundle so the write path can recompute against it.
     * Called by the shell when a tree opens; `lib/state` never fetches (§14.1).
     */
    openTree(tree: CompiledTree, evaluate?: AttainedLevelEvaluator): void {
      openTrees.set(tree.id, { tree, evaluate });
    },

    closeTree(treeId: string): void {
      openTrees.delete(treeId);
    },

    async hydrate(): Promise<void> {
      try {
        const handle = await database();
        await refreshProgressMirror(handle);
        progress.hydrated = true;
      } catch (error) {
        // Latched for the session. An implementer who treats a hydration
        // failure as "start fresh" has built the exact data-loss bug the
        // architecture is shaped to prevent (§13.3).
        hydrationFailed = true;
        progress.writable = false;
        progress.hydrated = false;
        throw error;
      }
    },

    /**
     * Synchronous, total, and off the mirror (T26/F23) — which is what lets it
     * sit inside the `$derived` layer the renderer uses. An unstarted tree
     * returns empty maps, never `undefined` and never a throw.
     */
    progressFor(treeId: string): TreeProgress {
      const milestones = new Map<string, MilestoneState>();
      for (const record of Object.values(progress.milestones)) {
        if (record.treeId === treeId) milestones.set(record.uid, record.state);
      }
      const skill = progress.skills[treeId];
      const grandfathered = new Map(
        Object.entries(skill?.grandfathered ?? {}).map(([level, frozen]) => [
          Number(level),
          frozen,
        ]),
      );
      return { milestones, grandfathered };
    },

    async setMilestoneState(
      uid: string,
      state: MilestoneState,
      opts?: { note?: string },
    ): Promise<void> {
      requireWritable();
      const open = treeContaining(uid);
      const milestone = open.tree.milestones.find((m) => m.uid === uid)!;
      const treeId = open.tree.id;
      const evaluate = open.evaluate ?? defaultEvaluator;

      const handle = await database();
      const tx = handle.transaction([STORES.milestone, STORES.skill], 'readwrite');

      try {
        const milestones = tx.objectStore(STORES.milestone);
        const skills = tx.objectStore(STORES.skill);

        // Step 1 — write or delete the MILESTONE record.
        if (state === null) {
          // Incomplete is the absence of a record (§12.2), never a null state.
          await milestones.delete(uid);
        } else {
          const existing = await milestones.get(uid);
          await milestones.put({
            uid,
            treeId,
            // Frozen at completion time and never refreshed (§12.2). An
            // existing record keeps its original snapshot and timestamp.
            slug: existing?.slug ?? milestone.id,
            title: existing?.title ?? milestone.title,
            state,
            at: existing?.at ?? nowIso(),
            ...(opts?.note === undefined ? {} : { note: opts.note }),
            contentVersion: existing?.contentVersion ?? open.tree.contentVersion,
          });
        }

        // Step 2 — recompute from this tree's records read back through the
        // by-tree index INSIDE this transaction. The mirror does not yet
        // contain step 1's write (it refreshes on commit), so a recompute
        // against it would be one milestone behind on every mutation.
        const records = await milestones.index(BY_TREE).getAll(treeId);
        const skill = await skills.get(treeId);
        const evaluation = evaluate(open.tree, projectProgress(records, skill));

        // Step 3 — the denormalized level and the watermark, same transaction.
        const startedAt = skill?.startedAt ?? nowIso();
        const grandfathered = { ...(skill?.grandfathered ?? {}) };
        for (const [level, uids] of evaluation.satisfiedBy) {
          // Never overwrite an existing record: the first freeze is the
          // protective one (D-19, §11.5).
          if (grandfathered[level] === undefined) {
            grandfathered[level] = { uids: [...uids], contentVersion: open.tree.contentVersion };
          }
        }

        await skills.put({
          treeId,
          startedAt,
          attainedLevel: evaluation.attainedLevel,
          // Every mutation, un-completing included: a correction is still the
          // user engaging with the skill (§12.2, T26/F19).
          lastActivityAt: nowIso(),
          contentVersionSeen: skill?.contentVersionSeen ?? open.tree.contentVersion,
          grandfathered,
        });

        await tx.done;
      } catch (error) {
        // One transaction, so a crash between the steps cannot leave the
        // denormalized level disagreeing with the records it summarizes.
        // `tx.done` rejects with an AbortError once the abort lands; claim it
        // here so the rollback does not surface as an unhandled rejection.
        tx.done.catch(() => undefined);
        try {
          tx.abort();
        } catch {
          /* already settled */
        }
        throw error;
      }

      await noteWrite();
      await refreshProgressMirror(handle);
    },

    async startSkill(treeId: string, contentVersion: number): Promise<void> {
      requireWritable();
      const handle = await database();
      const tx = handle.transaction(STORES.skill, 'readwrite');
      const skills = tx.objectStore(STORES.skill);

      const existing = await skills.get(treeId);
      if (existing === undefined) {
        const startedAt = nowIso();
        await skills.put({
          treeId,
          startedAt,
          attainedLevel: 0,
          // Starting a skill *is* activity in the domain; rendering it as
          // "No activity yet" would be false (§12.2).
          lastActivityAt: startedAt,
          contentVersionSeen: contentVersion,
          grandfathered: {},
        });
      }
      await tx.done;

      await noteWrite();
      await refreshProgressMirror(handle);
    },

    /**
     * §12.3's write-back, called by the tree route after `scoreSkill` on every
     * open (T26/F26). Writes only if the value differs, touches no other field.
     */
    async reconcileAttainedLevel(treeId: string, attainedLevel: number): Promise<boolean> {
      requireWritable();
      const handle = await database();
      const tx = handle.transaction(STORES.skill, 'readwrite');
      const skills = tx.objectStore(STORES.skill);

      const skill = await skills.get(treeId);
      if (skill === undefined || skill.attainedLevel === attainedLevel) {
        await tx.done;
        return false;
      }

      // Not `lastActivityAt`: a content release is not user activity (§12.2).
      await skills.put({ ...skill, attainedLevel });
      await tx.done;

      await noteWrite();
      await refreshProgressMirror(handle);
      return true;
    },

    async storageStatus(): Promise<{ usage: number; quota: number; lastExportAt?: string }> {
      const handle = await database();
      const meta = await handle.get(STORES.meta, LAST_EXPORT_AT_KEY);

      // T18 moved the Storage API call into `./durability.js` so the estimate
      // this reports and the one §12.7's trigger 3 compares against are the same
      // reading, and so the degrade-to-zeroes rule is written once.
      const estimate = await durability.pollEstimate();
      const lastExportAt = typeof meta?.value === 'string' ? meta.value : undefined;

      return {
        usage: estimate.usage,
        quota: estimate.quota,
        ...(lastExportAt === undefined ? {} : { lastExportAt }),
      };
    },

    /**
     * §12.7's dismissal record (T26/F15). In `META` rather than in session
     * memory: a session-scoped dismissal re-prompts on every reload, which is
     * the nagging §12.7's `lastExportAt` sentence exists to prevent.
     */
    async exportPromptDismissals(): Promise<Dismissals> {
      const handle = await database();
      const record = await handle.get(STORES.meta, EXPORT_PROMPT_DISMISSALS_KEY);
      return readDismissals(record?.value);
    },

    /**
     * Best-effort, and **not** guarded by `requireWritable()`. A read-only
     * session (§13.3) is exactly the session most in need of an export, so a
     * failure to remember the dismissal must not stop the user dismissing it;
     * the prompt is cleared from screen either way and returns next session.
     */
    async recordExportPromptDismissal(dismissals: Dismissals): Promise<void> {
      if (!progress.writable || hydrationFailed) return;
      const handle = await database();
      await handle.put(STORES.meta, {
        key: EXPORT_PROMPT_DISMISSALS_KEY,
        value: dismissals,
      });
    },

    /**
     * §12.5's migration pass, run before the tree renders whenever the bundle's
     * `contentVersion` exceeds this skill's `contentVersionSeen`. The
     * dispositions and the transaction live in `./lineage.js`; what belongs here
     * is the pair of rules every writer in this module shares — §13.3's latch,
     * and refreshing §13.2's mirror on commit.
     *
     * The `evaluateAttainedLevel` callback is how the level is recomputed
     * without `lib/state` importing `lib/scoring` (§14.1). It does **not** call
     * `reconcileAttainedLevel` (T26/F26): `MigrationReport.attainedLevel.after`
     * is the number the summary puts on screen, and a second computation
     * writing a different one would contradict a sentence the user is reading.
     */
    async applyLineage(
      tree: CompiledTree,
      evaluateAttainedLevel: (progress: TreeProgress) => number,
    ): Promise<MigrationReport> {
      requireWritable();
      const handle = await database();
      const report = await applyLineage(handle, tree, evaluateAttainedLevel);
      // T26/F23: without this the first paint after a migration renders
      // pre-migration state, which is the paint §12.5 exists to make correct.
      if (report.changed) {
        await noteWrite();
        await refreshProgressMirror(handle);
      }
      return report;
    },

    /** §12.5's cross-tree pass, run once at cold start from the manifest. */
    async applyMoves(moved: MovedIndex): Promise<readonly MigrationReport[]> {
      requireWritable();
      const handle = await database();
      const reports = await applyMoves(handle, moved);
      if (reports.length > 0) {
        await noteWrite();
        await refreshProgressMirror(handle);
      }
      return reports;
    },

    /**
     * The two manifest facts the export path needs, recorded at cold start by
     * `lib/actions` (§14.1 forbids this module from reading a manifest itself).
     * Best-effort: a failure here must never fail the start, since everything
     * that depends on it is archaeology or a report counter.
     */
    async recordManifest(meta: ManifestMeta): Promise<void> {
      const handle = await database();
      await handle.put(STORES.meta, { key: MANIFEST_KEY, value: meta });
    },

    /**
     * §12.6's export. Reads the three stores in one readonly transaction, so the
     * file cannot describe a state that never existed — a `SKILL` row read
     * before a concurrent write and its `MILESTONE` rows read after it would
     * export an `attainedLevel` disagreeing with the records it summarizes.
     */
    async export(): Promise<ExportFile> {
      const handle = await database();

      const read = handle.transaction(
        [STORES.skill, STORES.milestone, STORES.orphan, STORES.meta],
        'readonly',
      );
      const [skills, milestones, orphans, manifest] = await Promise.all([
        read.objectStore(STORES.skill).getAll(),
        read.objectStore(STORES.milestone).getAll(),
        read.objectStore(STORES.orphan).getAll(),
        read.objectStore(STORES.meta).get(MANIFEST_KEY),
      ]);
      await read.done;

      const generated = (manifest?.value as ManifestMeta | undefined)?.generated;
      const exportedAt = nowIso();
      const file = buildExportFile({
        skills: skills as SkillRecord[],
        milestones: milestones as MilestoneRecord[],
        orphans: orphans as OrphanRecord[],
        appVersion: APP_VERSION,
        generated: generated ?? UNKNOWN_GENERATED,
        exportedAt,
      });

      // §12.7 depends on this: `lastActivityAt > lastExportAt` is the definition
      // of "new activity", and T18 reads it to decide when to prompt. Written
      // after the file is assembled, so a failed assembly cannot claim a backup
      // that does not exist. A read-only session skips it — nothing may write
      // when hydration failed (§13.3) — and still gets its file.
      if (progress.writable && !hydrationFailed) {
        await handle.put(STORES.meta, { key: LAST_EXPORT_AT_KEY, value: exportedAt });
      }

      return file;
    },

    /**
     * §12.6's import. **Validate, migrate, then open the transaction** — in that
     * order, and the order is the whole design. §16.3's recurring rule is that a
     * read failure must never become a write, so every rejection below happens
     * before IndexedDB has been asked for anything.
     */
    async import(file: ExportFile, mode: 'merge' | 'replace'): Promise<ImportReport> {
      // First, before any read: §13.3's latch. A session that could not read the
      // user's progress must not write over it, and "import" is the largest
      // write in the system.
      requireWritable();

      const schemaVersionIn = readSchemaVersion(file);
      validateExportFile(file);
      const migrated = migrateExportFile(file, schemaVersionIn);

      const handle = await database();
      const manifest = await handle.get(STORES.meta, MANIFEST_KEY);
      const treeIds = (manifest?.value as ManifestMeta | undefined)?.treeIds;

      const tx = handle.transaction(
        [STORES.skill, STORES.milestone, STORES.orphan],
        'readwrite',
      );
      let report: ImportReport;

      try {
        const skills = tx.objectStore(STORES.skill);
        const milestones = tx.objectStore(STORES.milestone);
        const orphans = tx.objectStore(STORES.orphan);

        const plan = planImport(
          migrated,
          {
            skills: (await skills.getAll()) as SkillRecord[],
            milestones: (await milestones.getAll()) as MilestoneRecord[],
            orphans: (await orphans.getAll()) as OrphanRecord[],
          },
          {
            mode,
            schemaVersionIn,
            knownTreeIds: treeIds === undefined ? null : new Set(treeIds),
          },
        );

        for (const treeId of plan.deleteSkills) await skills.delete(treeId);
        for (const uid of plan.deleteMilestones) await milestones.delete(uid);
        for (const uid of plan.deleteOrphans) await orphans.delete(uid);
        for (const skill of plan.skills) await skills.put(skill);
        for (const milestone of plan.milestones) await milestones.put(milestone);
        for (const orphan of plan.orphans) await orphans.put(orphan);

        report = plan.report;
        await tx.done;
      } catch (error) {
        // One transaction for the whole file: §12.6 says an unreadable file is
        // rejected whole and never partially applied, and a failure part-way
        // through the writes is the same requirement arriving later.
        tx.done.catch(() => undefined);
        try {
          tx.abort();
        } catch {
          /* already settled */
        }
        throw error;
      }

      // T26/F23: every writer refreshes §13.2's mirror on commit. `import`
      // rewrites MILESTONE rows wholesale, so the alternative is stale progress
      // on the first paint after a restore.
      await noteWrite();
      await refreshProgressMirror(handle);
      return report;
    },

    /** Test seam: drop the handle so a new database name takes effect. */
    async close(): Promise<void> {
      db?.close();
      db = null;
      openTrees.clear();
      hydrationFailed = false;
    },
  };

  return store satisfies UserStateStore;
}

export const store = createUserStateStore();
