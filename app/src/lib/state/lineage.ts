/**
 * §12.5's migration pass — the fold over a tree's `lineage` ledger, and the one
 * transaction that commits it (T17).
 *
 * D-05 splits a milestone's identity into a mutable slug and an immutable uid so
 * that user state has something stable to point at while content keeps being
 * edited. §5.4's lineage ledger is the other half of that scheme: it records
 * only *structural* change — never rewording — and this module is what turns it
 * into writes. Minecraft Forge's missing-mappings mechanism is the direct
 * precedent, and its documented rough edge is the failure this must not repeat:
 * nested state was dropped because the remap path did not cover it. Every
 * disposition here therefore carries `state`, `at` **and** `note`, and the same
 * carry is where §12.8's photo will attach in phase 2.
 *
 * With no telemetry (§16.5, R-15) a silent mutation of a user's record is
 * undetectable by the maintainer and unreportable by the user. That is why the
 * pass returns a `MigrationReport` rather than resolving `void`, and why
 * `changed` is pinned to *observed mutation*.
 *
 * **The pass is split in two on purpose.** `foldLineage` is arithmetic over
 * records with no database in sight, and `applyLineage` is the transaction that
 * writes what it decided. §12.5's twelve table cells, its four fold rules, and
 * F14's composition guarantee are all properties of the arithmetic; testing them
 * through IndexedDB would test the transaction twelve times and the dispositions
 * once each.
 */

