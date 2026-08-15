# RESUME — implementation, phase 1

Updated 2026-08-14 after T17.

# SESSION 14 — T17 COMPLETE. `UserStateStore` HAS NO STUBS LEFT.

T17 (lineage migration and orphan records) verified complete 2026-08-14: **653 app tests +
195 tools tests**, `npm run typecheck` clean over 514 files, `npm run lint` clean,
`npm run build` clean, S1 gate holds.

**What is now true that was not:**

- **User state survives an arbitrary number of content releases without a silent
  mutation.** `applyLineage` runs on tree open whenever the bundle's `contentVersion`
  exceeds that skill's `contentVersionSeen`, folds §12.5's ledger, and returns a
  `MigrationReport` the skill page renders as one dismissible summary.
- **Every method §14.5 declares is implemented.** `NotImplementedHereError` no longer
  fires from anywhere in `lib/state`; the class stays exported because
  `cold-start.test.ts` still asserts the shell survives a store that throws it.
- **The `ORPHAN` store has a writer.** T16 exported orphans that nothing could create; the
  migration pass is the only thing that creates them, and `/data` now renders them through
  `RetiredAchievements.svelte` rather than an inline list.
- **`applyMoves` re-homes records at cold start** from the manifest's `moved` map, which is
  what closes T26/F13: `MILESTONE`'s key is the uid, so a record invisible to its
  destination tree gets overwritten the moment the user re-ticks the milestone.
- **`TreeSession` exposes `migration` and `dismissMigration()`**, and runs `applyLineage`
  before `reconcileAttainedLevel` (F26's order — the reconcile must not contradict the
  number the summary is showing).

**Three things a later task must not undo:**

- **The fold is pure and lives apart from the transaction.** `foldLineage` in
  `lineage.ts` takes records and a ledger and returns a plan; `applyLineage` writes it.
  Folding inside the transaction would make §12.5's twelve table cells and F14's
  composition property testable only through IndexedDB.
- **Consumption and the frozen-set replacement ship together.** A `split` deletes the
  predecessor row *and* replaces its uid in `SKILL.grandfathered` with the successors.
  Doing one without the other leaves a set §11.5 can never verify, which is D-19 defeated
  by the mechanism meant to preserve it.
- **`>` never becomes `!=`** in the trigger comparison, and neither pass touches
  `lastActivityAt`.

**Next up:** T18 (durability and quota) is unblocked and is the last runtime-io task. T19,
T21, T22, T23, T24, T25 remain open. See T17's own doc for the three calls §12.5 does not
make that the implementation had to resolve.

---

Updated 2026-08-14 after T15 and T16.

# SESSION 13 — T15 AND T16 COMPLETE.

T15 (placement and the level estimator) and T16 (export and import) verified complete
2026-08-14: 568 app tests, `npm run typecheck` clean, `npm run lint` clean, `npm run build`
clean, S1 gate holds, and no Ajv in the built client bundle.

**What is now true that was not:**

- **A user can get their progress off this device and back onto another one.** `/data`
  has a working export download and import picker, with §12.6's replace behind a
  confirmation and §16.5's retired-achievement list beside it.
- **`store.export()` and `store.import()` are implemented**; only `applyLineage` and
  `applyMoves` still reject with `NotImplementedHereError`, both T17's.
- **`store.recordManifest()` is new**, called by `coldStart`. §14.5 gives `export()` no
  arguments and §14.1 forbids `lib/state` from reading a manifest, so §7.2's `generated`
  stamp and the library's tree ids are injected — the same shape as `openTree`. Anything
  stubbing `ColdStartStore` must provide it.
- **`TreeSession.apply` serializes writes** (T15). §12.4 makes each write its own
  transaction that recomputes `attainedLevel`; a placement committing twelve at once had
  them racing. Rapid clicking in `TreeView` was the same hazard, more slowly.
- **`app/package.json` has a `version`**, and `app/src/lib/version.ts` mirrors it with a
  drift test. §16.1's app semver is recorded in every export.

**Two things a later task must not undo:**

- **`validate-export.ts` is hand-written on purpose.** §7.3 and §17.1 keep a schema engine
  out of the client; `import.test.ts` runs the real `export.schema.json` under Ajv over a
  twenty-mutation corpus, plus a vacuity guard, so the two cannot drift. A build check
  asserts no non-test module imports Ajv.
- **The milestone row tolerates unknown keys** (R-06, §12.8) and the skill row does not.
  Adding `additionalProperties: false` to the milestone shape would turn phase 2's photos
  into a breaking `schemaVersion` bump.

**Next up:** T17 (lineage migration and orphan records) is the natural successor — it owns
`applyLineage`/`applyMoves`, the self-heal half of T26/F20 that T16's test could only
half-assert, and the only writer of the `ORPHAN` store T16 exports. T18 (durability and
quota) is unblocked now that `lastExportAt` is written. T19, T21, T22, T23 are also open.

---

# RESUME — implementation, phase 1

Handoff written 2026-08-05, superseding the wave-2 task-doc handoff (that work is done).
Updated 2026-08-14 after T20. Read this, then `_BREAKDOWN.yaml`.

# SESSION 18 — T20 IS *PARTLY* DONE. §15 HOLDS FOR EVERYTHING THAT EXISTS.

Repository state: **657 tests** (462 app + 195 tools), `svelte-check` clean over 442 files,
lint clean, static build unchanged in shape.

**T20 is not closed, and closing it is not this session's fault to fix.** Ten of its
thirteen criteria are met and asserted as tests. The three that are not:

- **§15.6 (F29's placement flow, F30's estimator) needs T15**, which is written and not
  implemented. `_BREAKDOWN.yaml` now lists T15 in T20's `blocked_by`; the original field
  missed it. Nothing was stubbed to make those criteria pass.
- **§15.8's manual keyboard-only walkthrough and screen-reader spot checks are not
  performed**, and cannot complete before T15 and T16 — two of the four flows are `place`
  and `export`. `browse` and `complete` are walkable now and are a real pending check.

**Read `T20-accessibility.md`'s implementation notes before touching either renderer.**
Three of the five decisions there constrain later work:

- **`(level, track, lane)` is now one order for three jobs** — document order, focus order,
  and §15.1's reading order — produced by `gridOrder` in `lib/components/keyboard-grid.ts`.
  The **wide** branch renders from it too, which it did not before. Nodes are positioned by
  `transform` so nothing moved on screen, but **changing render order in either branch now
  changes the keyboard model.**
- **The arrow keys are viewport-dependent by necessity.** Wide draws level 1 at the bottom
  (§8.2), narrow at the top (§8.5, F27), so `focusTarget` takes the viewport and flips the
  sign. `Home`/`End` resolve to the lowest and highest levels that hold nodes, not literally
  1 and 10.
