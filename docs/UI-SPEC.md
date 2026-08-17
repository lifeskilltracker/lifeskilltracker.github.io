# Life XP Skill Tracker — Interface Specification

**Version:** 1.0
**Date:** 2026-08-16
**Owner:** Ethan Morchy
**Status:** Design agreed; ready for task breakdown

---

## 1. Purpose and scope

`docs/ARCHITECTURE.md` specifies what the interface must *compute* and *expose*. It deliberately declines to specify what it looks like: §15.9 defers visual design and palette to product, and **D19** — "visual identity per domain — palette and silhouette that make each region legible as its own place" — has been open since PRD v1.1.

This document closes D19 and specifies the interface: the visual system, the map's camera model, the application chrome, and the tree's presentation. It is written against the state of the app after T25, which is functionally complete through phase 1 and carries no visual design at all — no tokens, no theming, and stock Chakra defaults in `content/taxonomy/domains.yaml`.

**It is normative for presentation and non-normative for everything else.** Where it touches computed behaviour it does so by naming an amendment to `ARCHITECTURE.md` (§9 below), never by contradicting it in place.

### 1.1 What this document does not cover

Layout of tree nodes (§8 of ARCH), scoring (§11), persistence (§12), and the content schema (§5) are unchanged and not restated. The controlled vocabulary of facet tags (D12), the content licence (D26), and tree-family templating (D24) are content and product questions untouched here.

---

## 2. Decisions

| | Decision | Displaces |
|---|---|---|
| **U-01** | The map has a **two-level stepped camera**, not a static poster and not a free camera | ARCH §10.7 |
| **U-02** | Visual direction is **Survey / Ordnance** — ink-on-paper cartography | PRD D19 |
| **U-03** | **Hue is identity and never encodes score.** Domain score is a ruled water line | ARCH §10.5 |
| **U-04** | Skill positions are **derived, append-only, and frozen at publish** | new; serves F13, N11 |
| **U-05** | Chrome is a **collapsible left sidebar** plus **Find** and **Info** bottom-right | ARCH §13.4 |
| **U-06** | A **persistent next-step affordance** is always visible on the map | new; serves F36 |
| **U-07** | **Find highlights in place**; it is also the only filter UI | new |
| **U-08** | One **subsetted display face**; body and data type use system stacks | ARCH §17.1 |
| **U-09** | The tree keeps its static layout and gains a **level camera** | ARCH §9 |
| **U-10** | On phones the **world map survives**; the list substitution moves to the skill level | ARCH §10.7, §15.3 |
| **U-11** | A **short reveal animation on first load only** — "The Survey" (§5.7) | PRD D25 (partial) |

Each is argued at the point it is specified below.

---

## 3. Who this is for, and for how long

Two audiences with opposite session shapes, and every decision above resolves toward the first where they conflict.

**The Player** (PRD §4.1) opens the app *a few times a week, briefly, because they finished something*. For them the map is a hub they pass through in seconds on the way to a tree. Their session is: land, see where I am, go to the thing, tick it, leave. Spectacle they cannot skip is a tax paid every visit.

**The Curious Browser** (PRD §4.4) arrives once, intends to track nothing, and is the top of the contributor funnel. For them the map *is* the product, and the first ten seconds decide whether they ever return.

The resolution throughout: **make the first load a moment, and every load after it fast.** The reveal animation plays once ever (U-11). The next-step card (U-06) exists so the Player's whole reason for opening the app is answered before they take an action. The sidebar's started-skills list exists so they can skip the map entirely.

**Complexity budget.** Nothing a first-time visitor can stumble onto may require explanation. Search syntax, filters, and the band vocabulary live behind Find and Info; the map itself carries eight labelled regions, a water line, and one card.

---

## 4. The visual system

### 4.1 Direction

**Survey / Ordnance.** The map is literally a map, so it borrows the vernacular that has solved this exact problem for three centuries: ink plates on paper, engraved and tracked small-caps lettering, hachure for unmapped ground, and a ruled contour where a quantity changes.

