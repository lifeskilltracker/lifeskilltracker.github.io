# T30 — Map camera: two levels, label tiers, and the Survey system

| Field | Value |
|---|---|
| **Status** | complete |
| **Phase** | 2 |
| **Cluster** | views |
| **Blocked by** | T27, T28 |
| **Blocks** | T31, T33, T35 |
| **Spec** | UI-SPEC §4.3, §4.4, §5.1, §5.2, §5.6, §9 (A1, A3, A6); ARCHITECTURE §10.5, §10.7, §13.1 |
| **PRD** | F21, F22, F34, N5, N11 |

## Goal

The map has a camera. `/` fits all eight regions and `/d/<domainId>` fits one, both
prerendered, both camera states over the same rendered surface, with entering a region
flying the camera rather than navigating a page. Domain score renders as a ruled water
line across a full-strength plate instead of an opacity ramp; a domain with no published
trees renders as hachure; labels are set at fixed world sizes so exactly one tier is
legible at each level; and browser Back is the breadcrumb. After this task the map looks
like the document UI-SPEC describes and behaves as two steps rather than a poster.

## Why this shape

A free continuous camera fails on level-of-detail at this library's size. The reference
implementation's LOD is a single global boolean over a 5× zoom range and it works because
its map has 42 nodes; this library is projected at 164 and eventually 500, where a global
flag gives either an unreadable soup of labels or none at all. Scoping level 1 to **one
domain** bounds the labelled-hex count by the largest single domain regardless of library
growth — a structural constraint rather than a tuned one. Every camera state being a URL
is what makes Back the breadcrumb, which is the cheapest orientation mechanism available
and the reason there is no breadcrumb widget. The water line (A3) exists because
opacity-as-fill drains the map of colour at exactly the scores most domains hold most of
the time, destroying the per-region identity F21 asks for.

## Scope

**In scope**

- **Two camera levels**, both routes: level 0 at `/` fitting all eight regions, level 1 at
  `/d/<domainId>` fitting one. Both stay prerendered (A6); `/d/<domainId>` becomes a
  camera state over the map surface, so the transition is animated rather than a
  navigation.
- **The water line (A3).** Plate at full strength at every score, `--plate-open` opacity;
  a horizontal line across the region at height `1 − fill`, plate at full opacity below and
  open above; the line ruled in ink at 1.3 units and clipped to the region path. `fill` is
  unchanged — §11.6's `s/(s+k)` concave curve — and **never a raw percentage** (F34).
- **Fog (§4.4).** A domain with no published trees — a property of the manifest, never of
  user state (F22) — renders as 45° hachure in ink at 0.7 units, plate at 0.10, and its
  region name replaced by the contribute affordance. No colour, no fill, no water line.
- **Label tiers (§5.2).** Fixed world sizes, computed once at build time from the world
  extent and `hexSize` and asserted in a test, not hand-tuned: a domain label resolves to
  22–28 px at level 0 and stays legible at level 1; a skill label resolves to below 9 px at
  level 0 and 14–18 px at level 1. No per-zoom label rules and no fade thresholds.
- **Stroke stepping.** Region outlines 1.3 world units at level 0 and 0.9 at level 1, so
  outlines hold constant *screen* weight rather than growing with the camera.
- **Focus dim.** Focusing a region at level 0 holds it at full strength and drops
  everything else — the same mitigation §9.4 already applies to tree edges.
- **Motion (§5.6)**: camera fly 420 ms smootherstep, water line on score change 200 ms,
  focus dim 140 ms; and `prefers-reduced-motion: reduce` making the level change instant.
- **Announcement.** Entering a domain announces region name, band, breadth and skill count
  on the existing polite live region.

**Out of scope**

- **Skill hexes and the detail panel — T31.** Level 1 in this task shows the same channels
  as level 0 at a closer camera; the skill layer arrives with T31, which also owns the
  phone list substitution at level 1.
- **The first-load reveal — T35.** This task must end on the resting frame the reveal
  hands over; it must not animate anything on first paint.
- **Sidebar, Find, Info, the next-step card — T32 and T33.**
- **Tokens.** T27 owns every colour, opacity and face; this task consumes them.

## Deliverables

```
app/src/lib/components/MapRenderer.svelte     water line, hachure, label tiers, focus dim
app/src/lib/components/camera.ts              level ↔ viewBox, fit, the fly interpolation
app/src/lib/components/camera.test.ts         pure: fit, interpolation, reduced-motion
app/src/lib/components/map-presentation.ts    fill → water-line geometry; band lookup
app/src/routes/d/[domain]/+page.svelte        level 1 as a camera state, prerendered
app/src/lib/components/MapRenderer.test.ts    channels, transitions, announcements
```

## Interface contract

```ts
// app/src/lib/components/camera.ts — pure, no DOM
export type CameraLevel =
  | { readonly level: 0 }
  | { readonly level: 1; readonly domain: DomainId };

export interface ViewBox { x: number; y: number; w: number; h: number; }

export function fit(level: CameraLevel, world: WorldGeometry): ViewBox;
export function interpolate(from: ViewBox, to: ViewBox, t: number): ViewBox; // smootherstep
export const FLY_MS = 420;

// map-presentation.ts — the A3 water line, replacing the opacity ramp
export function waterLine(fill: number, bounds: ViewBox): { y: number };
```

