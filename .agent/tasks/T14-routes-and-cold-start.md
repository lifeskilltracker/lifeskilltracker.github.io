# T14 — Full routes and cold-start branches

| Field | Value |
|---|---|
| **Status** | complete — 2026-08-14 |
| **Phase** | 1 |
| **Cluster** | views |
| **Blocked by** | T11b |
| **Blocks** | T16, T20, T25 |
| **Spec** | ARCHITECTURE §13.1, §13.2, §13.3, §13.4, §16.3 |
| **PRD** | F23 |

> **HISTORICAL — superseded in part by T28's amendment A6 (2026-08-16).** This document
> records the phase-1 routes as they shipped. **`/d/<domainId>` is no longer a separate
> page.** It is a camera state over the same map surface (ARCH §10.7, §13.1), so the
> `DomainListing → SkillCard[]` composition named below is superseded by one `MapSurface`
> under both routes, with `SkillList` as the phone substitution at level 1. Both routes
> stay **prerendered**, which is unchanged. `+layout` also gains the sidebar, Find, Info and
> the next-step card (§13.4).
>
> Everything else here — the cold-start branches, `applyMoves`, §16.3's error states and the
> `/s/<treeId>` routes — is unchanged and still normative. The live successors are **T30**
> (the shared surface), **T31** (the level-1 layer and the list) and **T32** (the shell).

## Goal

`app/src/routes/` holds every route the app serves, wired to the correct prerender flag,
backed by the three module-level state stores of §13.2, and driving the cold-start
sequence of §13.3 including all of its failure branches. After this task, every route in
the §13.1 table resolves to a rendered view; a manifest fetch failure, a tree bundle
failure, and an IndexedDB hydration failure each produce the specific, defined behaviour
§16.3 names for it rather than an unhandled exception; and a hydration failure leaves the
store refusing every write for the rest of the session.

## Why this shape

GitHub Pages has no server, so §4.4's `adapter-static` with `fallback: '404.html'` is what
makes deep links work at all — routes that can be prerendered are (`/`, `/d/<domainId>`,
`/library`, `/data`, `/about`, `/contribute`), and skill routes deliberately are not,
because prerendering 164 (and eventually 500) tree shells would grow build time linearly
in content while adding nothing: the shell is identical for every tree and the content
arrives from the manifest at runtime regardless (§13.1). The cold-start sequence's
hydration-failure branch is the one piece of this task that cannot be gotten wrong: §13.3
is explicit that "the dangerous failure is not 'cannot read progress' but 'read as empty,
then wrote'" — a transient IndexedDB error must never be allowed to look like an empty
user, because the write path (§12) holds the only copy of a user's progress that exists
anywhere. Refusing writes for the session is the only response that cannot destroy data.

## Scope

**In scope**

- Every route in the §13.1 table, each with the specified prerender flag:
  `/` (World map, prerendered), `/d/<domainId>` (domain listing, prerendered one per
  domain), `/s/<treeId>` (tree view, not prerendered), `/s/<treeId>/m/<slug>` (tree view
  with milestone panel open, not prerendered), `/library` (all skills, filterable,
  prerendered), `/data` (export/import/storage status, prerendered), `/about` and
  `/contribute` (prerendered).