Three properties earned it over the alternatives:

- **It carries eight hues.** An ink-on-paper ground is what lets eight saturated colours coexist as one document rather than eight competing brands. This is the hardest constraint in the whole design and most directions fail it.
- **It survives both themes as a token swap**, where a leaded-glass or terminal direction commits to one world and makes the other a second design.
- **It is calm at the fifth visit.** The Player sees this surface hundreds of times.

The rejected alternatives are recorded in §11.

### 4.2 Palette

Ground and ink:

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#DCE1DC` | `#11171A` |
| `--ink` | `#0F1516` | `#CBD4D2` |
| `--rule` | derived, `--ink` at 18% | derived, `--ink` at 22% |

Domain plates, replacing the Chakra placeholders in `content/taxonomy/domains.yaml`:

| Domain | Light | Dark |
|---|---|---|
| Mind | `#24505F` | `#57A0B8` |
| Body | `#8E3A18` | `#DE7440` |
| Making | `#8F5A14` | `#D69B36` |
| Home | `#1B5B3D` | `#3FA271` |
| People | `#6B1F42` | `#C25585` |
| Work & Money | `#1C3A72` | `#5386D6` |
| Play | `#432E78` | `#8873CF` |
| Outdoors & Nature | `#4A6420` | `#9BBB45` |

Hue separation is forced where two domains would otherwise collide: **Mind leans teal against Work's navy; Home leans blue-green against Outdoors' olive.** This is a legibility requirement, not a preference — F21 asks each region to be recognizable as its own place, and two blues at a glance is one place.

**The palette block in `domains.yaml` gains a dark variant.** It currently carries a single `{ base, accent }` pair; it becomes `{ light: { base, accent }, dark: { base, accent } }`. This is a schema change (§9, amendment A7).

### 4.3 Hue is identity; score is a water line

**U-03, and the single most important rule in this document.**

The obvious implementation of "fill" is opacity: a domain at 18% renders its colour at 18%. It is wrong, and it was wrong in the first draft of this design. A domain at 18% is *a domain with a low water line*, not *a faded domain* — and since most domains are low-scoring most of the time, opacity-as-fill drains the entire map of colour and destroys exactly the per-region identity F21 asks for. It also quietly violates ARCH §10.5's own requirement that a partly-filled region keep its full-strength outline and label.

So:

- **The plate renders at full strength at every score**, at `--plate-open` opacity (0.52 over paper).
- **Score renders as a horizontal water line** across the region at height `1 − fill`, with the plate at full opacity below it and `--plate-open` above.
- **The line itself is ruled in ink** at 1.3 units, clipped to the region path.

`fill` is unchanged: ARCH §11.6's `s/(s+k)` concave curve. Never a raw percentage anywhere (F34).

### 4.4 Fog

A domain with no published trees (F22 — a property of the manifest, never of user state) renders as **hachure**: 45° ruling in ink at 0.7 units, the plate at 0.10, and the region name replaced by the contribute affordance. No colour, no fill, no water line. This reads as *unsurveyed ground*, which is precisely F22's intent — promise rather than emptiness.

### 4.5 Typography

| Role | Face | Delivery |
|---|---|---|
| Display — region labels, headings, tier and band names | one engraved serif, small caps, tracked ~0.14em | self-hosted, subsetted woff2 |
| Body — all UI text, milestone prose | system stack | none |
| Data — levels, counts, dates | system mono stack, `tabular-nums` | none |

**The display face's glyph set is closed and tiny.** It renders eight domain names, three subregion names, five band names, five tier names, and a handful of UI headings — roughly 40 unique glyphs. Subsetting to that set puts a variable display face at **8–12 kB woff2**, which is what makes U-08 affordable at all.

**Rules.** `font-display: swap`, and the fallback stack must be metric-adjacent so the swap does not reflow the map. Region labels carry a **knockout halo** — `paint-order: stroke` with a 2.8-unit stroke in `--paper` — which is the standard cartographic answer to type over saturated ink and is what makes the bolder palette survivable.

