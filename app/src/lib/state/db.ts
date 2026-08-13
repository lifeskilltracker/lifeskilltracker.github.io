/**
 * The IndexedDB database of §12.2 — five object stores, one index.
 *
 * IndexedDB from day one (D-09) rather than starting on `localStorage`: photos
 * are deferred, not cancelled (§12.8), and the synchronous hydration
 * `localStorage` would buy is worth nothing, since §13.3 already issues hydration
 * in parallel with the manifest fetch. Eviction does not distinguish them anyway
 * — Safari's ITP caps script-writable storage at seven days of non-use for both
 * (R-18).
 *
 * The fifth store is created empty and has no read or write path anywhere in the
 * app. §12.8 requires it reserved so that phase 2 needs no schema migration
 * (R-06), which is why its name appears in this file and nowhere else.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { MetaRecord, MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';

export const DB_NAME = 'life-skill-tracker';
export const DB_VERSION = 1;

/**
 * Keys are lowercase so that a consumer naming a store spells `STORES.photo`
 * rather than the reserved store's literal name — §14.7's grep gate proves the
 * reservation by showing that literal in this module alone.
 */
export const STORES = {
  meta: 'META',
  skill: 'SKILL',
  milestone: 'MILESTONE',
  orphan: 'ORPHAN',
  photo: 'PHOTO',
} as const;

/** §12.2's ER relationship: SKILL ||--o{ MILESTONE. */
export const BY_TREE = 'by-tree';

export interface LstDB extends DBSchema {
  META: { key: string; value: MetaRecord };
  SKILL: { key: string; value: SkillRecord };
  MILESTONE: { key: string; value: MilestoneRecord; indexes: { 'by-tree': string } };
  ORPHAN: { key: string; value: OrphanRecord };
  PHOTO: { key: string; value: { uid: string; image: Blob } };
}

export type Database = IDBPDatabase<LstDB>;

/** `name` varies only in tests, so each case gets an isolated database. */
export function openDatabase(name: string = DB_NAME): Promise<Database> {
  return openDB<LstDB>(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.skill)) {
        db.createObjectStore(STORES.skill, { keyPath: 'treeId' });
      }
      if (!db.objectStoreNames.contains(STORES.milestone)) {
        const milestones = db.createObjectStore(STORES.milestone, { keyPath: 'uid' });
        milestones.createIndex(BY_TREE, 'treeId');
      }
      if (!db.objectStoreNames.contains(STORES.orphan)) {
        db.createObjectStore(STORES.orphan, { keyPath: 'uid' });
      }
      if (!db.objectStoreNames.contains(STORES.photo)) {
        db.createObjectStore(STORES.photo, { keyPath: 'uid' });
      }
    },
  });
}
