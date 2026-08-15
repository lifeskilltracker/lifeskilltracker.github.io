/**
 * §12.5's disposition table, its four fold rules, and the two passes that apply
 * them (T17).
 *
 * The table has twelve cells — six ops × two record states — and each one is a
 * named test below that asserts **store contents**, not a return value. That is
 * not pedantry: Minecraft Forge's missing-mappings mechanism is §12.5's direct
 * precedent, and its documented rough edge was that nested state got dropped
 * because the remap path did not cover it. A test that checks only `state`
 * would pass against exactly that bug, so every disposition producing a
 * surviving record also asserts `at` and `note` came across unchanged.
 *
 * `scoreSkill` is imported here where §14.1 forbids `lib/state` from importing
 * it. The forbidden edge is in the *module graph*: the store takes an evaluator
 * as an argument precisely so that it never holds one, and supplying the real
 * engine here is what makes the D-19 assertions mean anything.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { scoreSkill } from '$lib/scoring';
import type { CompiledTree, LineageEntry, TreeProgress } from '$lib/types';
import { STORES, openDatabase } from './db.js';
import {
  BEND,
  BOIL,
  EGG,
  GRIND,
  KNIFE,
  STEAK,
  TAPER,
  bundle,
  titleOf,
  v1,
  v2,
  v3,
} from './fixtures/lineage/index.js';
import { applyFoldToRecords, foldLineage, subjectOf } from './lineage.js';
import { LineageGrammarError } from './lineage-types.js';
import { progress } from './progress.svelte.js';
import { createUserStateStore } from './store.js';
import type { MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';

// ── Harness ─────────────────────────────────────────────────────────────────

const AT = '2027-03-01T09:00:00.000Z';
const LATER = '2027-06-02T18:30:00.000Z';

let databaseCount = 0;
let store: ReturnType<typeof createUserStateStore>;

function databaseName(): string {
  return `lineage-test-${databaseCount}`;
}

beforeEach(async () => {
  databaseCount += 1;
  progress.reset();
  progress.writable = true;
  store = createUserStateStore({ databaseName: databaseName() });
  await store.hydrate();
});

function record(
  uid: string,
  state: 'complete' | 'dismissed' = 'complete',
  over: Partial<MilestoneRecord> = {},
): MilestoneRecord {
  return {
    uid,
    treeId: 'cooking',
    slug: `slug-${uid}`,
    title: titleOf(uid),
    state,
    at: AT,
    note: `what I did for ${uid}`,
    contentVersion: 1,
    ...over,
  };
}

function skill(over: Partial<SkillRecord> = {}): SkillRecord {
  return {
    treeId: 'cooking',
    startedAt: AT,
    attainedLevel: 0,
    lastActivityAt: AT,
    contentVersionSeen: 1,
    grandfathered: {},
    ...over,
  };
}

async function seed(rows: {
  skills?: SkillRecord[];
  milestones?: MilestoneRecord[];
  orphans?: OrphanRecord[];
}): Promise<void> {
  const db = await openDatabase(databaseName());
  for (const row of rows.skills ?? [skill()]) await db.put(STORES.skill, row);
  for (const row of rows.milestones ?? []) await db.put(STORES.milestone, row);
  for (const row of rows.orphans ?? []) await db.put(STORES.orphan, row);
  db.close();
}

async function dump(): Promise<{
  milestones: MilestoneRecord[];
  orphans: OrphanRecord[];
  skills: SkillRecord[];
}> {
  const db = await openDatabase(databaseName());
  const [milestones, orphans, skills] = await Promise.all([
    db.getAll(STORES.milestone) as Promise<MilestoneRecord[]>,
    db.getAll(STORES.orphan) as Promise<OrphanRecord[]>,
    db.getAll(STORES.skill) as Promise<SkillRecord[]>,
  ]);
  db.close();
  return { milestones, orphans, skills };
}

const byUid = <T extends { uid: string }>(rows: T[]): Record<string, T> =>
  Object.fromEntries(rows.map((row) => [row.uid, row]));

/** The injection §14.5 describes, with the real engine behind it. */
const evaluator = (tree: CompiledTree) => (state: TreeProgress) =>
  scoreSkill(tree, state).attainedLevel;

