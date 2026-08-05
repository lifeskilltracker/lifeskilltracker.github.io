# T07 — Content Loader and minimal tree route

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | runtime-io |
| **Blocked by** | T04 |
| **Blocks** | T08 |
| **Spec** | ARCHITECTURE §7.4, §7.5, §14.2, §13.1 |
| **PRD** | N4, N9 |

## Goal

`app/src/lib/content/` holds the single module in the application that performs a network
fetch for content, exposing the §14.2 `ContentLoader` interface over the artifacts `lst
compile` writes into `app/static/content/`. After this task the app can start cold, fetch
`manifest.json`, resolve a tree id to its hashed bundle URL, fetch and shape-check that
bundle, memoize it, pin it in Cache Storage when the user has started the skill, and
report honestly when it is serving stale content. A `/s/<treeId>` route exists that
resolves a tree from the manifest at runtime and proves the loader end to end; it renders
the tree's title and level spine as plain markup, because the SVG renderer is T08.

## Why this shape

§3.2's second rule makes the Content Loader **the only reader of content** — no component,
route, or engine fetches on its own — so every caching, offline, and failure decision has
exactly one place to live and one place to test. The split between a small mutable index
and large immutable hash-named chunks (§7.1) is what lets N4 hold as the library grows:
the manifest is the only file that can go stale, so there is no cache-header negotiation
to get right on GitHub Pages (§4.4). `loadTree` is memoized on **object identity**, not
merely on value, because §8.6 keys the Layout Engine's memoization on the tree it was
handed; a loader that returned a fresh parse per call would silently defeat the layout
cache and with it §17.3's sub-50 ms milestone toggle.

## Scope

**In scope**

- `loadManifest()`, `loadTree()`, `pin()`, `isOffline()` exactly as typed in §14.2.
- Manifest fetch with stale-while-revalidate: serve the Cache Storage copy immediately if
  present, revalidate in the background, and flip `isOffline()` true when revalidation
  fails (§7.4).
- Bundle fetch **CacheFirst** against Cache Storage — the hashed URL is immutable, so a
  cache hit is always correct and never needs revalidating (§7.4).
- The §7.5 shape assertion on every parse: the bundle's `schemaVersion` is one the app
  understands, and the tree has ten levels. A bundle that fails it is treated as
  unavailable **and cleared from Cache Storage** so a stale entry self-heals (§16.3).
- Per-tree failure isolation: a failed or malformed bundle disables that one tree and
  nothing else (§7.4).
- Pinning on start: `pin(treeId)` writes the bundle into a named Cache Storage bucket that
  ordinary eviction of browsed-but-unstarted trees does not touch (§7.4, N9). It **rejects
  cleanly on quota failure rather than throwing fatally** — pinning is best-effort and its
  caller in `lib/actions` resolves `pinned: false` (T26 F11).
- The `lib/content/store.svelte.ts` rune store of §13.2 — manifest plus loaded bundles,
  populated by the loader and read by routes.
- The `/s/<treeId>` route from §13.1, `prerender = false`, resolving through the manifest.
- The §16.3 branches this subsystem owns: manifest-fails-with-cache, manifest-fails-
  without-cache, tree-bundle-fetch-fails, bundle-fails-shape-assertion.

**Out of scope**

- **Service-worker generation and PWA / offline hardening.** §16.4 places these in
  **Phase 2** (`C2`). Since T26's F10 resolution (2026-08-05) §7.4 agrees, and no longer
  reads as though `@vite-pwa/sveltekit` ships alongside the loader. **This task ships
  ordinary `fetch` plus the Cache Storage API called directly**, which is the whole of N9
  — "once loaded". Consequences accepted rather than fixed here, and now recorded as
  **R-26** in §19.3: the app shell is not precached, so an offline *deep link* still hits
  the network and gets GitHub Pages' `404.html` (§4.4), and a cold boot with no network
  fails to §16.3's cold-start screen. Only content already in Cache Storage survives, and
  only for a session that has already booted.
- **The `startSkill` → `pin` sequence.** It lives in `lib/actions` (§14.1, T26 F11), not
  here and not in T09. This task exposes `pin()` and must not import `lib/state` — §14.7
  now gates that with `no-restricted-imports`.
- SVG rendering, node states, milestone interaction — T08 (§9). This task's route renders
  text only.
- The Layout Engine — T06. The loader hands over a `CompiledTree` and knows nothing about
  positions.
- Reading or writing user state, including the decision of *which* trees are started. The
  User State Store owns that (T09); `lib/actions` wires `startSkill` to `pin` (see hazards).
- The manifest and bundle **producer** — `lst compile`, T04. This task consumes what T04
  writes and must not reshape it.
- Manifest sharding — **R-05**, triggered at 30 kB compressed, not built now.
- `/`, `/d/<domainId>`, `/library`, `/data`, `/about`, `/contribute` and the cold-start
  failure screen as a designed view — T14 (§13.1–§13.4, §16.3). This task supplies the
  loader branches those routes consume and a minimal skill route only.

## Deliverables

