# T16 — Export and import

| Field | Value |
|---|---|
| **Status** | pending |
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
  contents into the §12.6 shape, and defining the `ExportFile` type §14.5 names but never
  declares.
- Serialization to a downloadable file and a file-picker read on the `/data` route (§13.1).
- Validation of every imported file against `schema/export.schema.json` (authored in T02)
  **before any write**.
- `import(file, mode: 'merge' | 'replace')`:
  - **merge** is the default — union by `uid`, newest `at` wins on conflict;
  - **replace all** exists behind an explicit confirmation;
  - an invalid file is **rejected whole, never partially applied**, reporting which field
    failed;
  - an unknown `schemaVersion` **newer than the app** is refused with a message saying the
    file came from a newer version (§16.3).
- Migrating older `schemaVersion` values forward through the chain (§5.10) before merging.
- Defining `ImportReport` — the return type §14.5 names and never declares.
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
      "attainedLevel": 3, "lastActivityAt": "2026-08-04T…" }
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

> **Import** defaults to **merge**: union by `uid`, newest `at` wins on conflict. That is
> what makes the two-device flow F38 implies actually work. An explicit **replace all**
> option exists behind a confirmation for restoring a known-good backup. Import validates
> against the export schema and migrates older `schemaVersion` values through the chain
> (§5.10) before merging; an unreadable file is rejected whole, never partially applied.

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

- [ ] A round-trip test: seed the store, `export()`, wipe the database, `import(file,
      'replace')`, and assert the resulting `SKILL`, `MILESTONE`, and `ORPHAN` contents are
      byte-identical to the seed — including `slug`, `title`, `at`, and `note`.
- [ ] A test asserts the exported object validates against `schema/export.schema.json`
      under Ajv, and that `format` is exactly `"life-xp-skill-tracker/progress"`.
- [ ] A test asserts `export()` output is **deterministic** given identical store contents
      apart from `exportedAt` — records are emitted in a stable order (by `treeId` then
      `uid`), so two exports diff cleanly.
- [ ] A test asserts `export()` writes `lastExportAt` into `META` and that the value is
      readable through `storageStatus()`.
- [ ] Merge, newest wins: import a file whose record for `k7m2qp9x` has a later `at` than
      the stored one; assert the stored record is replaced. Repeat with an earlier `at`;
      assert the stored record survives.
- [ ] Merge, union: import a file containing a uid absent from the store; assert it is
      added and that no stored uid absent from the file is removed.
- [ ] Replace: assert `import(file, 'replace')` removes stored uids absent from the file,
      and that the `/data` page requires a confirmation step before calling it — verifiable
      by a component test that asserts `import` is not called on the first click.
- [ ] Reject whole: import `fixtures/export/invalid-field` (one milestone with a
      non-enum `state`); assert `import` rejects, the returned/raised error names the
      failing field path, and **zero** records changed in IndexedDB.
- [ ] Refuse newer: import `fixtures/export/newer-version` (`schemaVersion` current + 1);
      assert the rejection message states the file came from a newer version and that no
      migration was attempted.
- [ ] Migrate prior: import `fixtures/export/prior-version`; assert it succeeds and the
      migrated records match the expected current-version shape.
- [ ] Unknown-key tolerance: import `fixtures/export/unknown-photo-key` (a milestone
      carrying `"photo": "…"`); assert the import **succeeds**, the milestone is stored,
      and a subsequent `export()` still validates. This is the §12.8 reservation and must
      be present now (**R-06**).
- [ ] A test asserts import rejects immediately when `store.writable === false` (§13.3,
      T09's latch) without touching IndexedDB.
- [ ] A human-readability check, as a test over the round-trip fixture: every milestone
      entry in the exported JSON contains a non-empty `title`, and every entry with a note
      retains it verbatim. N7's second reader has no codebase.
- [ ] `ExportFile` and `ImportReport` are declared in `export-types.ts` and imported by
      `app/src/lib/state/store.ts` — the §14.5 signatures no longer reference undefined
      types, and `npx tsc --noEmit` passes.
- [ ] `/data` renders the orphan list (§16.5) and the current `contentVersion` and
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

- **T26 F8 (2026-08-05): the export file has no top-level `contentVersion`.** The global
  counter is gone (§7.2). §12.6's example now carries `generated`, copied from the manifest
  the export was taken against — archaeology for a human reader, never used by the import
  path. The per-tree versions that *are* comparable live inside `grandfathered`, and
  earliest-wins now compares two versions of the same tree, which is what makes it mean
  anything.

- **§12.6 defines the merge rule for milestones only.** "Union by `uid`, newest `at` wins"
  has no analogue for `skills` (which have `startedAt` and `lastActivityAt`, not `at`) or
  for `orphans`. The architecture is silent. The behaviour an implementer needs, and which
  this task should adopt while recording that the spec does not state it: for `skills`, take
  the earlier `startedAt` and the later `lastActivityAt`, and let `attainedLevel` be
  overwritten and then reconciled on tree open (§12.3) rather than merged arithmetically;
  for `orphans`, union by `uid` with newest `at` winning, as for milestones. Flag this in
  the PR so it can be ratified into the spec rather than inherited by accident.
- **`attainedLevel` in the export is a snapshot, not a source of truth.** §12.3 makes it a
  denormalization reconciled on tree open. An import that trusts it is fine and expected;
  the value self-corrects the first time the tree is opened (**R-17**). Do not attempt to
  recompute it at import time — the tree bundles are not loaded and fetching them would
  defeat N4.
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
