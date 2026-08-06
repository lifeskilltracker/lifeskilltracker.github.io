# T17 — Lineage migration at load and orphan records

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | runtime-io |
| **Blocked by** | T09, T11 |
| **Blocks** | — |
| **Spec** | ARCHITECTURE §12.5, §5.4 |
| **PRD** | R-03, R-16 |

## Goal

`store.applyLineage(tree)` exists and runs before a tree renders whenever that bundle's
`contentVersion` exceeds the skill's `contentVersionSeen`. It walks the bundle's `lineage`
ledger and applies each `op` to the user's records according to §12.5's disposition table,
carrying state, timestamp **and** note across every disposition; moves anything it cannot
account for into the `ORPHAN` store with a reason rather than deleting it; updates
`contentVersionSeen`; recomputes attained level; and returns a `MigrationReport` the shell
renders as one dismissible summary. After this task, user state can survive an arbitrary
number of content releases without a silent mutation.

## Why this shape

**D-05** splits every milestone's identity into a mutable slug and an immutable uid
precisely so that user state has something stable to point at while content keeps being
edited; §5.4's lineage ledger is the other half of that scheme, recording only *structural*
change — never rewording — and CI enforces its completeness by diffing against `main`
(§6.4). Because uids freeze at first merge, user state can diverge from content from that
moment on, which is why this task is required for v1 even though §16.4's phase diagram does
not name it. The dispositions are Minecraft Forge's missing-mappings mechanism applied to
content, and Forge's documented rough edge is the exact failure this task must not repeat:
nested state was dropped because the remap path did not cover it. With no telemetry
(§16.5, **R-15**), a silent mutation of a user's record is undetectable by the maintainer
and unreportable by the user — hence the mandatory visible summary.

## Scope

**In scope**

- `applyLineage(tree: CompiledTree): Promise<MigrationReport>` per §14.5.
- The trigger condition: run when the bundle's `contentVersion` exceeds that skill's
  `SKILL.contentVersionSeen`, **before the tree renders** (§12.5).
- All six rows of §12.5's disposition table, for both `complete` and `dismissed` records,
  executed as §12.5's **fold** — file order, `merged` grouped by target, orphaned records
  leaving the working set, and the unknown-uid disposition as a final sweep scoped to this
  tree's `treeId` (T26/F14, F13).
- `applyMoves(moved: MovedIndex): Promise<readonly MigrationReport[]>` — the cold-start
  cross-tree pass over the manifest's `moved` map (§12.5, §14.5). The App Shell calls it
  (**T14**); this task implements it.
- The `ORPHAN` **write** path — the only place in the system that creates orphan records.
- Carrying `state`, `at`, and `note` through every disposition, and reserving the same
  carry for `photo` in phase 2.
- Updating `SKILL.contentVersionSeen` and recomputing `SKILL.attainedLevel` after the pass.
- Populating `MigrationReport` and `OrphanReason` — both now declared in §14.5 (T26/F3).
  Two fields that came out of that resolution and are not optional: `attainedLevel`
  before/after, because a migration is the one path that changes a rank with no user action
  and §11.10 requires rank consequences to be *stated*; and `partialMerge`, so the UI can
  name R-16's loss. `OrphanReason` is `'retired' | 'merged' | 'unknown'` — `merged` is
  §12.5's partial-merge orphan, which the disposition table produces and never names, and
  folding it into `unknown` would make an accepted loss indistinguishable from a record the
  pass could not account for.
- One dismissible summary, shown after any migration that changed something, saying what
  moved and why.
- Stating **R-16**'s accepted loss in the UI when it occurs: a merge whose predecessors were
  only partly complete does not grant the merged milestone.
- Surfacing orphans in a "retired achievements" section, and guaranteeing they never score.

**Out of scope**

- The `ORPHAN` store's *creation* and the `by-tree` index — **T09** (§12.2). This task is
  the first writer into a store T09 already built.
- `setMilestoneState` and the single-transaction write path — **T09** (§12.4). This task
  reuses it; it does not open its own write path.
- Computing attained level. `scoreSkill` is the Scoring Engine's — **T11** (§14.4). This
  task calls it and persists the result.
- The `lineage` block's *authoring* form, its CI completeness check, and `lst baseline` —
  §5.4 / §6.4, owned by **T03** and **T23**. This task consumes `lineage` as the compiler
  emits it (§7.3 retains it verbatim).
