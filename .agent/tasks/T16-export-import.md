# T16 — Export and import

| Field | Value |
|---|---|
| **Status** | complete — 2026-08-14 |
| **Phase** | 1 |
| **Cluster** | runtime-io |
| **Blocked by** | T09, T14 |
| **Blocks** | T18 |
| **Spec** | ARCHITECTURE §12.6, §14.6 |
| **PRD** | F38, N7 |

## Goal

`store.export()` produces a single plain-JSON file conforming to
`schema/export.schema.json`, and `store.import(file, mode)` reads one back — merging by
default, replacing everything behind an explicit confirmation. After this task a user can
move their progress between two devices, keep a backup that outlives the project, and
reload a backup without the app ever partially applying a file it could not fully
understand. The `/data` route offers both, reports what an import did, and refuses a file
from a newer `schemaVersion` rather than guessing at it.

## Why this shape

§14.6 lists five data contracts that cross a boundary someone else owns, and the export
file is **the only one with a consumer the project can never update**: users, forever.
Everything odd about the format follows from that. The file carries both identifiers
because it has two readers with different needs — the application matches on `uid`, and a
human reading it in ten years reads `title` and `note` — so N7's "survives the project
itself" is only satisfied if the second reader gets what they need without the codebase.
That is why the redundant `title` snapshot earns its bytes. It is also why the import path
**migrates rather than rejects** old versions, and why a *newer* version is refused
outright: guessing at a format from the future is how a restore silently drops the field
it did not recognise, in a system with no telemetry to notice (§16.5, **R-15**).

## Scope

**In scope**

- `export(): Promise<ExportFile>` — assembling `META`, `SKILL`, `MILESTONE`, and `ORPHAN`
  contents into the §12.6 shape. `ExportFile` is now **typed in §14.5** (T26/F3): transcribe
  it, do not re-derive it from the worked example.
- Serialization to a downloadable file and a file-picker read on the `/data` route (§13.1).
- Validation of every imported file against `schema/export.schema.json` (authored in T02)
  **before any write**.
- `import(file, mode: 'merge' | 'replace')`:
  - **merge** is the default, with a rule per array (T26/F12, tabulated below): `milestones`
    union by `uid` with newest `at` winning; `skills` merged field by field; `orphans` by
    `reason` specificity; and the cross-array milestone-beats-orphan rule;
  - **replace all** exists behind an explicit confirmation;
  - an invalid file is **rejected whole, never partially applied**, reporting which field
    failed;
  - an unknown `schemaVersion` **newer than the app** is refused with a message saying the
    file came from a newer version (§16.3).
- Migrating older `schemaVersion` values forward through the chain (§5.10) before merging.
- Populating `ImportReport` — now declared in §14.5 (T26/F3): per-array added/updated
  counts, the incoming `schemaVersion` and whether it was migrated, and
  `grandfatheredLevelsReplaced` for §12.6's earliest-version-wins merge, plus
  `orphans.updated`, `droppedForLiveRecord` and `treesRewound` (T26/F12). Exported orphans
  carry `OrphanReason`, which has three members — `retired`, `merged`, `unknown` — the
  middle one being §12.5's partial-merge case, which the table produces and never names.
- Calling **`refreshProgressMirror()` from T09** after every successful `import` commit
  (T26/F23 — same helper T17 uses after migration passes).
- Recording `lastExportAt` in `META` on every successful export (§12.7 depends on it).
- **Reserving the unknown-`photo`-key tolerance now**: the export schema and the import
  reader must accept and round-trip an unrecognised `photo` key on a milestone without
  error, so phase 2 needs no export-format migration (§12.8, **R-06**).
- The `/data` page's export and import controls, and the orphan list §16.5 requires it to
  show.

**Out of scope**

- The `schema/export.schema.json` document itself — **T02**. This task consumes it; it does
  not author it.
- The IndexedDB stores, the write path, and the `writable` latch — **T09** (§12.2, §12.4).
  Import writes through the store this task does not own.
