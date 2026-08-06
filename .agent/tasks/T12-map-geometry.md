# T12 — Map geometry — map.yaml, axial maths, region union

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | content-gates |
| **Blocked by** | T03, T10 |
| **Blocks** | T13 |
| **Spec** | ARCHITECTURE §6.2, §10.3, §10.4 |
| **PRD** | F21, D-08, R-13 |

## Goal

`content/taxonomy/map.yaml` holds the authored hex-tile-to-domain assignment for all
eight domains, including Making's three subregions, and `tools/src/compile/` gains the
axial-coordinate maths and region-union algorithm that turn those tile lists into one SVG
path per domain, emitted into `manifest.json`'s `taxonomy.map` key. After this task, the
manifest's `taxonomy.map` field — which T04 shipped as a schema-conformant placeholder
with no real geometry, because T12 did not exist yet in Phase 0 — carries actual unioned
region paths, and `lst compile` fails when the authored geometry violates any of §10.3's
CI-checked invariants: every domain has a region, no tile is claimed twice, every region
is contiguous, subregion tiles partition their parent's tiles exactly, and subregions
appear only under `making`.

## Why this shape

**D-08** is the decision this task implements: authors place hex tiles, the compiler
unions them into one path per domain at build time, and the hex grid has no runtime
existence. The alternative the architecture explicitly rejects — rendering individual
hexagons and colouring them by domain — gives every region a visible internal honeycomb,
N hit targets instead of one, N elements to animate, and no silhouette; unioning cuts the
runtime element count from several hundred to eight and gives each domain the Lynch-
districts silhouette F21 asks for. The hex grid survives only as an authoring
convenience — a human can specify an irregular blob without drawing bézier curves, and
tessellation without gaps or overlaps is guaranteed by construction — and the maths
(§10.2) runs entirely in the compiler, costing zero runtime bytes.

**R-13 governs how this task should be worked, not just what it produces.** Hand-writing
`tiles: [[0,0],[1,0],…]` for eight irregular regions is, in the architecture's own words,
"the least ergonomic authoring task in the project." It happens exactly once, it is
maintainer-only — it is not on the contributor path S2 measures — and if it proves
genuinely painful the accepted fallback is a **throwaway local grid-painting script**,
never a shipped feature. Do not build tooling beyond that fallback; a polished in-repo hex
editor would be scope creep against a task R-13 explicitly expects to be endured once.

## Scope

**In scope**

- `content/taxonomy/map.yaml`: `schemaVersion: 1`, `hexSize`, and one `regions` entry per
  domain in `content/taxonomy/domains.yaml` (T02 seeded eight), each with a `tiles` list
  in axial `(q, r)` coordinates, an optional `label` position, and — for `making` only —
  a `subregions` list whose `tiles` partition `making`'s own tile set exactly across
  `expression`, `objects`, and `systems`.
- `tools/src/compile/map.ts`: the axial-to-pixel conversion (§10.2) and the four-step
  region-union algorithm (§10.4) — expand tiles to corners on a shared vertex grid,
  discard edges appearing twice (interior), chain survivors into a closed loop, emit as
  an SVG path; compute centroid and bounding box per region.
- The §10.3 geometry invariants — **now §6.2's layer 2b rules M1–M5, owned by `lst
  validate` and implemented in T03's rules directory, not here** (T26/F17, 2026-08-05).
  This task authors the fixtures and the geometry they exercise; T03 owns the rule modules
  and the reporting. `map-validate.ts` moves out of `tools/src/compile/` accordingly, and
  this task gains T03 as a blocker. **M2 is stated over the multiset of every tile in every
  region**, not merely across domains: a tile listed twice inside one region has both copies
  of each of its six edges discarded by §10.4 step 2, so it vanishes from the outline with
  the path still closed and nothing reported.
- What stays in the compiler: §10.4's **hole warning only**. A region producing more than
  one closed loop emits both sub-paths and warns. That warning is now explicitly scoped to
  holes, because M3 rejects disconnection at validation first — a hole and a two-piece
  region both produce two loops, so loop count cannot discriminate and the compiler must
  not try (T26/F17).
- Replacing T04's placeholder `taxonomy.map` shape in the compiled manifest with real
  geometry — the manifest's structural shape (established by T02's `map.schema.json` and
  emitted empty-but-valid by T04) does not change; only its content becomes correct.
- `schema/map.schema.json` gains whatever additional shape constraints (if any) the
  authored `tiles` / `subregions` structure needs beyond what T02 already established —
  T02 scoped its `map.schema.json` as "shape only," deferring geometry semantics here.

**Out of scope**

- `content/taxonomy/domains.yaml` and `facets.yaml` — T02, already seeded.
- The Map Renderer that draws these paths, the fill/recency/breadth channels of §10.5,
  and subregion rendering as interior grouping lines (§10.6) — T13. T12 stops at emitting
  correct paths into the manifest; T13 consumes them.
- Navigation behaviour (§10.7) and the domain-list narrow-viewport fallback — T13.
- `lst compile`'s tree-bundle and manifest-scaffold logic in general (milestone
  transformation, `contentVersion`, artifact hashing) — T04, already built. This task
  extends the compiler with map-specific logic; it does not rebuild the rest of it.
- A shipped, general-purpose hex-tile authoring UI. R-13's accepted fallback, if the
  authoring step proves painful, is a throwaway local script — not a maintained tool, not
  a deliverable of this task, and not something later tasks should assume exists.
- Region **size** encoding anything quantitative. §10.3 states this as a hard rule: "A
  domain with more skills does not get more tiles, and the schema offers no way to
  express that it should." Region area is visual identity only; do not add a mechanism —
  authored or derived — that ties tile count to skill count, domain score, or any other
  quantity. That would also collide with NG9's ban on cross-domain comparability claims.

## Deliverables

```
content/taxonomy/map.yaml           authored hex geometry, all 8 domains + 3 Making subregions
tools/src/compile/map.ts            axial→pixel maths (§10.2) + region union (§10.4)
tools/src/compile/map.test.ts
tools/test/fixtures/map/            geometry fixtures for T03's M1–M5 rule modules
                                    (the rules themselves live in tools/src/validate/)