- Export and import of orphans — **T16** (§12.6). Orphans are "always exported"; T16 does
  the exporting.
- Content `schemaVersion` migration — §5.10, the compiler's, and a different mechanism
  entirely. `contentVersion` and `schemaVersion` are independent (§16.1).
- **R-03**, semantic redefinition under a stable uid. No mechanism can catch it (§5.4,
  §19.3); the mitigation is `docs/STYLE-RUBRIC.md` (**T24**) carrying Mozilla's rule and
  F42's two-round review. Nothing in this task should attempt to detect it.
- Photo migration — **Phase 2**, §12.8. The carry is designed for it; the payload is not.

## Deliverables

```
app/src/lib/state/lineage.ts            applyLineage — the §12.5 fold and disposition table
app/src/lib/state/moves.ts              applyMoves — the cold-start cross-tree pass
app/src/lib/state/lineage-types.ts      MigrationReport, OrphanReason
app/src/lib/state/orphans.ts            ORPHAN reads/writes; "never scores" boundary
app/src/lib/components/MigrationSummary.svelte   the one dismissible summary
app/src/lib/components/RetiredAchievements.svelte  the orphan section
app/src/lib/state/lineage.test.ts       one test per table cell — twelve cells
app/src/lib/state/fixtures/lineage/     bundles at successive contentVersions with
                                        split, merged, retired, moved, and unknown
```

## Interface contract

The method, verbatim from ARCHITECTURE §14.5:

```ts
applyLineage(tree: CompiledTree): Promise<MigrationReport>;   // §12.5
```

The authored ledger this consumes, verbatim from §5.4:

```yaml
lineage:
  - uid: q4np8w2r
    op: split
    into: [m3xk90ab, v8t2ncq5]
    note: "separated tapering from bending (2027-03)"
  - uid: b7ldk3fp
    op: merged
    into: [z2vr65jm]
  - uid: h8dq37nc
    op: retired
    note: "duplicated c5fj92tk"
  - uid: c5fj92tk
    op: moved
    into: [bladesmithing/c5fj92tk]
```

**The disposition table, verbatim from §12.5. This is the normative behaviour of this
task; every cell is a test.**

| `op` | Applied to a **complete** record | Applied to a **dismissed** record |
|---|---|---|
| *(no entry — reword, re-level, retrack, slug change)* | nothing; the uid is unchanged | nothing |
| `split` into [a, b, …] | **every** successor becomes complete, copying timestamp and note into those that have no record of their own; the predecessor is **consumed** | every successor becomes dismissed, on the same terms; the predecessor is consumed |
| `merged` into [c] *(all entries sharing target `c`, as one group)* | `c` becomes complete **only if every predecessor was complete**, and the predecessors are then **consumed**; otherwise `c` is not granted and the predecessors move to `ORPHAN` with notes intact | `c` dismissed only if all predecessors were, on the same terms |
| `retired` | record moves to `ORPHAN`, reason `retired` | same |
| `moved` to another tree | record follows the uid; `treeId` updated to the qualified target's tree | same |
| **final sweep** — uid in neither bundle nor lineage, **and `treeId` is this tree** | record moves to `ORPHAN`, reason `unknown` | same |

> Then `contentVersionSeen` is updated and attained level is recomputed.

**The four fold rules, verbatim from §12.5 (T26/F14, 2026-08-05). These are as normative as
the table, and three of the four change how the table is executed:**

> 1. **File order.** Entries are applied in the order they appear in the bundle, which the
>    compiler preserves verbatim (§7.3) and §6.4 check 6 enforces as append-only.
> 2. **`merged` folds by target, not by entry.** `LineageEntry` carries one `uid` (§5.2), so
>    an *n*-into-one merge is *n* entries sharing an `into` target. They are evaluated as
>    **one disposition** at the position of the last of them.
> 3. **The working set is live `MILESTONE` records for this tree.** A record leaves it
>    permanently by exactly two routes — moving to `ORPHAN`, or being **consumed** by the
>    disposition that carried its credit forward — and is never re-examined afterwards.
> 4. **The unknown-uid disposition is a final sweep, not a table row.** It runs once, after
>    the fold completes, over records whose `treeId` is this tree.