import type { CompiledTree, LineageEntry, TreeProgress } from '$lib/types';
import { BY_TREE, STORES, type Database } from './db.js';
import {
  LineageGrammarError,
  emptyReport,
  type FoldResult,
  type FoldState,
  type FrozenSets,
  type MigrationEntry,
  type MigrationReport,
} from './lineage-types.js';
import { toOrphan } from './orphans.js';
import type { MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';

/** What the fold needs to know about the bundle, and nothing more. */
export interface FoldSubject {
  readonly treeId: string;
  readonly contentVersion: number;
  readonly lineage: readonly LineageEntry[];
  /** uid → the snapshot a *new* successor record freezes (§12.2). */
  readonly bundle: ReadonlyMap<string, { readonly slug: string; readonly title: string }>;
}

export interface FoldOptions {
  /**
   * §12.5 fold rule 4: the unknown-uid disposition is a final sweep, not a table
   * row. Only a partial fold — F14's composition property — turns it off, since
   * a sweep run over half a ledger would orphan every record the other half
   * disposes of.
   */
  readonly sweep?: boolean;
}

export function subjectOf(tree: CompiledTree): FoldSubject {
  return {
    treeId: tree.id,
    contentVersion: tree.contentVersion,
    lineage: tree.lineage ?? [],
    bundle: new Map(tree.milestones.map((m) => [m.uid, { slug: m.id, title: m.title }])),
  };
}

// ── Grammar (T26/F21) ───────────────────────────────────────────────────────
//
// Nothing validates `into`'s two forms: `moved` qualifies its target as
// `<treeId>/<uid>` while `split` and `merged` use bare uids. Parsing defensively
// and failing loudly is the instruction, and loudly here means aborting the
// transaction — a pass that guessed would write a record onto a tree id that
// does not exist, and user state is the one thing with no second copy.

function targetsOf(entry: LineageEntry): readonly string[] {
  const into = entry.into ?? [];
  if (into.length === 0) {
    throw new LineageGrammarError(`lineage entry "${entry.uid}" (${entry.op}) has no "into" target`);
  }
  return into;
}

function bareUids(entry: LineageEntry): readonly string[] {
  const into = targetsOf(entry);
  for (const target of into) {
    if (target.includes('/')) {
      throw new LineageGrammarError(
        `lineage entry "${entry.uid}" (${entry.op}) names a qualified target "${target}"; ` +
          'only op:moved may cross trees (§5.4)',
      );
    }
  }
  return into;
}

interface MoveTarget {
  readonly treeId: string;
  readonly uid: string;
  readonly qualified: string;
}

function moveTarget(entry: LineageEntry): MoveTarget {
  const into = targetsOf(entry);
  if (into.length !== 1) {
    throw new LineageGrammarError(
      `lineage entry "${entry.uid}" (moved) names ${into.length} targets; a move has exactly one`,
    );
  }
  const qualified = into[0];
  const slash = qualified.indexOf('/');
  const treeId = qualified.slice(0, slash);
  const uid = qualified.slice(slash + 1);
  if (slash === -1 || treeId === '' || uid === '' || uid.includes('/')) {
    throw new LineageGrammarError(
      `lineage entry "${entry.uid}" (moved) names "${qualified}"; expected <treeId>/<uid> (§5.4)`,
    );
  }
  return { treeId, uid, qualified };
}

// ── Fold rule 2: `merged` folds by target, not by entry ─────────────────────

interface Disposition {
  readonly op: LineageEntry['op'];
  /** One entry, or — for `merged` — every entry sharing an `into` target. */
  readonly entries: readonly LineageEntry[];
}

/**
 * §12.5 fold rule 2. `LineageEntry` carries one `uid`, so an *n*-into-one merge
 * is *n* entries sharing an `into` target; they are **one disposition**,
 * evaluated at the position of the last of them.
 *
 * Getting this wrong is not an edge case. A two-into-one merge read entry by
 * entry grants the merged milestone to a user who completed only the first
 * predecessor — R-16's accepted loss inverted into silent over-credit.
 */
function dispositionsOf(lineage: readonly LineageEntry[]): readonly Disposition[] {
  const groups = new Map<string, LineageEntry[]>();
  for (const entry of lineage) {
    if (entry.op !== 'merged') continue;
    const target = bareUids(entry)[0];
    const group = groups.get(target);
    if (group === undefined) groups.set(target, [entry]);
    else group.push(entry);
  }

  const emitted = new Set<string>();
  const out: Disposition[] = [];
  for (let index = lineage.length - 1; index >= 0; index -= 1) {
    const entry = lineage[index];
    if (entry.op !== 'merged') {
      out.push({ op: entry.op, entries: [entry] });
      continue;
    }
    // Walking backwards puts the group at the position of its *last* entry,
    // which is where rule 2 evaluates it.
    const target = bareUids(entry)[0];
    if (emitted.has(target)) continue;
    emitted.add(target);
    out.push({ op: 'merged', entries: groups.get(target)! });
  }
  return out.reverse();
}

// ── The fold ────────────────────────────────────────────────────────────────

class Fold {
  /** §12.5 rule 3: live `MILESTONE` records for this tree. */
  readonly #working = new Map<string, MilestoneRecord>();
  readonly #initial = new Map<string, MilestoneRecord>();
  readonly #frozen = new Map<number, { uids: string[]; contentVersion: number }>();

  readonly #puts = new Map<string, MilestoneRecord>();
  readonly #deletes = new Set<string>();
  readonly #orphans = new Map<string, OrphanRecord>();
  readonly #entries: MigrationEntry[] = [];

  #frozenChanged = false;
  #partialMerge = false;

  constructor(
    private readonly subject: FoldSubject,
    state: FoldState,
  ) {
    for (const record of state.records) {
      if (record.treeId !== subject.treeId) continue;
      this.#working.set(record.uid, record);
      this.#initial.set(record.uid, record);
    }
    for (const [level, frozen] of Object.entries(state.grandfathered)) {
      this.#frozen.set(Number(level), {
        uids: [...frozen.uids],
        contentVersion: frozen.contentVersion,
      });
    }
  }

  run(options: FoldOptions): FoldResult {
    for (const disposition of dispositionsOf(this.subject.lineage)) {
      switch (disposition.op) {
        case 'split':
          this.#split(disposition.entries[0]);
          break;
        case 'merged':
          this.#merged(disposition.entries);
          break;
        case 'retired':
          this.#retired(disposition.entries[0]);
          break;
        case 'moved':
          this.#moved(disposition.entries[0]);
          break;
      }
    }

    if (options.sweep !== false) this.#sweep();

    return {
      puts: [...this.#puts.values()],
      deletes: [...this.#deletes],
      orphans: [...this.#orphans.values()],
      grandfathered: Object.fromEntries(this.#frozen) as FrozenSets,
      entries: this.#entries,
      partialMerge: this.#partialMerge,
      changed:
        this.#puts.size > 0 ||
        this.#deletes.size > 0 ||
        this.#orphans.size > 0 ||
        this.#frozenChanged,
    };
  }

  // ── Record moves ─────────────────────────────────────────────────────────

  #put(record: MilestoneRecord): void {
    this.#working.set(record.uid, record);
    this.#puts.set(record.uid, record);
    this.#deletes.delete(record.uid);
  }

  /**
   * §12.5's **consumed**: the row is deleted, because its credit was carried
   * forward in full. Never silent — the caller reports it with
   * `outcome: 'rewritten'` and `became` naming what it turned into.
   */
  #consume(uid: string): void {
    this.#working.delete(uid);
    this.#puts.delete(uid);
    if (this.#initial.has(uid)) this.#deletes.add(uid);
  }

  #orphan(record: MilestoneRecord, reason: 'retired' | 'merged' | 'unknown'): void {
    this.#orphans.set(record.uid, toOrphan(record, reason));
    this.#consume(record.uid);
  }

  #record(uid: string): MilestoneRecord | undefined {
    return this.#working.get(uid);
  }

  // ── Frozen sets (§11.5, D-19) ────────────────────────────────────────────
  //
  // "Frozen satisfaction sets migrate too, in lockstep with the records" — the
  // same single fold, advancing entry by entry, never a second pass. A
  // split-then-merge sequence gives a different and wrong answer if the two
  // structures are folded separately.

  #forEachFrozen(fn: (uids: string[], level: number) => string[] | null): void {
    for (const [level, frozen] of [...this.#frozen]) {
      const next = fn([...frozen.uids], level);
      if (next === null) continue;
      this.#frozenChanged = true;
      // "A frozen set emptied this way is deleted, since it then imposes no
      // condition and the level stands on current evaluation alone" (§12.5).
      if (next.length === 0) this.#frozen.delete(level);
      else this.#frozen.set(level, { uids: next, contentVersion: frozen.contentVersion });
    }
  }

  /** `split`: **replaces** the predecessor with every successor — it moves the
   *  entry rather than copying it. A copy would leave the predecessor uid in a
   *  set where §11.5's `.every` can never read it as `complete` again, since the
   *  record has just been consumed: D-19 defeated by the mechanism meant to
   *  preserve it. */
  #replaceFrozen(uid: string, successors: readonly string[]): boolean {
    let touched = false;
    this.#forEachFrozen((uids) => {
      const at = uids.indexOf(uid);
      if (at === -1) return null;
      touched = true;
      const kept = uids.filter((u) => u !== uid);
      const added = successors.filter((s) => !kept.includes(s));
      kept.splice(Math.min(at, kept.length), 0, ...added);
      return kept;
    });
    return touched;
  }

  /** `retired`, `moved`, and the unknown sweep: the uid is **removed**. A uid
   *  that has left the tree can never again read `complete` in this tree's
   *  `TreeProgress`, so leaving it in the set makes the set permanently
   *  unverifiable and silently revokes the grandfathering it exists to
   *  protect. The sweep is not named among §12.5's two deviations, but it
   *  removes a record from the tree by the same route and for the same reason. */
  #dropFrozen(uid: string): boolean {
    let touched = false;
    this.#forEachFrozen((uids) => {
      if (!uids.includes(uid)) return null;
      touched = true;
      return uids.filter((u) => u !== uid);
    });
    return touched;
  }

  /**
   * `merged` "replaces the predecessors with the successor only if all
   * predecessors were in the set", per level and as the set stands at this
   * entry. A set holding only *some* of them gets those removed rather than
   * left: their records have just been consumed or orphaned either way, so
   * keeping them is the same permanent unverifiability the retired and moved
   * deviations exist to prevent.
   */
  #mergeFrozen(predecessors: readonly string[], successor: string): boolean {
    let touched = false;
    this.#forEachFrozen((uids) => {
      const present = predecessors.filter((p) => uids.includes(p));
      if (present.length === 0) return null;
      touched = true;
      const at = uids.findIndex((u) => predecessors.includes(u));
      const kept = uids.filter((u) => !predecessors.includes(u));
      if (present.length === predecessors.length && !kept.includes(successor)) {
        kept.splice(Math.min(at, kept.length), 0, successor);
      }
      return kept;
    });
    return touched;
  }

  // ── The disposition table (§12.5) ────────────────────────────────────────

  #split(entry: LineageEntry): void {
    const successors = bareUids(entry);
    const predecessor = this.#record(entry.uid);

    if (predecessor === undefined) {
      // Not in the working set, so the row disposition is a no-op — but the
      // frozen set may still name it. §12.6's earliest-wins merge can
      // reintroduce a predecessor uid into a set whose record is gone, and the
      // next open is where that repairs itself.
      if (this.#replaceFrozen(entry.uid, successors)) {
        this.#note(entry.uid, entry.op, 'unfrozen', successors);
      }
      return;
    }

    for (const successor of successors) {
      // "A successor that already has a live record keeps it." Timestamps and
      // notes are copied only into successors with no record of their own —
      // rule 15 lets an `into` target name a uid that already shipped, and
      // §12.6's forced replay reaches the same collision with no unusual
      // authoring at all.
      if (this.#record(successor) !== undefined) continue;
      this.#put(this.#successorRecord(successor, predecessor));
    }

    this.#consume(predecessor.uid);
    this.#replaceFrozen(predecessor.uid, successors);
    this.#note(predecessor.uid, 'split', 'rewritten', successors, predecessor.title);
  }

  #merged(entries: readonly LineageEntry[]): void {
    const successor = bareUids(entries[0])[0];
    const predecessors = entries.map((e) => e.uid);
    const records = predecessors
      .map((uid) => this.#record(uid))
      .filter((r): r is MilestoneRecord => r !== undefined);

    if (records.length === 0) {
      if (this.#mergeFrozen(predecessors, successor)) {
        this.#note(predecessors[0], 'merged', 'unfrozen', [successor]);
      }
      return;
    }

    // The conjunction is over the *group* (rule 2) and over the state as well as
    // the presence: a predecessor with no record has not been done, and a mix of
    // complete and dismissed is not "all" of either.
    const complete = records.length === predecessors.length && records.every((r) => r.state === 'complete');
    const dismissed = records.length === predecessors.length && records.every((r) => r.state === 'dismissed');

    if (complete || dismissed) {
      if (this.#record(successor) === undefined) {
        // Nothing in §12.5 fixes which predecessor's timestamp the successor
        // inherits, so it takes the latest: the merged thing was not done until
        // the last of its parts was, and a summary showing the earliest would
        // date the achievement to before it existed.
        const source = records.reduce((latest, r) => (r.at > latest.at ? r : latest));
        this.#put(this.#successorRecord(successor, source));
      }
      for (const record of records) {
        this.#consume(record.uid);
        this.#note(record.uid, 'merged', 'rewritten', [successor], record.title);
      }
      this.#mergeFrozen(predecessors, successor);
      return;
    }

    // R-16's accepted loss. The successor is not granted, the predecessors
    // survive as orphans with their notes and timestamps intact, and only the
    // score contribution goes. F46's `dismissed` is explicitly not a
    // partial-credit state (D-22), so there is no third answer to reach for.
    this.#partialMerge = true;
    for (const record of records) {
      this.#orphan(record, 'merged');
      this.#note(record.uid, 'merged', 'orphaned', [], record.title);
    }
    this.#mergeFrozen(predecessors, successor);
  }

  #retired(entry: LineageEntry): void {
    const record = this.#record(entry.uid);
    if (record === undefined) {
      if (this.#dropFrozen(entry.uid)) this.#note(entry.uid, 'retired', 'unfrozen', []);
      return;
    }
    this.#orphan(record, 'retired');
    this.#dropFrozen(record.uid);
    this.#note(record.uid, 'retired', 'orphaned', [], record.title);
  }

  #moved(entry: LineageEntry): void {
    const target = moveTarget(entry);
    const record = this.#record(entry.uid);
    if (record === undefined) {
      if (this.#dropFrozen(entry.uid)) {
        this.#note(entry.uid, 'moved', 'unfrozen', [target.qualified]);
      }
      return;
    }
    // "the record follows the uid; `treeId` updated to the qualified target's
    // tree" — the uid, state, `at` and `note` are untouched. The row leaves this
    // tree's working set by changing tree, not by being deleted, which is what
    // keeps the final sweep from orphaning it a moment later.
    this.#put({ ...record, treeId: target.treeId });
    this.#working.delete(record.uid);
    this.#dropFrozen(record.uid);
    this.#note(record.uid, 'moved', 'rewritten', [target.qualified], record.title);
  }

  /**
   * Fold rule 4. It runs once, after the fold completes, over records whose
   * `treeId` is this tree — applied inline it would orphan any record whose uid
   * the ledger disposes of further down.
   */
  #sweep(): void {
    const named = new Set<string>();
    for (const entry of this.subject.lineage) {
      named.add(entry.uid);
      for (const target of entry.into ?? []) {
        named.add(target.includes('/') ? target.slice(target.indexOf('/') + 1) : target);
      }
    }

    for (const record of [...this.#working.values()]) {
      if (this.subject.bundle.has(record.uid) || named.has(record.uid)) continue;
      this.#orphan(record, 'unknown');
      this.#dropFrozen(record.uid);
      this.#note(record.uid, 'unknown', 'orphaned', [], record.title);
    }
  }

  /**
   * A successor's row is a *new* record for a *new* milestone, so it takes its
   * own frozen `slug`/`title` snapshot from the current bundle (§12.2 writes the
   * snapshot when the record is created) while inheriting the predecessor's
   * `state`, `at` and `note` from the table.
   *
   * A successor absent from the bundle is legitimate: file order lets a later
   * entry retire or move what an earlier one created. It inherits the
   * predecessor's snapshot, which is the only honest description available, and
   * the later entry disposes of it before the pass ends.
   */
  #successorRecord(uid: string, from: MilestoneRecord): MilestoneRecord {
    const snapshot = this.subject.bundle.get(uid);
    return {
      uid,
      treeId: this.subject.treeId,
      slug: snapshot?.slug ?? from.slug,
      title: snapshot?.title ?? from.title,
      state: from.state,
      at: from.at,
      ...(from.note === undefined ? {} : { note: from.note }),
      contentVersion: this.subject.contentVersion,
    };
  }

  #note(
    uid: string,
    op: MigrationEntry['op'],
    outcome: MigrationEntry['outcome'],
    became: readonly string[],
    title?: string,
  ): void {
    this.#entries.push({
      uid,
      title: title ?? this.subject.bundle.get(uid)?.title ?? uid,
      op,
      outcome,
      became,
    });
  }
}

