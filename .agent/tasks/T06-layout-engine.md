# T06 — Layout Engine

| Field | Value |
|---|---|
| **Status** | **complete** — 2026-08-13 |
| **Phase** | 0 |
| **Cluster** | pure-engines |
| **Blocked by** | T02 |
| **Blocks** | T08 |
| **Spec** | ARCHITECTURE §8, §14.3 |
| **PRD** | F13, F14, F15, F16, N11 |

## Goal

`app/src/lib/layout/` exports `layoutTree(tree, viewport)`, a pure function that turns a
`CompiledTree` into a `TreeLayout` — positioned nodes, routed edges, column and row bands,
and an overall extent, all in abstract units. It imports nothing from Svelte, the DOM,
`$app`, or `lib/state`. Given the same tree and the same viewport it returns the same
numbers, on every machine and in every session. After this task a tree has coordinates;
nothing yet draws them, which is T08.

## Why this shape

**No layout algorithm runs.** Positions are computed arithmetically from declared
semantics — level, track, order, slug — and that is the whole mechanism behind F13 and
N11 (§8). `docs/RESEARCH.md` §3 records why: roadmap.sh retreated from authored
coordinates, and crossing-minimizing auto-layout is unstable under small edits, so a
contributor rewording one milestone would relocate half the tree. Coordinates are
**abstract units** rather than pixels so the engine never learns the screen size and stays
testable without a browser (§8.1). F16's narrow layout is a *parameter*, not a second code
path over different data (§8.5) — and it falls out that the narrow layout **is** the linear
list §15 reuses as the screen-reader presentation at every viewport.

The layout signature deliberately excludes user state (§8.6, §14.1). Completing a
milestone must never trigger a re-layout — only a class change on already-positioned nodes
(§9.3) — which is what makes the §17.3 target of < 50 ms per toggle structural rather than
optimized.

## Scope

**In scope**

- The §8.1 type surface and `layoutTree` entry point in `app/src/lib/layout/index.ts`.
- The §8.2 wide algorithm, implemented step for step, including the centring in step 6.
- The §8.3 stability guarantee, encoded as a test per row of that section's table.
- §8.4 orthogonal three-segment edge routing, with same-level prerequisites routed through
  a side gutter rather than the row gutter.
- §8.5 narrow layout: one column, ordering `(level, track index, order, slug)`, `edges`
  returned empty.
- §8.6 memoization keyed on `(tree.id, tree.contentVersion, viewport)` and on nothing else.
- The layout constants (row height, slot width, gutters) as named exports in one module,
  so a value change is one diff and the stability tests still pass.
- A purity test asserting `lib/layout` imports nothing from `svelte`, `$app`, or
  `lib/state`, and an ESLint `no-restricted-imports` entry expressing the §14.1 forbidden
  edge `lib/layout ⇢ lib/state`.

**Out of scope**

- Any SVG, `viewBox`, pixel scaling, CSS, container query, or DOM — that is the TreeView
  renderer, **T08** (§9).
- Node state (complete / available / locked / bonus / dismissed). It is computed by the
  Scoring Engine in **T11a** and §8.7 states it never touches layout.
- Mastery achievements. §5.7 gives them no level, track, or order, and §9.6 renders them
  in a separate panel below the tree, so they are not positioned here and `TreeLayout` has
  no field for them — **T08** owns that panel.
- Hex map geometry. §10 is an unrelated coordinate system; the axial maths is **T12**.
- Reading or writing content. `layoutTree` receives an already-loaded `CompiledTree`; the
  fetch is the Content Loader, **T07**.
- Wiring the purity and import checks into the CI job graph — the gate lives in **T25**
  (§14.7, §6.5). This task ships the rule and the test; T25 makes them blocking.

## Deliverables