- **The live region is a diff of two `SkillProgress` values, not a message.** §15.2 wants the
  consequence, and the component handling the click cannot know it. `TreeView` keeps the
  previous value in a plain variable, deliberately not `$state`.

Also new and worth knowing: **`lib/components/breakpoints.ts`** holds §15.7's three
thresholds in one place (`SkillPage` and `map-presentation` import from it); the axe helper
is **`lib/components/axe.ts`**, scoped to WCAG 2.1 A/AA because axe's best-practice `region`
rule fires on any component tested in isolation; the map's manifest fixture moved to
**`lib/components/fixtures.ts`**, shared by its two test files; and `makeScoringTree` gained
optional `tracks`/`track`.

**`docs/RELEASE-CHECKLIST.md` is new, and it is the §16.2 checklist location.** T24's
collision over CONTRIBUTING.md is resolved rather than deferred — T24's note now says not to
duplicate the record. §16.2 in `ARCHITECTURE.md` points at the file.

## What T20 left for its dependents

- **T15** — §15.6 is specified and untested because the flow does not exist. When it lands,
  group the checkbox list by level with a running count, make every pre-check individually
  announced and reversible, and make the flow abandonable and resumable. Then finish T20's
  two §15.6 criteria in `TreeView.a11y.test.ts`'s idiom and add the flow to the axe gate.
- **T16** — same shape: `export` is one of §15.8's four flows, so the walkthrough record in
  `docs/RELEASE-CHECKLIST.md` cannot be completed until it exists.
- **T25** — the axe assertions live inside `npm test`; `.github/workflows/` is still empty,
  so "CI fails on an axe violation" is true of the command and pending on the job.

**Next: T15, then T16, then a return to T20's manual half.** T17 is unblocked and
independent.

# SESSION 17 — T14 IS DONE. THE APP HAS ALL OF ITS ROUTES.

Repository state: **583 tests** (388 app + 195 tools), typecheck (431 files), lint, and the
static build all clean. The build emits exactly §13.1's split — `/`, `/library`, `/data`,
`/about`, `/contribute`, eight `/d/<domainId>`, the `404.html` fallback, and **nothing under
`s/`**.

**Read `T14-routes-and-cold-start.md`'s implementation notes before touching the shell.**
Five decisions there are in no spec section, and three constrain later work:

- **The `layoutTree` call moved out of the tree route into
  `lib/actions/tree-session.svelte.ts`.** T14's criterion is that `TreeView` is the only
  view-layer file naming `lib/layout`; T08 had already made `TreeView` take positions as a
  *prop* so it structurally cannot re-run layout on a completion (§8.6). Both are only true
  with the call in `lib/actions`. `eslint.config.js` and `routes/view-boundaries.test.ts`
  both enforce it now. §12.3's write-back (T26/F26) went to the same seam.
- **`routes/Shell.svelte` holds the cold-start sequence**; `+layout.svelte` is four lines
  that render it. A SvelteKit route component may take only `data` and `children`, so
  §13.3's three failure branches — unreachable against real browser capabilities — need a
  component that is not a route in order to be injectable.
- **`/s/[tree]` and `/s/[tree]/m/[slug]` share `routes/s/[tree]/SkillPage.svelte`**, a
  non-route component in a route directory (it imports `lib/actions`, and §14.1 draws
  `ACTIONS → ROUTES`, never `ACTIONS → COMP`). The open panel is a `$bindable` prop on
  `TreeView` mirrored into the new `lib/state/ui.svelte.ts`, so the URL and the panel cannot
  disagree.

Two smaller things: `SkillPageData` gained `reason: 'missing' | 'unreachable'`, because
§16.3 has two tree-unavailable rows with different sentences and T26/F22 requires the
missing one to link to `/data` when a `SKILL` row survives; and **T13's `resolve()`
suppression in `MapRenderer` is gone** now that `/d/[domain]` exists, as session 16 asked.

## What T14 left for its dependents

- **T16** — `/data` exists and says plainly that export and import are §12.6 and not wired
  up. It already lists §16.3's started-skills-not-in-the-library, off
  `worldScores().unmatched` (T26/F22); T16 adds the controls beside that. Note the
  cold-start failure screen links to `/data` on the promise that an export is possible
  during an outage, which is **not yet true** — that promise is T16's to keep.