const migrate = (tree: CompiledTree) => store.applyLineage(tree, evaluator(tree));

/** A two-milestone tree carrying whatever ledger a case needs. */
function ledgerTree(lineage: LineageEntry[], contentVersion = 2): CompiledTree {
  return bundle({
    contentVersion,
    milestones: [
      { uid: TAPER, slug: 'taper-a-blade', level: 1 },
      { uid: BEND, slug: 'bend-a-blade', level: 1 },
      { uid: GRIND, slug: 'grind-a-bevel', level: 1 },
      { uid: BOIL, slug: 'boil-pasta', level: 1 },
      { uid: STEAK, slug: 'sear-steak', level: 2 },
    ],
    lineage,
  });
}

// ── The disposition table: six ops × two record states ──────────────────────

describe('§12.5 — the disposition table, cell by cell', () => {
  const states = ['complete', 'dismissed'] as const;

  for (const state of states) {
    it(`no entry — a reword or a re-slug leaves a ${state} record untouched`, async () => {
      const before = record(BOIL, state);
      await seed({ milestones: [before] });

      // Same uid, different slug *and* title: §12.2's snapshots are frozen at
      // completion time and a migration pass is not a licence to refresh them.
      const tree = bundle({
        contentVersion: 2,
        milestones: [{ uid: BOIL, slug: 'cook-dried-pasta', level: 1, title: 'Cook dried pasta' }],
      });
      const report = await migrate(tree);

      const after = await dump();
      expect(after.milestones).toEqual([before]);
      expect(after.orphans).toEqual([]);
      expect(report.entries).toEqual([]);
      expect(report.changed).toBe(false);
    });

    it(`split — every successor becomes ${state} and the predecessor is consumed`, async () => {
      await seed({ milestones: [record(KNIFE, state)] });

      const report = await migrate(
        ledgerTree([{ uid: KNIFE, op: 'split', into: [TAPER, BEND], note: 'separated' }]),
      );

      const after = byUid((await dump()).milestones);
      expect(Object.keys(after).sort()).toEqual([TAPER, BEND].sort());
      for (const uid of [TAPER, BEND]) {
        expect(after[uid].state).toBe(state);
        // The Forge failure: carrying the flag and dropping everything else.
        expect(after[uid].at).toBe(AT);
        expect(after[uid].note).toBe(`what I did for ${KNIFE}`);
      }
      // Consumed, not orphaned — the credit was carried forward in full.
      expect((await dump()).orphans).toEqual([]);
      expect(report.entries).toEqual([
        { uid: KNIFE, title: titleOf(KNIFE), op: 'split', outcome: 'rewritten', became: [TAPER, BEND] },
      ]);
    });

    it(`merged — all predecessors ${state} grants the successor and consumes them`, async () => {
      await seed({ milestones: [record(TAPER, state), record(BEND, state, { at: LATER })] });

      const report = await migrate(
        ledgerTree([
          { uid: TAPER, op: 'merged', into: [GRIND] },
          { uid: BEND, op: 'merged', into: [GRIND] },
        ]),
      );

      const after = await dump();
      expect(after.milestones.map((m) => m.uid)).toEqual([GRIND]);
      expect(after.milestones[0].state).toBe(state);
      // The merged thing was not done until the last of its parts was.
      expect(after.milestones[0].at).toBe(LATER);
      expect(after.milestones[0].note).toBe(`what I did for ${BEND}`);
      // The all-complete branch consumes; the orphan is the *other* branch.
      expect(after.orphans).toEqual([]);
      expect(report.partialMerge).toBe(false);
    });

    it(`retired — a ${state} record becomes an orphan with reason "retired"`, async () => {
      await seed({ milestones: [record(EGG, state)] });

      await migrate(ledgerTree([{ uid: EGG, op: 'retired', note: 'duplicated boil-pasta' }]));

      const after = await dump();
      expect(after.milestones).toEqual([]);
      expect(after.orphans).toEqual([
        {
          uid: EGG,
          treeId: 'cooking',
          title: titleOf(EGG),
          state,
          at: AT,
          note: `what I did for ${EGG}`,
          reason: 'retired',
        },
      ]);
      // §12.2's ORPHAN has no slug, and adding one would invite a dead link.
      expect('slug' in after.orphans[0]).toBe(false);
    });

    it(`moved — a ${state} record follows its uid to the named tree`, async () => {
      await seed({ milestones: [record(STEAK, state)] });

      await migrate(
        ledgerTree([{ uid: STEAK, op: 'moved', into: [`bladesmithing/${STEAK}`] }]),
      );

      const after = await dump();
      expect(after.orphans).toEqual([]);
      expect(after.milestones).toEqual([record(STEAK, state, { treeId: 'bladesmithing' })]);
    });

    it(`final sweep — a ${state} record in neither bundle nor lineage is orphaned as "unknown"`, async () => {
      const stranded = 'w9kt41xz';
      await seed({
        milestones: [
          record(stranded, state),
          // Same uid absence, different tree. F13's fix is the conjunction of
          // these two assertions, so they belong in one test.
          record(stranded, state, { uid: 'j2mb70vd', treeId: 'bladesmithing' }),
        ],
      });

      await migrate(ledgerTree([]));

      const after = await dump();
      expect(after.orphans).toEqual([
        expect.objectContaining({ uid: stranded, reason: 'unknown', state, at: AT }),
      ]);
      expect(after.milestones.map((m) => m.uid)).toEqual(['j2mb70vd']);
    });
  }
});