schema/map.schema.json              updated only if T02's shape-only version needs geometry-adjacent constraints
```

## Interface contract

The authored file shape, copied verbatim from §10.3:

```yaml
# content/taxonomy/map.yaml
schemaVersion: 1
hexSize: 40
regions:
  - domain: making
    tiles: [[0,0], [1,0], [2,0], [0,1], [1,1], [2,1], [1,2]]
    label: { q: 1, r: 1 }        # optional; defaults to centroid
    subregions:                   # Making only (F26)
      - id: expression
        tiles: [[0,0], [0,1]]
      - id: objects
        tiles: [[1,0], [1,1], [1,2]]
      - id: systems
        tiles: [[2,0], [2,1]]
  - domain: mind
    tiles: [[3,0], [4,0], [3,1]]
  …
```

> Validated by CI: every domain in `domains.yaml` has a region; no tile is claimed twice;
> each region is contiguous; subregion tiles partition their parent's tiles exactly;
> subregions appear only under `making`. (§10.3)

> **Region size does not encode anything.** A domain with more skills does not get more
> tiles, and the schema offers no way to express that it should. Region area is visual
> identity; the quantitative channels are fill, recency, and breadth (§10.5). (§10.3)

The coordinate system and conversion, copied verbatim from §10.2:

> Pointy-top hexagons in **axial coordinates** `(q, r)`, the standard scheme.
>
> ```
> x = size × √3 × (q + r/2)
> y = size × 3/2 × r
> ```
>
> with the six corner offsets at 30° + 60°·i. **No hex library.**

The compilation algorithm, copied verbatim from §10.4:

> For each region:
>
> 1. Expand every tile to its six corners, snapping to a shared vertex grid so that
>    adjacent hexes produce bit-identical corner coordinates.
> 2. Collect all edges; **discard every edge appearing twice** — those are interior.
> 3. Chain the survivors into a closed loop; emit as an SVG path `d`.
> 4. Compute the centroid for the label and the bounding box for hit-testing and zoom.
>
> Emitted into `manifest.taxonomy.map`, so the map renders from the manifest alone with
> no further fetch — which is what §3.3's cold-load sequence requires.
>
> A region with a hole (a domain drawn as a ring) would produce two loops. The compiler
> emits both as sub-paths and CI warns, because it is far more likely to be an authoring
> mistake than an intention.

The manifest target shape this task populates, copied verbatim from §7.2:

```jsonc
{
  "taxonomy": {
    "domains": [ /* domains.yaml, compiled */ ],
    "facets":  [ /* facets.yaml, compiled */ ],
    "map":     { /* unioned region paths — §10.3 */ }
  }
}
```

## Acceptance criteria

- [ ] `content/taxonomy/map.yaml` declares exactly one region per domain in
      `content/taxonomy/domains.yaml` (eight), and `making`'s region declares exactly
      three subregions: `expression`, `objects`, `systems`.
- [ ] A fixture where a domain from `domains.yaml` has no matching region in `map.yaml`
      fails **validation** (`lst validate`, rules M1–M5).
- [ ] A fixture where the same tile `(q, r)` appears in two different domains' `tiles`
      lists fails **validation** (`lst validate`, rules M1–M5).
- [ ] A fixture where a domain's tiles form two disconnected clusters (non-contiguous)
      fails **validation** (`lst validate`, rules M1–M5).
- [ ] A fixture where `making`'s subregion tiles omit one of `making`'s own tiles, or
      claim a tile `making` does not have, fails **validation** — the exact-partition check.
- [ ] A fixture declaring `subregions` under a non-`making` domain fails **validation** (`lst validate`, rules M1–M5).
- [ ] `tools/src/compile/map.ts`'s axial-to-pixel conversion matches §10.2's formula
      exactly for a hand-computed fixture set of `(q, r)` pairs.
- [ ] The region-union algorithm run against a fixture of 3+ adjacent tiles for one domain
      produces a single closed SVG path with no interior edges present in the `d`
      attribute — verified by parsing the emitted path and confirming edge count matches
      the expected exterior-only boundary.
- [ ] A fixture region shaped as a ring (a hole) passes M3 — a hole is contiguous — and
      emits two sub-paths with a compiler warning, not a hard failure. Asserting this
      alongside the disconnected-region failure above is what proves contiguity was
      computed by adjacency rather than inferred from a loop count (T26/F17).
- [ ] `npx lst compile` (T04) with this task's map compiler wired in produces a
      `manifest.json` whose `taxonomy.map` contains real path data (not T04's placeholder
      shape) for all eight domains.
- [ ] `schema/map.schema.json` still validates the authored `content/taxonomy/map.yaml`
      under Ajv.

## Verification

```bash
npm run --workspace tools test              # map.ts + map-validate.ts fixture suite
npx lst compile
node -e "const m = require('./app/static/content/manifest.json'); \
  console.log(Object.keys(m.taxonomy.map).length === 8)"
