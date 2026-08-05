# T13 — Map Renderer

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | views |
| **Blocked by** | T11, T12 |
| **Blocks** | T20 |
| **Spec** | ARCHITECTURE §10.5, §10.6, §10.7 |
| **PRD** | F21, F33, F34, F35, D-20 |

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
  **named band** over the continuous fill number, matching the tier text §15.3 also
  announces to screen readers (§11.6).
- Recency rendered as **a date in the region's text/accessible name** — "Last activity —
  12 March" — plus the saturation/shimmer visual treatment §10.5 describes, with no decay
  function, no fade constant, and no tuning knob anywhere in this component (D-20). The
  shimmer respects `prefers-reduced-motion` (§15.5, owned fully by T20 but must not be
  built to require motion).
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
- `domainScores()` and the underlying fill/recency/breadth arithmetic — T11, the Scoring
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
| Recency | Saturation and a slow ambient shimmer on the outline, decaying over time | §11.7 |
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
  skills: ReadonlyArray<{ treeId: string; domain: DomainId; attainedLevel: number }>,
): Map<DomainId, DomainScore>;
```

Component props are `(manifest: Manifest, domainScores: Map<DomainId, DomainScore>)`.
`DomainScore` is the record this component reads `fill`, `band` (the named tier), `breadth`,
and `lastActivityAt` from — see Notes and hazards for the open question on this type's
exact shape.

## Acceptance criteria

- [ ] Fill is implemented as `clip-path`, not `opacity` or `width`/`height` alone; a
      component test asserts a partly-filled region's outline and label remain
      full-opacity (§10.5).
- [ ] No component test or rendered DOM node ever contains a raw percentage string for a
      domain's fill — grep the rendered markup for `%` in a fill-adjacent node and assert
      none is present (F34).
- [ ] Fill is also exposed as text in the region's accessible name and on focus, carrying
      a **named band**, not a number (§10.5, N5, §15.3).
- [ ] Recency renders as a literal date string ("Last activity — 12 March" or equivalent),
      sourced from `lastActivityAt`, with no interpolated decay factor, opacity fade, or
      time-since computation beyond formatting the date (D-20).
- [ ] Breadth renders as a plain integer count beside the label, with a test asserting it
      equals the number of started skills in that domain (F35, §10.5).
- [ ] A domain with zero published trees in the manifest renders fogged (desaturated,
      contribute-one affordance) regardless of user state — a test using a manifest with
      an empty domain and non-empty user progress for that domain still shows fog (§10.5,
      F22).
- [ ] Making's subregions render as interior stroke lines within the Making path, never as
      separate `<path>` elements with their own fill or outline — a test asserts no
      subregion-scoped `region-fill` or `region-outline` class exists (§10.6, F27).
- [ ] Selecting a region (click or Enter/Space while focused) navigates to that domain's
      listing route (§10.7, F23).
- [ ] Every region is reachable via keyboard in a stable order independent of pixel
      position — a test asserts the tab order matches the manifest's domain order rather
      than any computed layout position (§10.7).
- [ ] Below the documented legibility threshold, the component renders a domain list
      instead of the SVG map, carrying the same three channels as inline text (§10.7,
      §8.5's narrow precedent).
- [ ] `npm run --workspace app test -- MapRenderer` passes.

## Verification

```bash
npm run --workspace app test -- MapRenderer
npx tsc --noEmit --project app
```

Passing looks like: the channel and navigation test suite green, and a clean typecheck.

## Notes and hazards

- **F4 (T26) — `domainScores()` cannot currently produce recency.** The signature shown
  above takes `skills: { treeId, domain, attainedLevel }[]`, which carries no
  `lastActivityAt`. This task cannot ship the recency channel until T11 resolves F4 (either
  by extending the row type or moving the recency rollup elsewhere) — treat this as a
  blocking dependency on T11's resolution, not something to work around locally by having
  this component reach into `SKILL` rows directly, which would violate §13.4's rule that no
  component imports the Scoring Engine's inputs directly.
- **F3 (T26) — `DomainScore` itself is an undefined type**, reconstructable only from
  §11.6, §11.7, and §10.5's channel table (fill, breadth, `lastActivityAt`, and presumably
  a `band` field for the named tier). Do not invent this type independently in this
  component; consume whatever T11 ships once F3 is resolved, and if it lacks a field this
  task needs (e.g. the named band string), that is a T11-side gap to raise, not one to
  patch by computing the band locally from a raw fill number.
- **Never build the graded recency channel, even as a togglable extra.** R-20 defers it to
  phase 2 explicitly, and D-20's whole argument is that every shipped implementation of a
  decaying visible value was withdrawn or resented — building it "behind a flag" still
  means building it, and this task's job is to keep the option cheap to add later
  (`lastActivityAt` already being stored) rather than to add it now.
- **Region area encodes nothing (§10.3).** Do not let fill rendering or layout code
  accidentally couple region size to score or skill count — Making being a large region is
  a fixed authoring fact from T12, unrelated to how full it renders.
- The `k = 6` / `fill = s/(s+48)` constants are Scoring Engine territory (T11) and must
  never be duplicated or re-derived in this component — this component reads the fill
  number T11 already computed and only decides how to draw it.