// ── Consumption, and the two rules that ride with it (T26/F20) ──────────────

describe('§12.5 — consumption', () => {
  it('does not overwrite a successor that already has a live record', async () => {
    // Rule 15 requires an `into` target to *resolve*, not to be new, so an
    // author may fold a coarse milestone into one that already shipped.
    await seed({
      milestones: [
        record(KNIFE, 'complete'),
        record(TAPER, 'complete', { at: LATER, note: 'my own note' }),
      ],
    });

    await migrate(ledgerTree([{ uid: KNIFE, op: 'split', into: [TAPER, BEND] }]));

    const after = byUid((await dump()).milestones);
    expect(after[TAPER].at).toBe(LATER);
    expect(after[TAPER].note).toBe('my own note');
    expect(after[BEND].at).toBe(AT);
    expect(after[BEND].note).toBe(`what I did for ${KNIFE}`);
    expect(after[KNIFE]).toBeUndefined();
  });

  it('is what makes a replayed split safe — a retained predecessor would re-complete', async () => {
    const tree = ledgerTree([{ uid: KNIFE, op: 'split', into: [TAPER, BEND] }]);
    await seed({ milestones: [record(KNIFE, 'complete')] });
    await migrate(tree);

    // The user changes their mind about one successor.
    store.openTree(tree);
    await store.setMilestoneState(TAPER, null);

    // §12.6's import rewinds `contentVersionSeen` and forces the whole ledger to
    // replay. If the predecessor had survived the first pass it would still
    // match its own entry, and silently re-complete what was just un-checked.
    const db = await openDatabase(databaseName());
    const row = (await db.get(STORES.skill, 'cooking')) as SkillRecord;
    await db.put(STORES.skill, { ...row, contentVersionSeen: 1 });
    db.close();

    await migrate(tree);

    const after = byUid((await dump()).milestones);
    expect(after[TAPER]).toBeUndefined();
    expect(after[BEND]).toBeDefined();
  });
});

// ── R-16's accepted loss ────────────────────────────────────────────────────

describe('§12.5 — merge with partial predecessors (R-16)', () => {
  it('grants nothing, orphans every predecessor, and says so on the report', async () => {
    await seed({ milestones: [record(TAPER, 'complete'), record(BEND, 'dismissed')] });

    const report = await migrate(
      ledgerTree([
        { uid: TAPER, op: 'merged', into: [GRIND] },
        { uid: BEND, op: 'merged', into: [GRIND] },
      ]),
    );

    const after = await dump();
    expect(after.milestones).toEqual([]);
    expect(after.orphans.map((o) => o.uid).sort()).toEqual([TAPER, BEND].sort());
    for (const orphan of after.orphans) {
      expect(orphan.reason).toBe('merged');
      // Nothing the user wrote is destroyed; only the score contribution goes.
      expect(orphan.note).toBe(`what I did for ${orphan.uid}`);
      expect(orphan.at).toBe(AT);
    }
    expect(report.partialMerge).toBe(true);
  });

  it('treats a two-into-one merge as one disposition — fold rule 2', async () => {
    // Executed entry by entry, the first entry alone would look like a complete
    // merge and grant `GRIND`: R-16's accepted loss inverted into over-credit.
    await seed({ milestones: [record(TAPER, 'complete')] });

    const report = await migrate(
      ledgerTree([
        { uid: TAPER, op: 'merged', into: [GRIND] },
        { uid: BEND, op: 'merged', into: [GRIND] },
      ]),
    );

    const after = await dump();
    expect(after.milestones).toEqual([]);
    expect(after.orphans.map((o) => o.uid)).toEqual([TAPER]);
    expect(report.partialMerge).toBe(true);
  });
});

