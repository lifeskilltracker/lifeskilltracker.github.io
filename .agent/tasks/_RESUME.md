# RESUME — implementation

Updated 2026-08-17: **T27, T28, T29, T32 and T34 are complete.** Phase 2 is under way.

# SESSION 23 — T32 AND T34, BUILT IN PARALLEL. THE PARALLEL FRONT IS NOW EXHAUSTED.

Both were blocked only by T27 and touch disjoint files, so they were built simultaneously
in separate worktrees and merged with **no conflicts**. Composed verification after the
merge: 901 + 348 tests pass, `svelte-check` 547 files 0 errors, `a11y:manual` **43 of 43
unchanged**, budget 57.7/82.0 kB, `check:s1` holds, `eslint` clean.

**The next actionable task is T30, and it is the only one.** T31 needs T30; T33 needs T30
and T31; T35 needs all four. There is nothing left to parallelise in phase 2.

## Retire the session-22 note about three failing tests

Session 22 recorded that the `dismiss/undismiss` property test and two axe gates "fail
identically on a clean tree". **They do not.** Both agents went looking and neither
reproduced it. What is actually there:

- `domains.test.ts` fails **before a compile** — it needs `static/content/manifest.json`.
  Run `npm run build` first. (CI already orders it this way as of `d7577f0`.)
- `s/[tree]/page-render.test.ts`'s axe gate is a **timing flake** under full-suite load
  (~5.6 s); it passes in isolation and on re-run.
- The `dismiss/undismiss` property test is randomized and passed every run.

Do not spend time on these three as if they were a standing regression.

## Carried forward — read before T33

- **The tab budget is now the binding a11y constraint.** Reaching the first milestone on
  `/s/piano` costs **16 tabs** against `manual-passes.mjs`'s `< 20`, up from 7, and it
  **grows by one per started skill**. The sidebar is 14 of the 16. T33's Find and Info are
  map affordances and must sit behind the same route guard the next-step card uses — do not
  add tab stops before `main` on the tree route. When the check finally trips, the right fix
  is to re-anchor it to count tabs *inside* `main`, not to raise the number.
- **`domain.test.ts` greps every source file for the band thresholds** `0.15 / 0.35 / 0.55 /
  0.72`. It catches innocent CSS like `font-size: 0.72rem`. T32 hit this and worked around
  it with `0.7` / `0.16` / `0.36`.

## For T31 specifically

`app/src/lib/components/node-state.ts` is the **single producer** of the §4.6 mapping:

```ts
export function visualFor(state: NodeState): MilestoneVisual;   // NodeState, not `| undefined`
export const MILESTONE_VISUAL: Record<NodeState, MilestoneVisual>;
```

Consume `visualFor`. Do not re-map states — the cross-task invariant exists because two
surfaces will otherwise disagree about what `bonus` looks like. `presentationFor` is the
SVG-attribute rendering of the same table and is now derived from `visualFor`.

## Two judgment calls worth a second opinion

- **§4.6's "open" plate shipped as bare paper, not `--plate-open`.** Reading it as 0.52
  makes `available` darker than `bonus` at 0.42, inverting the table's own ordering.
  `locked`/`dismissed` got a neutral `--rule` wash instead, on the grounds that a third
  strength of domain ink would read as a third score. This is a departure from the spec's
  literal text, recorded in T34's Outcome section.
- **UI-SPEC Q3 shipped as recency with no flag**, as specified. Revisit once three trees
  exist, per T32's scope.

# SESSION 22 — T29 COMPLETE. EVERY SKILL HAS A POSITION NOBODY AUTHORED.

`lst compile` now assigns each published tree the lowest free cell in its domain,
writes `content/taxonomy/placement.yaml`, and emits a cell per tree into the
manifest. **`lst baseline` check 9** fails CI if a committed assignment moves.

