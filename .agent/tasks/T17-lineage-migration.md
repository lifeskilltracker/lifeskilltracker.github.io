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
- All six rows of §12.5's disposition table, for both `complete` and `dismissed` records.
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
app/src/lib/state/lineage.ts            applyLineage — the §12.5 disposition table
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
| `split` into [a, b, …] | **every** successor becomes complete, copying timestamp and note | every successor becomes dismissed |
| `merged` into [c] | `c` becomes complete **only if every predecessor was complete**; otherwise predecessors move to `ORPHAN` with notes intact | `c` dismissed only if all predecessors were |
| `retired` | record moves to `ORPHAN`, reason `retired` | same |
| `moved` to another tree | record follows the uid; `treeId` updated | same |
| uid in neither bundle nor lineage | record moves to `ORPHAN`, reason `unknown` | same |

> Then `contentVersionSeen` is updated and attained level is recomputed.

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
      from `MILESTONE` (superseded, not orphaned — the table gives no orphan for `split`).
- [ ] `split` on a dismissed record produces a dismissed record for every successor.
- [ ] `merged` with **all** predecessors complete produces one complete record for the
      successor.
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
      moves to `ORPHAN` with `reason` exactly `unknown`.
- [ ] A no-entry change — same uid, changed `title` and `slug` in the bundle — leaves the
      `MILESTONE` record **byte-identical**, confirming §12.2's frozen snapshots survive a
      migration pass as well as an ordinary write.
- [ ] A test asserts the whole pass runs in **one** IndexedDB transaction: inject a failure
      partway and assert every store is at its pre-migration state, including
      `contentVersionSeen`.
- [ ] A test asserts `applyLineage` is a **no-op** when `tree.contentVersion <=
      SKILL.contentVersionSeen`, performs no write, and returns an empty report.
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
reload between, i.e. the pass is replay-safe across skipped versions. §12.5 assumes a user
may be many content versions behind and never says the pass is applied per intermediate
version — this check is what makes the assumption explicit.

## Notes and hazards

- **R-16 is accepted, not a bug to fix.** A user who completed one of two merged milestones
  has not done the merged thing, and F46's `dismissed` is explicitly not a partial-credit
  state (**D-22**, §11.10). Do not add a "partial" state, and do not grant the successor on
  a majority. State the loss in the UI and move on.
- **R-03 is unfixable by this task.** An author who keeps a uid but changes the milestone
  into a materially different achievement silently keeps stale completions. §19.3 records
  it as accepted, mitigated only by the style rubric and two-round review. Do not add
  heuristics that compare titles.
- **`moved` has an unresolved reachability problem.** The lineage entry lives in the *source*
  tree's bundle, so the migration only fires when the user opens the tree the milestone left.
  If they never open it again, the record keeps the old `treeId` indefinitely and opening the
  *destination* tree will not find it — and, by the last table row, a record whose uid is in
  neither that bundle nor that lineage becomes an orphan with reason `unknown`. §12.5 does
  not address this. Two things follow for the implementer: scope the "uid in neither" rule
  strictly to records whose `treeId` matches the tree being migrated, and do not treat a
  missing uid in an unrelated tree as unknown. The residual gap — a `moved` record stranded
  on an unvisited source tree — should be reported upward rather than papered over.
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