Candidate faces are open (§10, Q1); the requirement is an engraved or transitional serif with a genuine small-caps or caps design, licensed for self-hosting.

### 4.6 Milestone states

ARCH §9.3's five states are unchanged in meaning and unchanged in encoding. Restated only in Survey terms:

| State | Glyph | Plate | Border |
|---|---|---|---|
| `complete` | ✓ | domain ink, full | solid 1.3 |
| `bonus` | ✓ | domain ink, 42% | solid 1.3 |
| `available` | ○ | open | solid 2.2, emphasized |
| `locked` | ‧ | open | dashed |
| `dismissed` | ✕ | open | dotted |

**N5's requirement holds exactly as §15.4 states it**: glyph and border style carry the state independently of fill, glyphs remain real `<use>` elements so they survive `forced-colors: active`, and nothing here introduces a sixth meaning on colour.

---

## 5. The map

### 5.1 Camera model

**U-01.** Two levels, both of them routes. There is no free camera and no continuous zoom.

| Level | Route | Camera | Shows |
|---|---|---|---|
| **0 — world** | `/` | fits all eight regions | silhouettes, labels, water lines, breadth, recency |
| **1 — domain** | `/d/<domainId>` | fits one region | the same, plus that region's skill hexes |

Entering a region flies the camera and fades in the skill layer. Leaving reverses it. **Every camera state is a URL and browser Back is the breadcrumb** — there is no breadcrumb widget, and this is the single cheapest orientation mechanism available.

Both routes stay prerendered (ARCH §13.1 is otherwise unchanged). `/d/<domainId>` becomes a camera state over the same rendered surface rather than a separate page, so the transition is animated rather than a navigation.

**Why stepped and not continuous.** The reference implementation's level-of-detail is a single global boolean over a 5× zoom range, and it works because its map has 42 nodes. This library is projected at 164 and eventually 500. A global LOD flag at that size gives either an unreadable soup of labels or none at all. Scoping level 1 to **one domain** bounds the labelled-hex count by the largest single domain — Making, projected at 45 — regardless of how large the library grows. The constraint is structural rather than tuned.

### 5.2 Label tiers

Domain labels and skill labels are set at **fixed world sizes**, chosen so that geometric scaling alone makes exactly one tier legible at a time. No per-zoom label rules, no fade thresholds, no code.

The sizes are constrained rather than magic:

- A **domain label** shall resolve to **22–28 px** on screen at level 0, and remains legible at level 1.
- A **skill label** shall resolve to **below 9 px** at level 0 — illegible, therefore visually absent — and to **14–18 px** at level 1.

Given the world's extent and `hexSize`, these bound the two font sizes directly; they are computed once at build time and asserted in a test, not hand-tuned.

**Stroke weights step across the transition** so outlines hold constant *screen* weight rather than growing with the camera: region outlines 1.3 world units at level 0 and 0.9 at level 1.

### 5.3 Skill placement

**U-04, and the one genuinely new mechanism in this design.**

Level 1 draws individual skill hexes, and nothing in the system knows where a skill goes. `map.yaml` assigns tiles to *domains*, not skills to tiles. Two requirements bound every possible answer:

- **F13** — contributors never author layout coordinates. So a `tile:` field on a tree is not available.
- **N11** — a change to one thing shall not visibly reflow the rest. Users return to these views repeatedly and spatial memory is the entire benefit of a fixed map.

Together these rule out both the authored answer and the semantic one. Deriving position from subregion or facet tags clusters related skills beautifully and re-packs every neighbour when one skill is added, which is N11's exact failure mode.

**The mechanism:**

