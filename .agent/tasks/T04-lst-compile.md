# T04 — `lst compile` — manifest and hashed bundles

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | cli-toolchain |
| **Blocked by** | T02, T03 |
| **Blocks** | T07 |
| **Spec** | ARCHITECTURE §7.1, §7.2, §7.3, §4.3 |
| **PRD** | N4 |

## Goal

`tools/src/compile/` exists and is wired into the `lst` CLI as `lst compile`, the build
step §6.1 marks as a gate. It reads already-validated tree and taxonomy YAML from
`content/` and writes `app/static/content/manifest.json` plus one content-hashed JSON
bundle per tree under `app/static/content/trees/`, applying every transformation in
§7.3's table. After this task, `npm run build` (T01's root script,
`compile --workspace tools && build --workspace app`) produces real artifacts the
(not-yet-built) Content Loader can fetch, and those artifacts are provably free of any
value the runtime would otherwise have to default, infer, or fall back on.

## Why this shape

N4 sets the problem — the library grows without bound but first paint must not — and
§7.1 states the solution plainly: "a small mutable index pointing at large immutable
chunks." That is why compilation produces two kinds of file with two different caching
regimes rather than one bundle: the manifest is small, mutable, and revalidated; each tree
bundle is large, named by its own content hash, and cacheable forever, which is what turns
the GitHub Pages caching problem of §4.4 into a non-problem — there is no cache-header
negotiation to get right because staleness can only ever occur in the one small file.

The governing rule of §7.3 is **the compiled bundle contains no implicit values** — every
default materialized, every `any` normalized to `n_of: n: 1`, every `order` and `track`
resolved to an explicit value, every slug reference resolved to an index with the slug
retained. This is not tidiness; it is what lets the Layout Engine (T06) and Scoring Engine
(T11) be **total functions with no fallback branches**, which is in turn what makes them
cheap to test exhaustively. A compiler that leaves any transformation for the runtime to
redo puts a conditional inside a component that the architecture has deliberately kept
pure and total. This task is bounded tightly by that same logic: compile assumes its input
already passed `lst validate` (T03) — it is a transformer, not a second validator.

## Scope

**In scope**

- `lst compile` subcommand, reading `content/trees/*.yaml` and `content/taxonomy/*.yaml`.
- Manifest generation matching §7.2's shape exactly: `schemaVersion`, `contentVersion`,
  `generated`, `taxonomy.{domains,facets,map}`, the per-tree `trees[]` array — deliberately
  excluding milestones — and the library-wide **`moved`** map (T26/F13), collected by
  scanning every tree's `lineage` for `op: moved` and parsing the `<treeId>/<uid>` target.
  It is the one milestone-level fact the manifest carries, because a `moved` disposition is
  unreachable from the tree that records it (§7.2).
- Per-tree bundle generation: one JSON file per tree under `app/static/content/trees/`,
  filename carrying a content hash (§7.1).
- All nine transformations in §7.3's table, applied to every compiled tree.
- Writing output into `app/static/content/`, which T01 already gitignores as a build
  artifact (§4.3: "Compiled JSON is not committed").