```
app/src/lib/layout/index.ts            public surface: §8.1 types + layoutTree
app/src/lib/layout/constants.ts        row height, slot width, gutters — abstract units
app/src/lib/layout/wide.ts             the §8.2 normative algorithm
app/src/lib/layout/narrow.ts           §8.5 — one column, no edges
app/src/lib/layout/edges.ts            §8.4 orthogonal routing
app/src/lib/layout/memo.ts             §8.6 cache keyed on (id, contentVersion, viewport)
app/src/lib/layout/wide.test.ts        grid mapping, centring, column widths
app/src/lib/layout/stability.test.ts   one case per row of the §8.3 table
app/src/lib/layout/narrow.test.ts      ordering, single column, empty edges
app/src/lib/layout/purity.test.ts      §14.7 purity check over this directory's sources
eslint.config.js                   MODIFIED — disjoint no-restricted-imports slice for §14.1
```

## Interface contract

Copied from ARCHITECTURE §8.1. This block is what T08 is written against.

```ts
// app/src/lib/layout/index.ts — imports nothing from svelte, the DOM, or the store

export type Viewport = 'wide' | 'narrow';

export interface PositionedNode {
  uid: string;
  slug: string;
  level: number;      // 1..10
  col: number;        // track index
  lane: number;       // index within the (level, track) cell
  x: number; y: number; w: number; h: number;   // abstract units, not pixels
}

export interface RoutedEdge {
  fromUid: string; toUid: string;
  path: string;     // SVG path `d`, in the same abstract units
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: RoutedEdge[];
  columns: { trackId: string; title: string; x: number; w: number }[];
  rows:    { level: number; y: number; h: number }[];
  width: number; height: number;
  viewport: Viewport;
}

export function layoutTree(tree: CompiledTree, viewport: Viewport): TreeLayout;
```

The wide algorithm is **normative**. From ARCHITECTURE §8.2, verbatim:

```
1. rows    ← levels 1..10, level 1 at the BOTTOM, ascending upward.
             Row height is a constant. All rows are equal height, always.
2. columns ← tracks in declared order, left to right.
             A tree with no `tracks` has exactly one column.
3. cells   ← group milestones by (level, track).
4. lanes   ← within each cell, sort by (order, slug).
             `order` is always explicit in a compiled bundle (§7.3) and
             `slug` breaks any remaining tie, so the sort is total and
             stable with no reference to file position.
5. colWidth[c] ← max(lanes in any cell of column c) × slotWidth
6. x     ← column origin + (column centred offset for this cell's lane count)
   y     ← row origin
7. edges ← for each `requires`, route an orthogonal path (§8.4)
```

Step 6 is the one that matters: nodes in a cell are **centred within their column** rather
than left-packed, so a cell holding two nodes and a cell holding three both sit on the
column's centre line (§8.3).

Behavioural contract, from §14.3: `layoutTree` is **pure, total, and deterministic**.
Same inputs, same outputs, forever, including across app versions unless §8.2's algorithm
itself changes. **No exceptions are thrown** — a compiled bundle is valid by construction
because §6.2 and §7.3 have already made it so, so there is no defensive branch, no
`try`, and no fallback path to write.

## Acceptance criteria

- [ ] `layoutTree(tree, 'wide')` on a fixture with three tracks produces `rows` of length
      10, all with the same `h`, and with level 1's `y` strictly greater than level 10's —
      level 1 at the bottom (§8.2 step 1).
- [ ] A tree with no `tracks` produces `columns.length === 1` (§8.2 step 2).
- [ ] Two nodes in a cell and three nodes in a sibling cell of the same column have the
      same mean `x`, equal to that column's centre line (§8.2 step 6, §8.3).
- [ ] `colWidth` for a column equals its maximum cell lane count × `slotWidth`, asserted
      against the §8.3 worked example (`forge` = 3, `finishing` = 2).
- [ ] Shuffling the milestone array within a cell of the input fixture produces a
      byte-identical `TreeLayout` (JSON-stringified) — the §8.2 step 4 sort is total and
      reads no file position.
