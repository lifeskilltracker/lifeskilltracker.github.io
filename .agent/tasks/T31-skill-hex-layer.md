# T31 — Skill hex layer, detail panel, and the phone list

| Field | Value |
|---|---|
| **Status** | complete |
| **Phase** | 2 |
| **Cluster** | views |
| **Blocked by** | T29, T30 |
| **Blocks** | T33, T35 |
| **Spec** | UI-SPEC §5.4, §5.5, §8.1, §9 (A2, A5); ARCHITECTURE §10.7, §15.2, §15.3, §15.4 |
| **PRD** | F6, N5, N11 |

## Goal

Level 1 draws the skills. Each published tree in the focused domain renders as a hex at
the cell T29 assigned it, encoding its domain in plate colour, its attained level as a
water line, started-ness in its border and mastery in a glyph. Clicking one opens a detail
panel; clicking **Open tree** from there navigates to `/s/<treeId>`. On a phone, level 1
substitutes an honest list of skills while the world map survives. After this task the map
answers "what is in this domain, and where am I in each of them" without leaving the map.

## Why this shape

**The two-click path is deliberate.** A domain view exists to compare skills, and one-click
navigation makes every look cost a page load and a trip back. It also avoids the reference
implementation's cleverest and least defensible behaviour, where the same click means "fly
the camera" or "open the detail" depending on the current zoom, with nothing signalling
which. The phone threshold moves from viewport size to zoom level (U-10) because the
Curious Browser is disproportionately on a phone and the map is the entire reason they
might care: eight labelled regions genuinely do fit a phone, and skill hexes are exactly
where labels stop being legible and 44×44 px touch targets stop fitting. That is where the
list honestly belongs.

## Scope

**In scope**

- **The skill hex layer**, drawn only for the focused region (A2), positioned from the
  manifest's placement cells. Level 0 still renders eight paths and no hexes.
- **The four channels (§5.4)**, in the same never-colour-alone discipline as §4.6:
  plate colour = its domain (identity); water line = attained level over 10; border =
  started (solid) vs unstarted (dashed); glyph = mastery content present, level 10
  attained. Everything encoded visually is also in the accessible name (§15.3).
- **The skill detail panel (§5.5)**: title, attained level, tier, progress to next, the
  blocking level, the next available milestone, authors (F6), and an **Open tree** button.
- **Focus dim at level 1** — focusing a hex holds it and drops the rest.
- **Keyboard (§5.5).** Hexes are real links with resolved `href`s in the stable documented
  order §15.3 requires; arrow keys move by nearest-neighbour within a directional cone;
  `Enter` activates; `Esc` returns to level 0. The existing roving-`tabindex` model is
  unchanged.
- **Phone level 1 (§8.1)**: a list of skills carrying the same channels in the same order
  as the hexes. Level 0 stays a map on every viewport.
- **A5 in practice** — the screen-reader region list at level 0 and the phone map at level
  0 carry the same content in the same order, which is the property A5 restates.
- **Skill-layer fade**: 260 ms starting 120 ms after the camera, disabled under
  `prefers-reduced-motion`.

**Out of scope**

- Assigning cells — **T29** owns placement entirely; this task reads the manifest.
- The camera itself, label tiers and the water-line primitive — **T30**.
- Find's highlight over the hexes — **T33**.
- Anything about the tree view — **T34**.

## Deliverables

```
app/src/lib/components/SkillHexLayer.svelte     the hexes and their four channels
app/src/lib/components/SkillHexLayer.test.ts    channels, accessible names, keyboard
app/src/lib/components/SkillDetail.svelte       the panel; Open tree → /s/<treeId>
app/src/lib/components/SkillDetail.test.ts
app/src/lib/components/DomainSkillList.svelte   the phone substitution at level 1
app/src/lib/components/hex-neighbours.ts        directional-cone nearest-neighbour
app/src/lib/components/hex-neighbours.test.ts   pure
```

## Interface contract

```ts
// One row per published tree in the focused domain. Assembled by the shell from the
// manifest × the store's projection — components import neither loader nor state (§14.1).
export interface SkillHexRow {
  readonly treeId: string;
  readonly title: string;
  readonly domain: DomainId;
  readonly cell: Cell;                 // from T29's ledger, via the manifest
  readonly attainedLevel: number;      // 0–10; the water line is level/10
  readonly started: boolean;           // border: solid | dashed
  readonly hasMastery: boolean;        // glyph
  readonly tier: TierName | null;
}

// hex-neighbours.ts — pure, and the same model §15.2's tree grid already uses
export function neighbourInDirection(
  from: Cell, cells: readonly Cell[], dir: 'up' | 'down' | 'left' | 'right',
): Cell | null;
```

## Acceptance criteria

- [x] Level 0 renders no skill hexes; level 1 renders exactly the published trees of the
      focused domain, each at its ledger cell.
- [x] Every hex's accessible name carries title, attained level, tier, started-ness and
      mastery — everything the four visual channels carry (§15.3).
- [x] No channel is colour-only: an unstarted and a started hex differ in border style, and
      a mastery hex carries a real `<use>` glyph that survives `forced-colors: active`.
- [x] Clicking a hex opens the panel and does **not** navigate; **Open tree** navigates to
      `/s/<treeId>`. Asserted as two separate interactions.
- [x] Every hex is a real link with a resolved `href`, reachable by keyboard in the
      documented order; arrow keys traverse by nearest neighbour; `Esc` returns to level 0.
- [x] At phone width, level 0 renders the map and level 1 renders the list. Asserted at
      both widths against the same data.
- [x] The list and the hex layer carry the same skills in the same order.
- [x] Adding a tree to a fixture domain changes one hex and moves none of the others
      (N11, inherited from T29 and asserted here at the render layer).