- Comment stripping (YAML comments are for authors, not the runtime — §7.3's last row).

**Out of scope**

- Validation of any kind — T03. `lst compile` does not re-check the 15 semantic rules or
  the JSON Schema; it assumes clean input and its behaviour on invalid input is undefined
  by this task (a reasonable implementation errors loudly, but that is not what this task
  is graded on).
- The Content Loader, fetch/cache behaviour, service worker, and the §7.5 shape-assertion
  performed *on parse* — all T07. This task produces the bytes; T07 consumes them.
- Hex-region unioning into `taxonomy.map`'s domain paths (§10.3, §10.4, **D-08**) — T12.
  See hazards below for the phase-0/phase-1 ordering this creates.
- The content migration script for a schema bump (§5.10) — not this task, and not
  expected until T10's scheduled breaking-bump window.
- Manifest sharding at ~500 trees (**R-05**) — explicitly "not built now" per §7.2.
- `lst lint`, `lst status`, `lst new` — T22. `lst baseline` — T23.

## Deliverables

```
tools/src/compile/index.ts         orchestrates manifest + bundle generation
tools/src/compile/manifest.ts      §7.2 manifest assembly
tools/src/compile/bundle.ts        per-tree §7.3 transformations
tools/src/compile/hash.ts          content-hash filename helper
tools/src/compile/index.test.ts
tools/test/fixtures/compile/       one fixture tree exercising every §7.3 transformation
```

`app/static/content/manifest.json` and `app/static/content/trees/*.json` are the
**output** of running `lst compile` — they are build artifacts, not source deliverables,
and are gitignored per T01.

## Interface contract

The artifact layout, copied verbatim from §7.1:

```
app/static/content/
├── manifest.json                    # mutable, revalidated, small
└── trees/
    ├── blacksmithing.a7f3c091.json  # immutable, cache-forever
    ├── cooking.4b2e88d1.json
    └── …
```

> Tree bundles carry a content hash in the filename, so a bundle URL always names exactly
> one version of the content and may be cached permanently. The manifest maps tree id to
> current filename and is the only file that ever needs revalidating. (§7.1)

The manifest shape, copied verbatim from §7.2:

```jsonc
{
  "schemaVersion": 1,
  "generated": "2026-09-14T00:00:00Z",   // build stamp for humans; NOT comparable
  "taxonomy": {
    "domains": [ /* domains.yaml, compiled */ ],
    "facets":  [ /* facets.yaml, compiled */ ],
    "map":     { /* unioned region paths — §10.3 */ }
  },
  "trees": [
    {
      "id": "blacksmithing",
      "contentVersion": 4,      // this tree's own version — §5.3, the §12.5 trigger
      "title": "Blacksmithing",
      "summary": "Shaping hot metal by hand …",
      "domain": "making",
      "secondaryDomains": ["home"],
      "subregion": "objects",
      "facets": ["physical", "workshop", "heat", "tool-making"],
      "archetype": "dual-track",
      "milestoneCount": 62,
      "authors": ["A. Contributor"],
      "bundle": "trees/blacksmithing.a7f3c091.json"
    }
  ],
  "moved": {
    "c5fj92tk": "bladesmithing"    // every `op: moved` in the library — §12.5, T26/F13
  }
}
```

> The manifest deliberately excludes milestones. A tree's milestones are the bulk of its
> bytes and are needed only when the tree is opened. (§7.2)

The transformation table, copied verbatim from §7.3 — this is the heart of the task:

| Transformation | Why |
|---|---|
| YAML → JSON | No YAML parser in the app bundle |
| `any` → `n_of` with `n: 1` | The Scoring Engine handles two rule kinds, not three (§5.6) |
| Absent `requirements` → explicit `all` group | The engine never implements a default |
| `order` defaults resolved to explicit integers from file position | The Layout Engine never reads file order (§8.2) |
| `track` defaults resolved to the first declared track | Same |
| Slug references resolved to array indices, slugs retained | Fast lookup without a runtime map build |
| `detail` prose retained verbatim | It is the content |
| `lineage` retained, **in file order** | The runtime migration folds it in that order (§12.5, §5.5) |
| Every `op: moved` collected into the manifest's `moved` map | The disposition is unreachable from the tree that records it (§7.2) |
| Comments stripped | They are for authors |

> The rule: **the compiled bundle contains no implicit values.** Every default is
> materialized. This is what allows the Layout and Scoring engines to be total functions
> with no fallback branches, which is in turn what makes them cheap to test exhaustively.
> (§7.3)

The `lst` table row this task owns, copied verbatim from §6.1:

| Command | Purpose | Gates? |
|---|---|---|
| `lst compile` | YAML → JSON bundles + manifest (§7) | **yes** (build step) |

## Acceptance criteria

- [ ] Each of the nine §7.3 transformation rows has a dedicated fixture-backed test
      proving the specific before/after change.
- [ ] A compiled bundle contains **zero** occurrences of an `any` rule kind — grep the
      compiled JSON fixture output for the literal string and assert no match.
- [ ] A compiled bundle for a tree that authored no `requirements:` on a level contains an
      explicit `all` group for that level.
- [ ] Every milestone in a compiled bundle has an explicit integer `order`, even when the
      source omitted it — verified against a fixture where two milestones in the same
      (level, track) rely on file-order default.
- [ ] Every milestone in a compiled bundle has an explicit `track`, even when the source
      tree declared no `tracks:` at all (single-track default).
- [ ] `requires` and requirement-group `milestones` entries resolve to array indices in
      the compiled bundle while the original slug is still present alongside the index.
- [ ] `manifest.json` contains no `milestones` key anywhere under `trees[]`.
- [ ] A fixture with a `moved` entry in one tree produces a `manifest.moved` entry mapping
      that uid to the **destination** tree id, parsed out of the `<treeId>/<uid>` target;
      trees with no `moved` entries contribute nothing and the key is `{}` rather than
      absent. (T26/F21 — the target grammar is not yet validated anywhere; fail loudly on a
      malformed one rather than emitting a broken map.)
- [ ] A bundle's `lineage` array is byte-order-identical to the authored file's. T26/F14
      makes ledger order load-bearing for the runtime migration, so any sort, re-key, or
      map round-trip in the compiler is a correctness bug, not a style one.
- [ ] Compiling the same unchanged tree twice in a row produces byte-identical bundle
      files (deterministic; no unstamped randomness or wall-clock value leaks into the
      hashed content).
- [ ] Changing one field in a source tree changes that tree's bundle filename hash and
      leaves every other tree's bundle filename unchanged.
- [ ] Compiled bundle YAML comments are absent from the output.
- [ ] `npm run compile --workspace tools` (T01's root `build` script's first half)
      populates `app/static/content/manifest.json` and one bundle per tree in
      `content/trees/`.

## Verification

```bash
npm run --workspace tools test
npm run compile --workspace tools
ls app/static/content/trees
node -e "const m = require('./app/static/content/manifest.json'); console.log(m.trees.every(t => !('milestones' in t)))"
```

Passing looks like: all nine transformation tests green, the manifest excludes
milestones, and re-running compile with no content changes produces no diff in
`app/static/content/`.

## Notes and hazards

- **T26 resolutions landing here (2026-08-05).** **F8:** the manifest no longer carries a
  global `contentVersion`; each tree entry carries its own (§7.2), copied from the authored
  value, and `generated` is a human-facing build stamp that must never be used as a cache
  key or migration trigger. `contentVersion` is retained verbatim into the bundle (§7.3's
  table). **F9:** this task owns `schema/compiled-tree.schema.json` and
  `schema/manifest.schema.json`, and `lst compile` **validates its own output against them
  and fails the build on mismatch**. They are build-time and codegen artifacts only — the
  app ships no validator (§7.5).

- **`contentVersion`'s source is not specified.** §16.1 says it "increments on every
  merge touching `content/`," but no mechanism is named for how `lst compile` — which runs
  as a build step, not a merge hook — knows what number to write. A monotonic counter
  derived from git history (e.g. commit count touching `content/`) is a reasonable
  inference but is not stated in the architecture; implement something explicit and
  testable rather than guessing silently, and flag the choice in the PR.
- **`taxonomy.map` cannot be fully populated by this task.** The manifest shape requires
  a `taxonomy.map` key holding unioned region paths, but the hex-tessellation and
  region-union logic (§10.3, §10.4, **D-08**) belongs to T12, which is a **phase 1** task
  blocked by T10 — it does not exist yet when this **phase 0** task runs. This task must
  emit whatever shape T02's `map.schema.json` establishes (structure only, no real
  geometry) so the manifest is well-formed; T12 is what makes the field's *content*
  correct. This ordering gap is inherent to the phase 0/phase 1 split in `_BREAKDOWN.yaml`
  and is not a mistake to fix here.
- **`tools/` cannot import `app/`'s hand-written `compiled.ts` types** — T01's forbidden
  edges (`tools/ → app/` is FORBIDDEN) mean the JSON this task emits and the
  `CompiledTree`/`Manifest` TypeScript shapes T02 wrote by hand can drift with no compiler
  catching it. Keep them in parity with fixture-based tests that assert the emitted JSON's
  keys and shapes match what T02 documented, rather than relying on a shared import to
  enforce it structurally.
- The `yaml` package (T01's declared `tools/` dependency) must be used in a mode that
  preserves document order — the `order` and `track` file-position defaults in §7.3 are
  only correct if the parser gives compile the milestones in the order they were written.
- §7.5's content-hash purpose is explicitly **not** a security control — "there is no
  threat model in which an attacker who controls the origin is stopped by a hash the
  origin also serves." Any collision-resistant hash used for cache-busting is sufficient;
  do not over-engineer this into an integrity mechanism.
