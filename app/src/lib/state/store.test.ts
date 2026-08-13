/**
 * §12.4's write path, §13.3's latches, and §12.2's frozen snapshots.
 *
 * These are the tests protecting the only irreplaceable data in the system.
 * Nothing here is mocked except the one thing that cannot be provoked
 * otherwise — a hydration failure — which is injected as a failing database
 * opener rather than by stubbing anything inside the store.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CompiledTree } from '$lib/types';
import { STORES, openDatabase } from './db.js';
import { progress } from './progress.svelte.js';
import { createUserStateStore, NotWritableError } from './store.js';
import { makeTree } from '$lib/layout/fixtures.js';

let databaseCount = 0;
function freshStore() {
  databaseCount += 1;
  progress.reset();
  progress.writable = true;
  return createUserStateStore({ databaseName: `store-test-${databaseCount}` });
}

/** A two-level tree: level 1 has three milestones, level 2 has one. */
function tinyTree(): CompiledTree {
  return makeTree({
    id: 'cooking',
    contentVersion: 4,
    milestones: [
      { id: 'knife-grip', level: 1 },
      { id: 'boil-pasta', level: 1 },
      { id: 'fried-egg', level: 1 },
      { id: 'sear-steak', level: 2 },
    ],
  });
}

const uidOf = (tree: CompiledTree, slug: string) =>
  tree.milestones.find((m) => m.id === slug)!.uid;

describe('§12.4 — the write path is one transaction', () => {
  let store: ReturnType<typeof freshStore>;
  let tree: CompiledTree;

  beforeEach(async () => {
    store = freshStore();
    tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);
  });

  it('writes the milestone row and the denormalized level together', async () => {
    await store.startSkill('cooking', 4);
    const before = progress.skills['cooking'].lastActivityAt;

    // Level 1 needs all three; complete them.
    for (const slug of ['knife-grip', 'boil-pasta', 'fried-egg']) {
      await store.setMilestoneState(uidOf(tree, slug), 'complete');
    }

    const skill = progress.skills['cooking'];
    expect(Object.keys(progress.milestones)).toHaveLength(3);
    expect(skill.attainedLevel).toBe(1);
    expect(skill.lastActivityAt >= before).toBe(true);
  });

  it('leaves no milestone row behind when the recompute fails mid-transaction', async () => {
    store.openTree(tree, () => {
      throw new Error('scoring blew up');
    });

    await expect(store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete')).rejects.toThrow(
      'scoring blew up',
    );

    // Both writes share one transaction, so step 1 rolled back with step 3.
    const db = await openDatabase(`store-test-${databaseCount}`);
    expect(await db.count(STORES.milestone)).toBe(0);
    expect(await db.get(STORES.skill, 'cooking')).toBeUndefined();
    db.close();
  });

  it('deletes the row rather than writing a null state', async () => {
    const uid = uidOf(tree, 'knife-grip');
    await store.setMilestoneState(uid, 'complete');
    expect(progress.milestones[uid]).toBeDefined();

    await store.setMilestoneState(uid, null);

    // Incomplete is the absence of a record (§12.2).
    expect(progress.milestones[uid]).toBeUndefined();
    const db = await openDatabase(`store-test-${databaseCount}`);
    expect(await db.get(STORES.milestone, uid)).toBeUndefined();
    db.close();
  });

  it('recomputes from the object store, so the level accounts for the write just made', async () => {
    // Reading §13.2's mirror at step 2 would leave the level one milestone
    // behind on every mutation, because the mirror refreshes only on commit.
    for (const slug of ['knife-grip', 'boil-pasta']) {
      await store.setMilestoneState(uidOf(tree, slug), 'complete');
    }
    expect(progress.skills['cooking'].attainedLevel).toBe(0);

    await store.setMilestoneState(uidOf(tree, 'fried-egg'), 'complete');

    expect(progress.skills['cooking'].attainedLevel).toBe(1);
  });

  it('updates the mirror only after the transaction resolves', async () => {
    store.openTree(tree, () => {
      throw new Error('nope');
    });
    const before = { ...progress.milestones };

    await expect(store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete')).rejects.toThrow();

    expect(progress.milestones).toEqual(before);
  });

  it('records the note and the bundle version on the milestone', async () => {
    const uid = uidOf(tree, 'knife-grip');
    await store.setMilestoneState(uid, 'complete', { note: 'burnt the first two' });

    expect(progress.milestones[uid].note).toBe('burnt the first two');
    // Provenance, not an input: nothing branches on it (§12.2, T26/F15).
    expect(progress.milestones[uid].contentVersion).toBe(4);
    expect(progress.milestones[uid].treeId).toBe('cooking');
  });

  it('writes every timestamp as ISO-8601 UTC with a Z', async () => {
    await store.startSkill('cooking', 4);
    await store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete');

    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const skill = progress.skills['cooking'];
    expect(skill.startedAt).toMatch(iso);
    expect(skill.lastActivityAt).toMatch(iso);
    expect(progress.milestones[uidOf(tree, 'knife-grip')].at).toMatch(iso);
  });
});