- [x] `app/a11y/manual-passes.mjs` passes unchanged.

## Verification

```bash
npm test --workspace app -- SkillHexLayer SkillDetail hex-neighbours breakpoints
npm run build && npm run a11y:manual --workspace app
npm run check:budget
```

## Notes and hazards

- **Do not collapse the two clicks.** The single-click shortcut is the first thing an
  implementer will want to add and it is the specific behaviour §5.5 declines, by name.
- **The phone list is not a fallback; it is the level-1 presentation on that viewport.**
  It must carry every channel, not a subset, or A5's convergence claim becomes false in the
  same commit that T28 restated it.
- **44×44 px touch targets are the reason the list exists.** If hexes are made to fit a
  phone by shrinking them, the threshold has been defeated rather than met.
- **The detail panel reads authors (F6).** That data comes from the compiled bundle, so
  opening the panel may need the tree loaded; decide whether the panel loads the bundle or
  the manifest carries enough, and state it — an unstated answer here is a first-paint
  budget surprise.
- **Placement comes from the manifest, never re-derived in the app.** Re-running the spiral
  client-side would put an N11 guarantee in two places, and they would disagree.

## Outcome — what the build settled

Every acceptance criterion is met and the composed gate is green: **1021 + 349 tests**,
`svelte-check` 563 files 0 errors, `eslint` clean, `a11y:manual` **43 of 43 unchanged**,
budget **51.6 / 52.0 kB** first route, `check:s1` holds. Verified end to end in a real
browser against the built app: `/` draws no hexes, `/d/making` draws them, clicking one
leaves the URL where it was and opens the panel, and **Open tree** is the only thing that
navigates.

### The hazard the task doc named, answered in two halves

`hasMastery` is now a **required field on the manifest**, and the panel loads a bundle.

- **The hexes never fetch.** A level-1 frame draws a glyph decision for *every* skill in
  the domain; deciding it per bundle would put twenty chunk fetches on that frame, which is
  exactly what §7.1's small-manifest/large-chunks split exists to prevent. So the one fact
  the map needed and did not have — whether a tree publishes mastery content — moved onto
  the manifest, in `schema/manifest.schema.json` and `tools/src/compile/manifest.ts`, with
  a compile test asserting it in both directions.
- **The panel does fetch, on a gesture.** Progress to next, the blocking level and the next
  available milestone are all functions of the compiled tree and no summary of them belongs
  on the manifest. One bundle, when a panel opens, off the critical path. The panel paints
  its manifest half first, so opening it never looks like nothing happened, and a failed
  load is a **degraded panel, not an absent one**.

### §17.1 was the binding constraint, and it bound immediately

The first draft took `App JS, first route` to **52.9 / 52.0 kB** — over the gate the moment
it was written, because everything level 1 needs was reachable from the shell. Two changes
brought it to 51.6:

- **`SkillHexLayer`, `DomainSkillList`, `SkillDetail` and `skill-detail.ts` are all
  `import()`ed on demand.** They are level-1 only, and level 0 is the route every visitor
  lands on. §5.6 already holds the layer 120 ms behind the camera and fades it over 260 ms,
  so the chunk lands inside a window that already exists.
- **`readingOrder` was rewritten to sort on integers**, and the hex geometry moved out of
  `camera.ts` into its own `skill-hex.ts`. On a pointy-top lattice `y` is monotonic in `r`
  and, within a row, `x` is monotonic in `q` — so `(r, q)` *is* reading order, and the
  ordering the shell needs no longer drags the corner table and the path builder onto the
  first route.

**There is now 0.4 kB of first-route headroom.** T33 and T35 should assume the budget is
spent and reach for a chunk before reaching for the shell.

### Judgment calls worth a second opinion

- **§5.5's arrow keys use a ±60° cone, and diagonals answer two keys.** A pointy-top hex
  has neighbours at 0°/60°/120°/180°/240°/300° and *nothing* at 90°: the cell below
  `(q, r)` is `(q − 1, r + 2)`, two rows away. Four arrow keys cannot partition six
  directions, and any cone narrow enough to keep `down` off the diagonals makes `down` skip
  a whole row. The cost — `→` at the end of a row moving down-and-right — is asserted
  explicitly rather than hidden, because the alternative strands the reader.
- **`MapRenderer` keeps its `viewport` prop and its region list.** U-10 moves the *choice*
  to `MapSurface`, which passes `viewport="map"` unconditionally, so the level-0 list is
  no longer reachable from the shell. The markup was kept rather than deleted because §8.1
  says §15.3's convergence claim "must be restated, not dropped" and names the region list
  as what the screen reader gets at the world level; deleting it would have removed the
  only place that claim is asserted. **If that reading is wrong, the list should go.**
- **The glyph channel is two marks, not one.** §5.4's cell reads "mastery content present,
  level 10 attained", which is a list of the channel's values in the same shape as the
  border's "started (solid) vs unstarted (dashed)". So `hasMastery` (library) and
  `attainedMax` (reader) are separate facts with separate glyphs and separate sentences in
  the accessible name.

### Still open, and handed on

**T30's skill-label question is not settled and was deliberately not settled here.**
`SKILL_LABEL_WORLD_SIZE` still resolves to 12–13 px for `play` and `outdoors-nature`
against §5.2's 14–18 px band. Nothing in T31's criteria depends on it and the hexes are
legible at that size, so shipping the layer did not require an answer — but the answer is a
**UI-SPEC amendment**, not a code change, and it belongs to whoever is willing to widen
§5.2's band (recording that two extreme-aspect regions set the floor) or to refit level 1
to a constant box (which crops `outdoors-nature`, 381 wide, or wastes the frame on `play`).
Do not hand-tune the constant until one number passes.