```
app/src/lib/content/index.ts            the ContentLoader implementation — §14.2
app/src/lib/content/manifest.ts         manifest fetch, SWR, offline flag — §7.4
app/src/lib/content/bundle.ts           bundle fetch, CacheFirst, pinning — §7.4
app/src/lib/content/assert-shape.ts     the §7.5 shape assertion
app/src/lib/content/store.svelte.ts     §13.2 rune store: manifest + loaded bundles
app/src/routes/s/[tree]/+page.ts        prerender = false; resolves via the manifest
app/src/routes/s/[tree]/+page.svelte    minimal text rendering — replaced by T08
app/src/lib/content/loader.test.ts      memoization, isolation, shape assertion, offline
app/src/lib/content/fixtures/           a valid bundle, a nine-level bundle, a
                                        future-schemaVersion bundle, a truncated bundle
```

## Interface contract

Copied from ARCHITECTURE §14.2. Downstream tasks (T08, T14, T17) are written against it.

```ts
export interface ContentLoader {
  loadManifest(): Promise<Manifest>;
  loadTree(treeId: string): Promise<CompiledTree>;      // memoized
  pin(treeId: string): Promise<void>;                   // §7.4 offline pinning
  isOffline(): boolean;
}
```

> Contract: `loadTree` is idempotent and memoized; a second call for the same id returns
> the same object identity, which is what makes §8.6's layout memoization key work. It
> resolves only for a bundle that passed the §7.5 shape assertion, so no consumer handles
> a malformed tree.

The manifest shape this task consumes, verbatim from §7.2:

```jsonc
{
  "schemaVersion": 1,
  "generated": "2026-09-14T00:00:00Z",   // build stamp for humans; NOT comparable
  "taxonomy": {
    "domains": [ /* domains.yaml, compiled */ ],
    "facets":  [ /* facets.yaml, compiled */ ],
    "map":     { /* unioned region paths — §10.3 */ }
  },
  "trees": [
    {
      "id": "blacksmithing",
      "contentVersion": 4,      // this tree's own version — §5.3, the §12.5 trigger
      "title": "Blacksmithing",
      "summary": "Shaping hot metal by hand …",
      "domain": "making",
      "secondaryDomains": ["home"],
      "subregion": "objects",
      "facets": ["physical", "workshop", "heat", "tool-making"],
      "archetype": "dual-track",
      "milestoneCount": 62,
      "authors": ["A. Contributor"],
      "bundle": "trees/blacksmithing.a7f3c091.json"
    }
  ]
}
```

The three load-bearing behaviours of §7.4, verbatim:

> - **Pinning on start.** When a user starts a skill, its bundle is pinned in Cache Storage
>   rather than left to ordinary cache eviction. N9 says the app keeps working offline; a
>   user whose active skills silently stopped opening on a train would reasonably call that
>   broken. Trees merely browsed are not pinned.
> - **Per-tree failure isolation.** A failed bundle fetch disables one tree, never the app.
>   The map and every other tree keep working.
> - **Honest offline state.** When serving a cached manifest without revalidation, the UI
>   says so. Content that has never been fetched is not available offline, and pretending
>   otherwise is worse than a clear message.

The §16.3 rows this task implements, verbatim:

| Failure | Behaviour |
|---|---|
| Manifest fetch fails, cache present | Offline mode; render from cache and say so (§7.4) |
| Manifest fetch fails, no cache | Cold-start failure screen: what happened, retry, and a link to `/data` so an export is still possible if hydration worked |
| Tree bundle fetch fails | That tree only is unavailable; map and other trees unaffected |
| Bundle fails the §7.5 shape assertion | Treat as unavailable; clear that bundle from Cache Storage so a stale entry self-heals on retry. The loader owns this cache directly (§7.4), so it holds in v1 with no service worker |
| Deep link opened with no network | Cold-start failure screen. GitHub Pages' `404.html` fallback needs the network; shell precaching is phase 2 (§4.4, R-26) |

The §7.5 assertion is exactly two checks and no more:

- the bundle's `schemaVersion` is one the app understands (§5.10: current and one prior);
- the tree has ten levels.

It is **not** a security control and must not be extended into one — §7.5 states plainly
that there is no threat model in which a hash the origin also serves stops an attacker who
controls the origin.

## Acceptance criteria

- [ ] `app/src/lib/content/index.ts` exports an object satisfying the §14.2 interface, and
      `npx tsc --noEmit` passes with `strict: true`.
- [ ] A test asserts `(await loadTree('x')) === (await loadTree('x'))` — reference
      equality, not deep equality. This is the §8.6 contract and must be an identity check.
- [ ] A test asserts two concurrent in-flight `loadTree('x')` calls issue exactly **one**
      `fetch` and resolve to the same object.
- [ ] A test asserts `loadTree` is called with a URL taken from the manifest's `bundle`
      field, never constructed from the tree id — the hash is not derivable.
- [ ] A test asserts a second `loadTree('x')` after a page-lifetime cache hit performs no
      network request (Cache Storage hit, CacheFirst).
- [ ] `assert-shape.ts` rejects the nine-level fixture and the future-`schemaVersion`
      fixture, and accepts the valid fixture and a bundle at `schemaVersion` current − 1.