```

Passing looks like: every geometry-invariant fixture landing on its expected verdict, the
axial conversion matching the formula exactly, and a full `lst compile` run producing a
manifest with eight real region paths and no placeholder geometry remaining.

## Notes and hazards

- **~~Which command runs §10.3's five geometry checks is an open spec question.~~ RESOLVED
  by T26/F17, 2026-08-05, and it went the other way from this document's guess.** The checks
  are `lst validate`'s, as §6.2's layer 2b rules M1–M5; the failure surface is validate time,
  not build time; and T03 owns the rule modules. This document's `lst compile` placement was
  flagged as "an inference, not a reading" and was right to be — it turned out to be unsafe
  for a reason outside §10 entirely. §6.5's `build` job `needs` the app jobs, which the path
  filter skips on a content-only PR, and a skipped dependency skips the dependent: **`build`
  does not run on the PRs that change `map.yaml`.** The checks would have lived in a job that
  never fires on the input they guard. That is recorded separately as **T26/F24**, still
  open, and it does not affect this task now that the checks have moved.
- **R-13 is a working-mode instruction, not just an accepted risk.** If hand-authoring the
  eight regions' tile lists is slow or error-prone, the sanctioned response is a throwaway
  local script that helps a human place tiles and prints the resulting YAML — not a
  shipped editor, not a maintained tool, not something this task's deliverables list
  should grow to include. Building more than that is over-engineering against a risk the
  architecture already priced as "happens once, maintainer-only."
- **T04 already emits a schema-shaped placeholder for `taxonomy.map`.** This task replaces
  that placeholder's *content*, not its *shape* — do not change `map.schema.json`'s
  structural contract without checking T04's existing fixture tests, which assert against
  it.
- **The manifest is the only place map geometry ships.** §10.4 is explicit that the map
  renders "from the manifest alone with no further fetch," which is what §3.3's cold-load
  sequence requires — do not introduce a separate per-region fetch as an optimization; it
  would violate that requirement even if individually reasonable.
- **Do not let region size drift into meaning something.** It is tempting, once tile
  assignment is in front of you, to give a domain projected to have more skills more
  tiles "so it looks right." §10.3 forbids this explicitly and NG9 is the PRD-level reason
  why: region area is identity, not a comparability claim.
- Hole detection (a region producing two loops) is a warning, not a gate, specifically
  because it is "far more likely to be an authoring mistake than an intention" (§10.4) —
  keep it non-blocking; a hard failure here would be stricter than the spec asks for.


## T26 amendments — 2026-08-06

**F24 is resolved and this task is unaffected behaviourally.** The concern was that
`lst compile` never ran on a content-only PR, which would have left map geometry ungated on
its own input had the M1–M5 checks stayed in the compiler. They did not — F17 moved them to
`lst validate` — and F24 has now split `build` into `content: compile` (needs
`content: validate` only, never skips) and `app: build`. Both jobs a `map.yaml` change
depends on now run. No edit to this task's scope; strike any open note on F24.
