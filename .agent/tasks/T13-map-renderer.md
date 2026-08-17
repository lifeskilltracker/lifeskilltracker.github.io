# T13 — Map Renderer

| Field | Value |
|---|---|
| **Status** | **complete** — 2026-08-14 |
| **Phase** | 1 |
| **Cluster** | views |
| **Blocked by** | T11b, T12 |
| **Blocks** | T20 |
| **Spec** | ARCHITECTURE §10.5, §10.6, §10.7 |
| **PRD** | F21, F33, F34, F35, D-20 |

> **HISTORICAL — superseded in part by T28's amendments (2026-08-16).** This document
> records the phase-1 renderer as it shipped, and is kept as that record. Three of its
> statements are no longer normative and **must not be implemented from this page**:
>
> - **Fill is no longer a clip rectangle rising from the region's base.** A3 makes it a
>   **water line** at height `1 − fill` with the plate at full strength on both sides
>   (ARCH §10.5). Every `clip-path`, `region-fill` and "clip rectangle" reference below is
>   the superseded mechanism.
> - **"No pan, no zoom, no camera" is repealed.** A1 replaces it with the two-level stepped
>   camera (ARCH §10.7).
> - **The list substitution is no longer at a legibility threshold**, but at camera level 1
>   (A1, ARCH §10.7) — so a phone now gets the world map.
>
> The live successors are **T30** (camera, water line), **T31** (skill hexes, phone list)
> and **T33** (Find, Info). §10.6's subregions and the three-channel accessible-name rules
> below are unchanged and still hold.

## Goal

`app/src/lib/components/MapRenderer.svelte` exists and draws the eight (Making: eleven
counting subregions) region paths emitted by T12's compiler as an interactive world map.
After this task, opening `/` renders every domain's silhouette filled to a height
computed from its domain score, showing a recency date and a breadth count beside its
label, with fogged domains rendered distinctly and every region reachable, announced, and
activatable by keyboard.

## Why this shape

§10.5 draws three quantitative channels over the eight region shapes T12 already emits,
and each channel's encoding is a specific rejection of an easier, wrong alternative.
**Fill** uses a clip-path rising from the region's base rather than opacity, because a
partly-filled region must keep its full-strength outline and label (§10.5) — and it is
never rendered as a raw percentage, because F34 forbids a domain having a legible
denominator it does not have (§11.6: "domains have no denominator"). **Recency** ships as
a date, not a fade — D-20's deliberate deviation from F35's literal text, adopted because
every shipped system that decays a visible value for inactivity was either withdrawn by
its own vendor or is the most-complained-about part of its product (§11.7). **Breadth** is
a plain count, the one channel with nothing to obscure. Getting any of these three
backwards — a percentage, a fading fill, a bar instead of a count — reopens a question
the architecture has already closed with evidence, not just style preference.

## Scope

**In scope**

- The `<MapRenderer>` component: SVG structure per §10.5's markup, the four visual states
  (base, fill, recency, fog) per its channel table.
- Fill rendered as a clip-path rectangle rising from the region base (§10.5), never
  opacity, never a raw percentage anywhere on the map (F34) — presented instead as a
  **named band** over the continuous fill number, using the five F18 bands (**Quiet**,
  **Emerging**, **Moderate**, **Active**, **Deep**) via T11b's shared resolver module
  (§11.6, T26/F18 resolved 2026-08-06).
- Recency rendered as **a date in the region's text/accessible name** — "Last activity —
  12 March", or "No activity yet" when `DomainScore.lastActivityAt` is null — and **nothing
  else**: no saturation channel, no shimmer, no fade constant, no tuning knob anywhere in
  this component (D-20, T26/F5). §10.5 previously described a decaying saturation treatment
  here; it no longer does, so there is also no motion for §15.5 to reduce.
- Breadth rendered as a small count of skills started, as text beside the region label
  (§10.5, F35).
- Fog computed from the **manifest** (zero published trees for a domain), not from user
  state, replacing the region name with a "no skills yet — contribute one" affordance
  (§10.5, F22).
- Making's three subregions rendered as interior grouping lines — subdued strokes and
  small labels along internal boundaries — never as separate fills or outlines (§10.6,
  F27).