- Milestone deep links resolved by **slug**, not uid, with unresolvable slugs (a renamed
  milestone whose old slug isn't in `aliases`) opening the tree with a brief notice rather
  than a 404 (§13.1, §5.4).
- The three module-level rune stores of §13.2: `lib/content/store.svelte.ts` (manifest +
  loaded bundles), `lib/state/progress.svelte.ts` (in-memory mirror of user state),
  `lib/state/ui.svelte.ts` (viewport class, panel state, transient notices). No
  state-management library beyond Svelte runes (§13.2, N10).
- The cold-start sequence of §13.3 in full: mount shell with no full-page spinner; parallel
  `loadManifest()` and `store.hydrate()`; the three branches on manifest failure
  (success, offline-with-cache, hard failure) and the hydration-failure branch that
  refuses writes for the session; route-specific data loading after first paint.
- **Calling `store.applyMoves(manifest.moved)` in cold-start step 3** before domain scores
  are derived, rendering migration reports through T17's summary component. Skipped when
  hydration failed; runs before derivation so re-homed records count under the right domain
  on the first frame (§13.3, T26/F13).
- **The `/s/<treeId>` on-tree-open sequence** after the bundle loads (§13.3 step 4): when
  hydration succeeded and the tree exists in the manifest, call
  `store.applyLineage(tree, (progress) => scoreSkill(tree, progress).attainedLevel)` when
  `tree.contentVersion > SKILL.contentVersionSeen`; then `scoreSkill(tree,
  store.progressFor(treeId))`; then `store.reconcileAttainedLevel(treeId,
  skillProgress.attainedLevel)` (§12.3, T26/F26). Order is fixed: migration (with injected
  evaluator) first, score, then reconcile — see hazards. Cold-start `applyMoves` is step 3
  only, not repeated here.
- Every §16.3 error-handling row that is reachable from routing/cold-start: manifest fetch
  failure (both sub-cases), tree bundle fetch failure (isolated to that tree), the §7.5
  shape-assertion failure, IndexedDB hydration failure, IndexedDB write failure (quota).
- The view composition tree of §13.4: `+layout.svelte` (shell chrome, nav, notice host,
  error boundary) and the page components it composes, wired to the components T08 and
  T13 already provide (or stub cleanly if those tasks land later in the same phase).
- **The manifest × `SKILL` join that feeds `domainScores`** — a `$derived` expression
  zipping manifest `trees[]` entries to `SKILL` rows into `DomainSkillRow[]`
  (`{ treeId, domain, attainedLevel, lastActivityAt? }`, §14.4). Assigned here by T26/F4:
  it is the only layer holding both, since `lib/scoring` may not import the loader and
  `lib/state` may not either (§14.1). §3.3's sequence names it.
- Enforcing that `TreeView` is the only **presentational** component importing the Layout
  Engine, and that **presentational** components under `lib/components/` do not import
  `lib/scoring/` — scores arrive as props (§13.4). **Exception:** the tree route
  orchestration layer (`app/src/routes/s/[tree]/`) **may** import `scoreSkill` to supply
  the `applyLineage` DI callback and run the post-migration reconcile sequence; that is
  orchestration, not presentation (§14.1).

**Out of scope**

- The manifest-fetch and bundle-fetch machinery itself (`ContentLoader.loadManifest`,
  `loadTree`, the stale-while-revalidate and CacheFirst behaviour, service-worker
  precaching) — T07, §7.4. This task calls that interface and handles its failure
  outcomes; it does not implement the fetch layer.
- `UserStateStore.hydrate()` and the write-refusal enforcement inside the store itself —
  T09, §12.4/§14.5. This task is responsible for calling `hydrate()` at the right point in
  the cold-start sequence and rendering the correct branch on its outcome; the store's own
  `writable` flag and the rejection behaviour of its mutators are T09's.
- `TreeView`'s internal rendering (§9) — T08. `MapRenderer`'s internal rendering (§10) —
  T13. This task wires routes to those components; it does not build them.
- Import/export file handling on `/data` — routing and page chrome only; **T16** owns
  `export()` / `import()` (§12.6).
- Full accessibility verification of the routed views — T20, though this task must not
  introduce structure that T20 cannot later verify (e.g. a missing `<main>` landmark in
  `+layout.svelte` would be a defect discovered late).
- The build-phase machinery that produces prerendered output (§16.4) — a build-pipeline
  concern; this task only sets the correct `export const prerender` flag per route.

## Deliverables

```
app/src/routes/+layout.svelte                shell chrome, nav, notice host, error boundary
app/src/routes/+page.svelte                   World map → MapRenderer
app/src/routes/d/[domain]/+page.svelte        DomainListing → SkillCard[]
app/src/routes/s/[tree]/+page.svelte          SkillPage: SkillHeader, TreeView, MasteryPanel
app/src/routes/s/[tree]/m/[slug]/+page.svelte tree view with milestone panel pre-opened
app/src/routes/library/+page.svelte           all skills, filterable
app/src/routes/data/+page.svelte              ExportImport, StorageStatus
app/src/routes/about/+page.svelte             project entry point
app/src/routes/contribute/+page.svelte        contribution guide entry point
app/src/lib/content/store.svelte.ts           manifest + loaded bundles
app/src/lib/state/progress.svelte.ts          in-memory mirror of user state
app/src/lib/state/ui.svelte.ts                viewport class, panel state, transient notices
app/src/lib/components/ColdStartFailure.svelte the §16.3 hard-failure screen
app/src/routes/*.test.ts                       cold-start branch tests per route
```

## Interface contract

```
// ARCHITECTURE §13.1 — the route table, verbatim

| Route | View | Prerendered |
|---|---|---|
| / | World map (F21) | yes |
| /d/<domainId> | Domain skill listing (F23) | yes — one per domain |
| /s/<treeId> | Tree view | no — resolved from the manifest at runtime |
| /s/<treeId>/m/<slug> | Tree view with a milestone panel open | no |
| /library | All skills, filterable by domain, subregion, and facet | yes |
| /data | Export, import, storage status (F38, F39) | yes |
| /about, /contribute | Project and contribution guide entry points | yes |
```

```
// ARCHITECTURE §13.3 — cold start, verbatim

1. Mount shell, render layout chrome immediately — no spinner over the whole page.
2. In parallel:  Loader.loadManifest()   ‖   store.hydrate()
3. Both resolve → store.applyMoves(manifest.moved) → derive domain scores → render the map.
   Manifest fails, cache available   → offline mode, render, say so (§7.4).
   Manifest fails, no cache          → cold-start failure screen (§16.3).
   Hydration fails                   → render content read-only, surface the error
                                        loudly, and do NOT write, so a transient
                                        IndexedDB failure cannot overwrite good data
                                        with an empty state.
4. Route-specific data loads after first paint.
```

```
// ARCHITECTURE §16.3 — the error table rows this task is responsible for wiring, verbatim

| Failure | Behaviour |
|---|---|
| Manifest fetch fails, cache present | Offline mode; render from cache and say so (§7.4) |
| Manifest fetch fails, no cache | Cold-start failure screen: what happened, retry, and a link to /data so an export is still possible if hydration worked |
| Tree bundle fetch fails | That tree only is unavailable; map and other trees unaffected |
| Bundle fails the §7.5 shape assertion | Treat as unavailable; clear that bundle from Cache Storage so a stale entry self-heals on retry. The loader owns this cache directly (§7.4), so it holds in v1 with no service worker |
| Deep link opened with no network | Cold-start failure screen. GitHub Pages' `404.html` fallback needs the network; shell precaching is phase 2 (§4.4, R-26) |
| IndexedDB hydration fails | Render read-only, surface loudly, refuse all writes for the session (§13.3) |
| IndexedDB write fails (quota) | Surface immediately, do not update the UI as though it succeeded, prompt export |
```

```
// ARCHITECTURE §13.4 — view composition, verbatim

+layout.svelte          shell chrome, nav, notice host, error boundary
├── +page.svelte        WorldMap        → MapRenderer (§10)
├── d/[domain]          DomainListing   → SkillCard[]
├── s/[tree]            SkillPage
│   ├── SkillHeader     level, tier, progress to next (F32)
│   ├── TreeView        (§9) — the only consumer of the Layout Engine
│   ├── MasteryPanel    (§5.7, §9.6)
│   ├── MilestonePanel  detail, complete / note / dismiss (F31, F46)
│   └── AssessmentFlow  placement and the estimator (F29, F30)
└── data                ExportImport, StorageStatus
```

```ts
// ARCHITECTURE §14.5 — the store surface this task's cold-start sequence calls into
export interface UserStateStore {
  hydrate(): Promise<void>;
  progressFor(treeId: string): TreeProgress;   // synchronous — the tree route's input
  readonly hydrated: boolean;   // false until hydrate() resolves — §13.3, T26/F23
  readonly writable: boolean;   // false if hydration failed — §13.3
}

// ARCHITECTURE §14.2 — the loader surface this task's cold-start sequence calls into
export interface ContentLoader {
  loadManifest(): Promise<Manifest>;
  loadTree(treeId: string): Promise<CompiledTree>;      // memoized
  isOffline(): boolean;
}
```

## Acceptance criteria

- [x] Each route in the §13.1 table exists under `app/src/routes/` and its `+page.ts` (or
      `+page.svelte`'s own `export const prerender`) matches the table's flag exactly — a
      build (`npm run --workspace app build`) produces static HTML for every "yes" route
      and none for the "no" routes.
- [x] `/s/<treeId>/m/<slug>` resolves the milestone panel via the milestone's current
      slug; a fixture where a milestone's slug changed and the old slug is present in its
      `aliases` list still opens the correct milestone panel (§13.1, §5.4).
- [x] A fixture with an unresolvable slug (absent from both current slugs and `aliases`)
      opens the tree view with a visible notice rather than a 404 or a blank panel
      (§13.1).
- [x] `lib/content/store.svelte.ts`, `lib/state/progress.svelte.ts`, and
      `lib/state/ui.svelte.ts` each exist as separate modules with no cross-imports beyond
      what §13.2 implies (content store is read by progress derivation, not the reverse).
- [x] A test simulating cold start with both `loadManifest()` and `hydrate()` succeeding
      renders the map after both resolve, with no full-page spinner rendered at any point
      (§13.3 step 1 and 3).
- [x] A test simulating `loadManifest()` failing with a cached manifest available renders
      offline mode and a visible "offline" notice (§13.3, §16.3 row 1).
- [x] A test simulating `loadManifest()` failing with no cache renders the cold-start
      failure screen, including a retry action and a link to `/data` (§13.3, §16.3 row 2).
- [x] A test simulating `store.hydrate()` rejecting renders content **read-only**, surfaces
      the error, and asserts that **no mutating call on the store succeeds afterward** for
      the remainder of the simulated session — i.e. `writable` is `false` and every
      mutator call in the test throws or rejects rather than silently no-opping (§13.3,
      §16.3 row 5, §14.5).
- [x] The same failing-hydration test asserts a tree route renders progress as **unknown**,
      not as zero completions. `progressFor` is total and returns empty maps, so a view that
      does not branch on `store.hydrated` tells the user they have no progress rather than
      that it could not be read — the display-side twin of §13.3's "read as empty, then
      wrote" (T26/F23).
- [x] A test asserts a deep link to `/s/<treeId>` opened cold does not paint a zeroed tree
      before `hydrate()` resolves: `hydrated` is false during first paint (§13.3 step 4
      loads route data after it), and the tree renders its unknown-progress state.
- [x] A test simulating one tree bundle fetch failing (while the manifest succeeds)
      renders the map and every other tree normally, with only the failed tree marked
      unavailable (§16.3 row 3).
- [x] A test simulating a bundle that fails the §7.5 shape assertion asserts the bundle is
      treated as unavailable and a cache-clear call is made for that bundle's Cache Storage
      entry (§16.3 row 4).
- [x] `TreeView` is the only component under `app/src/routes/` or `app/src/lib/components/`
      that imports from `lib/layout/` — an import-lint rule or grep asserts this (§13.4,
      §14.7).
- [x] No **presentational** component under `app/src/lib/components/` imports from
      `lib/scoring/` — scores arrive only as props (§13.4). **`app/src/routes/s/[tree]/`
      is explicitly permitted** to import `scoreSkill` for the `applyLineage` DI callback
      and the post-load reconcile sequence; grep/lint rules must not treat that as a
      violation.
- [x] A test on `/s/<treeId>` asserts the on-tree-open sequence when the bundle's
      `contentVersion` exceeds `contentVersionSeen`: `applyLineage` receives the scoring
      callback and runs first, then `scoreSkill`, then `reconcileAttainedLevel` — in that
      order. After a migration, reconcile should typically resolve `false` (no-op).
- [x] A test asserts cold-start step 3 calls `store.applyMoves(manifest.moved)` before
      domain scores are derived when hydration succeeded (§13.3, T26/F13).
- [x] `npm run --workspace app build` succeeds and `npm run --workspace app test -- routes`
      passes.

## Verification

```bash
npm run --workspace app build
npm run --workspace app test -- routes
npx tsc --noEmit --project app
```

Passing looks like: a clean static build with the correct prerendered/non-prerendered
split, the cold-start and error-branch test suite green, and a clean typecheck.

## Notes and hazards

- **The hydration-failure branch is the one that must never regress.** §13.3 states it
  plainly: "the dangerous failure is not 'cannot read progress' but 'read as empty, then
  wrote'." Any future change to this task's cold-start sequence that makes a store
  mutator succeed while `writable` is `false` is a data-loss bug, not a UX bug — treat it
  with the same severity as a write-path defect in T09.
- **`writable` is a session-scoped flag, not a retry-recoverable one** per §14.5's
  contract as given — the spec does not describe a path back to `writable: true` within a
  session after a hydration failure. Do not add a "retry hydration" affordance that
  silently flips `writable` back on without that being an explicit, spec-backed decision;
  as written, the correct recovery path is reloading the app.
- **Skill routes are intentionally unprerendered** — do not "fix" this by prerendering
  trees as content grows. §13.1 states the reasoning explicitly: identical shells scale
  build time with content for zero benefit, since content arrives from the manifest at
  runtime regardless.
- **§4.4's GitHub Pages fallback (`404.html`) is what makes the non-prerendered routes
  resolve at all** on a static host. This task's route structure must remain compatible
  with `adapter-static`'s fallback mechanism — verify the build step, not just the dev
  server, since dev-server routing can mask a fallback misconfiguration that only shows up
  in the deployed static output.
- Full manifest-fetch and bundle-fetch mechanics (stale-while-revalidate, CacheFirst,
  service-worker precache) belong to T07 (§7.4); this task treats `ContentLoader` as a
  black box and is responsible only for reacting correctly to its resolved and rejected
  states.


## T26 amendments — 2026-08-06

**F26 — this task owns tree-open orchestration; migration persists level via injection.**
When the version gate fires, call
`store.applyLineage(tree, (p) => scoreSkill(tree, p).attainedLevel)` — the store imports
no scoring code (§14.1). Then `scoreSkill(tree, progressFor(treeId))`, then
`reconcileAttainedLevel(treeId, attainedLevel)`. Reconcile is the ordinary-open honesty
pass: it should be a **no-op immediately after migration** but must still run to catch
non-lineage content changes (requirement edits with no ledger entry).

**F22 — three things.**

- The manifest × `SKILL` join **drops a row with no manifest entry and never deletes it**.
  No `domain` means no `DomainSkillRow`, so it contributes to no score and no breadth count,
  but it stays in IndexedDB and `/data` lists it (T16).
- `/s/<treeId>` naming a tree absent from the manifest is a **tree-unavailable state, never
  a 404**. This is a lookup miss *before* any fetch, so it is a different branch from
  §16.3's existing bundle-fetch-failure row. If a `SKILL` row exists for that id, say so and
  link to `/data`: the user's progress is intact and they must be able to see that.
- §6.4's new check 8 makes this unreachable from a content release, but §12.6's import can
  still produce it from an export written against a fork or a newer library. Both §16.3 rows
  are yours; needs a test each.


## Implementation notes — 2026-08-14

Complete. `npm run lint`, `npm run typecheck --workspace app` (431 files, 0 errors),
`npm test --workspace app` (388 tests, 37 files) and `npm run build --workspace app` are
all clean. The build emits exactly §13.1's split: `index.html`, `library.html`,
`data.html`, `about.html`, `contribute.html`, eight `d/<domainId>.html`, and the
`404.html` fallback — **nothing under `s/`**.

### Five decisions this document did not make

**1 — the shell is `routes/Shell.svelte`, not `+layout.svelte`.** A SvelteKit route
component may take only `data` and `children` (`svelte/valid-prop-names-in-kit-pages`),
and §13.3's three failure branches are unreachable against real browser capabilities. So
the layout is four lines that render `Shell`, and `Shell` takes an optional
`contentLoader` and `userStore` — the same injection seam as `StoreOptions.open`.
`layout-bootstrap.test.ts` survives, narrowed to the one thing the injected tests cannot
see: that the real layout is wired to the real store.

**2 — the `layoutTree` call moved into `lib/actions/tree-session.svelte.ts`.** The
acceptance criterion is that `TreeView` is the only view-layer file importing
`lib/layout`, and T08 had already decided — correctly, per §8.6 — that `TreeView` takes
positions as a *prop* so that it structurally cannot re-run layout on a completion. Both
cannot be true with the call in the route. `lib/actions` is where §14.1 puts work that
belongs to neither the renderer nor the page, and the session already owned "a tree
opened, therefore register it and score it". §12.3's write-back (T26/F26) went to the
same place and for the same reason, with T17's `applyLineage` marked as running before
it.

**3 — `/s/<treeId>` and `/s/<treeId>/m/<slug>` share `SkillPage.svelte`.** They differ in
one prop. The shared body is a plain component **in the route directory**, not under
`lib/components/`, because it imports `lib/actions` and §14.1 draws `ACTIONS → ROUTES`,
never `ACTIONS → COMP`. `TreeView` gained a `$bindable openUid` and the route mirrors it
into §13.2's `ui` store: the panel is addressable by URL, so a component holding that
state privately would let the two disagree.

**4 — `SkillPageData` gained `reason: 'missing' | 'unreachable'`.** §16.3 has two
tree-unavailable rows and they are different failures: a manifest lookup miss (before any
fetch) versus a bundle that would not load. T26/F22 requires the first to say so and link
to `/data` when a `SKILL` row for that id survives — which the page now does, gated on
the mirror. `resolveSkillPage` asks the loader for the manifest rather than matching on
an error message; `loadManifest` is memoized, so it costs nothing.

**5 — `MapRenderer` now uses `resolve('/d/[domain]')`.** T13 left an `eslint-disable` and
a comment saying the line was worth revisiting once T14's route landed. It landed.

### Smaller things worth knowing

- **`applyMoves` is T17's and still rejects with `NotImplementedHereError`.** Cold start
  treats *that* error as "no migrations" and reports any other failure as a notice while
  continuing — the deliberately edgeless dependency `_RESUME.md` records.
- **The join drops a row and deletes nothing** (T26/F22). `worldScores` returns
  `unmatched`, and `/data` is the one surface that lists it. Without that list the
  retention is invisible everywhere, which is indistinguishable from a deletion.
- **`lib/content/domains.ts`** carries the eight locked ids because `entries()` needs
  them at build time, before any manifest exists. A compile-time exhaustiveness check
  against the generated `ContentDomainId` union plus a test against the compiled manifest
  means a ninth domain cannot ship as a route with no prerendered page.
- **The loader's test fakes moved to `lib/content/fixtures/environment.ts`**, so the
  route-level §16.3 tests exercise the same loader control flow rather than a second,
  differently-shaped set of stubs.
- **Export and import are not on `/data`.** They are §12.6 and T16's. The page says so
  rather than showing a control that does nothing — it is the page §16.3 sends people to
  during an outage, which is the worst possible place for a dead button.
- **`view-boundaries.test.ts`** restates §13.4's two rules as a file scan beside the
  `eslint.config.js` slice, per §14.7's habit of gating a boundary twice.

### Out-of-scope items confirmed still out

`ContentLoader`'s fetch machinery (T07), `hydrate()` and the write-refusal latch itself
(T09), `TreeView` and `MapRenderer` internals (T08, T13), export/import (T16),
`applyLineage`/`applyMoves` (T17), accessibility verification (T20), the estimator and
placement flow (T15 — `AssessmentFlow` in §13.4's tree is deliberately absent).