- [ ] `stability.test.ts` contains one named case per row of the §8.3 table and each
      asserts exactly what that row says moves and, by diffing the full node set, that
      nothing else does. In particular: adding a milestone beyond a column's lane maximum
      shifts columns to its **right** only, leaves every `rows[].y` unchanged, and leaves
      every node in columns to its left at an identical `x`.
- [ ] A test asserts that **every** node's `y` is unchanged across all seven §8.3 edits —
      the "vertical position is invariant under every content edit" property.
- [ ] Calling `layoutTree` twice with the same arguments returns the same object identity
      (§8.6), and a fixture differing only in `contentVersion` returns a different object.
- [ ] A test constructs two `TreeProgress`-shaped inputs and demonstrates they cannot be
      passed: `layoutTree` has arity 2 and `tsc --noEmit` rejects a third argument. User
      state is absent from the signature (§8.6, §14.1).
- [ ] `layoutTree(tree, 'narrow')` returns `columns.length === 1`, `edges.length === 0`,
      and `nodes` ordered by `(level, track index, order, slug)` (§8.5).
- [ ] Every `RoutedEdge.path` is a valid SVG path `d` string parseable into three
      orthogonal segments, and for every edge the source level is ≤ the target level —
      no edge points downward (§8.4, §6.2 rule 5).
- [ ] Same-level edges produce a path whose x-extent leaves the row band, i.e. they route
      through the side gutter and not the row gutter (§8.4).
- [ ] `purity.test.ts` reads every `.ts` file under `app/src/lib/layout/` and fails if any
      contains an import of `svelte`, `$app`, `$lib/state`, or a relative path escaping to
      `../state` (§14.7 purity check).
- [ ] `purity.test.ts` also fails if the literal string `archetype` appears anywhere under
      `app/src/lib/layout/` — the §14.7 grep gate, which is the mechanical form of **S1**.
- [ ] `npx eslint app/src/lib/layout` passes, and temporarily adding
      `import { x } from '$lib/state'` to `wide.ts` makes it fail on `no-restricted-imports`.
- [ ] A benchmark test lays out an 80-node fixture in under 2 ms (§17.3), asserted as a
      hard threshold rather than logged.
- [ ] `npx tsc --noEmit` passes with `strict: true`.

## Verification

```bash
npm run --workspace app test -- lib/layout
npx eslint app/src/lib/layout
npx tsc --noEmit
```

Passing looks like: the whole layout suite green, including every §8.3 stability row and
the 2 ms benchmark; ESLint clean; a clean typecheck. A reviewer should be able to open
`stability.test.ts` and read the §8.3 table off the test names.

**Verified 2026-08-13.** 59 layout tests green across six files; root `npm test` (69 app +
171 tools), `npm run typecheck` (0 errors, 328 files), `npm run lint`, and `npm run build`
all clean. Two gates were checked by breaking them rather than by assuming they work:
left-packing the step-6 offset fails exactly four tests (the centring case and three §8.3
rows), and adding `import { x } from '$lib/state'` to `wide.ts` fails
`no-restricted-imports` with the §14.1 message. The `archetype` grep gate caught its own
test's name on the first run, which is the strongest evidence available that it is live.

### Three files beyond the deliverables list

`edges.test.ts` and `index.test.ts` were split out of the planned `wide.test.ts` — F27
turned §8.4 from two sentences into a lane assignment with a named degenerate case, and
memoization, arity, and the §17.3 benchmark are public-surface concerns rather than wide
ones. `fixtures.ts` is the shared tree builder: §5.3 fixes `levels` at ten entries of four
to eight milestones, so a hand-written literal fixture runs to hundreds of lines. It sits
inside the directory so `purity.test.ts` covers it too.

**The fixture deliberately does not pad levels to §5.3's four-milestone minimum.** Filler
has to land in some cell, and inflating a cell is precisely what the column-width and
centring tests measure — the first version padded into the first track and moved the thing
under test. A level with no milestones simply contributes no nodes.

