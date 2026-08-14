/**
 * §12.6's export, and the round trip that is the whole point of it (T16).
 *
 * §14.6: this is the only contract whose consumer the project can never update.
 * So the assertions here are unusually literal — the exact `format` string, the
 * exact ordering, the human-readable fields surviving a round trip — because
 * each of them is a promise to someone reading a file in ten years with no
 * codebase to hand.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CompiledTree } from '$lib/types';
import { APP_VERSION } from '$lib/version.js';
import { makeTree } from '$lib/layout/fixtures.js';
import { STORES, openDatabase } from './db.js';
import { EXPORT_FORMAT } from './export-types.js';
import { exportFileName, serializeExportFile } from './export.js';
import { exportSchemaValidator } from './fixtures/schema.js';
import { progress } from './progress.svelte.js';
import { createUserStateStore } from './store.js';
import type { OrphanRecord } from './types.js';

const validateAgainstSchema = exportSchemaValidator();

let databaseCount = 0;
function freshStore() {
  databaseCount += 1;
  progress.reset();
  progress.writable = true;
  return createUserStateStore({ databaseName: `export-test-${databaseCount}` });
}

const databaseName = () => `export-test-${databaseCount}`;

function tinyTree(id = 'cooking'): CompiledTree {
  return makeTree({
    id,
    contentVersion: 4,
    milestones: [
      { id: 'knife-grip', level: 1 },
      { id: 'boil-pasta', level: 1 },
      { id: 'sear-steak', level: 2 },
    ],
  });
}

const uidOf = (tree: CompiledTree, slug: string) =>
  tree.milestones.find((m) => m.id === slug)!.uid;

/**
 * §12.5's records have no writer until T17, so the fixture writes one directly.
 * The export path is what is under test; inventing a second orphan writer to
 * seed it would be inventing exactly the thing §3.2 forbids.
 */
async function seedOrphan(orphan: OrphanRecord): Promise<void> {
  const db = await openDatabase(databaseName());
  await db.put(STORES.orphan, orphan);
  db.close();
}

describe('§12.6 — the exported file', () => {
  let store: ReturnType<typeof freshStore>;
  let tree: CompiledTree;

  beforeEach(async () => {
    store = freshStore();
    tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);
    await store.startSkill(tree.id, tree.contentVersion);
  });

  it('validates against schema/export.schema.json and carries the exact format string', async () => {
    await store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete');
    await seedOrphan({
      uid: 'z1y2x3w4',
      treeId: 'cooking',
      title: 'A retired milestone',
      state: 'complete',
      at: '2026-05-18T11:00:00.000Z',
      reason: 'retired',
    });

    const file = await store.export();
    const result = validateAgainstSchema(file);

    expect(`${result.valid}: ${result.errors}`).toBe('true: ');
    expect(file.format).toBe(EXPORT_FORMAT);
    expect(file.format).toBe('life-xp-skill-tracker/progress');
    expect(file.appVersion).toBe(APP_VERSION);
  });

  it('is deterministic apart from exportedAt, in treeId then uid order', async () => {
    const other = tinyTree('blacksmithing');
    store.openTree(other);
    await store.startSkill(other.id, other.contentVersion);
    for (const [subject, slug] of [
      [tree, 'boil-pasta'],
      [other, 'knife-grip'],
      [tree, 'knife-grip'],
    ] as const) {
      await store.setMilestoneState(uidOf(subject, slug), 'complete');
    }

    const first = await store.export();
    const second = await store.export();

    expect({ ...first, exportedAt: '' }).toEqual({ ...second, exportedAt: '' });
    expect(first.skills.map((s) => s.treeId)).toEqual(['blacksmithing', 'cooking']);

    const keys = first.milestones.map((m) => `${m.treeId}/${m.uid}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('records lastExportAt in META, readable through storageStatus', async () => {
    expect((await store.storageStatus()).lastExportAt).toBeUndefined();

    const file = await store.export();

    expect((await store.storageStatus()).lastExportAt).toBe(file.exportedAt);
  });

  it('keeps every milestone readable without the codebase (N7)', async () => {
    await store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete', {
      note: 'Took three goes. Ugly, but it holds.',
    });

    const file = await store.export();

    for (const milestone of file.milestones) {
      expect(milestone.title.length).toBeGreaterThan(0);
      expect(milestone.slug.length).toBeGreaterThan(0);
    }
    expect(file.milestones[0].note).toBe('Took three goes. Ugly, but it holds.');
  });

  it('carries no top-level contentVersion, and a generated stamp from the manifest', async () => {
    // T26/F8: §7.2 has no library-wide counter, so there is nothing to carry.
    const before = await store.export();
    expect('contentVersion' in before).toBe(false);
    // No manifest read yet on this device: an obviously-absent stamp, never a
    // plausible-looking one.
    expect(before.generated).toBe('1970-01-01T00:00:00.000Z');

    await store.recordManifest({ generated: '2026-09-14T00:00:00.000Z', treeIds: ['cooking'] });
    expect((await store.export()).generated).toBe('2026-09-14T00:00:00.000Z');
  });

  it('serializes as indented JSON with a trailing newline', async () => {
    const text = serializeExportFile(await store.export());

    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "format": "life-xp-skill-tracker/progress",');
    expect(JSON.parse(text)).toBeTypeOf('object');
  });

  it('names the download by its date, so backups sort', () => {
    expect(exportFileName('2026-08-04T11:03:00.000Z')).toBe(
      'life-skill-tracker-2026-08-04.json',
    );
  });
});

describe('§12.6 — the round trip', () => {
  it('restores byte-identical SKILL, MILESTONE and ORPHAN contents', async () => {
    const store = freshStore();
    const tree = tinyTree();
    await store.hydrate();
    store.openTree(tree);
    await store.startSkill(tree.id, tree.contentVersion);
    await store.setMilestoneState(uidOf(tree, 'knife-grip'), 'complete', { note: 'First one.' });
    await store.setMilestoneState(uidOf(tree, 'boil-pasta'), 'dismissed');
    await seedOrphan({
      uid: 'z1y2x3w4',
      treeId: 'cooking',
      title: 'A retired milestone',
      state: 'complete',
      at: '2026-05-18T11:00:00.000Z',
      note: 'Kept for the record.',
      reason: 'merged',
    });
    await store.hydrate();

    const file = await store.export();
    const seeded = {
      skills: { ...progress.skills },
      milestones: { ...progress.milestones },
      orphans: { ...progress.orphans },
    };

    // Wipe the database, exactly as clearing site data would.
    const db = await openDatabase(databaseName());
    for (const name of [STORES.skill, STORES.milestone, STORES.orphan]) await db.clear(name);
    db.close();
    await store.hydrate();
    expect(Object.keys(progress.milestones)).toHaveLength(0);

    const report = await store.import(file, 'replace');

    expect(report.mode).toBe('replace');
    expect(progress.skills).toEqual(seeded.skills);
    expect(progress.milestones).toEqual(seeded.milestones);
    expect(progress.orphans).toEqual(seeded.orphans);
  });
});