- Export **prompting** — when to nag, `navigator.storage.persist()`, quota thresholds —
  **T18** (§12.7). This task writes `lastExportAt`; T18 reads it.
- Lineage migration and orphan *creation* — **T17** (§12.5). This task exports and imports
  the `ORPHAN` store's contents; it never decides what belongs there.
- Photos in the export payload, and the ZIP form of `progress.json` plus `photos/<uid>.webp`
  — **Phase 2**, §12.8. Only the *tolerance* of the unknown key is in scope now.
- The `/data` page's storage-status panel — **T18**.
- Any network transfer of the file. N2 forbids user data leaving the device by any path the
  app controls; export is a local download and import is a local file read.

## Deliverables

```
app/src/lib/state/export.ts             export() — assembles the §12.6 ExportFile
app/src/lib/state/import.ts             import() — validate, migrate, merge or replace
app/src/lib/state/export-types.ts       ExportFile, ImportReport
app/src/lib/state/migrate-export.ts     schemaVersion chain, §5.10
app/src/routes/data/+page.svelte        export button, import picker, orphan list
app/src/lib/state/export.test.ts        round-trip, ordering, lastExportAt
app/src/lib/state/import.test.ts        merge, replace, rejection, version refusal
app/src/lib/state/fixtures/export/      valid, invalid-field, newer-version,
                                        prior-version, unknown-photo-key
```

## Interface contract

The methods, verbatim from ARCHITECTURE §14.5:

```ts
export(): Promise<ExportFile>;
import(file: ExportFile, mode: 'merge' | 'replace'): Promise<ImportReport>;
```

The file format, verbatim from ARCHITECTURE §12.6:

```jsonc
{
  "format": "life-xp-skill-tracker/progress",
  "schemaVersion": 1,
  "exportedAt": "2026-08-04T11:03:00Z",
  "appVersion": "1.4.2",
  "generated": "2026-09-14T00:00:00Z",
  "skills": [
    { "treeId": "blacksmithing", "startedAt": "2026-05-01T…",
      "attainedLevel": 3, "lastActivityAt": "2026-08-04T…",
      "contentVersionSeen": 7 }
  ],
  "milestones": [
    { "uid": "k7m2qp9x", "treeId": "blacksmithing", "slug": "light-the-forge",
      "title": "Light a fire and bring stock to forging heat",
      "state": "complete", "at": "2026-05-01T09:14:00Z",
      "note": "First proper coal fire. Took three goes." }
  ],
  "orphans": []
}
```

The import rules, verbatim from §12.6:

> **Import** defaults to **merge**. The file has three arrays and each needs its own rule.
> **`milestones`**: union by `uid`, newest `at` wins on conflict. An explicit **replace
> all** option exists behind a confirmation for restoring a known-good backup. Import
> validates against the export schema and migrates older `schemaVersion` values through the
> chain (§5.10) before merging; an unreadable file is rejected whole, never partially
> applied.

**`skills` — union by `treeId`, merged field by field, verbatim from §12.6 (T26/F12):**

| Field | Rule | Why |
|---|---|---|
| `startedAt` | **earliest** wins | When you started is a historical fact. |
| `lastActivityAt` | **latest** wins; present beats absent | Forced by §11.7's `max` rollup and §14.4's exemption-free monotonicity. |
| `contentVersionSeen` | **minimum** wins | Forces §12.5's replay — see below. |
| `grandfathered` | per level, **earliest `contentVersion`** wins | Unchanged. |
| `attainedLevel` | **never merged** — from the side with the later `lastActivityAt` | Derived; a maximum would be a ratchet §11.10 forbids. |

**`orphans`** — union by `uid`, the more specific `reason` winning (`retired` and `merged`
both beat `unknown`), `at` breaking ties among equally specific reasons. `at` cannot be the
primary discriminator here as it is for milestones: §12.2 freezes it at completion time, so
two devices holding the same orphan normally carry an identical value.