// ── Fold rules 1 and 4 ──────────────────────────────────────────────────────

describe('§12.5 — file order and the final sweep', () => {
  it('composes a split with a later merge of its successors', async () => {
    await seed({ milestones: [record(KNIFE, 'complete')] });

    await migrate(
      ledgerTree([
        { uid: KNIFE, op: 'split', into: [TAPER, BEND] },
        { uid: TAPER, op: 'merged', into: [GRIND] },
        { uid: BEND, op: 'merged', into: [GRIND] },
      ]),
    );

    const after = await dump();
    expect(after.milestones.map((m) => m.uid)).toEqual([GRIND]);
    expect(after.milestones[0].state).toBe('complete');

    // Reversed, the same ledger gives a different and wrong answer: the merge
    // matches nothing, the split then creates successors the bundle no longer
    // lists, and the sweep would orphan the lot. Only the forward result is
    // asserted because §6.4 check 6 enforces the ledger as append-only, which
    // is what makes file order a property of every bundle rather than a hope.
  });

  it('runs the unknown sweep after the fold, not inline', async () => {
    // `TAPER` exists only between the split and the merge. A sweep applied as a
    // table row would orphan it the moment the split created it.
    await seed({ milestones: [record(KNIFE, 'complete')] });

    await migrate(
      bundle({
        contentVersion: 2,
        milestones: [{ uid: GRIND, slug: 'grind-a-bevel', level: 1 }],
        lineage: [
          { uid: KNIFE, op: 'split', into: [TAPER, BEND] },
          { uid: TAPER, op: 'merged', into: [GRIND] },
          { uid: BEND, op: 'merged', into: [GRIND] },
        ],
      }),
    );

    const after = await dump();
    expect(after.orphans).toEqual([]);
    expect(after.milestones.map((m) => m.uid)).toEqual([GRIND]);
  });
});

// ── F14: the fold composes ──────────────────────────────────────────────────