> Applying entries 1..*n* in one pass equals applying 1..*i* and then *i+1*..*n*.

Rule 2 is the one most likely to be got wrong, and it is not an edge case: a two-into-one
merge is two entries, and reading them in isolation grants the merged milestone to a user who
completed only the first predecessor — R-16's accepted loss inverted into silent over-credit.

**Consumption, and the two rules that come with it (§12.5, T26/F20, 2026-08-05).** "Consumed"
means the `MILESTONE` row is **deleted** — reported, never silent — and it is the disposition
for a predecessor whose credit was carried forward in full: `split` always, `merged` only in
the all-complete branch. Orphaning is the other branch's answer, because R-16's partial merge
is a loss and the orphan is what survives it. Two rules ride with it, and both are tests:

- **A successor that already has a live record keeps its own `at` and `note`.** Timestamps and
  notes are copied only into successors with no record. Rule 15 requires an `into` target to
  *resolve*, not to be new, so an author may fold a coarse milestone into one that already
  shipped — and the same collision arrives with ordinary authoring through §12.6's import,
  which unions in a predecessor from a device that never opened the tree, rewinds
  `contentVersionSeen`, and forces this pass to replay over already-migrated successors.
- **Consumption is why replay-safety holds for `split` at all.** A predecessor left live stays
  in the working set, re-matches its own entry on every later pass, and — since an import
  forces a replay — silently re-completes a successor the user deliberately un-checked.

What is lost is the predecessor's frozen `title` snapshot: it leaves persisted state and
survives only in the `MigrationReport`. That is accepted, not an oversight.

**The cross-tree pass, new in §12.5 and §14.5 (T26/F13):**

```ts
applyMoves(moved: MovedIndex): Promise<readonly MigrationReport[]>;   // MovedIndex = Manifest['moved']
```

Runs at cold start from the manifest's `moved` map, not from any bundle. For each entry whose
uid names a record on the source tree: rewrite the record's `treeId` to the destination, and
**remove that uid from the source skill's frozen sets**. Idempotent by construction — after
re-homing, the entry no longer matches — so it needs no seen-marker. It does **not** update
`contentVersionSeen` and does **not** recompute the source tree's `attainedLevel`; both need
the source bundle, whose fetch is the entire thing this pass avoids. Its reports therefore
carry `fromVersion === toVersion` and `attainedLevel.before === after`, and §12.3's
reconciliation on next open corrects the level.

The three rules that govern the pass, verbatim from §12.5:

> **Nothing is ever silently deleted from user state.** Orphans keep their frozen title,
> timestamp, and note, are always exported, and surface in a "retired achievements" section
> rather than vanishing. They never score.

> The migration pass must carry **everything attached to a milestone** — state, timestamp,
> note, and later the photo — not just the completion flag. Minecraft Forge's
> missing-mappings mechanism is the direct precedent for the three dispositions, and its
> documented rough edge is exactly this: nested state was dropped because the remap path
> did not cover it.

> After any migration that changed something, the app shows **one dismissible summary** of
> what moved and why. Silent mutation of a user's record is the failure mode this whole
> mechanism exists to prevent, so it must not be silent.

And the accepted loss, verbatim:

> The **merge-with-partial-predecessors case is an accepted loss** and should be stated
> plainly in the UI. A user who completed one of two milestones that were later merged has
> not done the merged thing, and F46's `dismissed` is explicitly not a partial-credit
> state. The predecessors survive as orphans with their notes and timestamps, so nothing
> the user wrote is destroyed — only the score contribution goes.

The `ORPHAN` record shape, verbatim from §12.2 — note it carries no `slug`:

```
ORPHAN {
    string uid PK
    string treeId
    string title
    string state
    string at
    string note
    string reason
}
```

## Acceptance criteria

- [ ] `lineage.test.ts` contains one named test per cell of the disposition table — **six
      ops × two record states = twelve tests** — and each asserts the resulting store
      contents, not just a return value.
- [ ] For every disposition that produces a surviving record, a test asserts `at` and
      `note` are carried across **unchanged**. A test that only checks `state` does not
      satisfy this criterion; this is the Forge failure named in §12.5.