describe('§12.2 — frozen snapshots', () => {
  it('never refreshes slug and title after completion', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);

    const uid = uidOf(tree, 'knife-grip');
    await store.setMilestoneState(uid, 'complete');
    const at = progress.milestones[uid].at;

    // An upstream reword lands in the bundle...
    const milestone = tree.milestones.find((m) => m.uid === uid)!;
    milestone.id = 'renamed-slug';
    milestone.title = 'A completely different title';
    store.openTree(tree);

    // ...and the user then rewrites this very record, which is the only moment
    // a refreshed snapshot could slip in.
    await store.setMilestoneState(uid, 'dismissed');

    // The record is of what the user did, not of what the tree now says.
    expect(progress.milestones[uid].state).toBe('dismissed');
    expect(progress.milestones[uid].slug).toBe('knife-grip');
    expect(progress.milestones[uid].title).toBe('knife-grip');
    expect(progress.milestones[uid].at).toBe(at);
  });
});

describe('D-19 — grandfathering is frozen once', () => {
  it('freezes the satisfying uid set the first time a level is satisfied', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);

    for (const slug of ['knife-grip', 'boil-pasta', 'fried-egg']) {
      await store.setMilestoneState(uidOf(tree, slug), 'complete');
    }

    const frozen = progress.skills['cooking'].grandfathered[1];
    expect(frozen.uids).toHaveLength(3);
    expect(frozen.contentVersion).toBe(4);
  });

  it('does not overwrite an existing freeze — the first one is the protective one', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);

    for (const slug of ['knife-grip', 'boil-pasta', 'fried-egg']) {
      await store.setMilestoneState(uidOf(tree, slug), 'complete');
    }
    const first = progress.skills['cooking'].grandfathered[1];

    await store.setMilestoneState(uidOf(tree, 'sear-steak'), 'complete');

    expect(progress.skills['cooking'].grandfathered[1]).toEqual(first);
  });
});

describe('§13.3 — the writable latch', () => {
  const failingOpen = () => Promise.reject(new Error('IndexedDB unavailable'));

  it('refuses every mutator after a hydration failure, and writes nothing', async () => {
    progress.reset();
    const store = createUserStateStore({ databaseName: 'latch-1', open: failingOpen });

    await expect(store.hydrate()).rejects.toThrow('IndexedDB unavailable');

    expect(store.writable).toBe(false);
    expect(store.hydrated).toBe(false);
    await expect(store.setMilestoneState('X', 'complete')).rejects.toBeInstanceOf(NotWritableError);
    await expect(store.startSkill('cooking', 1)).rejects.toBeInstanceOf(NotWritableError);
    expect(progress.milestones).toEqual({});
  });

  it('stays latched across a later successful hydrate in the same session', async () => {
    progress.reset();
    let failNext = true;
    const store = createUserStateStore({
      databaseName: 'latch-2',
      open: (name) => {
        if (failNext) {
          failNext = false;
          return Promise.reject(new Error('transient'));
        }
        return openDatabase(name);
      },
    });

    await expect(store.hydrate()).rejects.toThrow('transient');
    await store.hydrate();

    // The latch is per-session, not per-attempt.
    expect(store.writable).toBe(false);
    await expect(store.startSkill('cooking', 1)).rejects.toBeInstanceOf(NotWritableError);
  });

  it('distinguishes "no progress" from "progress unknown"', async () => {
    progress.reset();
    const store = createUserStateStore({ databaseName: 'latch-3', open: failingOpen });
    expect(store.hydrated).toBe(false);

    await expect(store.hydrate()).rejects.toThrow();

    // Both false is what lets a view say "we could not load your progress"
    // rather than "you have none" (§13.3).
    expect(store.hydrated).toBe(false);
    expect(store.writable).toBe(false);
  });

  it('is hydrated only after hydrate resolves', async () => {
    const store = freshStore();
    expect(store.hydrated).toBe(false);
    await store.hydrate();
    expect(store.hydrated).toBe(true);
  });
});

describe('§14.5 — progressFor is synchronous and total', () => {
  it('returns empty maps for a tree with no records', async () => {
    const store = freshStore();
    await store.hydrate();

    const result = store.progressFor('never-started');

    expect(result.milestones.size).toBe(0);
    expect(result.grandfathered.size).toBe(0);
  });

  it('is not a promise', async () => {
    const store = freshStore();
    await store.hydrate();
    expect(store.progressFor('x')).not.toBeInstanceOf(Promise);
  });

  it('reflects a completion immediately, with no reload and no await', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);

    const uid = uidOf(tree, 'knife-grip');
    await store.setMilestoneState(uid, 'complete');

    expect(store.progressFor('cooking').milestones.get(uid)).toBe('complete');
    // Scoped to the tree.
    expect(store.progressFor('other').milestones.size).toBe(0);
  });

  it('exposes the frozen satisfaction keyed by level number', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);

    for (const slug of ['knife-grip', 'boil-pasta', 'fried-egg']) {
      await store.setMilestoneState(uidOf(tree, slug), 'complete');
    }

    expect(store.progressFor('cooking').grandfathered.get(1)?.uids).toHaveLength(3);
  });
});

