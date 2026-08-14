# T20 — Accessibility pass and axe gate

| Field | Value |
|---|---|
| **Status** | **partly complete** — 2026-08-14. Automated verification landed in full; §15.6 is blocked on T15 and §15.8's manual passes are outstanding. See *Completion state* at the end. |
| **Phase** | 1 |
| **Cluster** | views |
| **Blocked by** | T08, T13, T14 — and **T15** for the §15.6 criteria, which this field originally missed (see *Completion state*) |
| **Blocks** | — |
| **Spec** | ARCHITECTURE §15 |
| **PRD** | N5, D-10, R-07 |

## Goal

Every view T08, T13, and T14 shipped is verifiably usable by keyboard and screen reader:
the tree's linear-list structure carries complete accessible names and descriptions, the
map's regions announce every channel as text, no signal anywhere in the app is conveyed
by colour alone, motion respects `prefers-reduced-motion`, and `vitest-axe` runs as a CI
gate across the component test suite. After this task, the four core flows — browse,
place, complete, export — have been walked keyboard-only and recorded as passing per the
§16.2 manual release checklist, and the axe gate is wired to fail CI on violation.

## Why this shape

D-10 is the governing decision for this whole section: **the linear list is the primary
representation for assistive technology, not a fallback view alongside the drawn graph.**
§15.1 is explicit about why this shape was chosen over the alternatives — ARIA narrating a
spatial graph "attempts to narrate spatial relationships that convey nothing without
sight," and a separate screen-reader-only view "rots, because nobody looks at it." The
list this task verifies is the *same* list §8.5's narrow layout produces for every mobile
user, so it is exercised constantly and cannot silently break the way a dedicated a11y-only
code path would. This task's job is therefore not to build a parallel accessible
experience but to confirm the one the architecture already committed to sharing is
complete: node descriptions must state prerequisites *and whether they are met* (§15.2),
because that is the one piece of information a sighted user reads off the layout for free
and a screen-reader user cannot recover any other way.

## Scope

**In scope**

- Verifying and completing the tree's semantic structure per §15.2: a `<section>` per
  level, an ordered list of milestones, level headings carrying number/tier/per-group
  progress, and node accessible names/descriptions matching the specified content —
  level, state, prerequisites and whether they are met, and which requirement group the
  milestone serves.
- The full keyboard model of §15.2's table: roving `tabindex` in a single tab stop,
  arrow-key traversal within the grid, `Home`/`End` to level 1/10, `Enter`/`Space` to open
  the panel, `Esc` to close and return focus, and the `.` shortcut to jump to the next
  `available` milestone (F36).
- Live-region announcements for milestone completion, `polite` on a single shared live
  region, stating the consequence (level completion, new availability) rather than the
  click itself (§15.2).
- The map's accessible names per §15.3: region name, breadth, fill (as a **named tier**,
  never a percentage), and fogged state, in a stable reading order independent of pixel
  position, converging with the narrow-viewport list fallback from T13 (§10.7).
- The full §15.4 "never colour alone" table, verified signal by signal: milestone state
  (glyph + border, not just fill hue), domain identity (silhouette + label, not just
  palette), domain fill level (named band in text on focus, not just fill height), recency
  (the date in the accessible name/detail panel — it has **no** colour channel in v1, per
  D-20 and T26/F5), level progress (`n / m` text per group, not just bar colour). Domain
  fill uses the five **F18 bands** (**Quiet**, **Emerging**, **Moderate**, **Active**,
  **Deep**) via the shared resolver (T11b/T13, T26/F18 resolved 2026-08-06) — do not invent
  vocabulary or thresholds here.
- `prefers-reduced-motion: reduce` support: disabling the fill animation and
  edge-highlight transitions, leaving instant state changes, with nothing in the
  interface conveying information only through motion (§15.5).
- Self-assessment accessibility per §15.6: F29's placement flow grouped by level with a
  running count, fully keyboard-operable, interruptible and resumable; F30's estimator
  pre-checks announced as such and individually reversible.
- Responsive behaviour per §15.7: container queries (not global media queries), the three
  named breakpoints, and 44×44 CSS-pixel touch targets including invisible hit rectangles
  for SVG nodes smaller than that.
- `vitest-axe` wired into the component test suite as a CI gate (§15.8).
- A documented keyboard-only walkthrough of the four core flows (browse, place, complete,
  export) as a §16.2 release-checklist item, plus a screen-reader spot check on one
  desktop and one mobile reader.
- Forced-colours verification: the app checked against Windows High Contrast and
  `forced-colors: active`, confirming glyphs (real `<use>` elements) survive (§15.4).

**Out of scope**

- Building the tree, map, or route structures themselves — T08, T13, T14 respectively.
  This task verifies and completes their accessibility properties; it does not construct
  the components from scratch. Where a gap is found (e.g. a missing `aria-describedby`
  target), fixing it in the owning component is in scope, but redesigning the component is
  not.