- [ ] `split` on a complete record produces a complete record for **every** uid in `into`,
      each carrying the predecessor's `at` and `note`, and the predecessor record is gone
      from `MILESTONE` — **consumed, not orphaned** (T26/F20; this task doc inferred it
      before the spec said it, and the inference was right).
- [ ] `split` on a dismissed record produces a dismissed record for every successor, and
      consumes the predecessor.
- [ ] **`split` does not overwrite an existing successor.** Seed a complete record for
      successor `a` with its own `at` and note, then apply `split q → [a, b]` with `q`
      complete: `a` keeps **its own** `at` and `note`, `b` gets `q`'s, and `q` is consumed.
      Reachable with no import at all — rule 15 lets an `into` target name a uid that
      already shipped (T26/F20).
- [ ] **A retained predecessor would break replay-safety, so assert it is gone.** Apply the
      split, un-check successor `a`, then replay the whole ledger: `a` stays un-checked. If
      the predecessor survives the first pass, the replay silently re-completes it — this is
      the concrete failure T26/F20 fixed, and it is reachable through §12.6's forced replay.
- [ ] `merged` with **all** predecessors complete produces one complete record for the
      successor, and **every predecessor is consumed** — gone from `MILESTONE`, and not in
      `ORPHAN` either. The orphan branch is the partial case only (T26/F20).
- [ ] `merged` with **some** predecessors complete produces **no** successor record, moves
      **every** predecessor to `ORPHAN` with notes intact, and the returned
      `MigrationReport` marks the case so the UI can state **R-16**'s loss.
- [ ] `merged` with all predecessors dismissed produces a dismissed successor; with a mix,
      the same partial-predecessor path applies.
- [ ] `retired` moves the record to `ORPHAN` with `reason` exactly `retired`, for both
      states.
- [ ] `moved` updates `treeId` to the tree named in `into`'s `<treeId>/<uid>` form and
      leaves the uid, state, `at`, and `note` untouched.
- [ ] A uid present in `MILESTONE` for this tree but in neither the bundle nor the lineage
      moves to `ORPHAN` with `reason` exactly `unknown`. A record with the **same** uid
      absence but a **different** `treeId` is left untouched by the same pass — the two
      assertions belong in one test, since it is their conjunction that F13 fixed.
- [ ] A **two-into-one merge expressed as two entries** sharing an `into` target, with only
      the first predecessor complete, produces **no** successor record and orphans both
      predecessors. Executed entry-by-entry this test grants the successor; it is the direct
      regression test for §12.5's fold rule 2.
- [ ] A ledger containing `split q → [a, b]` followed by `merged a → [c]` and `merged b →
      [c]`, applied in one pass to a complete record for `q`, produces a complete `c`. The
      same ledger applied in reverse order does not — assert the forward result only, and
      keep the reversed case as a comment explaining why order is enforced by §6.4 check 6.
- [ ] A property test over generated ledgers asserts **fold(1..n) === fold(1..i) ∘
      fold(i+1..n)** for every split point *i*. This is F14's guarantee, and it is the one
      criterion that fails if any disposition is not a no-op on an absent subject.
- [ ] `applyMoves` re-homes a record whose source tree is never opened: seed a completion in
      tree A, seed a manifest whose `moved` map sends that uid to tree B, run `applyMoves`,
      and assert the record's `treeId` is B, its uid, state, `at` and `note` are unchanged,
      and the uid is gone from A's `SKILL.grandfathered`. **This is F13's named fixture.**
- [ ] `applyMoves` is idempotent: running it twice changes nothing the second time and
      returns no report with `changed: true`.
- [ ] `applyMoves` leaves the source skill's `contentVersionSeen` and `attainedLevel`
      untouched, and its report carries `fromVersion === toVersion`.
- [ ] A no-entry change — same uid, changed `title` and `slug` in the bundle — leaves the
      `MILESTONE` record **byte-identical**, confirming §12.2's frozen snapshots survive a
      migration pass as well as an ordinary write.
- [ ] A test asserts the whole pass runs in **one** IndexedDB transaction: inject a failure
      partway and assert every store is at its pre-migration state, including
      `contentVersionSeen`.
- [ ] A test asserts `applyLineage` is a **no-op** when `tree.contentVersion <=
      SKILL.contentVersionSeen`, performs no write, and returns an empty report.
