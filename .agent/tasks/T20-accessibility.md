# T20 — Accessibility pass and axe gate

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | views |
| **Blocked by** | T08, T13, T14 |
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
  palette), domain fill level (named tier in text on focus, not just fill height), recency
  (text in accessible name/detail panel, not just saturation), level progress (`n / m`
  text per group, not just bar colour).
- `prefers-reduced-motion: reduce` support: disabling the fill animation, recency shimmer,
  and edge-highlight transitions, leaving instant state changes, with nothing in the
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
| Recency | saturation | text in the accessible name and detail panel |
| Level progress | bar colour | n / m text per requirement group |
```

## Acceptance criteria

- [ ] Every rendered milestone node's accessible description includes level, state,
      prerequisites by title, whether each is met, and the requirement group it counts
      toward — verified against the §15.2 example structure across at least one fixture
      per node state.
- [ ] Keyboard traversal in a component test exercises every row of the §15.2 key table
      against a multi-level, multi-track fixture and asserts focus lands on the expected
      node after each key.
- [ ] The `.` shortcut jumps focus to the next `available` node in document order, tested
      against a fixture with `available` nodes non-adjacent in the DOM (F36).
- [ ] Completing a milestone in a test triggers exactly one `aria-live="polite"`
      announcement stating the consequence (e.g. level completion, new availability count)
      — not the raw click event — and no `aria-live="assertive"` region exists anywhere in
      the app (§15.2).
- [ ] Every map region's accessible name includes name, breadth count, fill as a named
      tier (not a number), and fogged state where applicable, matching the §15.3 examples'
      structure (§15.3, F34).
- [ ] Region reading order in a keyboard-traversal test matches a stable, documented order
      independent of the regions' rendered pixel positions (§15.3).
- [ ] For each row of the §15.4 table, a test using only computed styles with colour
      properties stripped (or a `forced-colors: active` media-feature simulation) still
      distinguishes every state via the listed redundant channel (§15.4).
- [ ] With `prefers-reduced-motion: reduce` simulated, a test asserts the fill animation,
      recency shimmer, and edge-highlight transition classes are absent or reduced to an
      instant state change (§15.5).
- [ ] F29's placement flow is keyboard-operable end to end in a test, groups items by
      level with a running count assertion, and a test confirms the flow can be abandoned
      mid-way and resumed with prior answers intact (§15.6).
- [ ] F30's pre-checked estimator items are each individually announced as pre-checked
      (not silently pre-checked) and individually toggleable in a test (§15.6).
- [ ] `npx vitest run --coverage` (or the project's equivalent) includes `vitest-axe`
      assertions on `TreeView`, `MapRenderer`, and `MilestonePanel`, and CI fails if any
      axe violation is introduced.
- [ ] A written record exists (in `docs/CONTRIBUTING.md` or the §16.2 checklist location)
      of a completed keyboard-only walkthrough of browse, place, complete, and export, and
      a screen-reader spot check on one desktop reader and one mobile reader, each dated
      and naming the reader/browser combination used.
- [ ] Touch targets for SVG nodes measure at least 44×44 CSS pixels via their hit
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