- **T17** — `store.applyMoves` still rejects with `NotImplementedHereError`, and cold start
  treats *exactly* that error as "no migrations" while reporting any other failure. When
  T17 lands: the notice in `Shell.svelte` becomes T17's migration summary, and
  `applyLineage` goes into `Session#open()` **before** the `reconcileAttainedLevel` call
  already there (§12.5's ordering, T26/F26).
- **T20** — every route renders exactly one `<main>`; the shell adds a `<header>`, a
  `<nav aria-label="Primary">`, and a notice host with `role="status"`. Nothing beyond that
  structure has been checked — no axe run, no keyboard pass. Import `bandFor` from
  `$lib/scoring` as `map-presentation.ts` does, and share §15.3's accessible-name builder
  rather than writing a second one.

**Next: T20 is the critical path.** T15, T16 and T17 are unblocked and independent.

# SESSION 16 — T13 IS DONE. THE MAP DRAWS.

Repository state: **511 tests** (316 app + 195 tools), typecheck, lint, S1, build all clean.

**T14 is the critical path and is fully unblocked.** It is also the task that makes any of
phase 1 visible: T13 built the component and deliberately wired it to nothing.

## T13 — the Map Renderer

`app/src/lib/components/MapRenderer.svelte` draws §10.5's four channels over T12's eight
paths, with `map-presentation.ts` beside it holding everything assertable without a DOM —
§15.3's accessible-name builder (**T20 shares this, do not write a second one**), the fill
rectangle, the UTC date formatter, the fog predicate, and geometry fallbacks for the
`bounds`/`label` the schema marks optional and the compiler always emits.

- **`bandFor` is imported from `$lib/scoring`, not restated.** `tiers.ts` restates `tierFor`
  rather than importing the engine (§13.4) and is the obvious precedent; it is the wrong one.
  F18 requires one table and one resolver, and T11b's barrel re-exports `bandFor` in as many
  words "for T13's regions and T20's copy". **T20 should import it the same way.**
- **Recency renders "Last activity — 12 March 2026".** §10.5's example has no year; keeping
  it avoids comparing against today, which is the elapsed-time computation D-20 forbids.
- **Two grep gates**, both in `MapRenderer.test.ts`: no band boundary appears in either file,
  and no `shimmer` / `decay` / `saturate(` / `halfLife` / `Date.now` appears in the component.
  The second strips comments first, on purpose — the prose naming the rejected mechanisms is
  what keeps them rejected.
- **Reading order is the manifest's domain order**, asserted against a fixture whose region
  geometry runs the other way. The list below `MAP_LIST_BELOW` reproduces it exactly (§15.3).
- `lib/types/index.ts` gained a `CompiledMapRegion` re-export. Nothing else outside the
  component changed.

**For T14**: the component takes `(manifest, domainScores, viewport, onselect)` and navigates
nowhere — it reports `{ domain, href }` upward and the shell routes. The manifest × `SKILL`
join that produces `DomainSkillRow[]` is yours (T26/F4), `/` and `/d/[domain]` are yours, and
`MAP_LIST_BELOW` is exported for the container measurement §15.7 wants (the skill page's
`NARROW_BELOW` is the pattern). The list branch's `<a>` suppresses
`svelte/no-navigation-without-resolve` because `/d/[domain]` did not exist for `resolve()` to
type-check against — once it does, that suppression should go.

**For T20**: the accessible names, the focus band text, and the fog affordance are all in
place and unit-tested, but nothing has been through axe or a keyboard-only pass — that is
still entirely yours, and it needs T14's routes to have somewhere to run.

## T12 — the map has real geometry

`content/taxonomy/map.yaml` is authored as **one connected landmass of 59 tiles**, not the
eight disconnected three-tile triangles the placeholder shipped. `lst compile` unions it into
eight single-loop SVG paths plus Making's three subregion paths, with `label` (tile centroid)
and `bounds` per region, all inside `manifest.taxonomy.map`.

- **Nothing about the schema moved.** T02's `map.schema.json` and `manifest.schema.json`'s
  `compiledMapRegion` already carried the full shape, so no app type regenerated.
- **M1–M5 already existed** from T03, fixtures included (T26/F17). Nothing was duplicated.
- **§10.4's hole warning is non-blocking**: `runCompile` returns `warnings: string[]` and
  `compileCommand` prints them without touching the exit code.
- **Per R-13 the layout script was thrown away, deliberately.** If the eight regions ever
  need redrawing, write another one — do not build an editor.

**For T13**: region area encodes nothing (§10.3, NG9). The quantitative channels are T11b's
`fill`, `breadth` and `lastActivityAt`, and band names come from `bandFor`, never a literal.

# T11b — §11 IS COMPLETE.

`lib/scoring` now ships both halves: `scoreSkill` honours §11.5's frozen records, and
`domainScores(taxonomy, rows)` returns score, fill, breadth and recency per domain without
reading a single byte of tree content. `table.ts` and `bands.ts` are dependency-free data.
All eight §11.9 invariants are property tests over generated inputs, 1,000 cases each.

The S1 purity gate is clean and all eight §11.9 invariants are property tests.

## Two things T11b decided that its document did not

1. **§11.7's recency `max` asserts §12.2's full fixed-precision form**, not merely the `Z`
   suffix. `Z` (0x5A) sorts above `.` (0x2E), so `…T09:00:00Z` beats the later
   `…T09:00:00.500Z` and recency silently reports the earlier instant. §12.2 already
   required invariant precision; nothing enforced it. The store cannot produce a bad value
   (`toISOString`), so this fires on **imported** data — **T16 should catch this throw and
   report it as an import diagnostic** rather than letting it reach a user as a crash.
2. **A frozen record with zero uids is refused.** `[].every(…)` is `true`, so §11.5's
   disjunct taken literally grandfathers a level for nothing.

## What T11b leaves for whoever is next

- **T14 owns the manifest × `SKILL` join that produces `DomainSkillRow`.** The engine
  consumes rows and never assembles them. A row naming an undeclared domain is skipped with
  no fallback (T26/F22).
- **T13 and T20 must call `bandFor`, never a literal threshold.** `domain.test.ts` greps all
  of `app/src` for the four boundary values and fails on any hit outside `bands.ts`. Band
  names are `string` by design and the table is expected to move (T26/F18).
- **F30's estimator is still absent, deliberately.** §11.8 places it in this engine, but its
  rule is PRD D20 and unresolved — **T15**, blocked on **T00**. It was not stubbed, because
  an empty implementation invites a wrong one.

# SESSION 14 — T10 PASSED. PHASE 0 IS CLOSED; PHASE 1 IS OPEN.

**The gate is through and the schema held.** R-14 predicted a breaking bump and there was
not one. What shipped is one new **optional** field — `milestone.label`, a short form for
the node box, capped at 36 characters, read as `label ?? title` — which §5.10 classes as
non-breaking: no `schemaVersion` change, no migration script, every existing tree still
valid. All 52 cooking milestones were labelled, and that is the whole migration.

Repository state after T10: **421 tests** (244 app + 177 tools), typecheck, lint, build,
`gen:types` diff-free, the S1 gate, `lst validate` and `lst compile` all clean.

**Now unblocked: T11b, T12, T21.** The critical path is **T11b → T14 → T20**.

## The four defects the gate found, none of them the schema's

This is what the gate was actually worth. Every one was invisible to a green suite, and
three could not have surfaced outside a real browser.

1. **Nothing called `store.hydrate()`.** The blocking one. `hydrate()` was correct and
   covered; no code path invoked it, so a completion did not survive a reload — the exit
   criterion the whole gate turns on. Fixed with `lib/actions/bootstrap.ts` (§13.3's first
   step *only*) called from `+layout.svelte`, plus a test asserting **something calls it**.
   The lesson generalizes: the gap was never in the sequence, it was in the wiring, and
   only an end-to-end pass sees wiring.
2. **The offline notice fires on every visit after the first.** `isOffline()` is read
   synchronously right after `loadTree`, which is always before revalidation settles, so
   the flag is read at the one moment it is guaranteed pessimistic. **Left for T14** — the
   fix is a reactive notice off the content store, not an `await`, which would defeat the
   instant paint stale-while-revalidate exists for. Until then every returning user is told
   they are offline while online.
3. **The level readout overprinted the tier name** — `Level 6 · Journeyman0 / 5`, from a
   hardcoded `x=90`. Now `tspan`s offset by `dx`. **This matters for F18**: a band name
   longer than "Journeyman" would have reopened it, and `dx` cannot be overrun.
4. **No favicon**, so Chromium's `/favicon.png` probe logged a 404 on every load — the only
   console error in the pass, and enough alone to fail an exit criterion.

## What T10 leaves for whoever is next

- **T21 carries this review's residue.** The exemplar is linear and single-track, so
  `track`, `order` and `n_of` got the weakest test of anything reviewed. If v1 breaks
  anywhere, the odds are strongly there. Read T21 as the second half of the schema
  falsification, not as pure content work.
- **§5.10's "current and one prior version" window is still unspent.** Nothing has been
  bumped, so a bump during phase 1 is still affordable — but only one.
- **T14 inherits two things at once**: §13.3's full cold start (`applyMoves`, the
  version-gated `applyLineage`, the offline branch) *and* the notice host that defects 2
  and 4 are both parked against. `+layout.svelte`'s degraded-session banner is a
  placeholder and should be replaced, not extended.