**A uid that is a live `MILESTONE` on one side and an `ORPHAN` on the other resolves to the
milestone**, and the orphan row is dropped — counted as `droppedForLiveRecord`. Orphaning is
re-derivable from an append-only ledger; a discarded live record is not.

The §16.3 rows this task implements, verbatim:

| Failure | Behaviour |
|---|---|
| Import file invalid | Reject whole, never partially apply; report which field failed |
| Unknown `schemaVersion` on import, newer than the app | Refuse and say the file came from a newer version — do not guess |

The versioning rule, verbatim from §14.6:

| Contract | Consumer | Schema | Versioning |
|---|---|---|---|
| **Export file** | **users, forever** | `schema/export.schema.json` | `schemaVersion`, migrated on import, §12.6 |

> The export file is the only contract with a consumer the project cannot update, which is
> why §12.6 carries redundant human-readable fields and why the import path migrates rather
> than rejects.

Version support window, from §5.10: **the app supports reading the current version and one
prior**; older exports are migrated on import through the chain. Anything newer is refused.

## Acceptance criteria

- [x] A round-trip test: seed the store, `export()`, wipe the database, `import(file,
      'replace')`, and assert the resulting `SKILL`, `MILESTONE`, and `ORPHAN` contents are
      byte-identical to the seed — including `slug`, `title`, `at`, and `note`.
- [x] A test asserts the exported object validates against `schema/export.schema.json`
      under Ajv, and that `format` is exactly `"life-xp-skill-tracker/progress"`.
- [x] A test asserts `export()` output is **deterministic** given identical store contents
      apart from `exportedAt` — records are emitted in a stable order (by `treeId` then
      `uid`), so two exports diff cleanly.
- [x] A test asserts `export()` writes `lastExportAt` into `META` and that the value is
      readable through `storageStatus()`.
- [x] Merge, newest wins: import a file whose record for `k7m2qp9x` has a later `at` than
      the stored one; assert the stored record is replaced. Repeat with an earlier `at`;
      assert the stored record survives.
- [x] Merge, union: import a file containing a uid absent from the store; assert it is
      added and that no stored uid absent from the file is removed.
- [x] Merge, `skills`: import a file whose skill row for `blacksmithing` has an **earlier**
      `startedAt`, a **later** `lastActivityAt`, and a **lower** `contentVersionSeen` than
      the stored one; assert all three fields move, and that `attainedLevel` is taken from
      the later-`lastActivityAt` side rather than maximised. Repeat with the file's
      `attainedLevel` **higher** but its `lastActivityAt` **earlier**, and assert the stored
      (lower) value survives — this is F12's ratchet regression test.
- [x] Merge, absent `lastActivityAt`: a side with the field present beats a side without it,
      regardless of the other fields.
- [x] Merge, `orphans`: import an orphan whose `reason` is `unknown` over a stored one whose
      `reason` is `retired`, both with the same `at`; assert `retired` survives.
- [x] Merge, cross-array: import a file holding a uid as a live milestone that the store
      holds as an orphan; assert the milestone wins, the `ORPHAN` row is gone, and
      `ImportReport.orphans.droppedForLiveRecord` is 1.
- [x] Rewind: after any merge that lowered a `contentVersionSeen`, assert `treesRewound`
      counts it and the stored value is the minimum of the two sides.
- [x] Replace: assert `import(file, 'replace')` removes stored uids absent from the file,
      and that the `/data` page requires a confirmation step before calling it — verifiable
      by a component test that asserts `import` is not called on the first click.
- [x] Reject whole: import `fixtures/export/invalid-field` (one milestone with a
      non-enum `state`); assert `import` rejects, the returned/raised error names the
      failing field path, and **zero** records changed in IndexedDB.
- [x] Refuse newer: import `fixtures/export/newer-version` (`schemaVersion` current + 1);
      assert the rejection message states the file came from a newer version and that no
      migration was attempted.
- [x] Migrate prior: import `fixtures/export/prior-version`; assert it succeeds and the
      migrated records match the expected current-version shape.