- [ ] **The frozen set moves under `split`, it does not copy.** Seed
      `grandfathered[2] = { uids: [q], … }`, apply `split q → [a, b]`, and assert the set is
      exactly `[a, b]` — `q` absent. Then assert level 2 still reads satisfied through
      §11.5's frozen path. A copied set leaves `q` in place, `progress[q]` can never read
      `complete` once the record is consumed, and the level silently un-satisfies: D-19
      defeated by the mechanism meant to preserve it (T26/F20).
- [ ] **Both passes refresh §13.2's mirror on commit** (T26/F23). After `applyLineage`,
      `store.progressFor(treeId)` reflects the migrated records without a reload; after
      `applyMoves`, the re-homed uid appears under the **destination** tree's
      `progressFor` and is gone from the source's. Without this the first paint after a
      migration renders pre-migration state, which is the paint §12.5 exists to make correct.
- [ ] A test asserts `contentVersionSeen` is updated and `SKILL.attainedLevel` recomputed
      after a pass that changed something.
- [ ] A test asserts orphans never score: seed an orphan whose milestone would satisfy a
      level, run `scoreSkill`, and assert `attainedLevel` is unchanged. Equivalently,
      `grep -rn "ORPHAN\|orphan" app/src/lib/scoring` returns no matches.
- [ ] A component test asserts `MigrationSummary.svelte` renders exactly once per migration
      that changed something, is dismissible, and is **not** rendered for an empty report.
- [ ] A component test asserts the merge-with-partial-predecessors branch renders text
      naming the lost score contribution and pointing at the retired-achievements section
      — **R-16** stated in the UI, not only in the spec.
- [ ] `RetiredAchievements.svelte` lists every `ORPHAN` record with its title, date, note,
      and reason.
- [ ] `MigrationReport` and `OrphanReason` are declared in `lineage-types.ts` matching
      §14.5 exactly, imported by `app/src/lib/state/store.ts`, and `npx tsc --noEmit`
      passes.
- [ ] A partial-merge fixture produces an orphan with `reason: 'merged'` and sets
      `partialMerge: true` on the report; a fixture whose migration changes the rank shows
      `attainedLevel.before !== after` and the summary states it.
- [ ] `grep -rn "\.delete(" app/src/lib/state/lineage.ts` shows deletions only of
      `MILESTONE` rows that were superseded or copied into `ORPHAN` in the same
      transaction — nothing leaves user state without a successor or an orphan.

## Verification

```bash
npm run --workspace app test -- lineage orphan
npx tsc --noEmit
npm run --workspace app check
```

Plus a sequenced fixture run: apply `fixtures/lineage/v1 → v2 → v3` in order against a
seeded store and assert the end state equals applying them one release at a time with a
reload between. **§12.5 now states this as a guarantee rather than leaving it assumed**
(T26/F14) — the fixture run is the example, and the property test in the criteria above is
the general case.

## Notes and hazards

- **R-16 is accepted, not a bug to fix.** A user who completed one of two merged milestones
  has not done the merged thing, and F46's `dismissed` is explicitly not a partial-credit
  state (**D-22**, §11.10). Do not add a "partial" state, and do not grant the successor on
  a majority. State the loss in the UI and move on.
- **R-03 is unfixable by this task.** An author who keeps a uid but changes the milestone
  into a materially different achievement silently keeps stale completions. §19.3 records
  it as accepted, mitigated only by the style rubric and two-round review. Do not add
  heuristics that compare titles.