- **The browser harness was not committed.** Every criterion it checks is restated as a
  committed test except the two that are inherently geometric — how wide rendered text is.
  Whether that gap is worth a screenshot-diff suite is **T25's** call, not the gate's.

# SESSION 13 — T08 IS DONE. PHASE 0 IS AT ITS GATE.

**Every Phase 0 implementation task is complete.** T00–T09 and T11a have landed; the only
thing left in phase 0 is **T10**, the gate, which is a written schema review plus a
by-hand pass over the whole pipeline.

Repository state after T08: **409 tests** (233 app + 176 tools), typecheck, lint, build,
`npx tsc --noEmit --project app`, and the S1 gate all clean.

## What T08 added that later tasks will use

- **A component test harness, the repository's first.** `lib/components/test-harness.svelte.ts`
  mounts a real component with Svelte's own `mount`/`unmount` and hands back a `$state`
  props object, so a test drives a re-render the way the app does — by changing a prop.
  jsdom is opted into per file with `// @vitest-environment jsdom`; the default stays
  `node`, since paying for jsdom in 170 engine tests to serve a handful is a poor trade.
  `resolve.conditions: ['browser']` in `vitest.config.ts` (test runs only) is what makes
  `mount` work at all.
- **`lib/actions/tree-session.svelte.ts`** — the seam between a loaded bundle, the engine,
  and the store. It calls `store.openTree`, derives `scoreSkill` off §13.2's mirror, and
  maps `MilestoneIntent` onto `setMilestoneState`. **Any future route that renders a tree
  should open a session rather than touching the store**, which is also what keeps
  §14.1's "components never import lib/state" true.
- **`eslint-plugin-svelte` is now wired in.** Before this, the `lib/components ⇢ lib/state`
  rule matched `.svelte` files that ESLint could not parse — it fired the moment a real
  component existed. That §14.1 edge is now checked where components live.
- **`npm run check:s1`** runs the §14.7 grep gate. T25 owns turning it into a CI step.

## Three fixture defects worth knowing about

They were all silent in their own suites and only surfaced when something rendered them.
The pattern is worth remembering when reviewing a fixture: a fixture is only exercised as
hard as its consumer.

1. `lib/scoring/fixtures.ts` put a level *spec object* in `milestone.level`; scoring reads
   levels through requirement groups, so every such tree laid out as empty.
2. `lib/content/fixtures/bundles.ts` generated colliding uids (`U${level}${i}`, so 1/0 and
   10/0 matched) — a §5.4 violation the renderer caught as a duplicate each-key.
3. The route's `load` was untyped, so `npx tsc --noEmit --project app` — the command in
   T08's own verification block — failed on a pre-existing error. It is typed as `PageLoad`
   now and that command is clean.

## What T10 needs from a human

T10 is deliberately not automatable: §16.4 makes phase 0 exist to **falsify the schema**,
and R-14 says to expect a bump and take it now while the corpus is one tree. Its exit
criteria include a manual browser pass — complete a milestone, reload, un-complete,
reload, no console errors — and a written verdict per finding in
`docs/SCHEMA-REVIEW-P0.md`.

# SESSION 10 — T00–T04 COMPLETE. Foundation and CLI toolchain verified.