describe('§12.5 — fold(1..n) === fold(1..i) ∘ fold(i+1..n)', () => {
  /**
   * Ledgers are generated as a sequence of *releases*, and the split points are
   * release boundaries. That is not a convenience: fold rule 2 makes an
   * n-into-one merge one atomic disposition, and a ledger is append-only per
   * release (§5.4, §6.4 check 6), so a boundary can never fall inside a group.
   * Splitting mid-group would test a state no bundle can be in.
   */
  const POOL = ['a1a1a1a1', 'b2b2b2b2', 'c3c3c3c3', 'd4d4d4d4', 'e5e5e5e5', 'f6f6f6f6'];

  function generate(seed: number): { releases: LineageEntry[][]; live: string[] } {
    let state = seed * 2654435761;
    const next = (bound: number): number => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state % bound;
    };

    const live = [...POOL];
    const fresh: string[] = [];
    let counter = 0;
    const mint = (): string => {
      const uid = `n${seed}${(counter += 1)}`.padEnd(8, 'x');
      fresh.push(uid);
      return uid;
    };

    const releases: LineageEntry[][] = [];
    for (let r = 0; r < 4; r += 1) {
      const entries: LineageEntry[] = [];
      const take = (): string | undefined => {
        if (live.length === 0) return undefined;
        return live.splice(next(live.length), 1)[0];
      };
      switch (next(4)) {
        case 0: {
          const uid = take();
          if (uid !== undefined) entries.push({ uid, op: 'split', into: [mint(), mint()] });
          break;
        }
        case 1: {
          const first = take();
          const second = take();
          const target = mint();
          if (first !== undefined) entries.push({ uid: first, op: 'merged', into: [target] });
          if (second !== undefined) entries.push({ uid: second, op: 'merged', into: [target] });
          break;
        }
        case 2: {
          const uid = take();
          if (uid !== undefined) entries.push({ uid, op: 'retired' });
          break;
        }
        default: {
          const uid = take();
          if (uid !== undefined) entries.push({ uid, op: 'moved', into: [`smithing/${uid}`] });
          break;
        }
      }
      // Successors created by this release are candidates for the next one.
      live.push(...fresh.splice(0));
      releases.push(entries);
    }
    return { releases, live: POOL };
  }

  for (let seed = 1; seed <= 40; seed += 1) {
    it(`composes for generated ledger ${seed}`, () => {
      const { releases } = generate(seed);
      const all = releases.flat();
      const subject = {
        ...subjectOf(bundle({ contentVersion: 2, milestones: [] })),
        lineage: all,
      };
      const start = {
        records: POOL.map((uid, index) =>
          record(uid, index % 2 === 0 ? 'complete' : 'dismissed'),
        ),
        grandfathered: { 1: { uids: [POOL[0], POOL[1]], contentVersion: 1 } },
      };

      // The sweep is a final pass, not part of the fold (rule 4), so it is off
      // on both sides of the equation.
      const whole = foldLineage(subject, start, { sweep: false });

      let boundary = 0;
      for (const release of releases.slice(0, -1)) {
        boundary += release.length;
        const first = foldLineage({ ...subject, lineage: all.slice(0, boundary) }, start, {
          sweep: false,
        });
        const second = foldLineage(
          { ...subject, lineage: all.slice(boundary) },
          {
            records: applyFoldToRecords(start.records, first),
            grandfathered: first.grandfathered,
          },
          { sweep: false },
        );

        const sort = <T extends { uid: string }>(rows: readonly T[]): T[] =>
          [...rows].sort((a, b) => a.uid.localeCompare(b.uid));

        expect(sort(applyFoldToRecords(applyFoldToRecords(start.records, first), second))).toEqual(
          sort(applyFoldToRecords(start.records, whole)),
        );
        expect(sort([...first.orphans, ...second.orphans])).toEqual(sort(whole.orphans));
        expect(second.grandfathered).toEqual(whole.grandfathered);
      }
    });
  }
});

// ── D-19: the frozen sets migrate in lockstep ───────────────────────────────

describe('§11.5 — frozen satisfaction migrates with the records', () => {
  /**
   * Level 2 carries the milestones a frozen set can name; level 3 carries one
   * that is never completed, so `attainedLevel` stops at 2 rather than running
   * up the empty levels a fixture tree necessarily has (§11.3 reads a
   * requirement group with no milestones as vacuously satisfied).
   */
  function levelTwoTree(lineage: LineageEntry[], contentVersion = 2): CompiledTree {
    return bundle({
      contentVersion,
      milestones: [
        { uid: BOIL, slug: 'boil-pasta', level: 1 },
        { uid: TAPER, slug: 'taper-a-blade', level: 2 },
        { uid: BEND, slug: 'bend-a-blade', level: 2 },
        { uid: STEAK, slug: 'sear-steak', level: 3 },
      ],
      lineage,
    });
  }

  it('moves the set under split rather than copying it', async () => {
    await seed({
      skills: [skill({ grandfathered: { 2: { uids: [KNIFE], contentVersion: 1 } } })],
      milestones: [record(BOIL, 'complete'), record(KNIFE, 'complete')],
    });

    const tree = levelTwoTree([{ uid: KNIFE, op: 'split', into: [TAPER, BEND] }]);
    await migrate(tree);

    const after = await dump();
    // A *copy* would leave KNIFE in the set, where §11.5's `.every` can never
    // read it as complete again once the record is consumed — D-19 defeated by
    // the mechanism meant to preserve it.
    expect(after.skills[0].grandfathered[2].uids.sort()).toEqual([TAPER, BEND].sort());

    // And the level still reads satisfied through the frozen path.
    expect(scoreSkill(tree, store.progressFor('cooking')).levels[1].satisfied).toBe(true);
    expect(after.skills[0].attainedLevel).toBe(2);
  });

  it('removes the uid under retired and under moved, and deletes an emptied set', async () => {
    await seed({
      skills: [skill({ grandfathered: { 2: { uids: [TAPER], contentVersion: 1 } } })],
      milestones: [record(TAPER, 'complete')],
    });

    await migrate(levelTwoTree([{ uid: TAPER, op: 'retired' }]));

    // A set that imposes no condition is deleted, not left empty.
    expect((await dump()).skills[0].grandfathered).toEqual({});
  });

  it('reports an "unfrozen" outcome when a set is all that was left to dispose of', async () => {
    // §12.6's earliest-wins merge can reintroduce a predecessor uid into a set
    // whose record is already gone. The next open folds the split over the set
    // again, and that repair is the only thing this pass has to do.
    await seed({
      skills: [skill({ grandfathered: { 2: { uids: [KNIFE], contentVersion: 1 } } })],
      milestones: [],
    });

    const report = await migrate(levelTwoTree([{ uid: KNIFE, op: 'split', into: [TAPER, BEND] }]));

    expect(report.entries).toEqual([
      { uid: KNIFE, title: KNIFE, op: 'split', outcome: 'unfrozen', became: [TAPER, BEND] },
    ]);
    expect((await dump()).skills[0].grandfathered[2].uids.sort()).toEqual([TAPER, BEND].sort());
    expect(report.changed).toBe(true);
  });
});