1. **Subdivide.** Generate a hex lattice at `cellSize = hexSize / cellDivisor` over the region's bounding box. Keep every cell whose centre lies inside the region polygon. **`cellDivisor` is 4, globally — there is no per-region override** (Q2, resolved; see below). Every region holds between 96 and 160 cells, against §5.1's 500-skill projection of 43–137 per region.
2. **Enumerate.** Order the surviving cells in a spiral from the cell nearest the region centroid. Deterministic given the polygon and `cellDivisor`.
3. **Assign, append-only.** Each published tree takes the lowest-numbered free cell in its primary domain at the moment it is first compiled. The assignment is written to a **committed placement ledger** and never recomputed.

A new skill always takes the next free cell; **nothing already placed ever moves.** F13 is satisfied because nobody authors anything, and N11 is satisfied by construction rather than by care.

**Why the divisor is 4.** Two independent constraints meet there with no room either side. *Capacity:* at 3, the lattice yields 90 cells for Making, 61 for Body, and 63 for Home — all short of §5.1's 500-skill projection of 137, 82, and 70, forcing exactly the reflow the ledger exists to prevent. 4 clears every region with 1.2× headroom at the worst (Making, 160 cells against 137). *Touch target:* the level-1 camera frames one region, so a cell's screen size falls with the region's extent; Play and Outdoors zoom least and set the floor at 45 px per cell at divisor 4, against WCAG 2.5.5 AAA's 44 px. Divisor 5 drops that floor to 36 px and fails. 4 is the largest divisor that stays touchable and the smallest that holds the ceiling.

**One divisor, not one per region.** A per-region override buys nothing the global 4 does not already cover, and it costs the ledger its single most useful property — that a cell index means the same thing everywhere, so the placement algorithm reads identically for every domain. The override is dropped.

**The ledger reuses an existing pattern.** ARCH §6.4 already establishes a committed baseline with CI failing on unauthorized drift, for milestone identifier stability (F41). Placement is the same shape of problem and takes the same shape of answer: `lst compile` assigns cells to trees that lack them, and CI fails if an existing assignment changed. No new concept is introduced.

**Three consequences, stated so they are not mistaken for defects:**

- **A retired skill leaves a hole.** Filling it would move whoever is currently in the next cell. The hole is correct.
- **A skill changing primary domain frees its old cell and takes a new one** in the destination. Freeing is safe precisely because assignment is by lowest-free rather than by count.
- **Editing a region's tiles in `map.yaml` reflows that domain's skills.** The polygon changed, so the lattice changed. This is a maintainer action, is rare, and the compiler shall warn loudly and name the affected trees. It is the one place N11 is knowingly traded, and it is traded for the ability to grow the map at all.

### 5.4 Skill hex states

A skill hex encodes, in the same never-colour-alone discipline as §4.6:

| Channel | Encodes |
|---|---|
| Plate colour | its domain (identity) |
| Water line | the skill's attained level over 10 |
| Border | started (solid) vs unstarted (dashed) |
| Glyph | mastery content present, level 10 attained |

Everything the hex encodes visually is also in its accessible name, per §15.3's rule.

### 5.5 Interaction

- **Level 0, click a region** → fly to level 1.
- **Level 1, click a skill hex** → open the **skill detail panel**: title, attained level, tier, progress to next, the blocking level, the next available milestone, authors (F6), and an **Open tree** button.
- **Level 1, click Open tree** → navigate to `/s/<treeId>`.

**The two-click path is deliberate.** A domain view exists to compare skills, and one-click navigation makes every look cost a page load and a trip back. It also avoids the reference implementation's cleverest and least defensible behaviour, where the same click means "fly the camera" or "open the detail" depending on the current zoom, with nothing signalling which.

**Hover and focus dim the rest.** Focusing a region at level 0, or a skill hex at level 1, holds it at full strength and drops everything else. This is the same mitigation ARCH §9.4 already applies to tree edges, applied to the map for the same reason.

**Keyboard.** Regions and skill hexes are real links with resolved `href`s, reachable in the stable documented order §15.3 requires. Arrow keys move between hexes by nearest-neighbour within a directional cone; `Enter` activates; `Esc` returns to level 0. The existing roving-`tabindex` model is unchanged.