T00 (PRD amendments), T01 (repository scaffold), T02 (schema v1 and generated types),
T03 (`lst validate` and `lst ids`), and T04 (`lst compile`) are complete as of 2026-08-07.
The implementation is committed on `agent/navigator-task-kickoff` in `8a8399e`, with
follow-up test fixes in `b3a7c5a` and session documentation in `0dd264a`.

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` all pass. The next
critical-path implementation tasks are T05 and T06; T04 unblocks T07 and T23.

# SESSION 9 — T01 COMPLETE; T00 COMPLETE

**T01 (repository scaffold) is complete** — verified 2026-08-07 under Node 20.20.2. See
`T01-repository-scaffold.md` for the command battery and Grok review sign-off. **No commit
exists yet**; implementation lives on branch `agent/navigator-task-kickoff` in the external
worktree `life-skill-tracker-worktrees/navigator-task-kickoff`.

**T00 (PRD amendments) is complete** — verified 2026-08-07. PRD v1.4 closes D20 (estimator:
integer L 1–10, contiguous prefix uids, editable suggestion), D26 (Creative Commons
Attribution 4.0 International (CC BY 4.0)), and records D23 out of v1. F33/F35 amendments
and RESEARCH §4 convexity fix align with ARCHITECTURE §19.5. **T15 specification is complete**
(unblocked by T00; implementation still blocked by **T11b**).

**Next critical-path implementation task: T02** (schema v1 and generated types). The Session 8
coherence gate **remains closed** — do not reopen the 28-doc pass.

# SESSION 8 — COHERENCE PASS COMPLETE *(superseded by Session 9 header above)*

Session 8 applied the parent-approved coherence fixes across `_BREAKDOWN.yaml`, task docs

Session 8 applied the parent-approved coherence fixes across `_BREAKDOWN.yaml`, task docs
(where needed), `docs/ARCHITECTURE.md`, `docs/SPEC-FINDINGS.md`, and this file. All **28**
task docs were **verified** for graph/header symmetry and stale prose. **T26 is complete
and no longer appears in any active `blocked_by`/`blocks` edge.** The actionable front is **T01 → T02**; **T00** is the only
other independent task ready now. **T12, T21, T22, and T23 are not startable yet** (each
still blocked per the graph).

Canonical decisions recorded here and in the task docs:

1. **T26 complete** — historical narrative retained; active graph edges removed.
2. **T02** authors `schema/compiled-tree.schema.json` and `schema/manifest.schema.json`;
   `CompiledTree`/`Manifest` are generated from them. **T04** validates compiler output
   against those schemas; authored-input validation remains **T03**.
3. **Root `eslint.config.js`** is canonical (**T01** creates it; **T06**, **T11a**, and
   **T11b** add disjoint rule slices; agents must serialize edits). **T25** verifies through
   the same flat config.
4. **Cold start vs tree open:** **T14** calls `applyMoves(manifest.moved)` at cold-start
   step 3 (§13.3). On tree open, when the version gate fires:
   `applyLineage(tree, evaluateAttainedLevel)` → `scoreSkill` → `reconcileAttainedLevel`.
   **T07** defers both to **T14**. **T17** implements migration via injected evaluator — no
   static `lib/state` → `lib/scoring` import (no T17→T14 hard edge).
5. **`startSkill(treeId, contentVersion)`** seeds `contentVersionSeen` with the current tree
   bundle's `contentVersion` (`lib/actions` reads it from the manifest and passes it).
6. **T09** defines/reuses a mirror refresh helper for its mutators; **T16** and **T17**
   must call the same helper on commit (cross-task invariant in `_BREAKDOWN.yaml` footer; no
   new graph edges).
7. **T08 out of scope:** layout is **T06**; **MilestonePanel** behaviour/component is **T19**,
   route wiring **T14**; export/import owner is **T16**.
8. Stale post-T26 "open finding" prose in **T09, T12, T13, T17, T20, T21** replaced with
   resolved requirements. **T21** architecture gaps go to **SPEC-FINDINGS** / a new
   reconciliation task, not completed **T26**.
9. **T23** check count corrected to **eight** (checks 1–8). **T25** `gen:types` gate covers
   all seven schema documents (`authored` + `compiled-tree` + `manifest` generated outputs).
10. **applyLineage DI (Session 8 fix pass):** §12.5 persists attained level inside migration
    via `evaluateAttainedLevel` callback; **T14** injects `scoreSkill`; reconcile remains the
    ordinary-open honesty pass after migration.

The coherence pass across all 28 docs is **done**. Historical sections below remain
explicitly historical.

# SESSION 7 — T26 IS COMPLETE. All twenty-seven findings resolved.

Group I (F19, F22, F24, F25, F26), then F15 and F18, then F27 — all on 2026-08-06.
**Every T26 acceptance criterion is met.**

**T26 no longer blocks anything.** Eleven tasks were waiting on it — T02, T04, T07, T08,
T09, T10, T11a/b, T12, T16, T17, T23. **The T11 split is also done** (step 1 below), so
every task doc exists and nothing in `_BREAKDOWN.yaml` is `pending`. **The critical path is
now T01 → T02**, which is the first task with no unresolved blocker, and the only
outstanding planning work is the coherence pass across all 28 docs (last item under "Known
open items").

- **F15** — all seven small omissions amended. Two mis-citations (§4.4 → §7.1/§7.4,
§10.5's Breadth → §11.7). **`MILESTONE.contentVersion` made required everywhere** and named
as *provenance, not an input* — nothing branches on it; it exists so an export read years
later says which version of the tree the user was looking at, the same job as the frozen
`slug`/`title`. §12.6's example and merge rule follow ("the whole record travels together").
`ORPHAN`'s missing slug confirmed deliberate, with the reason stated: a slug is a live
reference, and an orphan is exactly the milestone that no longer exists, so keeping one
invites a dead link out of the retired-achievements list. **§12.7 rewritten** — a trigger
table (T1/T2/T3), **per-trigger dismissal in `META`** (a single global flag disables the only
backup mechanism in a serverless system forever; each trigger re-arms on its own terms so no
timer is stored), `lastActivityAt > lastExportAt` as the definition of "new activity", and
T3 labelled **phase 2** since §17.4's sub-1 MB budget puts 60% of quota two or three orders
of magnitude out of reach.
- **F18** — five bands over `fill`: **Quiet** `[0,.15)`, **Emerging** `[.15,.35)`,
**Moderate** `[.35,.55)`, **Active** `[.55,.72)`, **Deep** `[.72,1)`. §15.3/§15.4 stop saying
"tier" and §2 gains a `Band` glossary entry beside `Tier`. Boundaries are landmark-anchored,
not quintiles: the top band opens just under a lone L10's 74.7%, so **one skill taken all the
way reaches it**, which is the claim R-19's depth premium exists to make. §15.3's shipped
example ("Fill: moderate") survives unchanged.
  **The owner's rider changed the shape of the answer:** names, count and boundaries are
provisional and expected to move from real use. So the band name is **`string`, not a closed
union** — `TierName` is closed only because F7 fixes tiers as pairs of levels 1–10, and bands
have no such anchor — the table is one pure dependency-free data module with one resolver, no
threshold may be written into a component, and `DomainScore` still carries no band field.
The bar: renaming a band or moving a boundary is a one-line data edit with no type change.

### F27 — the last five, filed so they could be closed honestly

`T06-layout-engine.md` was carrying five §8 gaps under a heading flagging them as
unanswered, and that heading was the only thing keeping T26's closing criterion unmet. **None had ever
been raised as a finding**, so they were filed as **F27** and resolved rather than having the
marker deleted to make a grep pass.

- **Narrow is level 1 at the TOP**, the opposite of wide — the one place the two modes
disagree about direction. Wide is a spatial metaphor (a tree grows upward); narrow is a
*reading order*, and §15 reuses it for screen readers **at every viewport**, so level 1 at
the bottom would run that order level 10 → level 1.
- **`col`/`lane`/`columns` in narrow**, and for a track-less wide tree: `col = 0`, and one
**synthetic** column `{ trackId: '', title: '', x: 0, w: width }` rather than an empty array,
chosen so **`columns[node.col]` resolves in both modes**. `edges: []` looks like the
precedent for an empty array and was declined — `col = 0` indexing into one type-checks,
which is what makes it a footgun. T06's proposal to make `lane` a running index over the
stack was **overruled**: one field must not mean two things across two modes.
- **§8.1 ships the unit constants** with v1 values, as tunable data on F18's principle — no
value is normative, only the ratios. Two are constrained and breaking either is a bug:
`rowGutter > 0`, and `sideGutterLane × (max same-level edges in a row) ≤ sideGutter`.
- **§8.4's side gutter** is one channel on the right, lanes assigned per row, four-segment
path. **The bow is the part that gets missed** — both nodes share a row, so without a
vertical offset the outbound and return legs are the same line and it renders as one stroke
that looks like a data bug.
- **§8.2 step 7 is scoped to positioned milestones**, so a mastery `requires` produces no
edge at all. §6.2 rule 14 leaves mastery with no cell and no position; an unpositioned
endpoint is a category error, not a partial edge.

### No edge changes

Group I touched no `blocked_by`/`blocks` edge, but the surface change is the largest since
Group C and lands on eight task docs. All eight are updated. The riders most likely to be
dropped on the floor: **check 8 is T23's** and is the only F22 edit outside the tasks F22 was
filed against; **the reconcile's ordering after `applyLineage`** spans T09, T14 and T17 with
nothing in the graph expressing it; and **`app: build` recompiling** makes a T04 acceptance
criterion load-bearing for T25's correctness.


## Where things stand

*(This table is session 6's snapshot, superseded by the session 7 header above — kept for
the record of which group resolved what.)*

**All 27 task docs written** (`5c69e91`); **28 as of the T11 split on 2026-08-06.**
**T26 is the front of the critical path** and is now 19 of 26 findings resolved — the count
grew again because Group G found one more.

| Resolved | Open |
|---|---|
| F1, F2 (2026-08-05, session 1) | F15 — the omission cluster, never started |
| F8, F9, F10, F11, F16 (session 2) | F18, F19 (raised by Group B) |
| F3, F4, F5 (session 3, Group B) | F22 (raised by Group C) |
| F12, F13, F14 (session 4, Group C) | F24, F25 (raised by Group D) |
| F6, F7, F17 (session 5, Group D) | **F26** (new, raised by Group G) |
| F20, F21, F23 (session 6, Group G) | |

Resolutions are recorded in `docs/SPEC-FINDINGS.md` and amended into
`docs/ARCHITECTURE.md`. No implementation has begun; the repository is still docs-only.

**Do not use the sqz MCP tools.** The user asked for built-in Read/Grep/Bash instead.

**Confidence bars go in the option *label*, not only the description** — the user asked
for this twice in session 6. `[#########-] Consume, both ops (Recommended)`.

## What session 6 changed (Group G — F20, F21, F23)

- **F20** — `split` **consumes** its predecessor (deleted, `at`/`note` copied forward,
  reported as `rewritten`), and the frozen-set entry **moves** rather than copies. The
  finding said the fate was unstated; it was worse — **the spec implied permanent
  retention**, because the final sweep only orphans a uid in "neither bundle **nor
  lineage**" and a split predecessor's uid *is* in the lineage. That also settles the
  verdict: a retained record stays in the working set, re-matches its own entry, and since
  §12.6 forces a replay on import it **silently re-completes a successor the user
  un-checked** — F14's replay guarantee was already false for this row. `merged`'s
  all-complete branch had the identical gap and got the same sentence. Orphaning was
  declined on `merged`'s own wording: it orphans in the "otherwise" branch because R-16's
  partial merge is a *loss*. Riders: **a successor with a live record of its own is never
  overwritten** (rule 15 lets `into` name an already-shipped uid), rule 3 gains consumption
  as a second exit, and `MigrationReport.entries` is stated to be per *record*.
- **F21** — `into`'s shape and cardinality are fixed per `op` in §5.4 and rule 15 branches
  on `op`. Three constraints the finding never asked about: **`moved`'s target uid must
  equal the entry's own** (§12.5 keeps the uid and rewrites only `treeId`, so a typo there
  is invisible forever), `split`/`merged` stay inside one tree, and cardinality is part of
  the grammar (`split` with `into: []` passes today). The permissive reading was declined
  because it **reopens F13's hole through the validator**.