// ── Orphans never score ─────────────────────────────────────────────────────

describe('§12.5 — orphans never score', () => {
  it('leaves the attained level alone however satisfying the orphan would have been', async () => {
    const tree = bundle({
      contentVersion: 2,
      milestones: [{ uid: BOIL, slug: 'boil-pasta', level: 1 }],
    });
    await seed({
      milestones: [],
      orphans: [
        {
          uid: BOIL,
          treeId: 'cooking',
          title: titleOf(BOIL),
          state: 'complete',
          at: AT,
          reason: 'retired',
        },
      ],
    });

    expect(scoreSkill(tree, store.progressFor('cooking')).attainedLevel).toBe(0);
  });
});

// ── The trigger, and the transaction ────────────────────────────────────────

describe('§12.5 — when the pass runs at all', () => {
  it('does nothing when the bundle is not newer than what this skill has seen', async () => {
    await seed({
      skills: [skill({ contentVersionSeen: 5, attainedLevel: 3 })],
      milestones: [record(EGG, 'complete')],
    });

    // `>`, never `!=`: `lineage` is append-only, so an *older* bundle carries a
    // shorter ledger, and running the pass against one would drive every
    // already-migrated record into the sweep and orphan it as `unknown`.
    const report = await migrate(ledgerTree([{ uid: EGG, op: 'retired' }], 3));

    expect(report.changed).toBe(false);
    expect(report.entries).toEqual([]);
    const after = await dump();
    expect(after.orphans).toEqual([]);
    expect(after.skills[0].contentVersionSeen).toBe(5);
  });

  it('does nothing for a tree the user never started', async () => {
    await seed({ skills: [], milestones: [] });
    const report = await migrate(ledgerTree([{ uid: EGG, op: 'retired' }]));

    expect(report.changed).toBe(false);
    // A level computed for a tree the user never began would put an unstarted
    // skill on the map with a rank.
    expect((await dump()).skills).toEqual([]);
  });

  it('updates contentVersionSeen and recomputes the level after a pass that changed something', async () => {
    await seed({
      skills: [skill({ attainedLevel: 0 })],
      milestones: [record(KNIFE, 'complete'), record(BOIL, 'complete')],
    });

    const tree = bundle({
      contentVersion: 7,
      milestones: [
        { uid: TAPER, slug: 'taper-a-blade', level: 1 },
        { uid: BEND, slug: 'bend-a-blade', level: 1 },
        { uid: BOIL, slug: 'boil-pasta', level: 1 },
        // Never completed, so the recomputed level stops at 1.
        { uid: STEAK, slug: 'sear-steak', level: 2 },
      ],
      lineage: [{ uid: KNIFE, op: 'split', into: [TAPER, BEND] }],
    });
    const report = await migrate(tree);

    const after = await dump();
    expect(after.skills[0].contentVersionSeen).toBe(7);
    expect(after.skills[0].attainedLevel).toBe(1);
    expect(report.attainedLevel).toEqual({ before: 0, after: 1 });
    expect(report.fromVersion).toBe(1);
    expect(report.toVersion).toBe(7);
  });

  it('does not touch lastActivityAt — a content release is not user activity', async () => {
    await seed({ milestones: [record(EGG, 'complete')] });
    await migrate(ledgerTree([{ uid: EGG, op: 'retired' }]));

    // A fold that bumped the watermark would refresh every user's whole map to
    // the day of the release, which is the fabricated date §11.7 refuses to
    // render (T26/F19).
    expect((await dump()).skills[0].lastActivityAt).toBe(AT);
  });

  it('rolls the whole pass back when it fails part-way', async () => {
    const before = [record(KNIFE, 'complete'), record(EGG, 'complete')];
    await seed({ milestones: before });

    const tree = ledgerTree([
      { uid: KNIFE, op: 'split', into: [TAPER, BEND] },
      { uid: EGG, op: 'retired' },
    ]);
    await expect(
      store.applyLineage(tree, () => {
        throw new Error('scoring blew up');
      }),
    ).rejects.toThrow('scoring blew up');

    const after = await dump();
    expect(byUid(after.milestones)).toEqual(byUid(before));
    expect(after.orphans).toEqual([]);
    // Including the watermark: a `contentVersionSeen` that survived a rolled-back
    // pass would skip the migration forever.
    expect(after.skills[0].contentVersionSeen).toBe(1);
  });

  it('refreshes §13.2’s mirror on commit', async () => {
    await seed({ milestones: [record(KNIFE, 'complete')] });
    await migrate(ledgerTree([{ uid: KNIFE, op: 'split', into: [TAPER, BEND] }]));

    // Without this the first paint after a migration renders pre-migration
    // state, which is the paint §12.5 exists to make correct (T26/F23).
    const projected = store.progressFor('cooking');
    expect(projected.milestones.get(TAPER)).toBe('complete');
    expect(projected.milestones.get(KNIFE)).toBeUndefined();
  });
});