### Ambiguities resolved during implementation

- **A synthetic column's `w` is the column area, not `TreeLayout.width`.** §8.2 step 2 and
  §8.5 both write the synthetic column as `{ trackId: '', title: '', x: 0, w: width }`.
  That literal holds exactly in narrow, where there is no side channel and the column *is*
  the whole tree. In wide it cannot: §8.4 puts the side gutter inside `width` but outside
  every column, so `w: width` would centre every node over the side channel and break the
  §8.3 centring the same paragraph asserts. The column's `w` is therefore what §8.2 step 5
  computes, in both the tracked and the synthetic case.
- **The same-level path is three drawn segments.** §8.4 calls it "four segments": out of
  the source's right edge, right to its lane depth, vertically by `sameLevelBow`, left into
  the target's right edge. The first two are collinear — a genuine fourth horizontal would
  be a no-op — so the path is `M … H … V … H …`: four path commands, three drawn segments,
  which is also what the cross-row `M … V … H … V …` produces. The tests assert three
  orthogonal segments for every edge in both cases.
- **"Every node's `y` is unchanged across all seven §8.3 edits" is asserted in the form
  that is true.** Taken literally it is false for the seventh row, re-levelling, whose own
  table entry says "it moves" — a node that changes level changes row by definition. The
  test asserts the two things that do hold without qualification: every row band keeps its
  `y` across all seven edits, and every node the edit did not re-level keeps its `y`.
- **A declared track with no milestones occupies one slot** rather than collapsing to zero
  width. §8.2 step 5's `max(lanes)` is 0 for an empty column and the spec does not say what
  a zero-width column means. The `lonely-track` lint (§6.3, T22) is what flags an empty
  track; the geometry should not make it invisible.
- **`$lib/types` re-exported three more names.** `CompiledMilestone`, `CompiledLevel`, and
  `MilestoneRef` were generated by T02 but not surfaced through the barrel. The engine
  addresses the flat milestone index and its slug refs directly (§7.3), so it needs them by
  name; the alternative was a deep import past the barrel. No generated type changed.
- **Edge ordering is derived from position, never from file position.** §8.2 step 4 fixes
  lane order but says nothing about the order of `TreeLayout.edges`. Sorting by
  `(target level, col, lane, source level, col, lane)` keeps the array stable under the
  same input shuffling that step 4 defends against.

## Notes and hazards

- **R-11 — edge spaghetti in dense trees.** §8.4 accepts crossings and never minimizes
  them (F15); a piano tree with many cross-track prerequisites may render illegibly. Do
  not add a crossing-reduction pass — it would destroy the stability guarantee that is the
  entire point of the subsystem. The mitigations are elsewhere: edge highlighting on focus
  (§9.4, T08), and the `track-overuse` / `lonely-track` lints (§6.3, T22). **The fallback
  §8.4 already permits** is to stop drawing edges by default and surface prerequisites as
  text; the engine's contract is to *supply* routes, not to insist they are drawn, so that
  fallback needs no change here.
- **Column widening is an honest exception to F13, not a bug (§8.3).** It is bounded,
  rightward-only, and rare. The alternative — a globally fixed column width — makes every
  column widen whenever any cell grows, which is strictly worse. Do not "fix" it.
- **R-14 — the schema is being fixed before content exists.** This engine consumes
  `CompiledTree` from T02, and T10 is the scheduled window for a breaking bump. Keep the
  read surface narrow (`id`, `contentVersion`, `tracks`, `levels[].milestones[]` with
  `uid`, `id`, `track`, `order`, `requires`) so a bump touches few lines.