- **F23** — `store.progressFor(treeId): TreeProgress`, synchronous and total. **The
  signature was the easy half.** §13.2 scoped mirror writes to §12.4 alone, so
  `applyLineage`, `applyMoves` and `import` never refreshed it — making a synchronous read
  wrong exactly when those have just run (a `split`'s successors invisible on the first
  paint after a content update; a re-homed record stranded under the source tree for the
  session, defeating §13.3's reason for ordering `applyMoves` before the map derives).
  Every writer now refreshes on commit. `hydrated` joins `writable` so an empty map cannot
  mean both "unstarted" and "unhydrated". The `by-tree` index is the **write path's**, its
  busiest consumer being §12.4 step 2 — which cannot read the mirror, since reactive state
  updates only on commit.
- **New: F26** — §12.3 requires a write-back on tree open and §14.5 has no method for it;
  `applyLineage` is version-gated and does nothing on an ordinary open. `T09` already
  carries an acceptance criterion for that reconciliation, so this is the second finding
  (after F24) that makes an existing task doc untestable as the spec is drawn.
- **Also noted, not filed:** T26's finding ids collide with the PRD feature ids used
  throughout the spec — §14.4 uses "F20" for domain-id stability and §13.1 uses "F23" for
  the domain listing. Renaming 26 findings now is churn; just be careful in prose.

### No edge changes

Group G touched no `blocked_by`/`blocks` edge. What it did add is a §14.5 surface change
(`progressFor`, `hydrated`) owned by T09 but consumed by T11a and T14, and a mirror-refresh
obligation that lands on **three** tasks — T09, T16 and T17 — which is the kind of
cross-task rider the coherence pass exists to catch.

## What session 5 changed (Group D — F6, F7, F17)

- **F6** — the baseline is `main`, and the evidence was one-sided rather than balanced: four
  sites say `main` against two stray "last release tag" phrases, and a **third** stray one
  turned up during resolution (§6.8 forwarded "Release tagging" to §16.2, which has no
  tagging step). **The rider the finding never asked about had a wrong answer**: the baseline
  is the tip of `origin/main` against the PR **merged into it**, not the merge-base T23 had
  been told to implement. Merge-base is unsound with two PRs in flight — both can bump one
  tree 4 → 5 and pass, leaving `main` with a version 5 that is not the 5 that shipped, so
  §12.5's `>` guard skips that migration for everyone who saw the first. Check 6 breaks the
  same way. Price: **branches must be up to date before merge**, and `fetch-depth: 0` —
  at depth 1 there is no `origin/main` and checks 1–7 pass on nothing.
- **F7** — rule 15 splits along "answerable from the working tree" versus "needs history".
  §6.2's rule 15 becomes the git-free half (`into` targets resolve in the head), keeping the
  table at fifteen so no count anywhere changes; §6.4 gains **check 7**. **"Appended since
  the baseline" is load-bearing**: as worded, the rule re-evaluated the whole ledger, so a
  `retired` uid legitimately gone from `main` three releases later would fail its own
  already-merged entry forever and permanently block every PR on that tree. Group C's check 6
  is what made the correct wording expressible — the second time it has paid for itself.
- **F17** — `lst validate` owns the five geometry invariants as §6.2 **layer 2b**, rules
  M1–M5. `T12-map-geometry.md` had assumed `lst compile`, and that placement is unsafe for a
  reason outside §10: §6.5's `build` job `needs` the app jobs, the path filter skips them on
  content-only PRs, and a skipped dependency skips the dependent — so `build` never runs on
  the PRs that change `map.yaml`. Riders: **M2 ranges over every tile in every region** (the
  intra-region duplicate is the silent one — §10.4 discards both copies of each doubled edge
  and the tile vanishes with the path still closed), and **the file list scopes reporting,
  not reading**, which was already true for rules 2 and 10–12 and stated nowhere.
- **Four defects folded in**, per the same policy as Group C: §6.8's dangling tag pointer,
  §10.4's hole-versus-disconnection conflation, M2's unscoped wording, and §6.7's authoring
  workflow (which told authors to run only validate and lint, and which F7 made worse).
- **New: F24** — §6.5's `build` job is unreachable on a content-only PR, so everything
  `lst compile` enforces is ungated on its own input. Blocks T25; weakens T04, T12, T23.
  Note `T25-ci-and-deploy.md` already carries an acceptance criterion that the spec as drawn
  makes unsatisfiable. **F25** — nothing owns §5.4's missing-uid gate; §6.1 names `lst ids`,
  which writes files in place and therefore cannot be the gate that rejects them.

### One edge change

**T03 now blocks T12.** F17 moved `map-validate.ts` out of `tools/src/compile/` and into
T03's rules directory, so the map geometry task depends on the validator that runs its
checks. Everything else in Group D was note-level.

## What session 4 changed (Group C — F12, F13, F14)

- **F12** — a merge rule per array. `skills` merges per `treeId` field by field:
  `startedAt` earliest, `lastActivityAt` latest, `contentVersionSeen` **minimum**,
  `attainedLevel` **never merged** (copied from the later-activity side). Max was rejected
  as a ratchet §11.10 already forbids. **`contentVersionSeen` is now an export field** —
  merging it as a minimum is what forces §12.5 to replay, without which a merge from an
  older device delivers pre-migration records that the `>` guard means are *never*
  migrated. `orphans` union by uid with the more specific `reason` winning (`at` is frozen
  at completion time, so it ties). A uid live on one side and orphaned on the other resolves
  to the **milestone** — and that rule must not ship without the rewind.
- **F13** — both halves. The unknown-uid sweep is scoped to `record.treeId === tree.id`,
  **and** the manifest gains a library-wide `moved` map applied by `store.applyMoves()` at
  cold start (§13.3). Scoping alone was insufficient: `MILESTONE`'s PK is the uid, so a user
  re-ticking an invisible milestone overwrites the original `at` and `note`. A uid-keyed
  `TreeProgress` lookup was researched and **withdrawn** — see below.
- **F14** — the pass is a **fold in file order** under four rules, with
  fold(1..n) = fold(1..i) ∘ fold(i+1..n) stated. **`merged` folds by target, not by entry**
  (`LineageEntry` carries one `uid`, so an *n*-into-one merge is *n* entries — reading them
  in isolation inverts R-16's accepted loss into silent over-credit). The unknown-uid row
  became a **final sweep**. File order needed enforcing, not just stating: §5.5 bounded
  file-position significance to two places (now three) and **§6.4 gains check 6** — the
  baseline ledger is a prefix of the head's. That check inherits whatever **F6** settles.
- **Three defects folded in** rather than appended, because Group C could not be stated
  without them: the multi-predecessor merge grouping, the exported `contentVersionSeen`, and
  §12.5's `moved` frozen-set clause (which kept a departed uid in the source tree's frozen
  set forever, un-satisfying a grandfathered level with no user action — invariant 7 defeated
  by the mechanism meant to preserve it; `moved` now removes the uid, like `retired`).
- **New: F20** — `split` never states the predecessor's fate, in the record table or the
  frozen-set clause. Blocks T17. **F21** — `into:` has two grammars (`moved` is
  tree-qualified, `split`/`merged` are bare uids) and neither is validated; F13's manifest
  index now parses that grammar. Blocks T03, T04, T17. **F22** — a started skill whose tree
  leaves the manifest loses its domain, its score, and its migration silently. Blocks T14,
  T16. **F23** — nothing produces `TreeProgress`; §14.5 has no accessor and §12.2's
  `by-tree` index has no stated consumer. Blocks T09, T11a.

### The research overturn worth knowing about

The proposal taken into research for F13 was neither of the finding's two options: key
`TreeProgress` lookups by **uid** against the bundle's uid set instead of the `by-tree`
index. It was withdrawn on three breakages, each verified against the spec — §11.5's frozen
check is per-tree so the *source* tree un-grandfathers; an unstarted destination tree has no
`SKILL` row (§11.7) so its completions render and score zero; and the final sweep's predicate
goes vacuously false, making `OrphanReason: 'unknown'` dead code. **This is the third session
running in which asking the agent for the case against first changed the answer.**

## What session 3 changed (Group B — F3, F4, F5)

- **F3** — all six undefined types written into §14.4/§14.5, plus `DomainId` and
  `OrphanReason`. **`Taxonomy` is `Manifest['taxonomy']`**, not a new declaration — T02
  must not hand-write it. **`tier` is `TierName | null`**, null exactly at
  `attainedLevel: 0` ("Level 0 — not yet ranked", §11.3). `OrphanReason` gained a third
  member `merged` for §12.5's partial-merge orphan; `MigrationReport` carries
  `attainedLevel` before/after.
- **F4** — the row extends: `DomainSkillRow.lastActivityAt`, and `DomainScore` carries
  `lastActivityAt: string | null`. **T11b owns both rollups.** The store cannot: `domain`
  lives only in the manifest and `STATE ⇢ LOADER` is FORBIDDEN, so
  T11's (now T11b's) "roll-up is a store concern" was unimplementable and is gone.
  §12.2 now pins every timestamp as **ISO-8601 UTC with a `Z`** — the `max` is a string
  comparison in a pure engine. The manifest × `SKILL` join is **T14's**.