- Navigation: selecting a region opens that domain's skill listing (§10.7, F23). Regions
  are focusable (`tabindex`, `role="link"`), keyboard-reachable in a stable reading order,
  and announced with name, fill level, breadth, and fogged state (§10.7).
- No pan, no zoom, no camera — the map fits the viewport at every size; below the
  legibility threshold it substitutes a domain **list** carrying the same three channels
  as inline indicators (§10.7).

**Out of scope**

- The hex-to-path compilation and `map.yaml` authoring — T12. This task consumes the
  compiled `manifest.taxonomy.map` paths; it does not produce them.
- `domainScores()` and the underlying fill/recency/breadth arithmetic — T11b, the Scoring
  Engine (§11.6, §11.7). This component renders `DomainScore` values; it does not compute
  them.
- The domain skill-listing view itself (`/d/<domainId>`) that selecting a region routes
  to — T14 owns routes; the listing view's own content is a separate deliverable if not
  already covered elsewhere.
- Full screen-reader verification (axe gate, keyboard-only manual pass) — T20. This task
  must produce the accessible name structure §10.7/§15.3 require, but the systematic
  accessibility pass and its CI gate are T20's.
- The graded, decaying recency channel — explicitly deferred to phase 2 as **R-20**, never
  built here even experimentally (D-20).
- D21's subregion-promotion trigger (when subregions become prominent divisions) — a
  PRD-level open decision (D21), architecturally a future styling change only.

## Deliverables

```
app/src/lib/components/MapRenderer.svelte      the map, §10.5–§10.7 in full
app/src/lib/components/MapRenderer.test.ts      channel rendering + navigation tests
```

## Interface contract

```html
<!-- ARCHITECTURE §10.5 — SVG structure, verbatim -->
<svg viewBox="…" role="group" aria-label="World map of life domains">
  <g class="region" data-domain="making" tabindex="0" role="link">
    <path class="region-base"    d="…"/>   <!-- palette base -->
    <path class="region-fill"    d="…" clip-path="url(#fill-making)"/>
    <path class="region-outline" d="…"/>
    <g    class="subregions">…</g>
    <text class="region-label">Making</text>
  </g>
</svg>
```

```
// ARCHITECTURE §10.5 — the three-plus-one channel table, verbatim

| Channel | Encoding | Source |
|---|---|---|
| Fill | A clip rectangle rising from the region's base, animated on change | Domain score through the concave curve (§11.6) |
| Recency | A date beside the label and in the accessible name — "Last activity — 12 March", or "No activity yet" when `lastActivityAt` is null. **No saturation, no shimmer, no fade** (D-20; graded channel is R-20, phase 2) | §11.7 |
| Breadth | A small count of skills started, rendered as text beside the label | §11.6 |
| Fog | Desaturated, low-contrast, with the region name replaced by a "no skills yet — contribute one" affordance | Zero published trees in the manifest (F22) |
```

```
// ARCHITECTURE §11.6 — the fill formula this component's clip-path height is driven by
fill(domain) = s / (s + 48)   // ∈ [0, 1), asymptotic, never saturates
```

```ts
// ARCHITECTURE §14.4 — the input this component's data comes from
export function domainScores(
  taxonomy: Taxonomy,
  skills: ReadonlyArray<DomainSkillRow>,
): Map<DomainId, DomainScore>;

export interface DomainScore {
  readonly domain: DomainId;
  readonly score: number;
  readonly fill: number;                  // this component's clip-path height
  readonly breadth: number;
  readonly lastActivityAt: string | null; // null → "No activity yet"
}
```

Component props are `(manifest: Manifest, domainScores: Map<DomainId, DomainScore>)` —
unchanged by T26/F3 and F4. This component reads `fill`, `breadth` and `lastActivityAt`
from `DomainScore`; the map is total over the taxonomy, so every domain has an entry and
there is no `undefined` branch. **There is no `band` field.** The named band is a
presentation mapping this component performs over `fill` via T11b's band resolver (§11.6,
T26/F18). Do not invent band names or thresholds locally.

## Acceptance criteria

- [x] Fill is implemented as `clip-path`, not `opacity` or `width`/`height` alone; a
      component test asserts a partly-filled region's outline and label remain
      full-opacity (§10.5).