- Comprehensive assistive-technology matrix testing across every reader/browser
  combination — explicitly **R-07**, an accepted residual risk, not a target for this
  task to close. "One desktop and one mobile reader per release" per §15.8 is the actual
  bar, not exhaustive coverage.
- The graded/decaying recency channel's accessibility treatment — that channel does not
  exist in v1 (D-20, R-20); nothing to verify here.
- Visual design and palette selection (D19) — a product decision explicitly out of this
  section's remit per §15.9; this task only verifies that whatever palette ships does not
  become the sole channel for any signal.
- Automated-only certification — §15.8 states plainly that axe "catches roughly a third
  of real issues," so passing the axe gate alone is not sufficient acceptance criteria for
  this task; the manual keyboard-only and screen-reader passes are equally required.

## Deliverables

```
app/src/lib/components/TreeView.a11y.test.ts       node names, descriptions, keyboard model
app/src/lib/components/MapRenderer.a11y.test.ts    region names, reading order, fill-as-text
app/vitest.config.ts                               vitest-axe wired into CI-run suites
docs/CONTRIBUTING.md                                or §16.2 checklist location — manual walkthrough record
```

## Interface contract

```
// ARCHITECTURE §15.2 — node accessible name/description, verbatim example

name:        "Forge a J hook"
description: "Level 2. Available. Requires: light a fire and bring stock to
              forging heat; draw a square taper on the anvil — both complete.
              Counts toward: all of Level 2's core group."
```

```
// ARCHITECTURE §15.2 — keyboard model, verbatim

| Key | Action |
|---|---|
| ← → | Previous / next milestone within the level |
| ↑ ↓ | Same track, level up / down |
| Home / End | Level 1 / level 10 |
| Enter / Space | Open the milestone panel |
| Esc | Close the panel, return focus to the node |
| . | Jump to the next available milestone (F36) |
```

```
// ARCHITECTURE §15.3 — map accessible names, verbatim

"Making. 4 skills started. Fill: moderate. Last activity 3 days ago."
"Play. No skills published yet — contribute one."
```

```
// ARCHITECTURE §15.4 — never colour alone, verbatim

| Signal | Colour | Redundant channel |
|---|---|---|
| Milestone state | fill hue | glyph (✓ ○ ‧ ✕) + border style (§9.3) |
| Domain identity | palette | region silhouette + label |
| Domain fill level | fill height | named tier in text on focus |
| Recency | none in v1 — it is text already (§10.5, D-20) | the date in the accessible name and detail panel |
| Level progress | bar colour | n / m text per requirement group |
```

## Acceptance criteria

- [x] Every rendered milestone node's accessible description includes level, state,
      prerequisites by title, whether each is met, and the requirement group it counts
      toward — verified against the §15.2 example structure across at least one fixture
      per node state.
- [x] Keyboard traversal in a component test exercises every row of the §15.2 key table
      against a multi-level, multi-track fixture and asserts focus lands on the expected
      node after each key.
- [x] The `.` shortcut jumps focus to the next `available` node in document order, tested
      against a fixture with `available` nodes non-adjacent in the DOM (F36).
- [x] Completing a milestone in a test triggers exactly one `aria-live="polite"`
      announcement stating the consequence (e.g. level completion, new availability count)
      — not the raw click event — and no `aria-live="assertive"` region exists anywhere in
      the app (§15.2).
- [x] Every map region's accessible name includes name, breadth count, fill as a named
      tier (not a number), and fogged state where applicable, matching the §15.3 examples'
      structure (§15.3, F34).
- [x] Region reading order in a keyboard-traversal test matches a stable, documented order
      independent of the regions' rendered pixel positions (§15.3).
- [x] For each row of the §15.4 table, a test using only computed styles with colour
      properties stripped (or a `forced-colors: active` media-feature simulation) still
      distinguishes every state via the listed redundant channel (§15.4).
- [x] With `prefers-reduced-motion: reduce` simulated, a test asserts the fill animation
      and edge-highlight transition classes are absent or reduced to an instant state
      change (§15.5). There is no recency shimmer to assert against — T26/F5 removed it,
      since D-20 ships recency as a date.
- [ ] F29's placement flow is keyboard-operable end to end in a test, groups items by
      level with a running count assertion, and a test confirms the flow can be abandoned
      mid-way and resumed with prior answers intact (§15.6).
- [ ] F30's pre-checked estimator items are each individually announced as pre-checked
      (not silently pre-checked) and individually toggleable in a test (§15.6).