- **F5** — the exemption is struck, and the decay language is gone from §2, §10.5 and
  §15.5 as well. Monotonicity now quantifies over all four `DomainScore` fields with no
  carve-out, matching §11.9's invariant 1, which never had one. R-20 carries the
  "if it ships, it is a renderer-side derivation" note. **Independent of R-24.**
- **New: F18** — the fill band vocabulary is required in three places, defined nowhere, and
  called a "tier" in two of them, colliding with F7. Blocks T13, T20. `DomainScore`
  deliberately has no band field so resolving it changes no engine type.
- **New: F19** — `SKILL.lastActivityAt` is non-optional in §12.2 but only ever written by
  `setMilestoneState`, and un-checking currently counts as activity. Blocks T09.

## What session 2 changed

- **F8** — `contentVersion` is now an **authored per-tree integer**; the library-wide
  counter is deleted. New `lst version` subcommand writes it, §6.4's baseline job enforces
  it. Touched §4.1, §5.2, §5.3, §6.1, §6.4, §6.5, §7.2, §7.3, §8.6, §11.5, §12.2, §12.5,
  §12.6, §16.1, §16.2, D-19. **T11's `>` versus `!=` distinction is a correctness matter,
  not an optimization** — see §12.5.
- **F9** — `schema/compiled-tree.schema.json` and `schema/manifest.schema.json` added.
  Build-time and codegen only; the app ships no validator.
- **F10** — service worker deferred to phase 2; pinning is in-page Cache Storage. Settled
  by N9's "**once loaded**" wording. Gap recorded as **R-26** in §19.3.
- **F11** — new **`lib/actions`** module is the `startSkill` → `pin` seam, with two new
  forbidden edges in §14.1 and §14.7. Pinning is best-effort.
- **F16** — **§11 splits at §11.5.** §11.1–§11.4 (tree-local) ship in Phase 0;
  §11.5–§11.8 (grandfathering + aggregation) in Phase 1. §16.4's "no scoring" became "no
  *domain* scoring".

## ~~Step 1 — the T11 split~~ DONE, 2026-08-06

`T11-scoring-engine.md` is **deleted**; `T11a-scoring-tree-local.md` (§11.1–§11.4, phase 0,
blocked by T02/T26, blocks T08) and `T11b-scoring-aggregation.md` (§11.5–§11.9, phase 1,
blocked by T10/T26, blocks T13/T14/T15/T17/T19) exist and both `_BREAKDOWN.yaml` rows read
`status: written`. **All 28 task docs are now written and the breakdown has no `pending`
row.**