- [ ] A test asserts that after a shape-assertion failure the bundle key is **deleted from
      Cache Storage**, and that a subsequent `loadTree` for the same id re-fetches.
- [ ] A test asserts a rejected `loadTree('broken')` leaves `loadTree('other')` resolving
      normally and `loadManifest()` unaffected — per-tree isolation.
- [ ] A test asserts `isOffline()` is `false` after a successful manifest revalidation and
      `true` after a failed one with a cached manifest present.
- [ ] A test asserts that with no cached manifest and a failing fetch, `loadManifest()`
      **rejects** rather than resolving with an empty manifest — the cold-start failure of
      §16.3 is a rejection the shell renders, not a silent empty state.
- [ ] A test asserts `pin('x')` places the bundle in a Cache Storage bucket distinct from
      the ordinary runtime bucket, and that clearing the runtime bucket leaves the pinned
      entry retrievable.
- [ ] A test asserts merely calling `loadTree('x')` does **not** pin — only `pin()` pins
      (§7.4: "Trees merely browsed are not pinned").
- [ ] `app/src/routes/s/[tree]/+page.ts` exports `export const prerender = false;`
      (§13.1) and the file contains no hard-coded tree id.
- [ ] Visiting `/s/<id>` for an id absent from the manifest renders a "tree unavailable"
      message and HTTP-level success, not an unhandled rejection.
- [ ] `grep -rn "fetch(" app/src/routes app/src/lib/components` returns no matches — §3.2's
      rule that the loader is the only content reader, checkable by inspection.
- [ ] `grep -rn "lib/state" app/src/lib/content` returns no matches — the loader never
      reads user state; the shell decides when to `pin`.
- [ ] `grep -rn "vite-pwa\|serviceWorker\|service-worker" app/ --include=*.ts --include=*.js
      --include=*.svelte` returns no matches — the Phase 2 boundary, mechanically checked.

## Verification

```bash
npm run --workspace app test -- content
npx tsc --noEmit
npm run --workspace app check          # svelte-check
npm run build && npx serve app/build   # then open /s/<exemplar-tree-id>
```

Passing looks like: every fixture landing on its expected verdict, the identity assertion
green, the three greps silent, and `/s/<exemplar>` showing the tree's title and ten level
headings served from `app/static/content/` with no route-level fetch.

## Notes and hazards

- **The §7.4 / §16.4 contradiction is resolved — T26 F10, 2026-08-05.** §7.4 no longer
  specifies a service worker; the Content Loader owns a named Cache Storage bucket in-page
  and checks `caches.match()` before `fetch()`. §16.4 won, and N9's actual wording is why:
  "**once loaded**, the application shall continue to function without network access" —
  which in-page Cache Storage satisfies in full. Still use stable, documented bucket names,
  because the Phase 2 workbox runtime-caching config must adopt them rather than shadow
  them. The two things the service worker would have added — offline cold boot and §4.4's
  offline deep links — are out of scope here and recorded as **R-26** in §19.3.
- **§16.3's wording no longer assumes a service worker.** The delete-on-failed-assertion
  behaviour is this task's, from the loader's own Cache Storage bucket. §16.3 also gained
  a row for the offline deep link, which belongs to T14, not here.
- **`pin()`'s caller is `lib/actions` — T26 F11, 2026-08-05.** §14.1 gained an
  orchestration module, the one place permitted to import both I/O owners; its sole v1
  export is `startSkill(treeId): Promise<{ pinned: boolean }>`, which calls
  `store.startSkill` then `loader.pin`. This task exposes `pin()` and does **not** own the
  wiring. Two rules follow: never import `lib/state` into `lib/content` (now an ESLint
  gate, §14.7), and **`pin()` must reject cleanly rather than throw fatally** — pinning is
  best-effort, the action resolves `pinned: false`, and a user near quota still starts the
  skill.
- **`contentVersion` is per-tree — T26 F8, 2026-08-05. This note previously said the
  opposite.** It is now an authored integer on each tree, carried in the bundle and in the
  manifest's tree entry (§5.3, §7.2). The global counter is gone, and with it the
  consequence this note used to warn about: a release touching one tree now invalidates one
  tree's layout memo and fires one tree's §12.5 pass. Fixtures must carry a per-tree value.
  The manifest keeps `generated` as a human-facing build stamp, which is **not** comparable
  and must never be used as a cache key or migration trigger.
- **§4.4's cross-reference is wrong.** It points at "§7.3, which treats manifest freshness
  explicitly"; manifest freshness is §7.1 and §7.4. §7.3 is the compiler's transformation
  table. Follow §7.4.
- **N4's budget is the reason for the split, not a target to optimize toward.** §17.2 puts
  the manifest at ~10 kB compressed at 164 trees and one bundle at ~7 kB. Nothing in this
  task needs performance work; if profiling seems necessary, something has been introduced
  that the architecture does not have (§17.3).
- Do not add Subresource Integrity, signature checks, or a hash recomputation on the client.
  §7.5 rejects all three by name as "ceremony for the same non-guarantee".
