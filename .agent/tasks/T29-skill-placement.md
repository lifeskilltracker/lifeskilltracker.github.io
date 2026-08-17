# T29 — Skill placement: sub-lattice, spiral, and the placement ledger

| Field | Value |
|---|---|
| **Status** | **complete** — 2026-08-16 |
| **Phase** | 2 |
| **Cluster** | cli-toolchain |
| **Blocked by** | — |
| **Blocks** | T31 |
| **Spec** | UI-SPEC §5.3, §9 (A2); ARCHITECTURE §6.4, §7.2, §7.3, §10.2, §10.4 |
| **PRD** | F13, N11, F41 |

## Goal

Every published tree has a stable position on the map that nobody authored. `lst compile`
subdivides each region into a hex sub-lattice, enumerates the cells in a spiral from the
region centroid, assigns the lowest-numbered free cell to any tree in that domain lacking
an assignment, and writes the result to a committed placement ledger it never recomputes.
A ninth baseline check fails CI if an existing assignment changed. After this task the
manifest carries a cell coordinate per tree, and adding a skill moves nothing already
placed.

## Why this shape

Two requirements bound every possible answer and together rule out both obvious ones.
**F13** says contributors never author layout coordinates, so a `tile:` field on a tree is
not available. **N11** says a change to one thing shall not visibly reflow the rest, and
spatial memory is the entire benefit of a fixed map — which kills the semantic answer too,
because deriving position from subregion or facet tags clusters beautifully and re-packs
every neighbour the moment one skill is added. Append-only assignment satisfies both by
construction rather than by care. The ledger invents no new concept: §6.4 already
establishes a committed baseline with CI failing on unauthorized drift, for milestone
identifier stability (F41). Placement is the same shape of problem and takes the same
shape of answer.

## Scope

**In scope**

- **Subdivide.** A hex lattice at `cellSize = hexSize / cellDivisor` over the region's
  bounding box; keep every cell whose centre lies inside the region polygon.
  `cellDivisor` is **4, global — no per-region override** (UI-SPEC Q2, resolved).
- **Enumerate.** Order surviving cells in a spiral from the cell nearest the region
  centroid. Deterministic given the polygon and `cellDivisor`.
- **Assign, append-only.** Each published tree takes the lowest-numbered free cell in its
  **primary** domain at first compile. Written to the ledger, never recomputed.
- The ledger file, its schema, and its emission into the manifest so the app can read a
  cell coordinate per tree without re-deriving anything.
- **`lst baseline` check 9** — an existing assignment that changed fails CI, in the manner
  of §6.4's eight existing checks and inheriting the same `origin/main` baseline and
  `fetch-depth: 0`.
- The three consequences, implemented deliberately and stated in the diagnostics:
  a retired skill **leaves a hole** (filling it would move whoever holds the next cell);
  a skill changing primary domain **frees its old cell and takes a new one** in the
  destination (safe precisely because assignment is lowest-free rather than by count);
  editing a region's tiles in `map.yaml` **reflows that domain's skills**, and the
  compiler shall warn loudly and name every affected tree.
- Asserting the resolved **UI-SPEC §12 Q2** value in a test, so the divisor cannot drift:
  `cellDivisor: 4`, global, no override.

**Out of scope**

- Drawing anything. The skill hex layer, its four channels and the detail panel are
  **T31**. This task ships coordinates and lives entirely in `tools/`; it has no app
  dependency and can start immediately, in parallel with everything else.
- Changing the region union. A2 leaves §10.4 producing the same eight silhouettes; the
  sub-lattice is a second layer over the same polygons.
- Any authored placement affordance. There is deliberately no override field — one would
  reintroduce F13's maintainer bottleneck through a side door.

## Deliverables

```
tools/src/compile/placement.ts        sub-lattice, spiral enumeration, assignment
tools/src/compile/placement.test.ts   determinism, append-only, the three consequences
tools/src/baseline/checks.ts          check 9 — no existing assignment changed
content/taxonomy/placement.yaml       the committed ledger: treeId → cell
schema/placement.schema.json          the ledger's shape
schema/manifest.schema.json           manifest entries gain a required cell coordinate

Shipped in `baseline/checks.ts` beside checks 1–8 rather than in its own
`baseline/placement.ts`: the eight existing checks share one findings type and one
report path, and a ninth in a separate module would have duplicated both.
```

## Interface contract

```ts
// tools/src/compile/placement.ts
export interface Cell { readonly q: number; readonly r: number; }   // sub-lattice axial

/** Deterministic given the polygon and cellDivisor. Index 0 is nearest the centroid. */
export function enumerateCells(
  region: RegionPolygon,
  hexSize: number,
  cellDivisor: number,
): readonly Cell[];

/** Pure: existing assignments in, assignments for trees lacking one out. Never moves an
 *  existing entry. Returns the reflow warning set when the lattice itself changed. */
export function assignPlacements(
  ledger: PlacementLedger,
  trees: readonly { id: string; domain: DomainId }[],
  lattices: ReadonlyMap<DomainId, readonly Cell[]>,
): { ledger: PlacementLedger; reflowed: readonly string[] };
```

