# T02 — Schema v1 and generated types

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | substrate-schema |
| **Blocked by** | T01 |
| **Blocks** | T03, T04, T06, T09, T11a |
| **Spec** | ARCHITECTURE §5 (normative), §14.6, §4.2 |
| **PRD** | F5, F7, F8, F14, F18, F19, F26, D8, D10, D11, D13 |

## Goal

`schema/` holds five JSON Schema documents that between them define every authored
artifact in the project — trees, the three taxonomy files, and the user export format —
and `app/src/lib/types/` holds TypeScript types generated from them plus the hand-written
compiled-bundle types. After this task, a tree YAML file can be checked against a
machine-readable contract, and both workspaces derive their understanding of content
shape from the same source. Nothing yet reads or enforces these files; that is T03.

## Why this shape

ARCHITECTURE §5 is normative prose and `schema/tree.schema.json` is generated from it —
where the two disagree, the section is the intent and the schema is the bug. Keeping
`schema/` as the only directory both workspaces import (§4.2) is what makes it impossible
for the validator and the renderer to drift: a schema change breaks them together, in CI,
loudly. `additionalProperties: false` is load-bearing rather than stylistic — it is the
structural mechanism enforcing §5.8's ban on any XP, points, weight, or difficulty field,
so a contributor cannot introduce effort-weighting by experiment.

## Scope

**In scope**

- `tree.schema.json` covering the full §5.2 entity model and the §5.3 field reference.
- `domains.schema.json`, `facets.schema.json`, `map.schema.json` per §5.9.
- `export.schema.json` per §12.6 — authored now because §14.6 names it the one contract
  with a consumer the project can never update.
- Generated TypeScript for authored shapes, plus hand-written `CompiledTree` / `Manifest`
  types for the post-§7.3 shape.
- Seed `content/taxonomy/domains.yaml` with the eight locked domains, including Making's
  three subregions (Expression / Objects / Systems).
- Seed `content/taxonomy/facets.yaml` with only the facets exemplar tree #1 needs.
- `npm run gen:types` wired into the root workspace.

**Out of scope**

- Any validation logic, Ajv wiring, or the 15 semantic rules — T03. This task ships the
  contract, not the enforcement.
- `content/taxonomy/map.yaml` and its hex geometry — T12.
- The full facet vocabulary. §5.9 defers it to PRD **D12**; the schema only requires that
  a tree's facets exist in the file, so seeding minimally is correct and the file grows by
  maintainer PR.
- The content migration script of §5.10 — not needed until the first bump, which T10
  expects to be where it lands.

## Deliverables

```
schema/tree.schema.json          the normative tree contract
schema/domains.schema.json       §5.9 domains.yaml
schema/facets.schema.json        §5.9 facets.yaml
schema/map.schema.json           §5.9 / §10.3 map.yaml — shape only, geometry is T12
schema/export.schema.json        §12.6 export file, schemaVersion 1
content/taxonomy/domains.yaml    eight domains, Making carrying three subregions
content/taxonomy/facets.yaml     minimal seed vocabulary
app/src/lib/types/authored.d.ts  GENERATED — do not edit
app/src/lib/types/compiled.ts    hand-written; the §7.3 post-compile shape
app/src/lib/types/index.ts       re-exports
tools/src/gen-types.ts           generation entry point
```

## Interface contract

Two type families, and the distinction between them is the part most likely to be got
wrong. **Authored** types mirror the YAML a contributor writes, where defaults are absent
and references are slugs. **Compiled** types mirror what §7.3 emits, where every default
is materialized and slug references are resolved to array indices with the slugs
retained. The Layout and Scoring engines consume only the compiled types.

Authored types are generated from `schema/*.json`. Compiled types are hand-written
because the compiled bundle is internal (§14.6) and has no schema of its own.

The compiled types must satisfy the consumers already fixed elsewhere in the spec:

```ts
// ARCHITECTURE §14.2 — Content Loader
loadManifest(): Promise<Manifest>;
loadTree(treeId: string): Promise<CompiledTree>;

// ARCHITECTURE §14.4 — Scoring Engine
export function scoreSkill(tree: CompiledTree, progress: TreeProgress): SkillProgress;
```

Structural requirements the tree schema must express (§5.3, §5.6, §6.2 layer 1):

- `levels` is exactly ten entries, `level: 1`–`10`, in order — F7.
- Each level carries 4–8 milestones — F8.
- `id` slug pattern `^[a-z0-9]+(-[a-z0-9]+)*$`; `uid` is 8 characters of Crockford
  base32 — §5.4.
- `uid` is optional in the schema. Authors write a complete draft with no uid lines at
  all (§5.4); absence is a CI failure in T03, not a schema violation here.