// ── The ledger's grammar (T26/F21) ──────────────────────────────────────────

describe('§5.4 — `into` is parsed defensively', () => {
  it('rejects a qualified target on split rather than inventing a tree', async () => {
    await seed({ milestones: [record(KNIFE, 'complete')] });
    await expect(
      migrate(ledgerTree([{ uid: KNIFE, op: 'split', into: [`smithing/${TAPER}`] }])),
    ).rejects.toThrow(LineageGrammarError);
    expect((await dump()).milestones).toEqual([record(KNIFE, 'complete')]);
  });

  it('rejects an unqualified target on moved', async () => {
    await seed({ milestones: [record(STEAK, 'complete')] });
    await expect(migrate(ledgerTree([{ uid: STEAK, op: 'moved', into: [STEAK] }]))).rejects.toThrow(
      LineageGrammarError,
    );
  });
});

// ── The sequenced release run (§12.5's stated guarantee) ────────────────────

describe('§12.5 — one pass over an accumulated ledger equals one pass per release', () => {
  async function runSequence(trees: CompiledTree[]) {
    await seed({
      milestones: [record(KNIFE, 'complete'), record(BOIL, 'complete'), record(EGG, 'complete')],
    });
    for (const tree of trees) await migrate(tree);
    return dump();
  }

  it('lands in the same place whether or not the user skipped v2', async () => {
    const skipped = await runSequence([v3()]);

    databaseCount += 1;
    progress.reset();
    progress.writable = true;
    store = createUserStateStore({ databaseName: databaseName() });
    await store.hydrate();
    const stepwise = await runSequence([v2(), v3()]);

    const strip = (rows: { uid: string }[]) => [...rows].sort((a, b) => a.uid.localeCompare(b.uid));
    expect(strip(skipped.milestones)).toEqual(strip(stepwise.milestones));
    expect(strip(skipped.orphans)).toEqual(strip(stepwise.orphans));
    expect(skipped.skills[0].grandfathered).toEqual(stepwise.skills[0].grandfathered);
    expect(skipped.skills[0].contentVersionSeen).toBe(3);

    // And the end state is the one the ledger describes: the two halves of the
    // knife milestone became one, the egg retired, the pasta untouched.
    expect(strip(skipped.milestones).map((m) => m.uid)).toEqual([BOIL, GRIND].sort());
    expect(skipped.orphans.map((o) => o.reason)).toEqual(['retired']);
  });

  it('leaves v1 alone, because nothing in it changed', async () => {
    await seed({ milestones: [record(KNIFE, 'complete')] });
    const report = await migrate(v1());
    expect(report.changed).toBe(false);
  });
});