The one decision worth carrying forward: **the sub-lattice is not a polygon
containment test.** `enumerateCells` takes the region's tiles and asks which
parent tile owns each cell — exact integers, per A2-D. Consequences:

- **No cell can belong to two regions** (tiles partition, M2 forbids double
  claims), so boundary ties cannot stack two skill hexes.
- **Every region holds exactly `16 × tiles`**: Making 160, Body 112, Home 112,
  People 128, Work & Money 96, the rest 112. Capacity is arithmetic now.
- The Q2 figures quoted at decision time (Body 109) came from float containment
  and were three cells low. The decision stands; Body is 112.

**Check 9 permits what the design permits**: appended lines, removed lines
(retirement frees the cell), and a changed `domain`. Only *same tree, same
domain, different cell* fails — plus any `cellDivisor` change.

**For T31**: `manifest.trees[].cell` is **required** in `manifest.schema.json` and
present on the app's generated `TreeEntry`. The ledger is written, not read, by
the app.

**Three app tests fail and are not ours** — the `dismiss/undismiss` property test
and two axe gates fail identically on a clean tree. Worth a look before T33.

# SESSION 21 — T28 AND T27 COMPLETE. THE SPEC AGREES WITH ITSELF AND THE VOCABULARY EXISTS.

Session 19's finished-but-uncommitted work was committed first, on its own, so the
amendments would land reviewable (`53ca432`).

