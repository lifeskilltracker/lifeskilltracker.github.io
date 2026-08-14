/**
 * §12.6's import — three merge rules, one rejection policy (T16).
 *
 * The seeds below write records straight into IndexedDB rather than through
 * `setMilestoneState`. That is not a shortcut around §3.2's single writer: every
 * merge rule is a rule about *timestamps and versions on two sides*, and the
 * write path stamps `at` and `lastActivityAt` from the clock, so a seed built
 * through it could not express "the stored record is older than the file's".
 * The import path itself is exercised in full.
 */

import 'fake-indexeddb/auto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ExportFile } from '$lib/types';
import { STORES, openDatabase } from './db.js';
import { exportSchemaValidator, loadExportFixture } from './fixtures/schema.js';
import { progress } from './progress.svelte.js';
import { createUserStateStore, NotWritableError } from './store.js';
import type { MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';
import { ExportValidationError, ExportVersionError, validateExportFile } from './validate-export.js';

const validateAgainstSchema = exportSchemaValidator();

let databaseCount = 0;
const databaseName = () => `import-test-${databaseCount}`;

function freshStore() {
  databaseCount += 1;
  progress.reset();
  progress.writable = true;
  return createUserStateStore({ databaseName: databaseName() });
}

interface Seed {
  skills?: SkillRecord[];
  milestones?: MilestoneRecord[];
  orphans?: OrphanRecord[];
}

async function seed(records: Seed): Promise<void> {
  const db = await openDatabase(databaseName());
  for (const skill of records.skills ?? []) await db.put(STORES.skill, skill);
  for (const milestone of records.milestones ?? []) await db.put(STORES.milestone, milestone);
  for (const orphan of records.orphans ?? []) await db.put(STORES.orphan, orphan);
  db.close();
}

const valid = (): ExportFile => loadExportFixture<ExportFile>('valid');

function withMilestones(file: ExportFile, rows: ExportFile['milestones']): ExportFile {
  return { ...file, milestones: rows };
}

const milestone = (over: Partial<MilestoneRecord> = {}): MilestoneRecord => ({
  uid: 'k7m2qp9x',
  treeId: 'blacksmithing',
  slug: 'light-the-forge',
  title: 'Light a fire and bring stock to forging heat',
  state: 'complete',
  at: '2026-05-01T09:14:00.000Z',
  contentVersion: 5,
  ...over,
});

const skill = (over: Partial<SkillRecord> = {}): SkillRecord => ({
  treeId: 'blacksmithing',
  startedAt: '2026-05-01T09:00:00.000Z',
  attainedLevel: 3,
  lastActivityAt: '2026-08-04T10:59:00.000Z',
  contentVersionSeen: 7,
  grandfathered: {},
  ...over,
});

const orphan = (over: Partial<OrphanRecord> = {}): OrphanRecord => ({
  uid: 'z1y2x3w4',
  treeId: 'blacksmithing',
  title: 'Sharpen a chisel on an oilstone',
  state: 'complete',
  at: '2026-05-18T11:00:00.000Z',
  reason: 'retired',
  ...over,
});

let store: ReturnType<typeof freshStore>;

beforeEach(async () => {
  store = freshStore();
  await store.hydrate();
});

describe('§12.6 — merging milestones: union by uid, newest at wins', () => {
  it('replaces a stored record with a later one from the file', async () => {
    await seed({ milestones: [milestone({ at: '2026-05-01T09:14:00.000Z', note: 'stored' })] });
    await store.hydrate();

    const report = await store.import(
      withMilestones(valid(), [
        { ...valid().milestones[0], at: '2026-06-01T09:14:00.000Z', note: 'from the file' },
      ]),
      'merge',
    );

    expect(progress.milestones['k7m2qp9x'].note).toBe('from the file');
    expect(report.milestones.updated).toBe(1);
    expect(report.milestones.added).toBe(0);
  });

  it('leaves a stored record alone when the file’s is older', async () => {
    await seed({ milestones: [milestone({ at: '2026-07-01T09:14:00.000Z', note: 'stored' })] });
    await store.hydrate();

    await store.import(
      withMilestones(valid(), [
        { ...valid().milestones[0], at: '2026-06-01T09:14:00.000Z', note: 'from the file' },
      ]),
      'merge',
    );

    expect(progress.milestones['k7m2qp9x'].note).toBe('stored');
  });

  it('adds a uid the store has never seen and removes none it has', async () => {
    await seed({ milestones: [milestone({ uid: 'j4h5g6f7', slug: 'only-here' })] });
    await store.hydrate();

    const report = await store.import(valid(), 'merge');

    expect(progress.milestones['j4h5g6f7']).toBeDefined();
    expect(progress.milestones['k7m2qp9x']).toBeDefined();
    expect(report.milestones.added).toBe(3);
  });

  it('moves the whole record together, never field by field (T26/F15)', async () => {
    await seed({
      milestones: [milestone({ at: '2026-01-01T00:00:00.000Z', title: 'Old title', note: 'old' })],
    });
    await store.hydrate();

    await store.import(valid(), 'merge');

    const stored = progress.milestones['k7m2qp9x'];
    expect(stored.title).toBe('Light a fire and bring stock to forging heat');
    expect(stored.note).toBe('First proper coal fire. Took three goes.');
    expect(stored.contentVersion).toBe(5);
  });
});

describe('§12.6 — merging skills, field by field (T26/F12)', () => {
  it('takes the earliest startedAt, the latest activity, and the lowest version seen', async () => {
    await seed({
      skills: [
        skill({
          startedAt: '2026-05-10T00:00:00.000Z',
          lastActivityAt: '2026-07-01T00:00:00.000Z',
          contentVersionSeen: 9,
          attainedLevel: 1,
        }),
      ],
    });
    await store.hydrate();

    const report = await store.import(valid(), 'merge');
    const merged = progress.skills['blacksmithing'];

    expect(merged.startedAt).toBe('2026-05-01T09:00:00.000Z');
    expect(merged.lastActivityAt).toBe('2026-08-04T10:59:00.000Z');
    expect(merged.contentVersionSeen).toBe(7);
    // From the later-activity side — the file's — not a maximum.
    expect(merged.attainedLevel).toBe(3);
    expect(report.treesRewound).toBe(1);
  });

  it('never ratchets attainedLevel upward from the older side', async () => {
    // The file claims a higher level but is the older device: §11.10 forbids the
    // ratchet, and a maximum is concretely wrong when one side dismissed what
    // the other completed.
    await seed({
      skills: [skill({ attainedLevel: 2, lastActivityAt: '2026-09-01T00:00:00.000Z' })],
    });
    await store.hydrate();

    const file = valid();
    file.skills[0] = { ...file.skills[0], attainedLevel: 9 };

    await store.import(file, 'merge');

    expect(progress.skills['blacksmithing'].attainedLevel).toBe(2);
  });

  it('lets a side with lastActivityAt beat a side without it (T26/F19)', async () => {
    await seed({ skills: [skill({ lastActivityAt: '2026-01-01T00:00:00.000Z' })] });
    await store.hydrate();

    // A file written before F19 made the field required. §5.10's migration fills
    // it from the newest milestone `at` for that tree — never from the clock,
    // because an import is not activity in the skill.
    const file = loadExportFixture<ExportFile>('prior-version');

    await store.import(file, 'merge');

    expect(progress.skills['blacksmithing'].lastActivityAt).toBe('2026-06-20T14:02:00.000Z');
  });

  it('keeps the earliest grandfathered record per level (D-19)', async () => {
    await seed({
      skills: [skill({ grandfathered: { 1: { uids: ['b3n4tv5w'], contentVersion: 8 } } })],
    });
    await store.hydrate();

    const report = await store.import(valid(), 'merge');

    // The file's record was frozen at contentVersion 5 — earlier, so protective.
    expect(progress.skills['blacksmithing'].grandfathered[1]).toEqual({
      uids: ['k7m2qp9x'],
      contentVersion: 5,
    });
    expect(report.grandfatheredLevelsReplaced).toBe(1);
  });

  it('counts a SKILL row for a tree this library does not have (T26/F22)', async () => {
    await store.recordManifest({ generated: '2026-09-14T00:00:00.000Z', treeIds: ['cooking'] });

    const report = await store.import(valid(), 'merge');

    expect(report.skillsWithNoManifestEntry).toBe(1);
    // Retained, never deleted: /data lists it beside the orphans (§16.5).
    expect(progress.skills['blacksmithing']).toBeDefined();
  });

  it('reports zero unmatched skills when no manifest has been read', async () => {
    const report = await store.import(valid(), 'merge');
    expect(report.skillsWithNoManifestEntry).toBe(0);
  });
});

describe('§12.6 — merging orphans by reason specificity', () => {
  it('lets retired survive an incoming unknown with the same at', async () => {
    await seed({ orphans: [orphan({ reason: 'retired' })] });
    await store.hydrate();

    const file = valid();
    file.orphans[0] = { ...file.orphans[0], reason: 'unknown' };

    await store.import(file, 'merge');

    expect(progress.orphans['z1y2x3w4'].reason).toBe('retired');
  });

  it('lets a specific reason replace a stored unknown', async () => {
    await seed({ orphans: [orphan({ reason: 'unknown' })] });
    await store.hydrate();

    const report = await store.import(valid(), 'merge');

    expect(progress.orphans['z1y2x3w4'].reason).toBe('retired');
    expect(report.orphans.updated).toBe(1);
  });

  it('drops an orphan the file holds as a live milestone', async () => {
    await seed({ orphans: [orphan({ uid: 'k7m2qp9x' })] });
    await store.hydrate();

    const report = await store.import(valid(), 'merge');

    expect(progress.orphans['k7m2qp9x']).toBeUndefined();
    expect(progress.milestones['k7m2qp9x']).toBeDefined();
    expect(report.orphans.droppedForLiveRecord).toBe(1);
  });

  it('drops an incoming orphan the store holds as a live milestone', async () => {
    await seed({ milestones: [milestone({ uid: 'z1y2x3w4', slug: 'still-here' })] });
    await store.hydrate();

    const report = await store.import(valid(), 'merge');

    expect(progress.orphans['z1y2x3w4']).toBeUndefined();
    expect(progress.milestones['z1y2x3w4']).toBeDefined();
    expect(report.orphans.droppedForLiveRecord).toBe(1);
  });
});

describe('§12.6 — replace, behind the /data page’s confirmation', () => {
  it('removes stored rows the file does not carry', async () => {
    await seed({
      skills: [skill({ treeId: 'gone' })],
      milestones: [milestone({ uid: 'j4h5g6f7', slug: 'gone' })],
      orphans: [orphan({ uid: 'h9j8k7m6' })],
    });
    await store.hydrate();

    await store.import(valid(), 'replace');

    expect(progress.skills['gone']).toBeUndefined();
    expect(progress.milestones['j4h5g6f7']).toBeUndefined();
    expect(progress.orphans['h9j8k7m6']).toBeUndefined();
    expect(Object.keys(progress.milestones).sort()).toEqual([
      'b3n4tv5w',
      'c8d9efgh',
      'k7m2qp9x',
    ]);
  });
});

describe('§16.3 — a read failure never becomes a write', () => {
  it('rejects an invalid file whole, naming the field, and changes nothing', async () => {
    await seed({ milestones: [milestone({ note: 'untouched' })] });
    await store.hydrate();

    const file = loadExportFixture('invalid-field');

    await expect(store.import(file as ExportFile, 'merge')).rejects.toBeInstanceOf(
      ExportValidationError,
    );
    await expect(store.import(file as ExportFile, 'merge')).rejects.toThrow(
      'milestones[1].state',
    );

    const db = await openDatabase(databaseName());
    expect(await db.count(STORES.milestone)).toBe(1);
    expect((await db.get(STORES.milestone, 'k7m2qp9x'))?.note).toBe('untouched');
    expect(await db.count(STORES.skill)).toBe(0);
    db.close();
  });

  it('refuses a file from a newer version without attempting a migration', async () => {
    const file = loadExportFixture('newer-version');

    const rejection = store.import(file as ExportFile, 'merge');
    await expect(rejection).rejects.toBeInstanceOf(ExportVersionError);
    await expect(rejection).rejects.toThrow('newer version');

    expect(Object.keys(progress.milestones)).toHaveLength(0);
  });

  it('refuses a file that is not an export at all', async () => {
    await expect(store.import({ hello: 'world' } as unknown as ExportFile, 'merge')).rejects.toThrow(
      '$.format',
    );
  });

  it('rejects immediately when the session is not writable (§13.3)', async () => {
    progress.writable = false;

    await expect(store.import(valid(), 'merge')).rejects.toBeInstanceOf(NotWritableError);

    const db = await openDatabase(databaseName());
    expect(await db.count(STORES.milestone)).toBe(0);
    db.close();
  });
});

describe('§5.10 — migrating a prior file forward', () => {
  it('fills in the fields F19 and F15 made required, and normalizes timestamps', async () => {
    const report = await store.import(loadExportFixture<ExportFile>('prior-version'), 'merge');

    expect(report.schemaVersionIn).toBe(1);
    // §12.2's fixed millisecond form: §11.7's lexicographic max sorts a
    // second-precision stamp above a later millisecond one, silently.
    expect(progress.milestones['k7m2qp9x'].at).toBe('2026-05-01T09:14:00.000Z');
    expect(progress.milestones['k7m2qp9x'].contentVersion).toBe(7);
    expect(progress.skills['blacksmithing'].lastActivityAt).toBe('2026-06-20T14:02:00.000Z');
    expect(progress.skills['cooking'].lastActivityAt).toBe('2026-07-02T08:15:00.000Z');

    // And the result is a current-version file again.
    const round = await store.export();
    expect(`${validateAgainstSchema(round).valid}`).toBe('true');
  });
});

describe('§12.8 / R-06 — the unknown-key reservation', () => {
  it('imports, stores and re-exports an unrecognised photo key', async () => {
    await store.import(loadExportFixture<ExportFile>('unknown-photo-key'), 'merge');

    const stored = progress.milestones['k7m2qp9x'] as unknown as Record<string, unknown>;
    expect(stored.photo).toBe('photos/k7m2qp9x.webp');

    const round = await store.export();
    expect(`${validateAgainstSchema(round).valid}: ${validateAgainstSchema(round).errors}`).toBe(
      'true: ',
    );
    expect(
      (round.milestones.find((m) => m.uid === 'k7m2qp9x') as unknown as Record<string, unknown>)
        .photo,
    ).toBe('photos/k7m2qp9x.webp');
  });
});

describe('§14.6 — the hand-written validator agrees with the schema', () => {
  const accepts = (value: unknown): boolean => {
    try {
      validateExportFile(value);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Mutations of the valid fixture, each of which the schema and
   * `validate-export.ts` must agree about. The two tolerances F19 and F15
   * introduced are deliberately excluded: the schema requires both fields, and
   * the import path accepts their absence exactly once so §5.10 can fill them
   * in. That divergence is the `prior-version` fixture's whole subject.
   */
  const mutations: [string, (file: ExportFile) => unknown][] = [
    ['untouched', (file) => file],
    ['wrong format', (file) => ({ ...file, format: 'something-else' })],
    ['missing exportedAt', (file) => ({ ...file, exportedAt: undefined })],
    ['empty appVersion', (file) => ({ ...file, appVersion: '' })],
    ['unknown top-level key', (file) => ({ ...file, extra: true })],
    ['skills not an array', (file) => ({ ...file, skills: {} })],
    ['unknown skill key', (file) => mutate(file, 'skills', { extra: 1 })],
    ['attainedLevel out of range', (file) => mutate(file, 'skills', { attainedLevel: 11 })],
    ['attainedLevel not an integer', (file) => mutate(file, 'skills', { attainedLevel: 1.5 })],
    ['contentVersionSeen zero', (file) => mutate(file, 'skills', { contentVersionSeen: 0 })],
    ['non-enum milestone state', (file) => mutate(file, 'milestones', { state: 'partly' })],
    ['malformed uid', (file) => mutate(file, 'milestones', { uid: 'nope' })],
    ['malformed slug', (file) => mutate(file, 'milestones', { slug: 'Not A Slug' })],
    ['empty title', (file) => mutate(file, 'milestones', { title: '' })],
    ['numeric note', (file) => mutate(file, 'milestones', { note: 7 })],
    ['unknown milestone key is allowed', (file) => mutate(file, 'milestones', { photo: 'x' })],
    ['unknown orphan key', (file) => mutate(file, 'orphans', { extra: 1 })],
    ['non-enum orphan reason', (file) => mutate(file, 'orphans', { reason: 'lost' })],
    ['grandfathered uid malformed', (file) => grandfather(file, { uids: ['nope'] })],
    ['grandfathered version zero', (file) => grandfather(file, { contentVersion: 0 })],
  ];

  it.each(mutations)('agrees about: %s', (_label, mutate_) => {
    const file = mutate_(valid());
    expect(`hand: ${accepts(file)}`).toBe(`hand: ${validateAgainstSchema(file).valid}`);
  });

  it('keeps the schema engine out of the shipped app', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.(ts|svelte)$/.test(entry) && !entry.includes('.test.')) {
          const text = readFileSync(full, 'utf8');
          if (/from\s+'ajv/.test(text) && !full.endsWith(join('fixtures', 'schema.ts'))) {
            offenders.push(full);
          }
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});

function mutate(file: ExportFile, key: 'skills' | 'milestones' | 'orphans', over: object): unknown {
  const rows = [...file[key]] as Record<string, unknown>[];
  rows[1 % rows.length] = { ...rows[1 % rows.length], ...over };
  return { ...file, [key]: rows };
}

function grandfather(file: ExportFile, over: object): unknown {
  const skills = [...file.skills];
  skills[0] = {
    ...skills[0],
    grandfathered: { 1: { ...skills[0].grandfathered['1'], ...over } },
  };
  return { ...file, skills };
}

describe('T26/F20 — the grandfathered merge can reintroduce a consumed uid', () => {
	/**
	 * Tolerated, not fixed. A device that never applied a `split` still holds the
	 * predecessor in its frozen set, and earliest-wins puts it back into a set
	 * whose record no longer exists — so §11.5's `.every` fails and the level
	 * un-satisfies. Do **not** "fix" it by unioning uids across the two sides
	 * (which defeats earliest-wins) or by pruning uids with no record (which
	 * cannot tell a consumed predecessor from a milestone the user un-checked).
	 *
	 * It self-heals through the rewind this section already performs: the next
	 * open of that tree folds the split over the set again. That second half is
	 * **T17's** `applyLineage` and cannot be asserted until it exists; what is
	 * asserted here is the state the rewind is supposed to catch — the level is
	 * unsatisfied, and `contentVersionSeen` has been rewound so the pass will run.
	 */
	it('leaves the level unsatisfied and rewinds the tree so §12.5 replays', async () => {
		await seed({
			skills: [
				skill({
					contentVersionSeen: 9,
					// The post-split freeze: the successor's uid, at version 9.
					grandfathered: { 1: { uids: ['b3n4tv5w'], contentVersion: 9 } }
				})
			],
			milestones: [milestone({ uid: 'b3n4tv5w', slug: 'draw-a-taper' })]
		});
		await store.hydrate();

		const report = await store.import(valid(), 'merge');

		// Earliest-wins took the pre-split record, naming a uid with no milestone.
		const frozen = progress.skills['blacksmithing'].grandfathered[1];
		expect(frozen.uids).toEqual(['k7m2qp9x']);
		expect(report.grandfatheredLevelsReplaced).toBe(1);

		// And the rewind that makes it temporary rather than permanent.
		expect(progress.skills['blacksmithing'].contentVersionSeen).toBe(7);
		expect(report.treesRewound).toBe(1);
	});
});

describe('the equivalence corpus is not vacuous', () => {
	it('contains mutations both validators reject', () => {
		const rejected = [
			{ ...valid(), format: 'something-else' },
			{ ...valid(), extra: true },
			mutate(valid(), 'milestones', { uid: 'nope' }),
			mutate(valid(), 'orphans', { reason: 'lost' })
		];
		for (const file of rejected) {
			expect(validateAgainstSchema(file).valid).toBe(false);
			expect(() => validateExportFile(file)).toThrow(ExportValidationError);
		}
	});
});