/**
 * §12.5's fold, as arithmetic. Pure: it reads nothing and writes nothing, and
 * the same input gives the same plan every time.
 */
export function foldLineage(
  subject: FoldSubject,
  state: FoldState,
  options: FoldOptions = {},
): FoldResult {
  return new Fold(subject, state).run(options);
}

/**
 * Applies a plan to a record list, off the database. `applyLineage` performs the
 * same writes against IndexedDB; this is what lets F14's composition property be
 * asserted over the arithmetic, which is where the guarantee actually lives.
 */
export function applyFoldToRecords(
  records: readonly MilestoneRecord[],
  result: FoldResult,
): MilestoneRecord[] {
  const byUid = new Map(records.map((r) => [r.uid, r]));
  for (const uid of result.deletes) byUid.delete(uid);
  for (const record of result.puts) byUid.set(record.uid, record);
  return [...byUid.values()];
}

// ── The transaction ─────────────────────────────────────────────────────────

/**
 * §12.5's pass over one tree, in one transaction (§12.4's discipline, for the
 * same reason: a crash between the dispositions and the recomputed level would
 * leave the denormalized number disagreeing with the records it summarizes).
 *
 * The caller supplies `evaluateAttainedLevel` because §14.1 forbids a static
 * import from `lib/state` to `lib/scoring`; the tree route injects
 * `(progress) => scoreSkill(tree, progress).attainedLevel` (§14.5).
 */