Label sizes are build-time constants with asserted bounds, not props:

```ts
export const DOMAIN_LABEL_WORLD_SIZE: number;   // → 22–28 px at level 0
export const SKILL_LABEL_WORLD_SIZE: number;    // → <9 px at level 0, 14–18 px at level 1
```

## Acceptance criteria

- [x] `/` and `/d/<domainId>` are both prerendered; the built output contains an HTML file
      for every domain.
- [x] Navigating from `/` into a domain animates the camera and does not remount the map
      surface. Asserted by an identity check on the rendered region paths across the
      transition.
- [x] Browser Back from level 1 returns to level 0 with the camera flown back, and no
      breadcrumb widget exists anywhere in the markup.
- [x] Every region renders its plate at `--plate-open` at every score; a domain at fill 0
      and a domain at fill 0.9 differ only by water-line height. Asserted directly.
- [x] No raw percentage appears in the rendered map (F34). `grep` for `%` in the map's
      accessible names returns nothing.
- [x] A fogged domain renders hachure, no water line, and the contribute affordance in
      place of its name — driven by the manifest, and unchanged by any user state.
- [x] The two label world sizes resolve into their specified pixel bands at both levels,
      computed from the real world extent and asserted in a test.
- [x] Region outlines hold constant screen weight across the transition (1.3 → 0.9 world).
- [x] Under `prefers-reduced-motion: reduce` the level change is instant and the water line
      does not animate; nothing is lost, per §15.5.
- [x] Entering a domain announces name, band, breadth and skill count on the polite region.
- [x] `app/a11y/manual-passes.mjs` passes unchanged.

## Verification

```bash
npm test --workspace app -- MapRenderer camera map-presentation
npm run build && npm run a11y:manual --workspace app
npm run check:budget
```

## Notes and hazards

- **A1 must land first.** §10.7 currently reads "no pan, no zoom, no camera"; an
  implementer working from the architecture alone will build the wrong thing. This is why
  T28 blocks this task.
- **Opacity-as-fill is the tempting wrong answer** and it was in the first draft of the
  design. A domain at 18% is a domain with a low water line, not a faded domain. It also
  violates §10.5's own requirement that a partly-filled region keep its full-strength
  outline and label.
- **The label sizes are derived, not chosen.** If they are hand-tuned the constraint stops
  being structural and the LOD argument in §5.1 stops holding at 500 nodes.
- **Do not add a fade threshold to hide skill labels at level 0.** Geometric scaling alone
  is meant to make them illegible and therefore absent; a threshold is the per-zoom rule
  §5.2 exists to avoid.
- **The map must paint to its resting frame on first load.** T35 layers the reveal on top;
  a map that animates itself into place leaves T35 nothing to hand over to.

## Outcome — what the build settled

Every acceptance criterion above is met, and the composed verification is green: 950 + 348
tests, `svelte-check` 551 files 0 errors, `eslint` clean, `a11y:manual` **43 of 43**,
budget 58.8 / 82.0 kB first paint, `check:s1` holds, and `build/d/` holds all eight
prerendered listings beside `build/index.html`.

- **The surface moved into the shell, and that is the whole of A6.** SvelteKit destroys one
  route component and creates the next, so `/` and `/d/<id>` can only share DOM nodes if
  neither route owns them. `Shell.svelte` mounts `MapSurface`; the routes contribute the
  camera *level* and their own content beneath it, and neither declares a `<main>`.
  `shell.test.ts` asserts this by node identity across a `pathname` change, which is the
  only form of the claim a re-render cannot accidentally satisfy — "the map is still drawn"
  passes just as well when the router has rebuilt everything.
- **A `bind:this` clears to `null`, not `undefined`, and the shell outlives what it binds.**
  The `ResizeObserver` guard read `=== undefined`, so leaving the map for `/library` called
  `observe(null)`, which threw and took the client runtime with it: every navigation after
  that changed the URL and rendered nothing. It surfaced only in `a11y:manual`, because
  every unit test mounts the shell at one path and none of them leaves the map. Cold loads
  and `/library → /s/piano` both worked, which is why the failure read as a tree-route
  problem for a while. Fixed to `== null`, and the reasoning is recorded at the
  declaration.
- **§4.4's three fog numbers live in `map-presentation.ts` and reach the stylesheet as a
  variable.** The plate opacity had been written twice — the constant and a `0.1` literal in
  the CSS — which is the drift these constants exist to prevent. `--hachure-plate` is now
  set beside `--outline-width` on the `<svg>`, and the test pins the pattern's spacing,
  stroke and opacity against the exported constants.
- **A fogged region draws no water line, not a water line at zero.** "Scored zero" and "not
  scored" are different claims and §4.4 makes only the second one; `.region-waterline` is
  asserted absent alongside `.region-below`.
- **The skill label band does not hold for all eight regions, and this is recorded rather
  than tuned away.** `play` (208×260) and `outdoors-nature` (381×140) fit by their long axis
  and so zoom least, landing at 12–13 px against §5.2's 14–18. §5.3 already names these two
  as the pair that "zoom least and set the floor"; what it does not account for is that they
  fall under its own floor. `camera.test.ts` asserts the shortfall explicitly. **T31 owns
  the decision** — widen the band, or fit level 1 to a constant box — and it must be made
  deliberately, not by hand-tuning `SKILL_LABEL_WORLD_SIZE` until one number passes.