- **Memoization depends on `CompiledTree` exposing `id` and `contentVersion`.** §8.6 names
  that key. Confirm both fields exist on T02's generated `CompiledTree` before implementing
  `memo.ts`; do not hand-write a parallel type.
  if they do not, that is a T02 defect, not a reason to key on something else. §8.6 also
  says nothing about cache eviction — an unbounded `Map` is acceptable for v1 given §17.5's
  scale thresholds, but say so in a comment rather than silently.

**The spec is no longer silent on any of these.** All five were filed as **T26/F27** and
resolved 2026-08-06; the answers are §8 now, not inferences. Two of this doc's earlier
guesses were kept and one was overruled — see the amendments at the end.

## T26 amendments — 2026-08-06 (F27)

The five §8 silences this doc was carrying now have verdicts in the spec.

**1. Narrow is level 1 at the TOP** (§8.5) — the one place the two modes disagree about
direction. Wide is a spatial metaphor, a tree growing upward; narrow is a *reading order*,
and §15 reuses it as the linear presentation for screen readers **at every viewport**. Level
1 at the bottom would run that order level 10 → level 1 and put visual order in opposition to
focus order. This doc's guess was right and is now spec; no explanatory comment needed.

**2. `col`, `lane`, `columns` in narrow** (§8.5) — `col = 0` throughout; `columns` holds one
**synthetic** entry `{ trackId: '', title: '', x: 0, w: width }`, an empty `trackId` marking
it synthetic so §9 draws no header. Not an empty array, despite `edges: []` looking like the
precedent: the invariant worth keeping is that **`columns[node.col]` resolves in both modes**,
which a test can assert and T08 can rely on without branching on viewport. `col = 0` indexing
into an empty array type-checks, which is what makes it a footgun.

**`lane` was overruled.** This doc proposed a running index over the whole stack; §8.5 keeps
`lane`'s §8.1 meaning — index within the `(level, col)` cell, so in narrow the index within
the level. One field must not mean two things across two modes, and `(level, lane)` recovers
the stack order anyway.

The same rule closes a gap this doc did not name: §8.2 step 2's wide tree with no `tracks`
gets the identical synthetic column.

**3. The unit constants are in §8.1 with v1 values** — `slotWidth` 100, `slotHeight` 44,
`rowHeight` 96, `rowGutter` 52, `colGutter` 24, `sideGutter` 72, `sideGutterLane` 18,
`sameLevelBow` 12. **No value is normative**: units are abstract and the renderer rescales
them, so what carries meaning is the ratios, and they ship as tunable data in one module
exactly as F18's band table does. `constants.ts`, as this doc planned. **Two are constrained,
and breaking either is a bug rather than a preference:** `rowGutter` must stay positive or
§8.4's edges have no channel, and `sideGutterLane × (max same-level edges in one row)` must
not exceed `sideGutter` or the outermost lane escapes the tree. Both are worth a test.

**4. Side-gutter geometry** (§8.4) — one vertical channel on the right of the whole tree,
outside every column, `sideGutter` wide. Each same-level edge takes a lane, numbered inside
out and assigned **per row** in `(source lane, target lane)` order, at depth
`channelX + k × sideGutterLane`. The path is four segments: out of the source's right edge,
right to its lane depth, vertically by `sameLevelBow`, left into the target's right edge.

**The bow is the part to get right.** Both nodes share a row, so both legs leave from the
right edge at the same `y`; without the offset the outbound and return legs are the same
line, and it renders as a single stroke that looks like a data bug. That is the first case a
fixture hits. A target to the *left* of its source crosses the nodes between it and the
channel — accepted, never routed around (§8.4).

**5. Mastery edges are dropped, not degraded** (§8.2 step 7) — the step ranges over
positioned milestone nodes only. §6.2 rule 14 forbids a mastery entry carrying a level,
track, order, or requirement group, so it has no cell and no position; §9.6 renders it
outside the grid and surfaces its prerequisites as text. An unpositioned endpoint is a
category error rather than a partial edge. Note the exclusion in `edges.ts`, as planned.