### 5.6 Motion

| Transition | Duration | Easing |
|---|---|---|
| Camera fly, level 0 ↔ 1 | 420 ms | smootherstep |
| Skill layer fade | 260 ms, 120 ms after camera start | ease-out |
| Water line on score change | 200 ms | ease (existing) |
| Focus dim | 140 ms | ease-out |
| First-load reveal | 1200 ms total | §5.7 |

ARCH §15.5's rule holds throughout: nothing in the interface conveys information only through motion, so removing all of it loses nothing.

### 5.7 The first-load reveal

**U-11. Named "The Survey".** The map is drawn in the order a real one is made — the engraver's linework, then the colour plates, then the type. It is the visual direction's own manufacturing process used as its reveal, which is why it was chosen over four alternatives (§11).

**A constraint that eliminated most candidates: on a true first load every domain score is zero.** Fill derives from user progress and a first-time visitor has none, so the reveal renders eight open plates, no water lines anywhere, and whichever regions the manifest reports as fogged. Any reveal built on progress animating into place shows a first-timer nothing at all. The reveal must be beautiful with no data in it, and fog — which is manifest-derived, not user-derived — is the only real state present on a cold visit.

**Sequence.** Three overlapping phases, staggered per region by distance from the world centre (`t` below is that distance normalized to `[0,1]`):

| Phase | Window | Behaviour |
|---|---|---|
| **Linework** | 0 → 460 ms, delay `t × 60` | Each region's outline draws along its own path via `stroke-dashoffset`, from its full `getTotalLength()` to zero |
| **Plates** | 300 → 800 ms, delay `t × 80` | Plate opacity 0 → `--plate-open`; hachure rises to 0.55 on fogged regions only |
| **Lettering** | 640 → 1100 ms, delay `t × 90` | Label opacity 0 → 1 with letter-spacing settling 5px → 0.14em |

Easing is `cubic-bezier(.16, .84, .44, 1)` throughout.

**Camera settle.** A 1.06 → 1.00 pull-back over the full 1200 ms, eased out, about the world centre. It is a **modifier rather than part of the reveal** — it layers onto the sequence at no cost and is the restrained form of a zoom-out establishing shot. The full form, opening close on one region and pulling back, was declined: 1200 ms leaves no room for it alongside the reveal, and opening on a particular domain implies that domain matters.

**Three properties are load-bearing:**

- **It plays once ever**, gated on a local flag. It is for the Curious Browser, and the Player must never pay for it twice.
- **It ends on the resting frame** — plates at open strength, hachure settled, labels set, camera at rest — so the welcome dialog (D25) opens over a finished picture with nothing still in motion.
- **Under `prefers-reduced-motion: reduce` it does not play at all**, and the map paints directly to that same final frame. Not a shortened version; skipped.

**Implementation note.** The linework phase needs `getTotalLength()` on each region path, which forces layout. Measure all eight once after first paint and cache, rather than per-region inside the animation setup.

---

## 6. Chrome

### 6.1 Sidebar

**U-05.** Left, collapsible to an icon rail, collapsed state persisted locally. It replaces the current top nav bar and gives the map its vertical extent back.

Four blocks, in this order:

1. **Primary nav** — Map, Library, Data, About, Contribute.
2. **Domains** — all eight, nested; the active one highlighted. This doubles as the "where am I" indicator at level 1 and is the cheapest orientation cue available.
3. **Your skills** — started trees with attained level, linking straight to `/s/<treeId>`. For the returning Player this is the most-used control in the application, because it is why they opened it.
4. **Domain progress** — the eight band names (Quiet → Deep) and skills-started counts, as text. Partly redundant with the map, which is the point: N5 requires these numbers to exist as text somewhere, and this is a better home than a focus-only announcement.

Block 3 is empty for a first-time visitor and renders as an invitation, not a void.

### 6.2 Find