- [x] `npx vitest run --coverage` (or the project's equivalent) includes `vitest-axe`
      assertions on `TreeView`, `MapRenderer`, and `MilestonePanel`, and CI fails if any
      axe violation is introduced.
- [ ] A written record exists (in `docs/CONTRIBUTING.md` or the §16.2 checklist location)
      of a completed keyboard-only walkthrough of browse, place, complete, and export, and
      a screen-reader spot check on one desktop reader and one mobile reader, each dated
      and naming the reader/browser combination used.
- [x] Touch targets for SVG nodes measure at least 44×44 CSS pixels via their hit
      rectangle even where the drawn node is smaller — verified by asserting the hit
      rectangle's computed bounding box in a component test.

## Verification

```bash
npx vitest run
npx vitest run --coverage   # or the project's axe-gated CI command
npx tsc --noEmit --project app
```

Passing looks like: the full component test suite green including the `*.a11y.test.ts`
files, zero axe violations reported, and a clean typecheck. The manual walkthrough and
screen-reader checks are recorded as a checklist artifact, not a command output — their
passing condition is the dated, named record existing and being current for this release.

## Notes and hazards

- **T24 authors `docs/CONTRIBUTING.md` wholesale, and neither task blocks the other.** If
  the walkthrough record goes there rather than the §16.2 checklist location, it can be
  overwritten by T24's authoring pass — the two tasks are unordered. Either put the record
  in the §16.2 location, or confirm T24 has already landed. T24's notes carry the
  reciprocal warning.
- **R-07 is accepted, not solvable by this task.** §15.8 states it directly: "a solo
  maintainer will not test every reader-and-browser combination... automated checks catch
  roughly a third of real issues." Do not treat an incomplete reader/browser matrix as a
  defect to fix here — the structural mitigation the architecture relies on is D-10 itself
  (the linear list every mobile user already exercises), not broader manual test coverage.
  Recording R-07 as accepted, with its mitigation, is a valid and sufficient outcome for
  this section of the task.
- **The linear list must not become a second, divergent implementation.** Because D-10
  makes it the *primary* representation rather than an alternate view, any accessibility
  fix made under this task should tighten the shared `narrow`/list-mode output T08 already
  produces (§8.5), not fork a separate screen-reader-only rendering path — a forked path is
  exactly the failure mode §15.1 rejects explicitly ("a separate screen-reader-only view
  nobody ever looks at").
- **Axe alone is not sufficient acceptance.** §15.8's one-third figure is stated precisely
  so a green CI gate is not mistaken for a completed accessibility pass. The manual
  keyboard-only and screen-reader checklist items are equally load-bearing acceptance
  criteria, not optional follow-up.
- **Colour-alone violations are easy to reintroduce silently** in later styling work,
  since most of them look correct to a sighted reviewer. The §15.4 table is the
  enumeration specifically because "it is the requirement most easily lost in
  implementation" — treat any future PR touching node/region styling as needing a re-check
  against this table, not just this task's own completion.
- Motion-sensitivity coverage (§15.5) depends on nothing in the interface conveying
  information *only* through motion — if a future feature adds an animation-only signal,
  that is a regression against this section's premise, not just a missed
  `prefers-reduced-motion` handler.


## T26 amendments — 2026-08-06

**F18 — §15.3's "named tier" is a named *band*.** Five bands over domain `fill`: **Quiet**,
**Emerging**, **Moderate**, **Active**, **Deep** (§11.6, with boundaries). The rename is the
point of the finding: §11.3's tiers are the five names over pairs of *skill levels*, and
announcing a domain's fill as a "tier" makes the map appear to rank a domain on the same
scale that ranks a skill.

§15.3's worked example survives unchanged — *"Making. 4 skills started. Fill: moderate.
Last activity 3 days ago."* — because `moderate` is one of the five names.

§15.4's redundancy row now reads "named band in text on focus (§11.6)".

**Do not declare a `BandName` union, and do not hardcode a boundary.** The names, count and
boundaries are provisional and expected to move from real use; the accessible-name builder
calls the same resolver over the same data table T13 uses. See T13's amendments for the full
rider — the risk is that two components each grow their own copy of the thresholds.


**F27 — the narrow layout's reading order is now guaranteed, not inferred.** §8.5 fixes
**level 1 at the top** in narrow, explicitly because §15 reuses that layout as the linear
presentation for screen readers **at every viewport**. Level 1 at the bottom would have run
the reading order level 10 → level 1. The guarantee is in the spec now, so §15's ordering
claims rest on it rather than on T06's judgement.


## Implementation notes — 2026-08-14

Five decisions are in no spec section, and three of them constrain later work.

**`(level, track, lane)` is one order for three jobs.** Document order, focus order
and §15.1's reading order are the same sequence, produced by `gridOrder` in
`lib/components/keyboard-grid.ts`, and the **wide** branch now renders from it too
(it previously rendered in `positions.nodes` order). Nodes are absolutely
positioned by `transform`, so nothing moved on screen — but F36's "next available
in document order" and §15.2's arrow traversal are now the same traversal by
construction rather than by coincidence. **A future change to render order in
either branch changes the keyboard model.**

**The arrow keys are viewport-dependent, and they have to be.** §8.2 draws level 1
at the *bottom* in wide; §8.5 draws it at the *top* in narrow (F27). A fixed
`↑ = level + 1` would therefore send focus visually downward in one of the two
viewports, so `focusTarget` takes the viewport and flips the sign. `Home`/`End`
are written in §15.2 as "level 1 / level 10" but resolve to the lowest and highest
levels that actually **hold nodes**, so they are not dead keys on a tree that
authors fewer than ten.

**`keyboard-grid.ts` declares its own `GridNode` rather than importing
`PositionedNode`.** §13.4 makes `TreeView` the only view-layer file that may name
the Layout Engine, enforced by both `eslint.config.js` and
`routes/view-boundaries.test.ts`. A structural type of the four fields a key press
needs keeps that rule mechanically checkable instead of earning an exception —
`PositionedNode` satisfies it with no cast, and `gridOrder` is generic so the
renderer gets its positions back.

**The live region is a diff, not a message.** §15.2 requires the announcement to
state the *consequence*, and the component that handles the click cannot know it:
the shell re-scores and hands the new `SkillProgress` back as a prop (§13.4,
§14.4). So `announcements.ts` compares the previous value with the current one and
`TreeView` holds the previous in a plain variable — deliberately **not** `$state`,
since a reactive one would make the effect re-run on its own write.

**§15.2's "core group" does not exist and could not.** Requirement groups have no
name in the schema (§5.6 — a group is a rule, a threshold, and a milestone list),
so `countsTowardClause` identifies the group by what it demands: *"all of Level 2's
required group"*, *"any 1 of 3 in Level 2's choice group"*, with an ordinal only
when a level holds more than one group of that rule. Inventing a name would put
authored-looking vocabulary in the renderer. Likewise §15.2's *"— both complete"*
reads well only when the prerequisites agree; when they disagree a trailing count
would hide *which* one is outstanding, so a mixed set annotates each individually.

Smaller things: §15.7's three thresholds now live together in
`lib/components/breakpoints.ts` (`SkillPage` and `map-presentation` import from it),
two of them read by `ResizeObserver` because the decision has to reach TypeScript
and one as a real `@container` rule; the axe gate is scoped to WCAG 2.1 A/AA
because axe's best-practice `region` rule fires on every component tested in
isolation, and a gate suppressed at each call site is not a gate; `MapRenderer.test.ts`'s
manifest fixture moved to `lib/components/fixtures.ts` so the map's two test files
share one; and `makeScoringTree` gained optional `tracks`/`track`, because "same
track" is only testable on a tree where some level does not fill a track.

## Completion state — 2026-08-14

**Done, and asserted as tests rather than claimed.** Ten of the thirteen acceptance
criteria, listed with their evidence in `docs/RELEASE-CHECKLIST.md`. 462 app tests
and 195 tools tests pass, lint is clean, `svelte-check` reports 0 errors over 442
files, and the static build is unchanged in shape.

**Three criteria are not met, and two of them cannot be met yet.**

- **§15.6's placement flow (F29) and estimator (F30) — blocked on T15.** T15 is
  written but not implemented, so there is no flow to group by level, to abandon
  and resume, or to announce a pre-check on. T20's `Blocked by` field lists only
  T08, T13 and T14 and is **wrong** on this point: §15.6 is in scope for this task
  and depends on T15. Nothing was stubbed to make the criteria pass.
- **§15.8's manual keyboard-only walkthrough and screen-reader spot checks — not
  performed.** `browse` and `complete` are walkable now; `place` and `export` are
  T15 and T16 and do not exist, so the four-flow walkthrough cannot be completed
  in any case. `docs/RELEASE-CHECKLIST.md` records this explicitly with the reason
  rather than leaving an unchecked box, and §15.8's manual items are load-bearing
  acceptance criteria — a green axe run is one third of the job, by the spec's own
  figure.

**Two smaller deviations, both deliberate.**

- There is **no `MilestonePanel` component** to run axe against: §9.4's panel is an
  `<aside>` inside `TreeView`, which is where §9.1's one-component rule puts it.
  The axe assertions cover it with the panel open, with §11.10's consequence
  intercept showing, and on the composed `/s/[tree]` route.
- The 44×44 target is asserted from the hit rectangle's **attributes**, not its
  computed bounding box: jsdom runs no layout, so `getBBox` returns zeros. The
  units are also §8.1's abstract units rather than CSS pixels — `hitRect`'s comment
  states the reasoning and the bound that makes it honest.

**The axe *gate* depends on T25.** The assertions run inside `npm test`; there is no
workflow file in `.github/workflows/` yet, so "CI fails on violation" is true of the
command and pending on the job. T25 owns that.
