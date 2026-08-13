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
  MigrationReport,
  MilestoneState,
  MovedIndex,
  TreeProgress,
} from '$lib/types';
import { BY_TREE, STORES, openDatabase, type Database } from './db.js';
import { evaluateAttainedLevel as defaultEvaluator } from './default-evaluator.js';
import type { AttainedLevelEvaluator } from './default-evaluator.js';
import { refreshProgressMirror } from './mirror.js';
import { progress } from './progress.svelte.js';
import { LAST_EXPORT_AT_KEY, type MilestoneRecord, type SkillRecord } from './types.js';

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
  export(): Promise<ExportFile>;
  import(file: ExportFile, mode: 'merge' | 'replace'): Promise<ImportReport>;
  storageStatus(): Promise<{ usage: number; quota: number; lastExportAt?: string }>;
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

      await refreshProgressMirror(handle);
      return true;
    },

    async storageStatus(): Promise<{ usage: number; quota: number; lastExportAt?: string }> {
      const handle = await database();
      const meta = await handle.get(STORES.meta, LAST_EXPORT_AT_KEY);

      const estimate = await globalThis.navigator?.storage?.estimate?.();
      const lastExportAt = typeof meta?.value === 'string' ? meta.value : undefined;

      return {
        usage: estimate?.usage ?? 0,
        quota: estimate?.quota ?? 0,
        ...(lastExportAt === undefined ? {} : { lastExportAt }),
      };
    },

    applyLineage(): Promise<MigrationReport> {
      return Promise.reject(new NotImplementedHereError('applyLineage', 'T17 (§12.5)'));
    },

    applyMoves(): Promise<readonly MigrationReport[]> {
      return Promise.reject(new NotImplementedHereError('applyMoves', 'T17 (§12.5)'));
    },

    export(): Promise<ExportFile> {
      return Promise.reject(new NotImplementedHereError('export', 'T16 (§12.6)'));
    },

    import(): Promise<ImportReport> {
      return Promise.reject(new NotImplementedHereError('import', 'T16 (§12.6)'));
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