**U-07.** Bottom-right, opens on click or `Ctrl`/`Cmd`+`F`.

**It highlights in place.** Typing lights up every matching skill across the whole map and dims the rest; the camera does not move. This makes Find double as **the only filter UI in the application** — "knitting", "outdoors", "level 3" — which is exactly what the reference implementation lacks and is criticized for. `Enter` flies to the top hit; `Esc` clears.

Matching runs over skill title, domain, subregion, and facet tags. It shall not silently omit a content type.

### 6.3 Info

**U-05.** Bottom-right beside Find. Opens the legend: what the water line means, the five band names, what hachure means, what the hex borders mean, and what the glyphs mean.

This is not optional polish. **F34 forbids showing a raw percentage**, so a user who wants to know what the fill height means has nowhere else to find out, and "no legend" is the most concrete criticism the prior-art review turned up.

### 6.4 The next-step card

**U-06,** and the one place this design deliberately goes beyond its reference.

Bottom-left, always visible on the map: **one** milestone — *"Blacksmithing · Forge a J hook"* — that flies the camera and opens the milestone when activated.

F36 and §15.2's `.` shortcut already promise the concrete next action, and the PRD calls it the product's central differentiator, but nothing above the tree level surfaces it. The prior-art review found the two poles of this axis and both fail: one product bought perfect orientation by deleting all agency, and the other has total agency with weak orientation and left its "recommended next" affordance behind an experiment flag. **A map that shows state and also answers "so what do I do" is the gap between them.**

Selection rule: the next available milestone (F36) in the skill with the most recent activity; ties broken by tree id for stability. The card is dismissible for the session and renders as an invitation when the user has started nothing.

---

## 7. The tree

**U-09.** ARCH §8's layout, §9's node encoding, and §15.2's keyboard grid are **unchanged**. The tree gains two things:

- **The Survey visual system** — plates, water line on the level header, engraved level and tier labels, hachure nowhere (a tree is never fogged).
- **A level camera.** No free zoom. The view glides between level bands: jump to the blocking level, to the next available milestone (the `.` shortcut's visual counterpart), or to level 10.

Free pan and zoom were considered and declined. §15.2's arrow-key grid and roving `tabindex` both assume stable, readable positions, and scaling milestone text in and out fights the one thing the tree exists to do, which is let someone read their next concrete action.

Mastery content keeps its separate panel below the tree (§9.6). Narrow presentation (§8.5, §9.5) is unchanged.

---

## 8. Responsive and accessible behaviour

### 8.1 Where the map gives way to a list

**U-10.** ARCH §10.7 currently substitutes a domain list below a viewport legibility threshold, so a phone visitor never sees the map at all. Since the Curious Browser is disproportionately on a phone and the map is the entire reason they might care, that threshold is in the wrong place.

**The threshold moves from viewport size to zoom level:**

| | Phone | Desktop |
|---|---|---|
| Level 0 — world | **map** | map |
| Level 1 — domain | **list of skills** | map with skill hexes |

Eight labelled regions genuinely do fit a phone. Skill hexes are where labels stop being legible and 44×44 px touch targets stop fitting, so that is where the honest list belongs.

**§15.3's convergence claim must be restated, not dropped.** It currently reads that the small-viewport and screen-reader experiences converge because both get the list. They still converge at the skill level; at the world level the screen reader gets the region list while the phone gets the map, and both carry the same channels in the same documented order. The property that matters — *the same content in the same order* — is preserved; the sentence asserting it must be rewritten to say so.

### 8.2 Accessibility

Everything in ARCH §15 holds. Three additions:

- **Camera transitions are announced, not just animated.** Entering a domain announces the region name, band, breadth, and skill count on the existing polite live region.
- **The next-step card is a landmark**, reachable without traversing the map.
- **Find's highlight state is exposed as text** — "12 skills match" — because a highlight that exists only visually is precisely the colour-only encoding N5 forbids.

`prefers-reduced-motion: reduce` disables the camera fly (the state change becomes instant), the skill-layer fade, the water-line animation, and the reveal.

**The existing manual pass is unaffected.** `app/a11y/manual-passes.mjs` was written against roles and accessible names only, with no CSS selector, no pixel, and no screenshot, specifically so the UI could be reworked without breaking it. It should continue to pass unchanged, and if it does not, that is a real regression rather than test churn.

---

## 9. Amendments required to `ARCHITECTURE.md`

Seven, named here so they do not surface as surprises during implementation. Each is a spec edit, not a code change, and they should land together in the manner of T26.

| | § | Change |
|---|---|---|
| **A1** | §10.7 | "No pan, no zoom, no camera" is replaced by the two-level camera (§5.1). The list substitution moves from a viewport threshold to a zoom level (§8.1) |
| **A2** | §10.1, §10.4, D-08 | The union survives untouched and still produces eight silhouettes. A **skill-hex sub-lattice layer** is added, drawn only for the focused region (§5.3). D-08's reasoning is strengthened rather than weakened: it is what keeps level 0 at eight paths |
| **A3** | §10.5 | Fill is a **water line at full plate strength**, not an opacity ramp (§4.3) |
| **A4** | §17.1 | Add a font row (~12 kB). Total first paint rises from ≤ 70 kB to **≤ 82 kB** |
| **A5** | §15.3 | Restate the convergence claim (§8.1) |
| **A6** | §13.1, §13.4 | `/d/<domainId>` becomes a camera state over the map surface rather than a separate page; both routes stay prerendered. `+layout` gains the sidebar, Find, Info, and the next-step card |
| **A7** | §5.9 | `domains.yaml` `palette` gains light and dark variants; schema change, additive |

**Also resolved: PRD D19** (§4.1, §4.2). **Partially addressed: PRD D25** — the Curious Browser now reaches a compelling view on a phone and gets a first-load moment, but the question of how they reach a *tree* without starting one is untouched.

**One compiler correctness note** belongs with A2 and was found while prototyping the union: region corners must be held as **exact integers on the hex lattice** — `(2q + r ± 1, 3r ± 1|2)` for pointy-top — and converted to pixels only at emit. Keying interior-edge cancellation on rounded floats leaves stray boundary edges and the loop fails to close. This is what §10.4's "snapping to a shared vertex grid" means, and it is the kind of line that gets implemented as `toFixed(2)` and silently half-works: in a prototype over these eight regions, two of the eight failed to close.

---

## 10. Proposed task breakdown

Nine tasks. T27 and T28 are prerequisites for everything visual; T29 is independent and lives in `tools/`.

| Task | Scope | Blocked by |
|---|---|---|
| **T27** — Design tokens and theme substrate | CSS custom properties, light/dark/system per §4.2, `domains.yaml` dark variants (A7), display face selection and subsetting, `check:budget` amendment (A4) | — |
| **T28** — Architecture reconciliation | Amendments A1–A7 landed in `ARCHITECTURE.md` | — |
| **T29** — Skill placement | Sub-lattice, spiral enumeration, placement ledger, `lst compile` assignment, CI drift gate. `tools/` only, no app dependency | — |
| **T30** — Map camera | Two-level stepped camera, route binding, label tiers, stroke stepping, focus dim, motion and reduced-motion | T27, T28 |
| **T31** — Skill hex layer and detail panel | Skill hexes, their four channels, the detail panel, phone list substitution (§8.1) | T29, T30 |
| **T32** — Shell chrome | Sidebar with four blocks, collapse and persistence, next-step card | T27 |
| **T33** — Find and Info | Highlight-in-place search, filter semantics, live-region count, legend | T30, T32 |
| **T34** — Tree restyle and level camera | Survey system applied to `TreeView`, level camera, `.`-shortcut counterpart | T27 |
| **T35** — Reveal, and accessibility verification | First-load reveal, `prefers-reduced-motion` audit across all of the above, `a11y:manual` re-run, `forced-colors` check | T30–T34 |

**Critical path:** T27 → T30 → T31 → T33. T29 can start immediately and in parallel; it is the longest single piece of new logic.

---

## 11. Alternatives considered and declined

**Illuminated / leaded glass.** Jewel tones held by heavy dark leading, the pane lighting from below as score rises. The best fill metaphor of the four and the clearest answer to PRD goal 4. Declined because it commits the app to a dark world — a light theme is a second design rather than a token swap — and leading that reads well on eight regions is clumsy across eighty tree nodes at phone width.

**Riso overprint.** Four inks, with the other four domains as overprints where two plates cross; descends from MakerSkillTree's printable hex posters, the project's closest prior art (`docs/PRIOR-ART.md`). The most distinctive of the four and the only one with a reason outside taste. Declined because texture is the whole idea and texture is what fails first at small sizes.

**Instrument / terminal.** Matte near-black, hairline rules, mono numerals, one accent. Sleekest and cheapest. Declined twice over: it deletes PRD goal 4 by flattening eight places into eight rows, and the prior-art teardown established that it is substantially what the reference implementation already ships.

**A free continuous camera.** Declined on the LOD scaling argument in §5.1.

**Semantic skill placement.** Declined on N11 in §5.3.

**Authored skill tiles.** Declined on F13 and on the maintainer bottleneck goal 2 exists to prevent — and the prior-art review notes hand-placed positions as the likely reason the reference map has stayed at 42 nodes.

### 11.1 Reveal alternatives

Four were built and played against the chosen one before The Survey (§5.7) was taken.

**Fog burn-off.** Everything begins hachured; survey spreads outward from the centre and each region resolves into its plate as the front passes, except the genuinely fogged ones. The closest contender, and it does more *product* work than the winner — it teaches the hachure convention by performing it, so a first-timer learns what unsurveyed ground means before anyone tells them, and the two empty regions read as the remainder of a process rather than as missing content. Declined on beauty alone; worth reconsidering if D25's welcome dialog turns out to need the explanation carried visually.

**Tessellation.** Tiles land centre-out, then interior seams dissolve and eight silhouettes remain — a literal animation of §10.4's union. Declined: 29 elements moving is a great deal of motion for a tool opened twice a week, and it implies a runtime hex grid that D-08 specifically eliminates.

**Contour bloom.** Concentric contour rings expand from the centre; regions ink as the front crosses them. Declined as the closest of the five to a stock radial wipe — the contour styling was doing all the work of distinguishing it.

**Skills ticker.** Skill names race past, then the map fades up behind them. It alone communicates the library's breadth in words. Declined on three counts: it is a loading indicator for something that is not loading, which a fast static site should never fake; 1200 ms fits perhaps eight names, too few to feel like a library and too many to read; and it leaves only ~340 ms for the map itself.

**A full zoom-out establishing shot** (open close on one region, pull back to the world). Declined — see the camera settle note in §5.7.

---

## 12. Open questions

- **Q1.** The specific display face. Requirement is an engraved or transitional serif with a true small-caps or caps design, self-hostable, subsettable to ~40 glyphs at ≤ 12 kB. Not yet chosen.
- **Q2. Resolved (2026-08-16): `cellDivisor` is 4, globally, and the per-region override is dropped.** Measured against the real `map.yaml`: 3 overflows Making, Body, and Home at §5.1's 500-skill projection, and 5 puts the smallest level-1 cell at 36 px, under WCAG 2.5.5 AAA's 44 px. See §5.3.
- **Q3.** Whether the next-step card's selection rule (§6.4) should prefer the most recent activity or the nearest-to-completion level. Recency is specified; the alternative is worth a look once three trees exist.
- **Q4.** D25's remainder — how a Curious Browser reaches a compelling *tree* view without starting a skill.
- **Q5.** Whether Find should persist its highlight across a camera move, or clear on navigation. Specified as clear-on-`Esc` only; untested.