- [x] No component test or rendered DOM node ever contains a raw percentage string for a
      domain's fill — grep the rendered markup for `%` in a fill-adjacent node and assert
      none is present (F34).
- [x] Fill is also exposed as text in the region's accessible name and on focus, carrying
      a **named band**, not a number (§10.5, N5, §15.3).
- [x] Recency renders as a literal date string ("Last activity — 12 March" or equivalent),
      sourced from `lastActivityAt`, with no interpolated decay factor, opacity fade, or
      time-since computation beyond formatting the date (D-20).
- [x] Breadth renders as a plain integer count beside the label, with a test asserting it
      equals the number of started skills in that domain (F35, §10.5).
- [x] A domain with zero published trees in the manifest renders fogged (desaturated,
      contribute-one affordance) regardless of user state — a test using a manifest with
      an empty domain and non-empty user progress for that domain still shows fog (§10.5,
      F22).
- [x] Making's subregions render as interior stroke lines within the Making path, never as
      separate `<path>` elements with their own fill or outline — a test asserts no
      subregion-scoped `region-fill` or `region-outline` class exists (§10.6, F27).
- [x] Selecting a region (click or Enter/Space while focused) navigates to that domain's
      listing route (§10.7, F23).
- [x] Every region is reachable via keyboard in a stable order independent of pixel
      position — a test asserts the tab order matches the manifest's domain order rather
      than any computed layout position (§10.7).