**T28 — all seven amendments landed in one commit** (`9842a65`). §10.7 no longer says
"no pan, no zoom, no camera", so an implementer working from the architecture alone now
builds the right map. A1–A7 are recorded in `docs/SPEC-FINDINGS.md` as their own series,
deliberately not as `F` findings: they are supersessions, not defects. PRD is **v1.5** —
D19 resolved, D25 partially addressed with its remainder named, **D28 adopted by A6**
(§19.4's priced alternative was taken, and every cost it named was paid). T13, T14 and
T25 carry HISTORICAL banners for the clauses they shipped against.

**T27 — Alegreya SC, and the reasoning matters more than the name** (`1035afb`). The face
was chosen against measurements, and two plausible answers were falsified on the way:

- **The 12 kB budget never bound.** All eleven candidates subset to 4.2–8.9 kB once
  unused OpenType tables are dropped. Do not cite the budget as the reason for anything
  here.
- **Stroke contrast binds.** Hairline survival at §5.2's 23 px tracks stroke contrast
  almost exactly — above ~3:1 the thinnest stem lands under one device pixel and
  antialiasing halves its effective contrast. **No weight of Cormorant fixes this**; its
  weight axis thickens the thick stems (22u → 23u from 600 to 700).
- **§4.5's small-caps requirement is a second, independent filter.** Libre Caslon Text,
  Spectral SC and EB Garamond have **no true small caps** despite the naming, and browser
  synthesis scales caps to ~0.75 and thins strokes with them. Only Alegreya SC and
  Vollkorn SC pass both rules.
- **The knockout halo is an accessibility mechanism, not a flourish.** Ink on the halo is
  13.9:1 / 12.0:1; the same ink on a full-strength plate is **1.45:1** at worst. Nothing
  downstream may drop it.

## Carried forward — read before starting T29 or T31

- **A2-D is an open, latent defect in T12.** `tools/src/compile/map.ts` keys interior-edge
  cancellation on `toFixed(6)` of pixel floats rather than on lattice integers. All 306
  tools tests pass and that is not evidence against it: the failure is content-triggered
  and appears when someone edits `map.yaml`. **Fix before the next `map.yaml` edit**, and
  **T29 should not layer the sub-lattice on float-keyed geometry.** Recorded on
  `T12-map-geometry.md` and in SPEC-FINDINGS as A2-D.
- **`cellDivisor` freezes at T29's first committed assignment.** UI-SPEC **Q2 is settled
  (2026-08-16): 4, global, no per-region override.** Measured against the real `map.yaml` —
  3 overflows Making, Body, and Home at the 500-skill projection; 5 puts the smallest
  level-1 cell at 36 px, under WCAG 2.5.5 AAA. Do not revisit it after the first ledger
  commit: renumbering the spiral reflows every region, the exact N11 failure the ledger
  exists to prevent.
- **`accent` is now derived** — the plate-open composite of `base` over that theme's
  paper. A3 removed its only consumer (MapRenderer's clip-path fill), so this is a
  placeholder with a principled rule rather than a hand-picked colour. **T31 should
  revisit it** if skill hexes need a real second tone; it is one data edit per domain.
- **The font lives beside `tokens.css`, not in `static/`.** Deliberate: `static/` is
  root-addressed and `BASE_PATH` is non-empty on a project-page deploy. Do not "tidy" it
  into `static/` — that reintroduces a silent fallback to Palatino in production.
- **`MapRenderer.a11y.test.ts` had one assertion adjusted** (plates are per-domain tokens
  now, so two regions differ by identity rather than recency). `MapRenderer.test.ts` is
  unchanged.

**Next actionable:** **T32** and **T34** (both blocked only by T27, both unblocked and
parallel), and **T30** on the critical path. T30 → T31 → T33 → T35 follows; T31 now has
its placement input and is blocked only by T30.

# SESSION 20 — `docs/UI-SPEC.md` IS COMMITTED, AND PHASE 2 IS BROKEN DOWN.

`docs/UI-SPEC.md` v1.0 landed (commit `23cd203`) and **T27–T35 are written**. Phase 2 is
"the interface" — the thing the architecture deliberately declined to specify (§15.9) and
PRD **D19** had left open since v1.1.

**What UI-SPEC decides.** Eleven decisions, U-01 to U-11. The load-bearing ones:

- **U-02 Survey / Ordnance** — ink-on-paper cartography. Chosen over three alternatives on
  one hard constraint: it is the only direction that carries **eight saturated hues as one
  document**, and it survives both themes as a token swap.
- **U-03 hue is identity and never encodes score.** Score is a ruled **water line** at
  `1 − fill`, plate at full strength above and below. Opacity-as-fill was in the design's
  own first draft and is wrong: most domains are low-scoring most of the time, so it drains
  the map of exactly the per-region identity F21 asks for.
- **U-01 a two-level stepped camera**, both levels URLs, Back as the breadcrumb. Declined a
  free camera on LOD scaling — the reference implementation's global LOD boolean works at 42
  nodes and this library is projected at 164 and eventually 500.
- **U-04 skill positions are derived, append-only, frozen at publish.** The one genuinely
  new mechanism. F13 forbids authored coordinates and N11 forbids reflow, which together
  rule out both the authored answer and the semantic one.

**Seven amendments to ARCHITECTURE.md (A1–A7)** are named in UI-SPEC §9 and **not yet
landed**. Until T28 runs, §10.7 still reads "no pan, no zoom, no camera" — an implementer
working from the architecture alone will build the wrong map. That is why T28 gates T30.

### Start here

Three tasks have no blockers and are genuinely parallel:

| | Why now |
|---|---|
| **T28** | Spec-only. Nothing visual is correct to build until A1–A7 are in the architecture. |
| **T27** | Everything visual consumes its tokens. Also decides UI-SPEC **Q1** (the display face). |
| **T29** | `tools/` only, no app dependency, and the longest single piece of new logic. |

Then **T27 → T30 → T31 → T33 → T35** is the critical path, with T32 and T34 falling off
T27 in parallel.

### The traps, stated so they are not rediscovered

- **`cellDivisor` is frozen the moment the placement ledger has its first commit.** UI-SPEC
  **Q2 is settled: 4, global.** Changing it after that commit reflows every region, which is
  the exact N11 failure T29 exists to prevent.
- **T30 must paint to the resting frame.** T35's reveal layers onto it; a map that animates
  itself into place leaves T35 nothing coherent to hand over to.
- **Reduced motion means *skipped*, not shortened** — a 100 ms reveal is still a reveal.
- **`a11y:manual` must keep passing unchanged.** It was written against roles and accessible
  names only, with no CSS selector, no pixel and no screenshot, specifically so the UI could
  be reworked without breaking it. A failure is a regression, not test churn.
- **The `accent` half of each domain palette has no answer yet.** UI-SPEC §4.2 gives one hex
  per domain per theme; `domains.yaml` carries `{ base, accent }`. T27 must not silently
  reuse the Chakra accents against the new bases.

### Open questions with no owner

UI-SPEC §12 **Q3** (next-step selection rule — recency ships, the alternative waits for
three trees), **Q4** (D25's remainder: how a Curious Browser reaches a compelling *tree*
without starting one) and **Q5** (does Find's highlight survive a camera move — T33 decides
and records it). Q4 is the only one with no task at all.

### Still true from session 19

The four run-level confirmations below still need the repository to exist. None is code.

---

# SESSION 19 — T25 COMPLETE. PHASE 1 IS DONE, AND CI EXISTS.

Verified 2026-08-15: **752 app tests + 303 tools tests**, `npm run typecheck` clean over
530 files, `npx eslint .` clean, every gate command run by hand and green.

**`.github/workflows/ci.yml` and `deploy.yml` exist.** Seven gating jobs, one advisory,
the path filter as a job-level `if:`, and a merge to `main` that publishes to Pages with
no manual step (D-12).

**What is now true that was not:**

- **§17.1's budget is enforced, in Brotli, and it is tested by failing.**
  `tools/src/ci/budget.ts` measures first paint from the *prerendered `index.html`* — the
  browser's own list of what it fetches — and the lazy tree route as a static-import
  closure minus that. Fixtures are built from incompressible bytes searched to an exact
  Brotli size, so each row passes at its budget and fails one byte over. Real figures
  today: **45.7 / 52, 11.7 / 25, 0.6 / 15, 46.4 / 70 kB**. *(Historical as of 2026-08-16 —
  T28's A4 adds a ≤ 12 kB font row and moves the total to 82 kB. T27 implements it.)*
- **The workflows themselves have tests.** `workflows.test.ts` parses both files and
  asserts the graph, the absence of `always()`, the `fetch-depth: 0` on the two jobs that
  need it, and that deploy has no `pull_request` trigger. `path-filter.test.ts` runs the
  filter over real temporary git repositories.
- **`lst lint --format github`** emits `::warning` workflow commands with repo-relative
  paths. Chosen over a bot precisely because `::warning` has no failing variant.
- **§4.4's fourth row turned out to be a gap, not a verification.** Pages serves fixed
  headers, so `lib/content/manifest.ts` now fetches the manifest with `cache: 'no-cache'`;
  hashed bundles deliberately still don't.

### Four things need the repository to exist, and none of them are code

There is no git remote and no credentials as of 2026-08-15. Publishing under GitHub user
**`lifeskilltracker`**. In order:

1. Create the repo, push `main`, and set **Settings → Pages → Source: GitHub Actions**.
   Under "Deploy from a branch" the deploy workflow succeeds and the site never changes —
   the one failure mode here that looks exactly like success.
2. Run `tools/ci/apply-branch-protection.sh` (after `gh auth login`). It requires the seven
   gating jobs, sets `strict: true`, and leaves `content: lint` unrequired.
3. Open a content-only PR and confirm `content: compile` is **run, required, green** while
   the three `app:` jobs are **skipped**. A skipped required check counts as passing, so
   "the PR was green" is not the assertion.
4. Confirm the deployed site serves from `/<repo-name>/` — the only end-to-end test of
   `BASE_PATH`.

**What is left in the repository as a whole:** **T20's manual §15.8 passes** (keyboard and
screen-reader, now unblocked since T15 and T16 have landed), **T00's owner decisions**, and
**F29** — §9 draws neither a track title nor a module label, raised by T21 and still open.

# SESSION 18 — T22, T23, T24 COMPLETE. THE CLI IS WHOLE AND THE DOCS EXIST.

# SESSION 18 — T22, T23, T24 COMPLETE. THE CLI IS WHOLE AND THE DOCS EXIST.

All three verified complete 2026-08-15: **751 app tests + 266 tools tests**, `npm run
typecheck` clean over 530 files, `npx eslint .` clean.

**The `lst` CLI now implements every row of §6.1's table.** `validate`, `ids`, `compile`
(already shipped) plus `lint`, `status`, `new` (T22) and `baseline`, `version` (T23).
Nothing in §6.1 is unimplemented.

**What is now true that was not:**

- **`lst lint` cannot fail a merge, structurally.** Rules produce findings; `lint/index.ts`
  alone decides whether findings gate, and it decides they never do. R-04's promotion path
  is a change in one function. Real-corpus behaviour: 17 findings across the three trees,
  exit 0.
- **`content/REVIEW-STATUS.md` exists and is generated.** `lst status` regenerates it,
  writes on drift, and fails only on drift — a corpus with no reviews recorded anywhere
  still exits 0.
- **All eight §6.4 checks run**, against the tip of `origin/main` with the head being the
  working tree. An unresolvable ref throws rather than passing vacuously, which is the whole
  point of the `fetch-depth: 0` paragraph. Fixtures are real temporary git repositories.
- **`lst version` shipped with T23**, per T23's own F8 hazard note — it needs check 5's
  comparison byte for byte.
- **The three contributor documents exist** and point at all three exemplar trees by path.

**T25 is the only thing left in phase 1**, and it now has everything it needs: seven gating
jobs whose commands all exist, the check-4 auto-fix patch waiting for push credentials, and
the up-to-date-branch repository setting §6.4 requires. **T20 remains partly complete** —
§15.6 is blocked on T15 and §15.8's manual passes are outstanding.

### Three decisions recorded in the task docs rather than here

- **T22** — a requirement-group "shape" is `rule` + `n`, not size; `level-pacing` fires at
  a deviation of 3; an orphan is off the prerequisite graph in *both* directions. And
  `vague-milestone` ships flagging the bare word "practice", nine false positives on
  `mental-health.yaml`, kept deliberately as R-04's evidence rather than tuned away.
- **T23** — check 2 is detectable in exactly one shape (the uid now carries a slug the
  baseline gave to another uid); everything past that is R-03 and unreachable. Check 6
  compares ledger entries with object keys sorted, because YAML key order is not meaning.
- **T24** — acceptance criteria 5 and 10 contradict each other. 10's grep fires on the
  exclusion list 5 requires verbatim. Resolved for the verbatim text; read the hit rather
  than acting on it.

# SESSION 17 — T21 COMPLETE. S1 HAS ALL THREE SHAPES, AND ONE OF THEM RENDERS WRONG.

T21 (exemplar trees 2 and 3) verified complete 2026-08-15: `npx lst validate` exits 0 over
the whole repository, **751 app tests + 195 tools tests**, `npm run typecheck` clean over
530 files, `npx eslint .` clean. No change under `lib/layout`, `lib/scoring` or
`lib/components`, and the `archetype` grep over those three directories is empty.

**What is now true that was not:**

- **All three trees S1 names exist.** `piano.yaml` — three tracks (technique 20,
  repertoire 20, musicianship 10), **15 cross-track `requires` edges of which 4 are
  same-level**, explicit multi-group `requirements:` at levels 4 and 7. `mental-health.yaml`
  — no tracks, **five modules**, and `n_of`/`any` electives at levels 4, 6 and 10 whose
  members span three modules. Both are 50 milestones over ten levels, five per level.
- **§8.4's side gutter has its first real input.** The four same-level cross-track edges are
  the case the gutter and its bow exist for; before this task nothing in the repository
  produced one. Piano lays out 620×960 wide with 3 columns and 57 edges; both trees pass
  through the real `TreeView` with every node drawn, in both viewports.
- **T10's residue is discharged.** The phase-0 gate recorded that `track`, `order` and
  `n_of` had the weakest test of anything in the schema. They now have two trees exercising
  them, and `order` is still untested by design — neither tree needed a tiebreak.
- **`facets.yaml` gained `performance` and `contemplative`** (§5.9 maintainer PR), kept
  minimal on purpose; D12 is still open and the full facet vocabulary is still not seeded.

**RAISED: F29, and it is the first finding raised by implementation rather than by the
breakdown.** §9 draws **neither a track title nor a module label** — `TreeView.svelte` never
reads `positions.columns`, and `module` appears nowhere in `app/src/` outside the generated
types. So piano's three columns are unnamed, and the modular tree is currently
indistinguishable on screen from a linear one. §9.2's SVG sketch has no place to put either,
which is why it is a spec finding and not a T08 bug. Filed in `docs/SPEC-FINDINGS.md` with
the three decisions a resolution needs (where column titles live, what a module label even
is when modules cut across columns, and whether the track name joins the accessible name).
**S1 is satisfied as written** — one component, no archetype branch, three shapes through
one pipeline — but its evidence is weaker than the sentence in D-07 implies.

**Three things a later task must not undo:**

- **Neither tree was bent to fit the renderer.** If F29's resolution makes module labels
  drawable, the answer is to draw them, not to simplify `mental-health.yaml` into
  something the current renderer flatters.
- **`talk-to-a-professional` stays an elective.** It sits in an `n_of` at level 6 on
  purpose: gating a level on professional care would be a clinical judgement the tree has
  no standing to make.
- **Teaching and performing stay spread across levels** in both trees (F43) — piano teaches
  a first piece at level 6 and performs for friends at level 4. T24 points at these as
  worked examples, so clustering them at the ceiling later would make its rubric a caveat.

**Next up:** **T22, T23, T24, T25 are the only open tasks left.** T24 is unblocked by this
task and should treat both new trees as its worked examples — but must not describe module
labels as a rendered feature while F29 is open. T20 remains *partly* complete: §15.8's
manual passes are still outstanding — see its own *Completion state*.

---

Updated 2026-08-15 after T19.

# SESSION 16 — T19 COMPLETE. `dismissed` IS VERIFIABLY INERT.

T19 (dismissed state end to end) verified complete 2026-08-15: **751 app tests + 195 tools
tests**, `npm run typecheck` clean over 530 files, `npx eslint .` clean, `npm run build`
clean, S1 gate holds.

**What is now true that was not:**

- **"Hide it instead" does something.** `tree-session.ts` carried a `case 'hide': return;`
  with a comment admitting it. Hiding is now a presentation-only suppression held by the
  `TreeSession` as a `SvelteSet` — no record, no `MilestoneState`, no preference — with a
  `Show hidden (N)` control and an `unhide` intent, because a suppression the user cannot
  find again is indistinguishable from data loss. §11.10 and §9.3 now specify it.
- **Invariant 6 is stated over sequences, not over one mask.** §11.10's catastrophe is a
  *reversibility* argument, so `scoring/dismissed.property.test.ts` generates
  dismiss/undismiss sequences and compares every score field against the baseline **after
  every step** — a sequence that returns to where it started would hide a score that moved
  in the middle. `nodeStates` is excluded and asserted to change: `dismissed` is
  presentation-only, not invisible.
- **§11.10's catastrophe is a named regression test.** An `all` group of five with two
  dismissed evaluates `completed = 3`, `n = 5`, `satisfied = false`; all five dismissed is
  `0 of 5` and still unsatisfied, not vacuously satisfied.
- **The intercept is verified against the write path, not against the wording.**
  `routes/s/[tree]/MilestonePanel.test.ts` wires the panel to the real store over
  `fake-indexeddb` and spies on `setMilestoneState`. No existing test could tell "warned
  first" from "wrote anyway", because none of them wrote anything.

**Three things a later task must not undo:**

- **Hiding never reaches the store.** That is what makes "writes nothing" structural rather
  than reviewed. If a durable hidden flag is ever wanted, it is a §12.2 schema question and
  a breaking bump — not a quiet extra call in `#applyOne`.
- **A revealed hidden node keeps its own state's glyph and border.** Borrowing
  `dismissed`'s dotted border and ✕ would state something the user never said.
- **The property test's vacuity guard stays.** Without it a corpus where no dismissal ever
  lands passes against any engine at all.

**Next up:** **T21, T22, T23, T24, T25 are the only open tasks left.** T00 is complete, so
the "T00 awaits owner decisions" line carried by sessions 11–15 is stale. T20 remains
*partly* complete: §15.6's criteria were blocked on T15, which has since landed, and
§15.8's manual passes are still outstanding — see its own *Completion state*.

---

Updated 2026-08-15 after T18.

# SESSION 15 — T18 COMPLETE. THE runtime-io CLUSTER IS CLOSED.

T18 (durability, quota, and export prompting) verified complete 2026-08-15: **730 app tests
+ 195 tools tests**, `npm run typecheck` clean over 528 files, `npx eslint .` clean, and
§15.8's axe gate green over `/data` with the prompt rendered.

**What is now true that was not:**

- **R-18 has its mitigation.** Browser storage is not durable and nothing in the app makes
  it so; F39's prompting is the whole answer, and until now it did not exist. All three of
  §12.7's triggers are implemented and each is tested firing on its boundary and silent one
  step below it — ten completions with no export, thirty days with new activity since,
  sixty percent of quota.
- **`navigator.storage.persist()` is requested once, after the first committed user-data
  write**, and nothing anywhere branches on the answer. A test runs the same sequence
  against all four outcomes — granted, denied, thrown, absent — and asserts the app behaves
  identically. "Request it, do not depend on it" is mechanically true rather than intended.
- **A quota-failed write is no longer a silent success.** `SkillPage` was firing intents
  through a bare `void`, so an IndexedDB rejection vanished. `tree-session.apply` now raises
  §16.3's notice and the export prompt and still rethrows; the in-memory mirror was already
  safe, because §12.4 refreshes it only on commit.
- **Dismissal is persisted in `META`, per trigger** (T26/F15). `never-exported` never
  re-arms, `stale-export` costs one window, `quota-pressure` re-arms ten points past a
  stored watermark. A dismissal never writes `lastExportAt` — the app must not claim a
  backup it did not take.
- **`/data` shows §16.5's four facts through one component**, and presents the figures as
  estimates rather than exact numbers.

**Three things a later task must not undo:**

- **The triggers never consult the persistence grant.** `persist()` is effectively
  unavailable on Safari, which is also where ITP's seven-day eviction bites; a prompt gated
  on a denied grant would be silent on Chrome and useful nowhere.
- **The prompt stays in flow in §13.4's notice host.** No dialog, no backdrop, no focus
  management, no fixed positioning — `ExportPrompt.test.ts` asserts the absence of each,
  including in the component's source, because an overlay renders as an ordinary element.
- **`storageStatus()` keeps reading the estimate through `durability.pollEstimate()`.**
  Both Storage API fields are optional; read as `undefined` they become `NaN`, and
  `NaN > 60` is false — a trigger that never fires and never says why.

**Next up:** phase 1's runtime-io cluster is done (T07, T09, T13, T14, T16, T17, T18).
**T19, T21, T22, T23, T24, T25 remain open**, and T00 still awaits owner decisions. See
T18's own doc for the five calls §12.7 does not make that the implementation resolved,
and for the correction to its Verification block — there is no `test:a11y` script.

---

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
