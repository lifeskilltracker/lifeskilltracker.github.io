# T31 — Skill hex layer, detail panel, and the phone list

| Field | Value |
|---|---|
| **Status** | pending |
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

- [ ] Level 0 renders no skill hexes; level 1 renders exactly the published trees of the
      focused domain, each at its ledger cell.
- [ ] Every hex's accessible name carries title, attained level, tier, started-ness and
      mastery — everything the four visual channels carry (§15.3).
- [ ] No channel is colour-only: an unstarted and a started hex differ in border style, and
      a mastery hex carries a real `<use>` glyph that survives `forced-colors: active`.
- [ ] Clicking a hex opens the panel and does **not** navigate; **Open tree** navigates to
      `/s/<treeId>`. Asserted as two separate interactions.
- [ ] Every hex is a real link with a resolved `href`, reachable by keyboard in the
      documented order; arrow keys traverse by nearest neighbour; `Esc` returns to level 0.
- [ ] At phone width, level 0 renders the map and level 1 renders the list. Asserted at
      both widths against the same data.
- [ ] The list and the hex layer carry the same skills in the same order.
- [ ] Adding a tree to a fixture domain changes one hex and moves none of the others
      (N11, inherited from T29 and asserted here at the render layer).
- [ ] `app/a11y/manual-passes.mjs` passes unchanged.

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
