/**
 * §12.7's prompting sequence, and §16.3's quota row (T18).
 *
 * `lib/state/export-prompt.ts` decides; this is the layer that gathers what the
 * decision needs and persists what the user does about it, so these tests run
 * against a **real store over `fake-indexeddb`**. The two things worth proving
 * here cannot be proven against the pure function alone:
 *
 * - an export (T16, §12.6) ends the prompt condition immediately, because it is
 *   `lastExportAt` in `META` that both halves read;
 * - a dismissal is not quietly recorded as an export, which would be the app
 *   telling itself a backup exists that does not.
 *
 * And §16.3's row, which is the reason this file touches the write path at all:
 * an IndexedDB write that fails on quota must surface immediately, must not
 * update the UI as though it succeeded, and must prompt an export.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTree } from '$lib/layout/fixtures.js';
import { openDatabase, STORES, type Database } from '$lib/state/db.js';
import { durability } from '$lib/state/durability.js';
import { exportPrompt } from '$lib/state/export-prompt.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { createUserStateStore } from '$lib/state/store.js';
import type { MilestoneRecord, SkillRecord } from '$lib/state/types.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { CompiledTree } from '$lib/types';
import {
  dismissExportPrompt,
  refreshExportPrompt,
  reportWriteFailure,
} from './export-prompt.js';

const NOW = '2026-08-15T12:00:00.000Z';
const daysBefore = (days: number): string =>
  new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();

let databaseCount = 0;
function freshStore(open?: (name?: string) => Promise<Database>) {
  databaseCount += 1;
  progress.reset();
  progress.writable = true;
  return createUserStateStore({
    databaseName: `export-prompt-${databaseCount}`,
    ...(open === undefined ? {} : { open }),
  });
}

function tinyTree(): CompiledTree {
  return makeTree({
    id: 'cooking',
    contentVersion: 4,
    milestones: [
      { id: 'knife-grip', level: 1 },
      { id: 'boil-pasta', level: 1 },
    ],
  });
}

/** Ten `complete` rows — trigger 1's threshold, straight into the mirror. */
function completions(count: number): Record<string, MilestoneRecord> {
  const rows: Record<string, MilestoneRecord> = {};
  for (let index = 0; index < count; index += 1) {
    const uid = `uid${index}`;
    rows[uid] = {
      uid,
      treeId: 'cooking',
      slug: `m${index}`,
      title: `Milestone ${index}`,
      state: 'complete',
      at: daysBefore(3),
      contentVersion: 1,
    };
  }
  return rows;
}

const skill = (lastActivityAt: string): SkillRecord => ({
  treeId: 'cooking',
  startedAt: daysBefore(90),
  attainedLevel: 1,
  lastActivityAt,
  contentVersionSeen: 1,
  grandfathered: {},
});

beforeEach(() => {
  exportPrompt.reset();
  ui.reset();
  durability.reset();
});

describe('refreshing the prompt at session start (§12.7)', () => {
  it('raises the never-exported prompt and shows it', async () => {
    const store = freshStore();
    await store.hydrate();
    progress.milestones = completions(10);

    const trigger = await refreshExportPrompt({ store, now: NOW });

    expect(trigger).toBe('never-exported');
    expect(exportPrompt.reason).toBe('never-exported');
    expect(exportPrompt.visible).toBe(true);
  });

  it('stays silent for a user with nine completions', async () => {
    const store = freshStore();
    await store.hydrate();
    progress.milestones = completions(9);

    expect(await refreshExportPrompt({ store, now: NOW })).toBeNull();
    expect(exportPrompt.visible).toBe(false);
  });

  it('counts only completions, not dismissed milestones (§12.7)', async () => {
    const store = freshStore();
    await store.hydrate();
    const rows = completions(10);
    // §12.2's other state. §12.7 says "completions"; a dismissal is the user
    // declining a milestone, which is not work they would lose.
    rows['uid0'] = { ...rows['uid0'], state: 'dismissed' };
    progress.milestones = rows;

    expect(await refreshExportPrompt({ store, now: NOW })).toBeNull();
  });

  it('reads the newest lastActivityAt across every skill for trigger 2', async () => {
    const store = freshStore();
    await store.hydrate();
    const database = await openDatabase(`export-prompt-${databaseCount}`);
    await database.put(STORES.meta, { key: 'lastExportAt', value: daysBefore(31) });
    progress.skills = {
      cooking: skill(daysBefore(40)),
      woodwork: { ...skill(daysBefore(2)), treeId: 'woodwork' },
    };

    expect(await refreshExportPrompt({ store, now: NOW })).toBe('stale-export');
  });

  it('polls the storage estimate as part of the session-start refresh', async () => {
    const store = freshStore();
    await store.hydrate();

    await refreshExportPrompt({ store, now: NOW });

    // `durability` degrades to zeroes where there is no `navigator.storage`,
    // which is exactly the node case — the point is that it was read at all.
    expect(durability.lastEstimate).not.toBeNull();
  });
});

