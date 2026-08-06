# T14 — Full routes and cold-start branches

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | views |
| **Blocked by** | T11 |
| **Blocks** | T16, T20, T25 |
| **Spec** | ARCHITECTURE §13.1, §13.2, §13.3, §13.4, §16.3 |
| **PRD** | F23 |

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
- **Calling `store.applyMoves(manifest.moved)` in step 3**, before domain scores are
  derived, and rendering the reports it returns through the same migration summary T17
  provides. Assigned here by T26/F13 for the same reason as the join below: it is the
  manifest × store operation, and the shell is the only layer holding both (§14.1). It is
  skipped along with every other write when hydration failed, and it runs before the
  derivation so a re-homed record counts under the right domain on the first frame.
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
- Enforcing that `TreeView` is the only component importing the Layout Engine and that no
  component imports the Scoring Engine directly — scores arrive as derived props (§13.4,
  §14's dependency rules, checkable by inspection or by T14's own import-lint config).

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
- Import/export file handling on `/data` beyond routing to the page — the export/import
  logic is §12.6, a User State Store concern (T09 or an adjacent persistence task).
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

- [ ] Each route in the §13.1 table exists under `app/src/routes/` and its `+page.ts` (or
      `+page.svelte`'s own `export const prerender`) matches the table's flag exactly — a
      build (`npm run --workspace app build`) produces static HTML for every "yes" route
      and none for the "no" routes.
- [ ] `/s/<treeId>/m/<slug>` resolves the milestone panel via the milestone's current
      slug; a fixture where a milestone's slug changed and the old slug is present in its
      `aliases` list still opens the correct milestone panel (§13.1, §5.4).
- [ ] A fixture with an unresolvable slug (absent from both current slugs and `aliases`)
      opens the tree view with a visible notice rather than a 404 or a blank panel
      (§13.1).
- [ ] `lib/content/store.svelte.ts`, `lib/state/progress.svelte.ts`, and
      `lib/state/ui.svelte.ts` each exist as separate modules with no cross-imports beyond
      what §13.2 implies (content store is read by progress derivation, not the reverse).
- [ ] A test simulating cold start with both `loadManifest()` and `hydrate()` succeeding
      renders the map after both resolve, with no full-page spinner rendered at any point
      (§13.3 step 1 and 3).
- [ ] A test simulating `loadManifest()` failing with a cached manifest available renders
      offline mode and a visible "offline" notice (§13.3, §16.3 row 1).
- [ ] A test simulating `loadManifest()` failing with no cache renders the cold-start
      failure screen, including a retry action and a link to `/data` (§13.3, §16.3 row 2).
- [ ] A test simulating `store.hydrate()` rejecting renders content **read-only**, surfaces
      the error, and asserts that **no mutating call on the store succeeds afterward** for
      the remainder of the simulated session — i.e. `writable` is `false` and every
      mutator call in the test throws or rejects rather than silently no-opping (§13.3,
      §16.3 row 5, §14.5).
- [ ] The same failing-hydration test asserts a tree route renders progress as **unknown**,
      not as zero completions. `progressFor` is total and returns empty maps, so a view that
      does not branch on `store.hydrated` tells the user they have no progress rather than
      that it could not be read — the display-side twin of §13.3's "read as empty, then
      wrote" (T26/F23).
- [ ] A test asserts a deep link to `/s/<treeId>` opened cold does not paint a zeroed tree
      before `hydrate()` resolves: `hydrated` is false during first paint (§13.3 step 4
      loads route data after it), and the tree renders its unknown-progress state.
- [ ] A test simulating one tree bundle fetch failing (while the manifest succeeds)
      renders the map and every other tree normally, with only the failed tree marked
      unavailable (§16.3 row 3).
- [ ] A test simulating a bundle that fails the §7.5 shape assertion asserts the bundle is
      treated as unavailable and a cache-clear call is made for that bundle's Cache Storage
      entry (§16.3 row 4).
- [ ] `TreeView` is the only component under `app/src/routes/` or `app/src/lib/components/`
      that imports from `lib/layout/` — an import-lint rule or grep asserts this (§13.4,
      §14.7).
- [ ] No route or page component imports from `lib/scoring/` directly — scores arrive only
      as props derived elsewhere (§13.4).
- [ ] `npm run --workspace app build` succeeds and `npm run --workspace app test -- routes`
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