- `subregion` present iff `domain: making` — expressible as a JSON Schema conditional.
- `requirements[].rule` is `all` \| `n_of` \| `any`; `n_of` requires `n` — §5.6.
- `provenance.copyleftDerived` is required with **no default** — F45 makes the question
  unskippable.
- Mastery entries carry `id`, `uid`, `title`, `detail`, `requires` and nothing else — no
  level, track, order, or requirement group (§5.7).
- `additionalProperties: false` at every object level **in `tree.schema.json` and the
  three taxonomy schemas**.

**The export schema is the deliberate exception.** §12.8 reserves the export format's
tolerance of an unknown `photo` key on a milestone precisely so that phase 2 needs no
schema migration. `export.schema.json` must therefore **not** set
`additionalProperties: false` on the milestone object. This is the opposite of the tree
schema's rule and the difference is load-bearing in both directions: the tree schema is
closed to keep §5.8's ban on effort quantities structural, and the export schema is open
at that one point to keep §12.8's reservation real. Closing it is a silent phase-2 tax;
opening the tree schema defeats §5.8.

## Acceptance criteria

- [ ] All five schema files are valid JSON Schema and load without error under Ajv.
- [ ] `content/taxonomy/domains.yaml` validates, contains eight domains, and only
      `making` declares `subregions`.
- [ ] `content/taxonomy/facets.yaml` validates.
- [ ] A fixture tree exercising every §5.3 feature validates against `tree.schema.json`.
- [ ] A fixture tree with nine levels fails; with eleven fails; with levels out of order
      fails.
- [ ] A fixture level with three milestones fails; with nine fails.
- [ ] A fixture tree carrying an `xp:`, `points:`, `weight:`, or `difficulty:` field fails
      on `additionalProperties` — this is the §5.8 regression test and must be present.
- [ ] A tree with `domain: making` and no `subregion` fails; a tree with a non-Making
      domain that declares `subregion` fails.
- [ ] A mastery entry carrying `level:` or `track:` fails.
- [ ] `provenance` missing `copyleftDerived` fails.
- [ ] A tree with no `uid` lines at all **passes** the schema.
- [ ] An export file whose milestone carries an unknown `photo` key **validates** against
      `export.schema.json` — the §12.8 reservation, and the inverse of the test above.
- [ ] `MigrationReport`, `ImportReport`, and `ExportFile` (§14.5) are defined rather than
      stubbed as `unknown`; their shapes come from T26's F3 resolution.
- [ ] `npm run gen:types` regenerates `authored.d.ts` and produces no diff when run twice.
- [ ] `tsc --noEmit` passes across both workspaces with `strict: true`.
- [ ] `compiled.ts` defines `CompiledTree` and `Manifest` with the §7.3 transformations
      applied, and a comment on each field that differs from its authored counterpart.

## Verification

```bash
npm run gen:types && git diff --exit-code app/src/lib/types/authored.d.ts
npm run --workspace tools test          # schema fixture suite
npx tsc --noEmit
```

Passing looks like: no diff after regeneration, every fixture in the suite landing on its
expected verdict, and a clean typecheck.

## Notes and hazards

- **T26 resolutions landing here (2026-08-05).** **F8:** `tree.yaml` gains a required
  `contentVersion` integer (§5.3) — per-tree, authored, starting at 1. Add it to
  `tree.schema.json` and to the generated types. **F9:** `schema/compiled-tree.schema.json`
  and `schema/manifest.schema.json` now exist, and `CompiledTree` and `Manifest` are
  **generated from them**, not hand-written in `app/`. That removes this task's original
  reason for hand-maintaining those types across the §4.2 boundary the compiler cannot
  cross. **F16:** this task now blocks T11a as well as T03/T04/T06/T09.

- **R-14 — the schema is being fixed before any content exists.** Expect at least one
  breaking bump between phase 0 and phase 1; T10 is the scheduled window for it. Do not
  over-engineer for hypothetical future fields — a bump with one tree in the corpus is
  cheap, which is the entire reason phase 0 exists.
- **D-05, dual identifiers.** `id` is mutable and unique within the tree; `uid` is
  immutable and unique across the whole repository. Repository-wide uniqueness cannot be
  expressed in JSON Schema and is semantic rule 2 in T03 — do not attempt it here.
- **D-06, nesting over a `level` field.** Milestones sit under their level and carry no
  `level:` key. A schema that permits one reintroduces the disagreement the nesting exists
  to prevent.
- `any` is retained in the schema as distinct spelling from `n_of: 1` for authoring
  clarity (§5.6). The compiler normalizes it (§7.3), so `CompiledTree` has two rule kinds,
  not three. Getting this backwards puts a fallback branch in the Scoring Engine.
- §5.10's bump policy: a new optional field does not bump; a new required field, a removal,
  a retype, or a semantics change does, and ships a content migration in the same PR.