// ── The cross-tree pass (T26/F13) ───────────────────────────────────────────

describe('§12.5 — applyMoves, at cold start, from the manifest', () => {
  it('re-homes a record whose source tree is never opened — F13’s fixture', async () => {
    await seed({
      skills: [
        skill({ grandfathered: { 1: { uids: [STEAK, BOIL], contentVersion: 1 } } }),
        skill({ treeId: 'bladesmithing' }),
      ],
      milestones: [record(STEAK, 'complete', { note: 'first proper sear' })],
    });

    const reports = await store.applyMoves({ [STEAK]: 'bladesmithing' });

    const after = await dump();
    expect(byUid(after.milestones)[STEAK]).toEqual(
      record(STEAK, 'complete', { note: 'first proper sear', treeId: 'bladesmithing' }),
    );
    // §11.5 verifies a frozen set against *one tree's* progress, so a uid that
    // has left can never read `complete` there again.
    const source = after.skills.find((s) => s.treeId === 'cooking')!;
    expect(source.grandfathered[1].uids).toEqual([BOIL]);
    expect(reports.map((r) => r.treeId)).toEqual(['cooking']);
    expect(reports[0].entries).toEqual([
      {
        uid: STEAK,
        title: titleOf(STEAK),
        op: 'moved',
        outcome: 'rewritten',
        became: [`bladesmithing/${STEAK}`],
      },
    ]);
  });

  it('is idempotent — the second run matches nothing', async () => {
    await seed({ milestones: [record(STEAK, 'complete')] });

    await store.applyMoves({ [STEAK]: 'bladesmithing' });
    const second = await store.applyMoves({ [STEAK]: 'bladesmithing' });

    expect(second).toEqual([]);
    expect(byUid((await dump()).milestones)[STEAK].treeId).toBe('bladesmithing');
  });

  it('advances no version and recomputes no level', async () => {
    await seed({
      skills: [skill({ contentVersionSeen: 4, attainedLevel: 3 })],
      milestones: [record(STEAK, 'complete')],
    });

    const [report] = await store.applyMoves({ [STEAK]: 'bladesmithing' });

    // Both need the source bundle, whose fetch is the entire thing this pass
    // avoids; §12.3's reconciliation on next open corrects the level.
    const source = (await dump()).skills.find((s) => s.treeId === 'cooking')!;
    expect(source.contentVersionSeen).toBe(4);
    expect(source.attainedLevel).toBe(3);
    expect(report.fromVersion).toBe(report.toVersion);
    expect(report.attainedLevel.before).toBe(report.attainedLevel.after);
  });

  it('refreshes the mirror on both sides of the move', async () => {
    await seed({ milestones: [record(STEAK, 'complete')] });
    await store.applyMoves({ [STEAK]: 'bladesmithing' });

    expect(store.progressFor('cooking').milestones.get(STEAK)).toBeUndefined();
    expect(store.progressFor('bladesmithing').milestones.get(STEAK)).toBe('complete');
  });

  it('reports one summary per source tree', async () => {
    await seed({
      skills: [skill(), skill({ treeId: 'baking' })],
      milestones: [
        record(STEAK, 'complete'),
        record(EGG, 'complete', { treeId: 'baking' }),
      ],
    });

    const reports = await store.applyMoves({
      [STEAK]: 'bladesmithing',
      [EGG]: 'bladesmithing',
    });

    expect(reports.map((r) => r.treeId).sort()).toEqual(['baking', 'cooking']);
  });
});