- [x] Below the documented legibility threshold, the component renders a domain list
      instead of the SVG map, carrying the same three channels as inline text (§10.7,
      §8.5's narrow precedent).
- [x] `npm run --workspace app test -- MapRenderer` passes.

## Verification

```bash
npm run --workspace app test -- MapRenderer
npx tsc --noEmit --project app
```

Passing looks like: the channel and navigation test suite green, and a clean typecheck.

## Notes and hazards

- **~~F4 (T26) — `domainScores()` cannot produce recency.~~ RESOLVED 2026-08-05 — the row
  type was extended.** `DomainSkillRow` carries `lastActivityAt` and `DomainScore` reports
  the per-domain maximum, so the recency channel is unblocked and this component's props
  did not change. The alternative — this component reading `SKILL` rows — was never
  available: §14.1 marks `COMP ⇢ STATE` FORBIDDEN and §13.4 forbids components importing
  the engine.
- **~~F3 (T26) — `DomainScore` is an undefined type.~~ RESOLVED 2026-08-05.** It is now
  typed in §14.4, above. The one field this task expected and did **not** get is `band`;
  see the interface contract. That is deliberate, not an oversight to raise — F18 owns it.
- **F5 (T26) fixed a contradiction inside this document.** Its earlier copy of §10.5's
  channel table specified "saturation and a slow ambient shimmer, decaying over time" while
  the out-of-scope list below forbids building exactly that channel. §10.5 and the table
  above now both say what D-20 ships: a date, and no visual channel.
- **Never build the graded recency channel, even as a togglable extra.** R-20 defers it to
  phase 2 explicitly, and D-20's whole argument is that every shipped implementation of a
  decaying visible value was withdrawn or resented — building it "behind a flag" still
  means building it, and this task's job is to keep the option cheap to add later
  (`lastActivityAt` already being stored) rather than to add it now.
- **Region area encodes nothing (§10.3).** Do not let fill rendering or layout code
  accidentally couple region size to score or skill count — Making being a large region is
  a fixed authoring fact from T12, unrelated to how full it renders.
- The `k = 6` / `fill = s/(s+48)` constants are Scoring Engine territory (T11b) and must
  never be duplicated or re-derived in this component — this component reads the fill
  number T11b already computed and only decides how to draw it.


## T26 amendments — 2026-08-06

**F18 — the fill bands are named.** Five, over `fill`: **Quiet** `[0, 0.15)`, **Emerging**
`[0.15, 0.35)`, **Moderate** `[0.35, 0.55)`, **Active** `[0.55, 0.72)`, **Deep** `[0.72, 1)`
(§11.6). §15.3 and §15.4 no longer call them "tiers" — that word belongs to §11.3's five
names over pairs of *skill levels*, and this component must not reuse it.

**The band table is expected to change, and this task is where that gets designed for.**
The owner considers names, count and boundaries provisional pending real use. So:

- **Do not declare a `BandName` union type.** `TierName` sits nearby as a five-member union
  and looks like the precedent; it is not. Tiers are closed because F7 fixes them as pairs of
  levels 1–10. Bands have no anchor, and a union makes renaming one a type change across
  every consumer. The name is `string`.
- **Do not write a threshold into this component.** One ordered data table, one resolver,
  called by both this renderer and §15.3's accessible-name builder. The table is a pure
  dependency-free constant module — same class as `lib/types`, so §14.1 needs no new node.
- The bar: renaming a band, moving a boundary, or dropping to four bands must be a one-line
  data edit with no type change and no change here.
- Worth a property test that the table is non-empty and ascending, that its first bound is 0,
  and that every bound is in `[0, 1)`.

`DomainScore` still carries no band field (§14.4) — the mapping is presentation, and that is
what keeps the table tunable without touching the engine.

**F15.** §10.5's channel table sourced **Breadth** to §11.6; it is §11.7. Fixed in the spec;
if this doc reproduces that table, fix it here too.


## Implementation notes — 2026-08-14

**Done.** `MapRenderer.svelte`, `map-presentation.ts` and `MapRenderer.test.ts` (26 tests);
app 316 tests, tools 195, typecheck, lint, S1 gate and `npm run build` all clean.

Six decisions the document did not settle, recorded because each one was a fork:

- **A third file.** The deliverables named two; there are three. `map-presentation.ts` holds
  the accessible-name builder §15.3 shares with T20, the fill rectangle, the date formatter,
  the fog predicate and the geometry fallbacks — everything worth asserting without a DOM.
  Keeping it beside the component (rather than in `lib/`) is what lets `vitest MapRenderer`
  still be the whole suite: its tests live in `MapRenderer.test.ts`.
- **`bandFor` is imported from `$lib/scoring`, not restated.** `tiers.ts` is the local
  precedent for restating a mapping rather than importing the engine (§13.4), and it is the
  wrong precedent here: F18 requires **one table and one resolver**, and T11b's barrel
  re-exports `bandFor` in as many words "for T13's regions and T20's copy." Restating it
  would have been the exact duplication F18 exists to prevent. Nothing else in this component
  touches the engine, and a test greps both files for the four band boundaries.
- **The date carries a year** — "Last activity — 12 March 2026". §10.5's example omits it,
  but dropping the year either loses it outright or requires comparing against today, and
  comparing against today is the elapsed-time computation the criteria forbid. Formatted in
  UTC, matching §12.2's storage, so a late-evening completion does not move a day.
- **The threshold gates are written against code, not prose.** The D-20 gate forbids
  `shimmer`, `decay`, `saturate(`, `halfLife` and `Date.now`, and it strips comments first:
  the paragraphs naming the rejected mechanisms are the main thing stopping a later
  maintainer from re-adding them, and a gate that made writing them impossible would be
  working against its own purpose.
- **Clip-path ids are instance-scoped** (`$props.id()`), not `#fill-making` verbatim. Two
  maps on one page would otherwise have the second clipped by the first's fill.
- **The list branch uses real `<a href>`; the SVG regions use §10.5's `<g role="link">`
  verbatim.** Both report `{ domain, href }` upward and neither navigates — the shell owns
  the route (§13.4). The anchor is `base`-prefixed rather than `resolve()`d, because
  `/d/[domain]` is T14's and does not exist yet for `resolve()` to type-check against; the
  `svelte/no-navigation-without-resolve` suppression there is worth revisiting when it lands.

**One file outside the deliverables changed**: `lib/types/index.ts` re-exports
`CompiledMapRegion`, which `Manifest` already contained but nothing had addressed directly.

**Left for T14, deliberately**: nothing renders this yet. The manifest × `SKILL` join that
produces `DomainSkillRow[]` is T14's (T26/F4), and so is `/` and `/d/[domain]`, so wiring the
component into a route here would have meant building half of T14 without its cold-start
branches. `MAP_LIST_BELOW` is exported for the route that will measure its container.