- **~~`moved` has an unresolved reachability problem.~~ RESOLVED by T26/F13, 2026-08-05,
  and this note's advice was half the answer.** Scoping the sweep to `record.treeId ===
  tree.id` was adopted and is necessary — but it is not sufficient, because
  `MILESTONE`'s primary key is the **uid**: a user whose record is invisible to the
  destination tree simply re-ticks the milestone, and that write lands on the same key,
  overwriting the original `at` and `note`. The residual gap is therefore closed rather than
  reported upward: the manifest carries a library-wide `moved` map and `applyMoves` re-homes
  the record at cold start. Do not build a uid-keyed `TreeProgress` lookup as an alternative
  — it was considered and rejected on three counts (§11.5's frozen check is per-tree; an
  unstarted destination tree has no `SKILL` row so the completions score zero; and the final
  sweep's predicate goes vacuously false). See `docs/SPEC-FINDINGS.md` F13.
- **The pass is a fold, and replay-safety is now a stated guarantee rather than an
  assumption — T26/F14, 2026-08-05.** The four rules above are normative. Two consequences
  for the implementation: the ledger must be iterated in array order and never sorted or
  keyed into a map that loses order, and `merged` entries must be grouped by `into` target
  *before* the fold walks them.
- **An import can lower `contentVersionSeen` — T26/F12.** §12.6 merges the field as a
  minimum, which deliberately rewinds a skill so this pass replays on next open. Do not
  assume the value only ever rises, and do not treat a rewind as corruption. The replay is
  safe by the guarantee above and usually mutates nothing, which is why `MigrationReport.
  changed` is pinned to *observed mutation* rather than "entries were evaluated" — a
  twelve-skill import must not produce twelve summaries.
- **`split`'s predecessor fate is still unstated — T26/F20, open.** This document's
  criterion below (predecessor superseded, not orphaned) is an inference from the table's
  silence, not a quotation of it, and the frozen-set half is worse: §12.5 says `split`
  *copies* the set entry to every successor, which leaves the predecessor uid in a set where
  §11.5 can never read it as complete. Do not implement the frozen-set branch of `split`
  until F20 lands.
- **`into:`'s grammar is unvalidated — T26/F21, open.** `moved` uses `<treeId>/<uid>` while
  `split` and `merged` use bare uids, and nothing checks either. Parse defensively and fail
  loudly rather than producing a record on a tree id that does not exist.
- **`contentVersion` is per-tree — T26 F8, 2026-08-05. This note previously said the
  opposite.** It is an authored integer on each tree (§5.3), so
  `contentVersion > contentVersionSeen` is true only for trees whose content actually
  changed. The pass no longer fires on every started skill on every release. Keep the
  empty-lineage path cheap anyway — a tree can change without any structural lineage entry
  (a reword bumps the version but produces no dispositions) — and make sure that case still
  produces no summary (see the no-op criterion).
- **The comparison is `>`, never `!=`.** §12.5 now states why, and it is a correctness
  matter rather than an optimization: `lineage` is append-only (§5.4), so an older bundle
  carries a *shorter* ledger. Running the pass against one drives every already-migrated
  record into the "uid in neither bundle nor lineage" row and orphans it as `unknown`.
  Under a content rollback the correct behaviour is to do nothing, which `>` gives free.
- **The frozen snapshot survives migration.** §12.2's `slug` and `title` are written at
  completion time and never refreshed. A `split` successor inherits the *predecessor's*
  timestamp and note per the table, but must take its own `slug`/`title` snapshot from the
  new bundle — those are new records for new milestones. §12.5 does not say this explicitly;
  it follows from §12.2's rule that the snapshot is written at the time the record is
  created.
- **`ORPHAN` has no `slug` field** (§12.2). Do not add one. It also has no
  `contentVersion`, so an orphan cannot be dated to a release — accepted; `at` is the user's
  timestamp and is what matters.
- **~~§12.5 does not define `MigrationReport`.~~ RESOLVED by T26/F3, 2026-08-05.** It is
  typed in §14.5 and carries what this note asked for, plus `attainedLevel` before/after.
  Transcribe it; do not design a second shape.
- Nothing in this task may write outside §12.4's transaction discipline. One pass, one
  transaction, reactive state updating from its completion — the same rule, for the same
  reason, as an ordinary milestone toggle.


## T26 amendments — 2026-08-06

**F19 — neither pass writes `SKILL.lastActivityAt`.** `applyLineage` and `applyMoves` mutate
records and frozen sets without touching the watermark. A content release is not user
activity; a fold that bumped it would refresh every user's whole map to the day of the
release, which is the fabricated date §11.7 refuses to render.

**F26 — neither pass reconciles `attainedLevel` either.** §12.3's write-back is
`store.reconcileAttainedLevel`, called by T14's tree route **after** `applyLineage`. Do not
call it from inside a migration: `MigrationReport.attainedLevel.after` is what the summary
shows the user, and a second computation writing a different number would contradict it.

**F22 — this task is explicitly unchanged**, which is worth stating because F22 touches its
neighbours. The migration passes do not move; the `moved` map's durability is a CI concern
(§6.4 check 8, T23) rather than a runtime one.