Four things about how the split was drawn, because they are decisions rather than
transcription:

- **T11a ships the whole tree-local §14.4 block, including two fields it does not
  implement.** `TreeProgress.grandfathered` is accepted and unread, and
  `LevelProgress.grandfathered` is always `false`, with a phase-0 test asserting exactly
  that so T11b has a failing counterpart to flip. The alternative — narrow the type in
  phase 0 and widen it in phase 1 — would break T08 and T09, which are written against
  §14.4 *now*. No downstream type changes at the phase boundary.
- **`satisfiedBy` went to T11a**, not T11b. It is tree-local, T09 is what freezes it, and
  computing it in phase 0 means §11.5 is one added disjunct in `levels.ts` rather than a
  restructure. T11b's deliverables list `levels.ts`, `index.ts` and `invariants.prop.ts`
  as MODIFIED for that reason.
- **The generators and the `fast-check` choice are T11a's**, because invariant 8 needs
  them and it is tree-local. §11.9's eight invariants split 2/6: **6 (tree-local form) and
  8** to T11a, **1–5, 7 and the score half of 6** to T11b. The §11.10 counter-test —
  the one that proves the suite has teeth — is T11a's, which puts it before any content is
  authored against the engine.
- **T26/F18's band table landed in T11b** as `bands.ts`, with the three constraints F18
  set written as acceptance criteria: name is `string` not a union, one table and one
  resolver, and a grep test that no numeric threshold appears outside that module.

One stale figure was corrected in passing: the old doc's "raises the containing domain's
score by exactly 9 (`table[4] − table[1] = 11 − 2`)" was ×2-table arithmetic that F1
superseded. It is **+37** (45 − 8), and it is now T11b's criterion — T11a asserts only the
`attained 1 → 4` half, since the score does not exist in phase 0.

Graph edges were rewired in the eight task docs whose header tables still said `T11`
(T10, T13, T14, T15, T17, T19, T26 — T08 already read `T11a`), and the prose references
in T00, T04, T06, T08, T09, T10, T13, T15, T17, T19 and T25 were pointed at the correct
half.

## Step 2 — the remaining ten findings

Suggested grouping, unchanged from this session's analysis:

| Group | Findings | Blocks | Note |
|---|---|---|---|
| ~~**B — engine types**~~ | ~~F3, F4, F5~~ | — | **Done, session 3.** |
| ~~**C — lineage & import**~~ | ~~F12, F13, F14~~ | — | **Done, session 4.** Raised F20–F23. |
| ~~**D — CLI & map validation**~~ | ~~F6, F7, F17~~ | — | **Done, session 5.** Raised F24, F25. |
| ~~**G — the lineage leftovers**~~ | ~~F20, F21, F23~~ | — | **Done, session 6.** Raised F26. |
| **E — the omission cluster** | F15, F19, F22, F25, F26 | T03, T09, T14, T16 | Seven small items plus F19. F22 and F25 are the same class — a stated guarantee with no named owner — and **F26 is that class again**, which is the argument for taking it here rather than alone: §12.3's write-back, §5.4's missing-uid gate and §5.9's tree removal are three instances of one question. |
| **H — the CI topology** | F24 | T25 | Alone, and it does not fit the others. It is a job-graph decision, not a §6.4/§10.3 ownership question, and it is the only open finding that makes an existing task doc's acceptance criterion unsatisfiable as the spec is drawn. |
| **F — the band vocabulary** | F18 | T13, T20 | Does not fit the others: naming the bands is a content/PRD-adjacent call, probably T00's, and it must also rename "tier" at the domain level. Ask the owner rather than deriving. |

**F24 is the one to do next if you want the highest-severity single finding**: as the spec is
drawn, `lst compile` — and therefore §7.3, F9's schema validation, F13's `moved` map, and
§6.4 check 5 — never gates a content-only PR. **Group E is the alternative**, and it is now
five findings rather than four; if you take it, do F22, F25 and F26 as one sitting, since all
three are "a stated guarantee with no named owner" and answering one shapes the others.
**F18 still needs the owner, not a derivation** — the band names are a content call and may
belong in the PRD.

## Working agreements from this session

- **Confidence bars on every option** presented to the user (`[########--] 8/10`).
- **Research before deciding on open calls**, and ask the agent for the case *against* the
  proposal. This session's F8 proposal was overturned by exactly that, and the overturn was
  correct — see `SPEC-FINDINGS.md` F8's "An intermediate proposal, and why it was wrong".
- **Verify agent spec findings against `docs/ARCHITECTURE.md` before acting on them.**
- **Five findings at a time, maximum.** The user is watching usage limits.

## Known open items

- **T15 specification is complete** (2026-08-07). D20 rule is concrete in PRD v1.4 and
  `T15-placement-and-estimator.md`; implementation remains blocked by **T11b**.
- **T26's F1 and F2 needed the user's judgment** and got it. The rest are mostly delegable,
  but F6 (which baseline ref) is a maintainer preference, not a derivation — and **F18's
  band names are the same kind of call**, plus they may belong in the PRD.
- ~~**The T11 split is still step 1.**~~ **Done 2026-08-06** — see the step 1 section
  above. `DomainSkillRow`, `DomainScore` and both rollups went to **T11b**;
  `TierName | null` went to **T11a**, since every skill starts at `attained: 0` and so the
  null case is phase 0.
- **Group D's one edge change is T03 → T12**, and it is the kind the coherence pass below
  exists to catch: moving a check between subcommands moves a dependency between tasks.
- **Group G's rider spans three tasks with no edge to carry it.** Every §14.5 writer must
  refresh §13.2's mirror on commit — T09 for `setMilestoneState`, T17 for both migration
  passes, T16 for `import`. Nothing in the graph expresses "these three implement one
  invariant", and the failure is silent: stale progress on the first paint after a
  migration. Same shape as Group C's two build-artifact fields.
- **Group C added two fields to build artifacts**, and both are load-bearing rather than
  informational: `manifest.moved` (T02's schema, T04 emits it) and the export file's
  `contentVersionSeen` (T02's schema, T09 writes it, T16 merges it as a minimum). Neither
  changed a graph edge, but both are easy to drop on the floor because the tasks that own
  the schemas are far upstream of the tasks that need the behaviour.
- **T14 stubs `applyMoves` if T17 has not landed.** Deliberately no hard edge — see the
  T17 note in `_BREAKDOWN.yaml`. Do not add one without re-checking the critical path.
- ~~**The coherence pass across all 28 docs has not been done.**~~ **Done 2026-08-07** —
  Session 8 coherence pass; see the Session 8 header above.