```yaml
# content/taxonomy/placement.yaml
schemaVersion: 1
cellDivisor: 4          # global; frozen at the first committed assignment
placements:
  - { tree: blacksmithing, domain: making, cell: { q: 0, r: 0 } }
```

## Acceptance criteria

- [x] `enumerateCells` is deterministic: the same polygon and divisor yield a
      byte-identical cell list across runs and platforms. Asserted by a fixture.
- [x] Adding a tree to a domain changes exactly one ledger line and no existing line.
      Asserted over all eight domains.
- [x] Retiring a tree leaves its cell free and moves nothing; the next tree added to that
      domain takes the freed cell.
- [x] A tree changing primary domain frees the source cell and takes the lowest free cell
      in the destination.
- [x] Editing a region's tiles emits a warning naming every affected tree, and the ledger
      records the reflow rather than silently rewriting.
- [x] `lst baseline` check 9 fails on a hand-edited ledger line and passes on an appended
      one. Verified over a real temporary git repository, as T25's tests do.
- [x] Every published tree in the manifest has a cell; no cell is claimed twice.
- [x] `cellDivisor: 4` yields at least 137 cells for Making, 82 for Body, and 70 for Home
      against the real `map.yaml` — §5.1's 500-skill projection — and every figure is
      asserted rather than asserted-by-comment.
- [x] The ledger schema has no per-region divisor field, and a `placement.yaml` carrying
      one is rejected by `lst validate`.

## Verification

```bash
npm test --workspace tools -- placement
npm run build                                   # lst compile assigns and writes
git diff --exit-code content/taxonomy/placement.yaml   # a re-compile changes nothing
```

## Notes and hazards

- **`cellDivisor` is effectively frozen once content exists.** Changing it later reflows
  every region — the exact N11 failure this task is built to prevent. Q2 is settled at
  **4** against the real geometry; the first ledger commit makes that permanent for all
  eight regions at once, since the divisor is global.
- **Lowest-free, not next-highest.** The distinction is invisible until the first
  retirement and then it is the whole design: counting assignments makes freeing unsafe.
- **The hole is correct.** A future reader will see a gap in a region and try to close it.
  The compiler's diagnostics should say why it is there, or someone will fix it.
- **Exact-integer lattice arithmetic, per A2's compiler note.** The sub-lattice inherits
  the same trap as the region union: keying anything on rounded floats half-works.
- **This is the longest single piece of new logic in the interface work** (UI-SPEC §10)
  and it has no blockers. Start it in parallel.


## Outcome — 2026-08-16

Closed. 348 tools tests pass; `npm run typecheck` and `npx eslint .` are clean.
The three failing app tests (`dismiss/undismiss` property, two axe gates) are
**pre-existing** and fail identically with this work stashed.

**One interface change from the plan above, and it is the load-bearing decision.**
`enumerateCells` takes the region's **tiles**, not a `RegionPolygon`:

```ts
export function enumerateCells(tiles: readonly AxialTile[], cellDivisor: number): readonly Cell[]
```

§5.3 says "keep every cell whose centre lies inside the region polygon", and the
polygon *is* the union of the tiles — so the equivalent question is "which parent
tile contains this cell's centre?", which is a total function of the cell alone
and computes in exact integers. Point-in-polygon on the emitted path would have
put float containment on a boundary where cells land exactly on region edges,
reintroducing A2-D one level finer. Three properties fall out that the polygon
formulation could not have guaranteed:

- **Cells partition the plane.** Every cell has exactly one parent tile and M2
  forbids a tile being claimed twice, so **no cell can belong to two regions** —
  asserted over the real `map.yaml`. A boundary tie cannot draw one region's
  skill hex on top of another's.
- **Every region holds exactly `16 × tiles`**, because the rounding is
  equivariant under lattice translation. Capacity is arithmetic, not measurement.
- The **45 px touch-target floor is not asserted here**. It depends on the level-1
  camera, which is T30's; the capacity half of Q2 is asserted, and the note is
  recorded in `placement.test.ts`.

**Correction to the Q2 measurements.** The figures quoted when Q2 was decided
(160 / 109 / 112 for Making / Body / Home) came from float polygon containment,
which dropped three boundary cells in Body. The exact partition gives **Making
160, Body 112, Home 112** — every region is `16 × tiles`. The decision is
unaffected: 4 was already the answer, and Body's true capacity is larger than the
number it was justified with, not smaller.

**Check 9 is narrower than "the ledger changed", deliberately.** An appended line
is a new skill; a removed line is a retirement freeing its cell; a changed
`domain` is a skill moving region. Only *same tree, same domain, different cell*
is a violation — plus any change to `cellDivisor`, which moves everything while
leaving every line looking equal.

**Follow-on for T31**, which reads this: `manifest.trees[].cell` is now **required**
by `manifest.schema.json`, and the app's generated `TreeEntry` carries it.
