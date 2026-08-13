import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BY_TREE, STORES, openDatabase } from './db.js';

describe('§12.2 — the object stores', () => {
  it('creates all five stores on the upgrade path', async () => {
    const db = await openDatabase('db-test-stores');
    const names = [...db.objectStoreNames].sort();

    expect(names).toEqual(
      [STORES.meta, STORES.skill, STORES.milestone, STORES.orphan, STORES.photo].sort(),
    );
    db.close();
  });

  it('indexes MILESTONE by treeId', async () => {
    const db = await openDatabase('db-test-index');
    const tx = db.transaction(STORES.milestone);
    const index = tx.objectStore(STORES.milestone).index(BY_TREE);

    expect(index.name).toBe(BY_TREE);
    expect(index.keyPath).toBe('treeId');
    await tx.done;
    db.close();
  });

  it('reserves the fifth store empty, with no read or write path', async () => {
    const db = await openDatabase('db-test-reserved');

    // Created so phase 2 needs no schema migration (§12.8, R-06).
    expect(db.objectStoreNames.contains(STORES.photo)).toBe(true);
    expect(await db.count(STORES.photo)).toBe(0);
    db.close();
  });

  it('keys each store on the §12.2 primary key', async () => {
    const db = await openDatabase('db-test-keys');
    const tx = db.transaction([STORES.meta, STORES.skill, STORES.milestone, STORES.orphan]);

    expect(tx.objectStore(STORES.meta).keyPath).toBe('key');
    expect(tx.objectStore(STORES.skill).keyPath).toBe('treeId');
    expect(tx.objectStore(STORES.milestone).keyPath).toBe('uid');
    expect(tx.objectStore(STORES.orphan).keyPath).toBe('uid');
    await tx.done;
    db.close();
  });
});