export async function applyLineage(
  handle: Database,
  tree: CompiledTree,
  evaluateAttainedLevel: (progress: TreeProgress) => number,
): Promise<MigrationReport> {
  const subject = subjectOf(tree);

  // Read the skill row outside the write transaction only to answer "is there
  // anything to do?". Opening a readwrite transaction to decide not to write is
  // the cost §12.5 avoids by making the trigger a per-tree integer comparison.
  const skill = (await handle.get(STORES.skill, tree.id)) as SkillRecord | undefined;
  if (skill === undefined) {
    // Not started, so there is no user state to migrate and nothing to seed:
    // creating a row here would put an unstarted skill on the map with a rank.
    return emptyReport(tree.id, tree.contentVersion, tree.contentVersion, 0);
  }

  // `>`, never `!=`, and it is a correctness matter rather than an optimization.
  // `lineage` is append-only (§5.4), so an *older* bundle carries a shorter
  // ledger; running the pass against one drives every already-migrated record
  // into the final sweep and orphans it as `unknown`. Under a content rollback
  // the correct behaviour is to do nothing, which `>` gives free.
  if (!(tree.contentVersion > skill.contentVersionSeen)) {
    return emptyReport(
      tree.id,
      skill.contentVersionSeen,
      skill.contentVersionSeen,
      skill.attainedLevel,
    );
  }

  const tx = handle.transaction([STORES.milestone, STORES.skill, STORES.orphan], 'readwrite');

  try {
    const milestones = tx.objectStore(STORES.milestone);
    const skills = tx.objectStore(STORES.skill);
    const orphans = tx.objectStore(STORES.orphan);

    // Re-read inside the transaction. The row read above answered a question;
    // this one is what gets written back, and between the two a concurrent
    // write could have landed.
    const current = ((await skills.get(tree.id)) ?? skill) as SkillRecord;
    const records = (await milestones.index(BY_TREE).getAll(tree.id)) as MilestoneRecord[];

    const result = foldLineage(subject, {
      records,
      grandfathered: current.grandfathered,
    });

    for (const uid of result.deletes) await milestones.delete(uid);
    for (const record of result.puts) await milestones.put(record);
    for (const orphan of result.orphans) await orphans.put(orphan);

    // The recompute reads this tree's records back through the by-tree index
    // *inside* this transaction, so it accounts for the dispositions just
    // written — the mirror does not yet contain them (it refreshes on commit).
    const after = (await milestones.index(BY_TREE).getAll(tree.id)) as MilestoneRecord[];
    const attainedAfter = evaluateAttainedLevel(
      progressOf(after, result.grandfathered),
    );

    await skills.put({
      ...current,
      attainedLevel: attainedAfter,
      // Not `lastActivityAt` (T26/F19): a content release is not user activity,
      // and a fold that bumped the watermark would refresh every user's whole
      // map to the day of the release — the fabricated date §11.7 refuses to
      // render.
      contentVersionSeen: tree.contentVersion,
      grandfathered: result.grandfathered,
    });

    await tx.done;

    return {
      treeId: tree.id,
      fromVersion: current.contentVersionSeen,
      toVersion: tree.contentVersion,
      changed: result.changed,
      entries: result.entries,
      partialMerge: result.partialMerge,
      attainedLevel: { before: current.attainedLevel, after: attainedAfter },
    };
  } catch (error) {
    // One pass, one transaction. A failure part-way through must leave every
    // store at its pre-migration state — including `contentVersionSeen`, whose
    // survival is what makes the pass run again next time rather than being
    // skipped over a half-applied ledger.
    tx.done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      /* already settled */
    }
    throw error;
  }
}

function progressOf(
  records: readonly MilestoneRecord[],
  grandfathered: FrozenSets,
): TreeProgress {
  return {
    milestones: new Map(records.map((r) => [r.uid, r.state])),
    grandfathered: new Map(
      Object.entries(grandfathered).map(([level, frozen]) => [Number(level), frozen]),
    ),
  };
}