- [x] Unknown-key tolerance: import `fixtures/export/unknown-photo-key` (a milestone
      carrying `"photo": "…"`); assert the import **succeeds**, the milestone is stored,
      and a subsequent `export()` still validates. This is the §12.8 reservation and must
      be present now (**R-06**).
- [x] A test asserts import rejects immediately when `store.writable === false` (§13.3,
      T09's latch) without touching IndexedDB.
- [x] A human-readability check, as a test over the round-trip fixture: every milestone
      entry in the exported JSON contains a non-empty `title`, and every entry with a note
      retains it verbatim. N7's second reader has no codebase.
- [x] `ExportFile` and `ImportReport` are declared in `export-types.ts` **matching §14.5
      exactly** (T26/F3 typed them there) and imported by `app/src/lib/state/store.ts`, and
      `npx tsc --noEmit` passes.
- [x] `/data` renders the orphan list (§16.5) and the current `contentVersion` and
      `appVersion`.

## Verification

```bash
npm run --workspace app test -- export import
npx tsc --noEmit
npm run --workspace app check
```

Plus the §16.2 manual item, which this task is the reason for: **per schema bump, import an
export produced by the previous version and confirm it migrates.** The
`fixtures/export/prior-version` file is what makes that check mechanical rather than
ceremonial — keep it, and add one per bump.

## Notes and hazards

- **T26 F20 (2026-08-05): the `grandfathered` merge can reintroduce a uid whose record is
  gone, and that is tolerated rather than fixed.** §12.5 now *consumes* a `split`
  predecessor and **moves** its frozen-set entry to the successors. Because this section
  merges `grandfathered` per level as a whole entry with the earliest `contentVersion`
  winning, an import from a device that never applied the split puts the predecessor uid back
  into a set whose record no longer exists, and §11.5's `.every` then fails — the level
  un-satisfies. It self-heals through the rewind this section already performs: the next open
  of that tree folds the split over the set again. **Do not "fix" it by unioning uids across
  the two sides or by pruning uids with no record** — the first defeats earliest-wins, the
  second cannot distinguish a consumed predecessor from a milestone the user un-checked. The
  right test asserts the round trip: import, assert the level is temporarily unsatisfied,
  open the tree, assert it is satisfied again.

- **T26 F23 (2026-08-05): `import` calls T09's `refreshProgressMirror()` on commit.** It
  rewrites `MILESTONE` rows wholesale; do not duplicate mirror logic locally.

- **T26 F8 (2026-08-05): the export file has no top-level `contentVersion`.** The global
  counter is gone (§7.2). §12.6's example now carries `generated`, copied from the manifest
  the export was taken against — archaeology for a human reader, never used by the import
  path. The per-tree versions that *are* comparable live inside `grandfathered`, and
  earliest-wins now compares two versions of the same tree, which is what makes it mean
  anything.

- **~~§12.6 defines the merge rule for milestones only.~~ RESOLVED by T26/F12, 2026-08-05,
  and this note's guess was right on two fields and wrong on a third.** Earliest `startedAt`
  and latest `lastActivityAt` were adopted. `attainedLevel` "overwritten and then reconciled"
  was too loose: overwritten *by which side* is the whole question, and the answer is the one
  with the later `lastActivityAt`. Taking a maximum — the other obvious reading of
  "overwritten" — is a ratchet §11.10 forbids and is concretely wrong when one device
  dismissed what the other completed. The `orphans` rule was wrong outright: `at` is frozen
  at completion time (§12.2), so it ties on exactly the conflicts it would have to settle,
  and `reason` specificity decides instead. See `docs/SPEC-FINDINGS.md` F12.
- **`contentVersionSeen` is now in the export, and merging it as a minimum is load-bearing —
  T26/F12.** Without it a merge from a device two releases behind delivers pre-migration
  records into a store whose counter is already current, and §12.5's `>` guard means the pass
  **never runs again**: a milestone retired two releases ago arrives live, scores nothing,
  and never surfaces as an orphan explaining itself. Minimum-wins rewinds the skill so T17's
  pass replays on next open. Do **not** implement the milestone-beats-orphan rule without
  this — together they resurrect a retirement; separately, one of them fixes the other.
- **`attainedLevel` in the export is a snapshot, not a source of truth.** §12.3 makes it a
  denormalization reconciled on tree open. An import that copies it is fine and expected;
  the value self-corrects the first time the tree is opened (**R-17**). Do not attempt to
  recompute it at import time — the tree bundles are not loaded and fetching them would
  defeat N4 — and do not compute it *arithmetically* from the two sides either.
- **`appVersion` and `contentVersion` in the export are for archaeology, not for logic.**
  §16.1 says the app semver is "human-facing; recorded in exports for support and
  archaeology." Do not branch import behaviour on either; only `schemaVersion` gates.
- **Never let a read failure become a write** (§16.3's recurring rule). Every branch of
  import must either apply the whole file or write nothing. Validate first, migrate second,
  and open the IndexedDB transaction only once both have succeeded.
- **R-06 — photos change this format.** Phase 2 turns the export into a ZIP of
  `progress.json` plus `photos/<uid>.webp` so the JSON stays readable and the images stay
  openable. The unknown-key tolerance reserved here is what keeps that from being a
  breaking `schemaVersion` bump. Do not add strict `additionalProperties: false` on the
  milestone object in the export schema — that would defeat the reservation. (Note this
  cuts the opposite way from `tree.schema.json`, where §5.8 makes
  `additionalProperties: false` load-bearing. The two schemas have different jobs.)
- The export file is a `/data`-page download. There is no cloud sync, no share target, and
  no upload endpoint — N2, and §16.5's "no telemetry of any kind".


## T26 amendments — 2026-08-06

**F19.** `ExportFile.skills[].lastActivityAt` is **required**, not optional — §12.2's
watermark is total now that `startSkill` seeds it. §12.6's merge rule stays "latest wins;
present beats absent", but *never now*: an import is not activity in the skill. "Present
beats absent" survives only as a tolerance for files written before the field became
required, which §5.10's migration path fills in.

**F22.** `ImportReport` gains `skillsWithNoManifestEntry: number`. Once §6.4's check 8 is in
place, an import is the **only** way a `SKILL` row can exist for a tree this library does
not have — an export from a fork or a newer library — so the import is where it must be
reported, on §14.5's stated principle that a consequence the user could not otherwise
observe gets a counter. Such rows are **retained, never deleted**; they are excluded from
scoring (T14's join) and listed on `/data` beside the orphan list (§16.5). Needs a
round-trip fixture: an export naming a tree absent from the manifest imports cleanly,
reports the count, and loses nothing.

**F15 — `MILESTONE.contentVersion` is required in `ExportFile`, not optional.** §12.2 typed
it required while §14.5 typed it optional and §12.6's example omitted it, so a round trip
could drop a required field with no stated default. It is **provenance, not an input** —
nothing branches on it — and it is always available at write time, so nothing forces the
optional. The merge rule is now explicit: the whole record travels together, since `slug`,
`title`, `note` and `contentVersion` are all provenance of the completion the winning `at`
identifies. Mixing fields across the two sides would describe a completion that never
happened.

## Implementation notes — 2026-08-14

```
app/src/lib/state/export-types.ts        format constants, the version window, ORPHAN_SPECIFICITY
app/src/lib/state/validate-export.ts     the client's own check, with field paths
app/src/lib/state/migrate-export.ts      §5.10's chain + the F19/F15 backfill + §12.2 normalization
app/src/lib/state/export.ts              buildExportFile, serializeExportFile, exportFileName
app/src/lib/state/import.ts              planImport — the three merge rules, pure
app/src/lib/state/store.ts               export()/import()/recordManifest(), one transaction each
app/src/lib/version.ts                   §16.1's app semver
app/src/routes/data/+page.svelte         export, import, replace confirmation, orphan list
app/src/lib/state/fixtures/export/*.json valid, invalid-field, newer-version, prior-version,
                                         unknown-photo-key
app/src/lib/state/fixtures/schema.ts     the real schema under Ajv — tests only
```

### Seven decisions this document did not make

- **The app still does not ship a validator.** §7.3 refuses Ajv in the client over §17.1's
  82 kB budget, and an import is exactly the case where a check is not optional — so
  `validate-export.ts` is the narrow hand-written form, and `import.test.ts` runs the real
  `export.schema.json` under Ajv over a twenty-mutation corpus so the two cannot drift.
  A build check asserts no non-test module imports Ajv, and the built bundle contains none.
- **`prior-version` means the pre-F19/F15 shape, not `schemaVersion: 0`.** The schema puts
  `minimum: 1` on `schemaVersion`, so there is no version 0 to migrate from and nothing has
  ever shipped below 1. What T26/F19 and T26/F15 actually describe is a file written before
  two fields became required, and §5.10's "migration path fills them in" is the backfill in
  `migrate-export.ts`. The chain registry is present and empty, so the next real bump has a
  home and a test that already checks the window is covered.
- **Timestamps are normalized on the way in, not rejected.** `_BREAKDOWN.yaml` anticipated
  §11.7's fixed-precision assertion arriving "as an import diagnostic". Refusing a readable
  instant over its formatting would be refusing someone's backup to protect a string
  comparison, so the ingest rewrites every timestamp to §12.2's `.sssZ` form instead. The
  `prior-version` fixture carries a second-precision stamp so this is covered.
- **`generated` and the manifest's tree ids arrive through `recordManifest`.** §14.5 gives
  `export()` no arguments and §14.1 forbids `lib/state` from reading a manifest, so the two
  facts the export path needs are injected at cold start — the same shape as `openTree`.
  With no manifest ever read, `generated` is the epoch rather than `exportedAt`: an obvious
  absence beats a plausible lie in a file whose reader has no codebase.
- **`ExportFile` and `ImportReport` stay declared in `$lib/types`.** T26/F3 typed them into
  §14.5 and `ExportFile` is *generated* from `export.schema.json`, so re-declaring them in
  `export-types.ts` would have been a second source of truth for the one contract the
  project can never update. That module re-exports them and owns everything else about the
  format.
- **`/data` shows the manifest's `generated`, not a "current `contentVersion`".** T26/F8
  removed the library-wide counter (§7.2, §16.1) after this criterion was written; the
  `generated` stamp is what §16.1 says covers that job, and it is the value every export
  carries.
- **`TreeSession`-style serialization was not needed here** — `import` is one transaction
  for the whole file, which is also how "reject whole, never partially apply" survives a
  mid-write failure rather than only a mid-validation one.

### Smaller things worth knowing

- **`export()` reads all four stores in one readonly transaction.** A `SKILL` row read
  before a concurrent write and its `MILESTONE` rows read after it would export an
  `attainedLevel` disagreeing with the records it summarizes.
- **`lastExportAt` is skipped in a read-only session** (§13.3) and the file is still
  produced. Nothing may write when hydration failed, and refusing to hand someone a backup
  because the app could not record that it had done so would be the wrong way round.
- **The T26/F20 test asserts the half that exists.** The reintroduced uid and the rewind
  that makes it temporary are both checked; "open the tree and it is satisfied again" is
  `applyLineage`, which is T17's. The test says so.
- **`role="alert"` is banned app-wide** by `TreeView.a11y.test.ts` — §15.2 allows one polite
  region and no interrupting one — so the import and export errors are `role="status"`.
- **The equivalence corpus has a vacuity guard**, since a comparison test where both sides
  always accept passes silently.

### Out-of-scope items confirmed still out

`export.schema.json` itself (T02), the write path and the latch (T09), export *prompting*
and the quota panel (T18, which reads the `lastExportAt` written here), lineage migration
and orphan *creation* (T17 — this task exports and imports the `ORPHAN` store's contents and
never decides what belongs there), photos and the ZIP form (phase 2, §12.8 — only the
unknown-key tolerance is here), and any network transfer at all (N2).