describe('§12.2 — startSkill', () => {
  it('seeds startedAt, lastActivityAt, and contentVersionSeen', async () => {
    const store = freshStore();
    await store.hydrate();

    await store.startSkill('cooking', 3);

    const skill = progress.skills['cooking'];
    expect(skill.contentVersionSeen).toBe(3);
    expect(skill.attainedLevel).toBe(0);
    // Starting a skill IS activity in the domain.
    expect(skill.lastActivityAt).toBe(skill.startedAt);
    expect(skill.grandfathered).toEqual({});
  });

  it('does not reset startedAt when called twice', async () => {
    const store = freshStore();
    await store.hydrate();

    await store.startSkill('cooking', 3);
    const startedAt = progress.skills['cooking'].startedAt;
    await store.startSkill('cooking', 9);

    expect(progress.skills['cooking'].startedAt).toBe(startedAt);
    expect(progress.skills['cooking'].contentVersionSeen).toBe(3);
  });
});

describe('§12.3 — reconciliation on tree open', () => {
  it('corrects a stale level, touching no other field', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);
    await store.startSkill('cooking', 4);
    await store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete');

    const before = { ...progress.skills['cooking'] };

    const wrote = await store.reconcileAttainedLevel('cooking', 2);

    expect(wrote).toBe(true);
    const after = progress.skills['cooking'];
    expect(after.attainedLevel).toBe(2);
    // A content release is not user activity, so the watermark is untouched.
    expect(after.lastActivityAt).toBe(before.lastActivityAt);
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.contentVersionSeen).toBe(before.contentVersionSeen);
    expect(after.grandfathered).toEqual(before.grandfathered);
  });

  it('does not write when the value already agrees', async () => {
    const store = freshStore();
    await store.hydrate();
    await store.startSkill('cooking', 4);

    expect(await store.reconcileAttainedLevel('cooking', 0)).toBe(false);
  });

  it('is a no-op for a tree with no SKILL row', async () => {
    const store = freshStore();
    await store.hydrate();
    expect(await store.reconcileAttainedLevel('never-started', 5)).toBe(false);
  });
});

describe('T26/F22 — a SKILL row with no manifest entry is retained', () => {
  it('never prunes rows, because the store cannot see the manifest', async () => {
    const store = freshStore();
    await store.hydrate();
    await store.startSkill('a-tree-that-left-the-library', 1);

    await store.hydrate();

    expect(progress.skills['a-tree-that-left-the-library']).toBeDefined();
  });
});

describe('§12.7 — storage status', () => {
  it('returns lastExportAt from META when present, and undefined when absent', async () => {
    const store = freshStore();
    await store.hydrate();
    const name = `store-test-${databaseCount}`;

    expect((await store.storageStatus()).lastExportAt).toBeUndefined();

    const db = await openDatabase(name);
    await db.put(STORES.meta, { key: 'lastExportAt', value: '2026-08-13T00:00:00.000Z' });
    db.close();

    expect((await store.storageStatus()).lastExportAt).toBe('2026-08-13T00:00:00.000Z');
  });
});

describe('§13.2 — one shared mirror rebuild, reused by every writer', () => {
  it('refreshes the mirror on each mutator commit', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);

    await store.startSkill('cooking', 4);
    expect(progress.skills['cooking']).toBeDefined();

    await store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete');
    expect(progress.milestones[uidOf(tree, 'knife-grip')]).toBeDefined();

    await store.reconcileAttainedLevel('cooking', 7);
    expect(progress.skills['cooking'].attainedLevel).toBe(7);
  });

  it('rebuilds the mirror in exactly one place', async () => {
    // T16's `import` and T17's `applyLineage` / `applyMoves` must import this
    // helper rather than duplicating it. Nothing in the task graph expresses
    // "these three implement one invariant", and the failure is silent — stale
    // progress on the first paint after a migration.
    const { readFileSync, readdirSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const dir = fileURLToPath(new URL('.', import.meta.url));

    const writers = readdirSync(dir)
      .filter((name) => name.endsWith('.ts') && !name.includes('.test.'))
      .filter((name) => readFileSync(`${dir}${name}`, 'utf8').includes('progress.replace('));

    expect(writers).toEqual(['mirror.ts']);
  });
});

describe('§14.5 — the methods this task declares but does not implement', () => {
  it('names their owning task rather than failing obscurely', async () => {
    const store = freshStore();
    await expect(store.applyLineage()).rejects.toThrow('T17');
    await expect(store.applyMoves()).rejects.toThrow('T17');
    await expect(store.export()).rejects.toThrow('T16');
    await expect(store.import()).rejects.toThrow('T16');
  });
});