describe('dismissal (T26/F15)', () => {
  it('suppresses the prompt for the rest of the session', async () => {
    const store = freshStore();
    await store.hydrate();
    progress.milestones = completions(10);
    await refreshExportPrompt({ store, now: NOW });

    await dismissExportPrompt({ store, now: NOW });

    expect(exportPrompt.visible).toBe(false);
    // And it stays gone when the app asks again, because the record is in
    // `META` rather than in session memory (F15).
    expect(await refreshExportPrompt({ store, now: NOW })).toBeNull();
    expect(exportPrompt.visible).toBe(false);
  });

  it('survives a reload — the record is in META, not in memory', async () => {
    const store = freshStore();
    await store.hydrate();
    progress.milestones = completions(10);
    await refreshExportPrompt({ store, now: NOW });
    await dismissExportPrompt({ store, now: NOW });

    // A new session over the same database, as a reload would be.
    exportPrompt.reset();
    expect(await refreshExportPrompt({ store, now: NOW })).toBeNull();
  });

  it('does not record an export it did not perform', async () => {
    const store = freshStore();
    await store.hydrate();
    progress.milestones = completions(10);
    await refreshExportPrompt({ store, now: NOW });

    await dismissExportPrompt({ store, now: NOW });

    // The whole hazard: a dismissal that wrote `lastExportAt` would silence
    // every later trigger and claim a backup that does not exist.
    expect((await store.storageStatus()).lastExportAt).toBeUndefined();
  });

  it('does nothing when there is no prompt on screen', async () => {
    const store = freshStore();
    await store.hydrate();

    await expect(dismissExportPrompt({ store, now: NOW })).resolves.toBeUndefined();
    expect((await store.storageStatus()).lastExportAt).toBeUndefined();
  });
});

describe('an export ends the condition (§12.6 → §12.7)', () => {
  it('clears the prompt as soon as lastExportAt is written', async () => {
    const store = freshStore();
    await store.hydrate();
    progress.milestones = completions(10);
    expect(await refreshExportPrompt({ store, now: NOW })).toBe('never-exported');

    await store.export();

    expect(await refreshExportPrompt({ store, now: NOW })).toBeNull();
    expect(exportPrompt.visible).toBe(false);
  });
});

/**
 * §16.3: "IndexedDB write fails (quota) — surface immediately, do not update the
 * UI as though it succeeded, prompt export."
 *
 * The failure is injected at the object store rather than stubbed inside the
 * store, so the transaction really aborts and the assertions are about what the
 * write path does with a real rollback.
 */
describe('a quota-failed write (§16.3)', () => {
  /**
   * `idb`'s wrappers are themselves proxies over objects with internal slots, so
   * anything this does not deliberately override has to be handed back **bound to
   * the real target** rather than re-dispatched through the outer proxy.
   */
  function passthrough<T extends object>(target: T, override: (key: string) => unknown) {
    return new Proxy(target, {
      get(actual, property, receiver) {
        if (typeof property === 'string') {
          const replacement = override(property);
          if (replacement !== undefined) return replacement;
        }
        const value = Reflect.get(actual, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(actual) : value;
      },
    });
  }

  const quotaExceeded = () =>
    Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));

  function quotaFailingOpen(name?: string): Promise<Database> {
    return openDatabase(name).then((database) =>
      passthrough(database, (property) => {
        if (property !== 'transaction') return undefined;
        return (...args: unknown[]) => {
          const tx = (database.transaction as (...a: unknown[]) => unknown)(...args) as {
            objectStore: (n: string) => object;
          };
          return passthrough(tx, (txProperty) => {
            if (txProperty !== 'objectStore') return undefined;
            return (storeName: string) => {
              const objectStore = tx.objectStore(storeName);
              if (storeName !== STORES.milestone) return objectStore;
              return passthrough(objectStore, (osProperty) =>
                osProperty === 'put' ? quotaExceeded : undefined,
              );
            };
          });
        };
      }),
    ) as Promise<Database>;
  }

  it('leaves the mirror unchanged, says so, and prompts an export', async () => {
    const store = freshStore(quotaFailingOpen);
    await store.hydrate();
    const tree = tinyTree();
    store.openTree(tree);
    const uid = tree.milestones[0].uid;

    await expect(store.setMilestoneState(uid, 'complete')).rejects.toThrow(/quota/i);

    // Not a silent success: the mirror never learned about the write.
    expect(progress.milestones[uid]).toBeUndefined();
    expect(store.progressFor('cooking').milestones.size).toBe(0);
  });

  it('surfaces the failure and raises the prompt when the caller reports it', async () => {
    reportWriteFailure(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));

    // §16.3's "surface immediately" — a notice the user can actually see.
    expect(ui.notices).toHaveLength(1);
    expect(ui.notices[0].kind).toBe('error');
    expect(ui.notices[0].text.toLowerCase()).toContain('not saved');

    // And §16.3's "prompt export", regardless of the three triggers: none of
    // them is armed here, and the write still failed.
    expect(exportPrompt.reason).toBe('write-failed');
    expect(exportPrompt.visible).toBe(true);
  });

  it('is dismissible without persisting anything', async () => {
    const store = freshStore();
    await store.hydrate();
    reportWriteFailure(new Error('QuotaExceededError'));

    await dismissExportPrompt({ store, now: NOW });

    expect(exportPrompt.visible).toBe(false);
    expect((await store.storageStatus()).lastExportAt).toBeUndefined();
  });
});
