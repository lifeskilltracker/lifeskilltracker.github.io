# Spec Findings — Architecture Reconciliation

Decision record for T26. Twenty-five findings have been raised against
`docs/ARCHITECTURE.md` during the v1 task breakdown — seventeen from the breakdown itself,
F18 and F19 found while resolving F3 and F4, F20–F23 found while resolving F12–F14, and
F24–F25 found while resolving F17 and F7. Each gets a verdict of **amend**, **tolerate**,
or **not a defect**, with a reason and a date.

This file is the audit trail. The resolutions themselves live in the spec.

| # | Verdict | Date | Summary |
|---|---|---|---|
| F1 | amend | 2026-08-05 | `k = 6`, `p = 1.25`, table ×8; invariant 4 asserted against the table |
| F2 | amend | 2026-08-05 | `SKILL.grandfathered` holds frozen uid sets; exported and lineage-migrated |
| F3 | amend | 2026-08-05 | Six types defined in §14.4/§14.5; `tier` is `null` at level 0; `Taxonomy` is `Manifest['taxonomy']` |
| F4 | amend | 2026-08-05 | `DomainSkillRow` gains `lastActivityAt`; the engine owns both rollups; the shell owns the join |
| F5 | amend | 2026-08-05 | Exemption struck; the decay language removed from all four sites |
| F6 | amend | 2026-08-05 | Baseline is `origin/main` tip vs the PR merge result; branches must be up to date; three stray tag references removed |
| F7 | amend | 2026-08-05 | Rule 15 splits — git-free `into` resolution stays in §6.2, history becomes §6.4 check 7, scoped to appended entries |
| F8 | amend | 2026-08-05 | `contentVersion` is per-tree and authored; the global counter is deleted |
| F9 | amend | 2026-08-05 | `schema/{compiled-tree,manifest}.schema.json`; build-time and codegen only |
| F10 | amend | 2026-08-05 | Service worker → phase 2; pinning moves in-page; gap is R-26 |
| F11 | amend | 2026-08-05 | `lib/actions` is the seam; pinning is best-effort |
| F12 | amend | 2026-08-05 | Per-array merge rules; `attainedLevel` never merged; `contentVersionSeen` exported and minimum-wins |
| F13 | amend | 2026-08-05 | Unknown-sweep scoped to `treeId`; manifest-level `moved` index applied at cold start |
| F14 | amend | 2026-08-05 | The pass is a fold in file order; `merged` groups by target; the unknown row is a final sweep |
| F15 | — | — | pending |
| F16 | amend | 2026-08-05 | §11 splits at §11.5; §11.1–§11.4 ship in phase 0 |
| F17 | amend | 2026-08-05 | `lst validate` owns the five geometry invariants as §6.2 layer 2b (M1–M5) |
| F18 | — | — | pending — raised 2026-08-05 while resolving F3 |
| F19 | — | — | pending — raised 2026-08-05 while resolving F4 |
| F20 | — | — | pending — raised 2026-08-05 while resolving F14 |
| F21 | — | — | pending — raised 2026-08-05 while resolving F13 |
| F22 | — | — | pending — raised 2026-08-05 while resolving F12 |
| F23 | — | — | pending — raised 2026-08-05 while resolving F13 |
| F24 | — | — | pending — raised 2026-08-05 while resolving F17 |
| F25 | — | — | pending — raised 2026-08-05 while resolving F7 |

---

## F1 — Invariant 4 was false against the shipped constants

**Verdict: amend.** 2026-08-05.

### The finding as raised

§11.6 shipped `p = 1.25` at `k = 8` while conceding it "sits 5% over the strict
boundary" of `p ≤ log₂(2k/(k−1))` = 1.193. §11.9 then made that same boundary
**invariant 4**, an executable property test. The spec asserted a test its own
constants fail.

### Two things found during resolution

**The breach was larger than stated.** §11.6 claimed the ×2 integer table
`[2, 5, 8, …, 36]` with `k = 16` was "the identical curve" to `L^1.25` at `k = 8`.
It is not. `2 × 2^1.25 = 4.757` rounds **up** to 5, inflating precisely the step
invariant 4 is tightest on:

| | Δfill(0→1) | Δfill(1→2) | breach |
|---|---|---|---|
| as stated in §11.6 | 11.1% | 11.8% | 6% |
| as actually shipped | 11.1% | 12.7% | 14% |

**The invariant could not have caught it.** It was written against `L^p` while the
app ships rounded integers. An invariant that does not read the artefact under test
checks nothing.

**A third option existed that the spec did not consider.** §11.6 treated `k = 8` as
fixed and offered only to move `p`. `docs/level_weighting.md` line 165 establishes
`k ∈ [6, 10]` as the defensible range, and `k = 6` permits `p` up to 1.263 — enough
for 1.25 to clear strictly.

### Resolution

```
contribution(L) = [8, 19, 32, 45, 60, 75, 91, 108, 125, 142]   // L^1.25 × 8, rounded
fill(domain)    = s / (s + 48)                                  // k = 6 unscaled
```

| L | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| fill | 14.3% | 28.4% | 40.0% | 48.4% | 55.6% | 61.0% | 65.5% | 69.2% | 72.3% | 74.7% |
| Δ | **14.29** | 14.07 | 11.64 | 8.39 | 7.17 | 5.42 | 4.49 | 3.76 | 3.02 | 2.48 |

Strictly decreasing, maximum at the first step. Invariant 4 holds by construction.

Three sub-decisions ride along:

1. **The ×8 scale is load-bearing.** At ×2 and ×4 the rounding at L=2 breaks the
   invariant even for a compliant `p`. At ×8 the error is small enough that the
   shipped integers comply exactly.
2. **The table is normative; `p` is provenance.** The shipped artefact is ten
   integers. `p = 1.25` documents where they came from.
3. **Invariant 4 is asserted against the shipped table and `k`, never against
   `L^p`.** This is the clause that would have caught the original defect.

### Why this over the alternatives

Considered and declined:

- **`p = 1.19` at `k = 8`** — equally sound and the smallest edit; preserves every
  display anchor §11.6 argued for. Declined because it gives back ~1.5 points of the
  depth premium adopted deliberately in R-19 after the NG8 tension was weighed.
- **Flat table `[1..10]`** — dissolves the finding permanently, since `p = 1` clears
  the constraint at every `k`, and §11.6 already specifies it as a config revert.
  Declined because it restores the exact 5×L2 = 1×L10 tie that `RESEARCH.md` §4
  flagged as the original defect and that PRD v1.3 amended F33 to fix. Reversal
  remains a one-line config change.
- **Weakening invariant 4 with a tolerance** — declined. The invariant's stated
  purpose is catching a maintainer who retunes `k` or `p` in isolation, and a ~1.6
  point tolerance band is precisely where that drift would hide.

### What it costs

A lone mastered skill fills 74.7% of its region rather than 69.0%, so one deep skill
comes closer to owning its territory. The first level moves the region 14.3% rather
than 11.1% — louder, which is the direction F34 wants. Top-end headroom narrows
slightly: 8×L10 reaches 95.9%.

### A framing correction made during resolution

The reconciliation surfaced that §11.6 never said what `fill` is *for*, which made
the constants look arbitrary. It is a **map-region rendering function, not a progress
bar** — §10.5 draws each domain as a clip rectangle rising from the region's base,
and a region has bounded height while the score does not. It is not claiming a domain
is 70% complete; domains have no denominator, which is why F34 forbids showing the
number at all. Its job is the comparison the PRD is built on: *is Body quiet compared
to Mind?* Absolute values are meaningless by design; only ordering across a user's own
eight regions carries information. §11.6 now states this, along with the fact that no
per-skill continuous fill exists anywhere in the system.

### Files touched

`docs/ARCHITECTURE.md` §11.6, §11.9 (invariants 4 and 7), §18 D-21, §19.3 R-21.

### Downstream

**T11** implements the table and invariant 4 against it. **T00** should fold the
corrected numbers into R-25's proposed F33 amendment — the PRD text quotes the old
`[2,5,…,36]` figures. `docs/level_weighting.md` retains the original `k = 8` analysis
and is now superseded on the constants while remaining correct on the constraint
itself; its line 174 "identical curve" claim is the error that produced this finding.

---

## F2 — Grandfathering (D-19) was unimplementable as specified

**Verdict: amend.** 2026-08-05.

### The finding as raised

§11.5 requires user state to persist, per satisfied level, the completion set that
first satisfied it and the `contentVersion` at that moment. Nothing in the spec could
hold it: §12.2's `SKILL` had no such field, §14.4's `scoreSkill` received only a
uid→state map, and §12.6's export format did not carry it. **Invariant 7** — "tree
revision alone never decreases `attained`" — was therefore an unfalsifiable claim.

D-19 is not optional: under D-18's contiguous ranking, a contributor adding one
milestone to level 2's `all` group can drop a user from attained 8 to attained 1,
from someone else's pull request, with D-17's no-telemetry rule guaranteeing nobody
finds out.

### Resolution

Freeze the **satisfying uid set**, on the skill row:

```ts
// SKILL gains one field
grandfathered: { [level: number]: { uids: string[]; contentVersion: number } }

// the rule
satisfied(L) = evaluatedSatisfied(L)
            || (frozen[L] && frozen[L].uids.every(u => progress[u] === 'complete'))
```

`TreeProgress` widens from a bare map to `{ milestones, grandfathered }`, keeping
`scoreSkill`'s arity at two and making the dependency explicit in the type.
`LevelProgress` gains `grandfathered: boolean` and `satisfiedBy: readonly string[]`.

**The engine stays pure.** It reads frozen records and reports `satisfiedBy`; the
User State Store decides what to freeze and performs the write, preserving §3.2's
single-writer rule. An engine that froze its own records would be a second writer
with no transaction.

### Three consequences, each of which silently breaks D-19 if skipped

1. **Write** — inside §12.4's existing transaction on the `SKILL` row. Free: that
   row is already read-modify-written for `attainedLevel`.
2. **Migrate** — §12.5 runs frozen uids through the lineage table, with one
   deviation: on `retired` the uid is **removed from the frozen set** rather than
   orphaned. A frozen set records a condition that *was* met, not an achievement the
   user holds; leaving a retired uid in it makes the set permanently unverifiable and
   revokes the grandfathering the mechanism exists to provide. A set emptied by
   retirement is deleted.
3. **Export** — §12.6 carries it per skill row, merged on import with the **earliest
   `contentVersion` winning**. Grandfathering is a historical fact and the older
   freeze is the more protective one; "newest `at` wins" is right for a milestone's
   current state and wrong for a record of what was already true. Without export, a
   user restoring a backup loses grandfathering **unrecoverably** — the content
   version it was frozen against may no longer exist — which is §11.5's exact failure
   mode arriving through the recovery path.

### Why this shape

Considered and declined:

- **Freeze the requirement groups** rather than the completion set. Matches §11.5's
  original second sentence literally and is behaviourally identical on `all` groups,
  but stores 5–10× more and reopens which-`n`-counted on `n_of` groups. Freezing the
  chosen electives is both smaller and more faithful to what the user did.
- **A separate `SATISFACTION` object store.** Cleaner indexing and no nested JSON in
  an otherwise flat store, but a fifth store and a second write in a transaction that
  already holds the `SKILL` row open, for a record nothing queries independently.
- **Record only "level L was satisfied"** without the uid set. Cheapest, and wrong:
  it cannot distinguish the user un-checking something from content adding a
  requirement, so it becomes a ratchet and destroys falsifiability. §11.5's "un-checking
  still un-satisfies" is what keeps the number honest.
- **Drop D-19 from v1**, relying on F42 review plus a lint rule forbidding additions
  to a published level's `all` group without a lineage entry. Defensible for a
  single-maintainer content repo, and declined: the failure is silent and unbounded,
  and the promise is hard to add back once users have history.

### Cost

~100 bytes per skill at ten satisfied levels. One JSON field, one type widening, one
row in §12.5's table, one key in the export format.

### Files touched

`docs/ARCHITECTURE.md` §11.5, §11.9 (invariant 7), §12.2, §12.5, §12.6, §14.4,
§18 D-19.

### Downstream

**T09** implements the write and the freeze rule. **T11** consumes `TreeProgress`'s
new shape and reports `satisfiedBy`. **T16** implements the export key and the
earliest-version merge rule. **T17** implements the lineage deviation for frozen sets.
**T02** picks up `FrozenSatisfaction` and the widened `TreeProgress` in generated
types; note this interacts with F3, which is still pending.

---

## F8 — `contentVersion` had no increment mechanism and no stated scope

**Verdict: amend.** 2026-08-05.

### The finding as raised

Two defects in one field. §16.1 said it increments "on every merge touching
`content/`", but `lst compile` is a build step with no notion of a merge and no
counter source was named anywhere. And its scope was never stated: §16.1 and §7.2
implied a **global** counter while §8.6's memo key and §12.5's migration trigger read
`tree.contentVersion` as though it were **per-tree**. If global, every content release
invalidates every tree's layout memo and fires §12.5's full migration pass on every
started tree, including trees nothing changed in.

### Resolution

**`contentVersion` becomes an authored per-tree integer.** One field, one type, one
scope. It lives in `content/trees/*.yaml` → compiled bundle → manifest tree entry →
`SKILL.contentVersionSeen`. §8.6's memo key and §12.5's trigger keep their existing
wording and are finally well-defined. The library-wide counter is **deleted**; §7.2's
existing `generated` timestamp carries "which state of the library is this" for human
readers and is explicitly non-comparable.

Source of truth is the tree file, written by a new `lst version` subcommand and
enforced by §6.4's baseline job as a fifth check: compile baseline and head, elide
`contentVersion` from both, compare the remaining bytes; if they differ and the field
did not increase, fail and print the value to paste. That is §5.4's uid ergonomics
exactly — the tool writes it locally, CI refuses the merge without it — so authors
learn no new pattern, and it rides on a checkout and compile the job already performs.

### An intermediate proposal, and why it was wrong

The first resolution attempt kept the global counter for ordering and used the
**bundle content hash** already in the manifest as the per-tree change trigger. Two
things killed it, and both are worth recording because the idea is attractive:

- **The hash conflates "bytes changed" with "content changed."** §7.5 defines it as a
  build-time hash for cache busting, computed over the emitted bundle, and every
  transformation in §7.3's table feeds those bytes. A compiler change to default-`order`
  materialization or slug→index resolution moves **every tree's hash at once** — firing
  §12.5 on every started tree on an *app* release. Worse than the defect being fixed.
  And since a global counter stamped inside each bundle would itself move every hash on
  every content release, the two halves of the proposal cancelled.
- **"Robust to rollback" was backwards.** `lineage` is append-only (§5.4), so an older
  bundle carries a *shorter* ledger. Running the pass against one drives every
  already-migrated record into §12.5's "uid in neither bundle nor lineage" row and
  orphans it as `unknown`. Skipping on rollback is the safe behaviour, which `>` gives
  for free and `!=` destroys. §12.5 now states this explicitly.

Git-derived counters were considered for the global value and declined: `actions/checkout`
clones at `fetch-depth: 1`, so `git rev-list --count HEAD -- content/` returns 1 forever
with no error and no CI failure, and a source tarball has no `.git` at all.

### Why per-tree is better than the global it replaces

Beyond the memo and migration blast radius: §12.6 merges `grandfathered` per level with
the **earliest `contentVersion` winning**, and under the global counter two exports could
carry equal versions that meant different states of the tree in question. Per-tree, both
sides of that comparison are versions of the same tree. Concurrency also improves — two
content PRs touching different trees never collide, and two touching the same tree
conflict on one line, which is correct.

### Cost

The most invasive of the five resolved this session. One authored field, one schema
bump, one CLI subcommand, one extra check in an existing CI job, one checklist line.
Authors must bump — enforced, not trusted.

### Files touched

`docs/ARCHITECTURE.md` §4.1, §5.2, §5.3, §6.1, §6.4, §6.5, §7.2, §7.3, §8.6, §11.5,
§12.2, §12.5, §12.6, §16.1, §16.2, §18 D-19.

### Downstream

**T04** produces it and drops the global-counter assumption. **T07**'s "global, stamped
into the bundle" note **inverts**. **T17** is the largest edit — its "fires on every
tree" consequence reverses. **T02** adds the field and regenerates types; **T03**
validates it; **T09** and **T16** carry it through storage and export; **T23** and
**T25** own the new gate. **T06**'s memo key survives verbatim.

---

## F9 — the compiled-bundle shape was unenforced across the workspace boundary

**Verdict: amend.** 2026-08-05.

### The finding as raised

§4.2 forbids `tools/ → app/`, and §14.6 declared the compiled bundle "internal" with no
schema. T02 therefore placed the hand-written `CompiledTree` types in `app/`, where the
compiler that produces the JSON cannot import them. Two hand-maintained descriptions of
the same JSON, on opposite sides of an import boundary, with nothing to catch the drift.

### Resolution

Add `schema/compiled-tree.schema.json` and `schema/manifest.schema.json`. `lst compile`
validates what it emits against them and fails the build on mismatch; `app/` generates
`CompiledTree` and `Manifest` types from them, exactly as it already generates authored
types from `tree.schema.json`. This invents nothing — §4.2 already makes `schema/` the
one thing both workspaces read, and §14.7 already gates type generation.

§14.6's "internal" survives, restated: **internal means unversioned, not unspecified.**
Both sides change in one commit; there is no external consumer to migrate.

### The rider that matters

These are **build-time and codegen artifacts only**. The app ships no validator and does
not validate bundles at runtime. The runtime check remains §7.5's narrow shape assertion,
and §7.3 and §7.5 both now say so, because the obvious wrong move is to reach for ajv in
the Content Loader — spending a meaningful share of §17.1's 70 kB budget to re-prove in
front of the user what CI already proved, at a point where the user can do nothing about
a failure anyway.

### Why not fixture parity

The alternative was a golden compiled fixture that `app/` type-checks against. Declined:
it catches only drift the fixture happens to exercise, and it adds a test to maintain
rather than reusing a codegen step that already runs.

### Files touched

`docs/ARCHITECTURE.md` §4.2, §7.3, §7.5, §14.6, §14.7.

### Downstream

**T02** generates from the new schemas instead of hand-writing `CompiledTree`. **T04**
validates compiler output and owns both schema files. **T25** picks up the enforcement
line in CI.

---

## F10 — §7.4 shipped a service worker that §16.4 defers to phase 2

**Verdict: amend.** 2026-08-05.

### The finding as raised

§7.4's closing paragraph specified the `@vite-pwa/sveltekit` service worker as part of
the Content Loader; §16.4's phase diagram puts "PWA / offline hardening" in phase 2. The
breakdown resolves for §16.4, so the consequence needed accepting explicitly rather than
discovering: without shell precaching, §4.4's fix for GitHub Pages' 404-status deep links
does not land in v1, and §16.3's "so a stale service-worker entry self-heals" assumes
machinery that will not exist.

### What settled it

**N9 is narrower than the spec had been reading it:** "**Once loaded**, the application
shall continue to function without network access." Once loaded — not booting cold from
an aeroplane. Against that, almost nothing in §7.4 actually needs a service worker:

| §7.4 behaviour | Needs one? |
|---|---|
| Pin started bundles in Cache Storage | No — `caches.open()` is available to window script |
| Serve a cached bundle with the network down | No — the loader checks `caches.match()` before `fetch()` |
| Honest offline state | No |
| App shell boots with no network | **Yes** |
| Offline deep links resolve locally (§4.4) | **Yes** |

Only the last two are lost, and neither is required by N9.

### Resolution

Accept the v1 gap. §7.4 now specifies pinning as a Content Loader responsibility over the
Cache Storage API with a `caches.match()`-first read path, and defers the service worker
to phase 2 with its two benefits named. §16.3's wording drops the service-worker
assumption — the self-healing behaviour is real without one, because the loader owns the
cache — and gains a row for the offline deep link. §4.4's constraint table states the
consequence at the point of the constraint. §16.4's Phase 0 prose explains why the phase-2
item is load-bearing rather than cosmetic.

Recorded as **R-26** in §19.3, with the residual cost named honestly: a 404 status on a
shared link is visible to crawlers and to anything treating the status as authoritative.

### Why not promote the service worker into v1

It is genuinely cheap — a config block. Declined because it exceeds what N9 requires,
adds a well-known class of stale-cache failures to a v1 that has no telemetry to detect
them (D-17), and spends §17.1 budget during the phase where the budget is tightest.
Reversal cost is one config block, which is what makes deferring safe.

### Files touched

`docs/ARCHITECTURE.md` §4.1, §4.4, §7.4, §7.5, §16.3, §16.4, §19.3 (new R-26).

### Downstream

**T07** implements in-page Cache Storage pinning and drops the service worker; its
offline-guarantee criteria are now scoped to "once loaded". **T14** gains the offline
deep-link branch in §16.3's table. **T25** must not add a PWA plugin to the build.

---

## F11 — `pin()` had no caller

**Verdict: amend.** 2026-08-05.

### The finding as raised

§7.4 pins a bundle when the user starts a skill, but `pin()` lives on the Content Loader
(§14.2) and `startSkill()` on the User State Store (§14.5), and no section said what
joins them. §14.1's graph routed both through `routes/`, which made the shell the only
legal seam — but that was inference, not specification.

### Resolution

Add **`lib/actions`** to §14.1: the one module permitted to import both I/O owners,
containing nothing but named sequences of calls into them. No rendering, no persistence,
no business rules. Its first and only v1 export:

```ts
export function startSkill(treeId: string): Promise<{ pinned: boolean }>;
```

The two forbidden edges this implies — `lib/content ↛ lib/state` and
`lib/state ↛ lib/content` — are added to §14.1's diagram and to §14.7's
`no-restricted-imports` gate, because otherwise the new module is a suggestion rather
than a constraint.

### Why a module rather than a rule about `routes/`

`routes/` was the cheaper answer and needed no graph change. Declined because more than
one route reaches these sequences — the tree route and §11.8's placement flow both start
skills — and an orchestration rule living in a route gets implemented once and forgotten
at the second call site. The cost is one box on a dependency graph whose whole virtue is
being small, which is why the contract explicitly bounds it to sequences: if an export
starts making decisions rather than ordering calls, the decision belongs in an engine.

Also declined: **the Content Loader subscribing to store events**, which inverts §14.1's
I/O ownership split and makes "the only content reader" and "the only user-data writer"
untrue.

### The rider that matters

**Pinning is best-effort.** The store write happens first and its failure propagates; the
pin is attempted only after that succeeds, and a rejected pin resolves with
`pinned: false` rather than throwing. Cache Storage writes fail under quota pressure
(§12.7), and a user near quota must still be able to start a skill — refusing the primary
action to protect a secondary one is the wrong trade. Without this stated, an implementer
wraps both in one `try` and the failure is silent and user-visible.

### Files touched

`docs/ARCHITECTURE.md` §4.2, §7.4, §14.1, §14.5, §14.7.

### Downstream

**T07** exposes `pin()` but no longer owns the wiring, and its "an implementer will look
for this and not find it" note is resolved. **T09** keeps `startSkill` free of loader
knowledge. **T15**'s placement flow calls the same action rather than re-implementing the
sequence. **T25** adds the import rule. A new task doc is *not* warranted — the module is
two files and belongs to whichever task first needs it, which is T07.

---

## F16 — §9.3 required the Scoring Engine in a phase §16.4 says has no scoring

**Verdict: amend.** 2026-08-05.

### The finding as raised

§9.3 opens: "Five presentational states. Four come from the Scoring Engine (§11.4)."
§16.4 places TreeView inside Phase 0 and closes: the skeleton "deliberately has no map,
**no scoring**, and no export" — the Scoring Engine is the *first* Phase 1 item. §16.4
also requires the Phase 0 tree to be "authored, validated, compiled, laid out, rendered,
and completable", which cannot be shown without `complete`, `available`, and `locked`.

It could not be resolved in the task graph: T08 → T10 → T11 is already an edge, so making
T08 depend on T11 creates a cycle.

### Resolution

**Split §11 at §11.5, not at the module boundary.**

| §11.1–§11.4 | tree-local evaluation — groups, attained level, node states | **phase 0** |
|---|---|---|
| §11.5–§11.8 | grandfathering and cross-tree aggregation — frozen sets, domain score, fill, recency, breadth, self-assessment | **phase 1** |

§11.4 consumes only `progress[uid]`, group thresholds, and `requires` edges — all
tree-local, all available from the compiled bundle plus that tree's progress. It touches
nothing in §11.5–§11.8. §16.4's "no scoring" is reworded to "**no domain scoring**",
which is almost certainly what it meant: the two clauses either side of it name the map
and the export, the other two phase-1-facing outputs, and §11.6's domain score is what
feeds the map.

§16.4's Phase 0 chain gains a node between the Layout Engine and TreeView; §11 gains an
opening note stating the seam; §9.3 names its producer.

### Why the seam falls at §11.5 specifically

Not arbitrary, and not merely "the smallest slice that works". §11.5 is the first thing
in §11 that **writes persisted state** — `SKILL.grandfathered`, per F2 — and persisted
state is exactly what Phase 0 exists to falsify. Putting grandfathering after T10's
breaking schema bump is where it wanted to be anyway.

### Alternatives declined

- **Phase 0 renders `complete`/`locked` only.** Smallest spec edit, but T08 needs a mode
  flag, and the gate stops proving `available` — which §11.4 calls "the concrete-next-action
  set the product exists to supply". The skeleton would no longer demonstrate the thing
  the product is.
- **Move all of §11 into Phase 0.** Writes the domain-score arithmetic against a schema
  T10 is expected to break, and forces removing the T10 → T11 edge. Relocates the problem.
- **Derive node state in the Layout Engine.** Rejected outright and recorded so it is not
  re-proposed: §14.1 marks `LAYOUT → STATE` **FORBIDDEN**, and node state is a function of
  user progress. It would destroy N11's stability guarantee — the whole reason §8.6's memo
  key excludes user state.

### Files touched

`docs/ARCHITECTURE.md` §9.3, §11 (opening note), §16.4.

### Downstream

**T11 splits into T11a and T11b.** T11a — §11.1–§11.4, phase 0, blocks T08. T11b —
§11.5–§11.8, phase 1, blocked by T10, blocks T13/T14/T15/T17/T19. The cycle dissolves:
`T11a → T08 → T10 → T11b`. **T08** depends on T11a and may render all five states at the
gate. **T10**'s gate criteria can require `available` honestly.

---

## F3 — six named types were used and never defined

**Verdict: amend.** 2026-08-05.

### The finding as raised

`TierName`, `DomainScore` and `Taxonomy` appeared only at use sites in §14.4;
`MigrationReport`, `ImportReport` and `ExportFile` only at use sites in §14.5. Four task
documents (T02, T09, T16, T17) independently recorded "defined nowhere — do not stub as
`unknown`", which is the shape of a defect that would otherwise be resolved four different
ways in four files.

### Resolution

All six defined, plus `DomainId` and `OrphanReason`. Two are recoveries rather than
inventions and are worth naming as such:

- **`Taxonomy` is not a new type.** §7.2's manifest already carries
  `taxonomy: { domains, facets, map }`, and F9 made `schema/manifest.schema.json` normative
  with `app/` generating `Manifest` from it. So `Taxonomy = Manifest['taxonomy']` — one
  description of the shape, generated, in `lib/types`. Hand-writing a parallel interface
  would have re-created the exact drift F9 closed. The engine reads only `domains`, and
  reads it only to emit an entry per domain.
- **`ExportFile` is transcription.** §12.6's worked example is complete; the type is that
  example with the §12.2 store shapes filling in the arrays.

`TierName` is §2's five F7 names. `DomainScore` and `DomainSkillRow` are F4's, below.

### The `attainedLevel: 0` case

`tier: TierName | null`, null exactly when `attainedLevel === 0`, displayed as *"Level 0 —
not yet ranked"* (§11.3). Adding a sixth name — `'Unranked'` — was the tempting answer: it
removes a null from every consumer and needs no display rule. Declined because `TierName`
is F7's vocabulary, defined in §2 as *pairs of levels*, and a presentation vocabulary the
PRD owns should not acquire a member the PRD never authorised. `tier?: TierName` was worse
still: it makes "unranked" and "not computed" the same value and invites `tier ?? 'Novice'`,
which promotes an unranked skill at the call site where nobody is looking.

### Two riders found while typing the reports

Both are derivations from prose that had no type to force the question:

1. **`OrphanReason` has three members, not two.** §12.5 names `retired` and `unknown`
   explicitly and then produces a third orphan in the merge row — "otherwise predecessors
   move to `ORPHAN` with notes intact" — without naming its reason. `'merged'` is that case.
   The alternative, folding it into `unknown`, would have made **R-16**'s accepted loss
   indistinguishable from a record the migration could not account for, which is the one
   thing §12.5's summary has to tell a user apart.
2. **`MigrationReport` carries `attainedLevel` before and after.** §11.10 requires rank
   consequences to be stated rather than discovered, and a migration is the one path that
   changes a rank with no user action at all. A report that lists moved uids but not the
   rank they cost would meet §12.5's letter and miss its point.

### Deliberately not defined

**`DomainScore` carries no band name.** §11.6 and §15.3 require a named band over `fill`,
but the vocabulary itself is nowhere in the spec and §15.3/§15.4 call it a "tier", which
collides with F7's skill tiers. That is a real gap and is now **F18**; it is not resolved
here, and keeping the band out of `DomainScore` means resolving it later changes no engine
type. The band is a presentation mapping over `fill` and belongs to the renderer.

### Files touched

`docs/ARCHITECTURE.md` §11.3, §14.4, §14.5.

### Downstream

**T02** generates or declares all eight and drops its "defined rather than stubbed" caveat.
**T11a** consumes `TierName | null` — the null case is phase 0, since `attained: 0` is what
every skill starts at. **T11b** owns `DomainScore`. **T08**'s `SkillHeader` must render the
unranked state. **T09**, **T16**, **T17** import the report types instead of inventing them;
T17 also owns `OrphanReason`.

---

## F4 — `domainScores` could not produce recency

**Verdict: amend.** 2026-08-05.

### The finding as raised

§11.7 requires `SKILL.lastActivityAt` to roll up per domain as a maximum so a region can
report *"Last activity — 12 March."* §14.4's signature gave `domainScores` rows of
`{ treeId, domain, attainedLevel }`. The engine was asked for a value its inputs did not
contain. Either the row type extends, or the rollup lives somewhere else.

### Resolution

**Extend the row.** `DomainSkillRow` gains `lastActivityAt?: string`; `DomainScore` carries
`lastActivityAt: string | null` alongside `score`, `fill` and `breadth`. Breadth needs no
new field — a `SKILL` row exists only once a skill is started, so it is the row count.

### The case against extending, and why it lost

The argument for moving the rollup out was put deliberately first, and two of its three
strands are good:

- **A date is not arithmetic.** Everything else in §11.6 is a function of `attainedLevel`
  with an invariant attached; `max(lastActivityAt)` is a projection with no constant to tune.
  Answered rather than refuted: it is one of *three* reductions over one row set, and §11.7
  is a single subsection titled "Recency and breadth" for that reason.
- **String comparison is a format trap.** Correct, and it survives as a requirement rather
  than an objection — §12.2 now fixes every stored timestamp as ISO-8601 UTC with a `Z`
  suffix, which is what makes a lexicographic `max` safe inside a pure engine. Without that
  clause, extending the row would have handed `lib/scoring` a silent bug.
- **"`domainScores` never reads tree content" forbids widening.** This is the one that
  sounds strongest and is simply wrong. "Tree content" means a compiled bundle, and the
  bullet says why: the map must render before any bundle is fetched. `domain` comes from the
  **manifest entry** (§7.2) and `attainedLevel` from the **`SKILL` row** (§12.2) — the row
  has always been a manifest × IndexedDB join. `lastActivityAt` lives in the same `SKILL`
  row as `attainedLevel`, so it adds no source, no fetch, and cannot reach a bundle.

What actually settled it is that **the alternative homes are forbidden by §14.1's own
edges**:

| Candidate | Verdict |
|---|---|
| User State Store | **Structurally impossible.** The rollup is *per domain*, and `domain` exists only in the manifest. `STATE ⇢ LOADER` is FORBIDDEN, so `lib/state` can never learn a tree's domain. |
| Map Renderer | Forbidden twice: `COMP ⇢ STATE`, and §13.4's "no component imports the Scoring Engine directly". |
| App Shell `$derived` | Legal — but `DomainScore` then has two producers assembled at a site with no contract and no test, and T13's already-written prop signature changes. |

`T11-scoring-engine.md`'s out-of-scope line — "`lastActivityAt` roll-up is a store concern
(§12.4, T09)" — therefore described an arrangement the dependency graph does not permit. It
is deleted rather than ratified.

### What the join costs, and who does it

The shell zips manifest `trees[]` to `SKILL` rows in its `$derived` layer (§13.2) and passes
`DomainSkillRow[]`. That join was unassigned before this finding — §3.3 wrote the call as
`domainScores(catalogue, userState)`, matching neither the argument names nor the types in
§14.4 — so §3.3's sequence now names the real signature and routes the result through the
shell per §13.4 rather than drawing an engine → component arrow that §14.1 has no edge for.

### A dividend

With recency in `DomainScore` and non-decaying, §11.9's invariant 1 keeps its universal
quantifier over *all* fields and F5's exemption can be struck outright rather than narrowed.
Resolving F4 first is what makes F5 a deletion instead of a rewording.

### Cost

One optional field on an input row, one nullable field on an output record, one sentence in
§12.2 pinning the timestamp format. No new task, no new graph edge: **T11b** owns it, and it
already blocks T13.

### Files touched

`docs/ARCHITECTURE.md` §3.3, §11.7, §12.2, §14.4.

### Downstream

**T11b** implements both rollups and the null cases. **T13**'s F4 hazard is resolved and its
props at `(manifest, Map<DomainId, DomainScore>)` are unchanged. **T09** gains the ISO-8601
`Z` requirement on every timestamp it writes. **T14** owns the manifest × `SKILL` join in
derived state.

---

## F5 — §14.4's monotonicity clause was vestigial

**Verdict: amend.** 2026-08-05.

### The finding as raised

§14.4 exempted "the explicitly decaying recency channel" from monotonicity. D-20 ships a
date with no decay and R-20 defers the graded channel to phase 2, so the exemption protected
nothing — while advertising to an implementer that a decaying channel exists and is expected.

### Two things found during resolution

**§11.9 already disagreed with it.** Invariant 1 reads "Completing a milestone never
decreases any `DomainScore` field" with no exemption at all. The clause was not merely
vestigial; it contradicted the invariant table in the same document.

**The exemption was the smallest of four sites.** The decay language was still live in three
places an implementer is more likely to build from:

| Site | Text |
|---|---|
| §2 glossary | Recency channel — "**the only channel permitted to decrease**" |
| §10.5's channel table | "Saturation and a slow ambient shimmer on the outline, **decaying over time**" |
| §15.5 | reduced-motion disables "the recency **shimmer**" |

§10.5 is the one that mattered: it is a rendering table, and `T13-map-renderer.md`
reproduces it **verbatim** in its interface contract while its own out-of-scope list forbids
building that channel. The task document instructed and prohibited the same thing.

### Resolution

Strike the exemption; fix all four sites. Monotonicity now quantifies over every
`DomainScore` field without carve-out, which is true under D-20 because a maximum over
timestamps rises with wall-clock time and §12.4 writes `lastActivityAt` on every mutation.
Recency occupies **no colour or motion channel in v1**: §10.5 renders a date, §15.4's
redundancy row records that there is no colour to make redundant, and §15.5 has no shimmer
to disable.

### Reinstating it conditionally was the other option

Declined. A clause that says "should R-20 ship, this exemption returns" keeps the unbuilt
channel alive in the contract, which is the harm being fixed. R-20 carries the note instead,
and carries it in the form that makes it unnecessary: if the graded channel ever ships, the
decayed value is derived **in the Map Renderer** from `DomainScore.lastActivityAt` and is not
a `DomainScore` field, so §14.4's contract and T11b's property tests are untouched.

### What R-24 would change: nothing here

**This resolution does not depend on R-24 and does not pre-empt it.** T00's proposed
amendment relaxes PRD F35 to require recency to be *represented* and leaves the channel
unspecified. If it lands, the spec stops being knowingly non-compliant with F35 (§1, §19.5)
and D-20 becomes compliant rather than deviant — but nothing in §14.4, §10.5, §11.9 or §15.4
changes, because all four now describe what v1 ships rather than what F35 asked for. If T00
instead rejects the amendment and holds F35 as written, the response is to build R-20's
graded channel, and the paragraph above says exactly where it goes. Either way this is a
rendering decision reached later, not a contract that has to be kept ajar now.

### Files touched

`docs/ARCHITECTURE.md` §2, §10.5, §11.9, §14.4, §15.4, §15.5, §18 D-20, §19.1 R-20.

### Downstream

**T11b** asserts monotonicity over all four fields with no exemption. **T13** replaces the
copied §10.5 row and its contradiction disappears. **T20** drops the recency shimmer from its
reduced-motion criteria and the saturation row from its never-colour-alone table. **T00** is
unblocked either way; R-24 remains open.

---

## F14 — §12.5 never stated whether the migration pass is replay-safe

**Verdict: amend.** 2026-08-05.

### The finding as raised

A user who skips several content versions runs **one** pass against the latest bundle's
accumulated `lineage`, not a sequence of passes. Whether the dispositions compose correctly
under that — a `split` whose successors were later `merged`, for instance — was unaddressed,
and so was the ordering rule that would make them.

### Resolution

The pass is a **fold over the ledger in file order**, governed by four rules, and the
guarantee is stated: applying entries 1..*n* in one pass equals applying 1..*i* then
*i+1*..*n*. Every entry is a no-op when its subject is not in the working set, so replaying
an entire ledger over already-migrated records changes nothing — which is what lets §12.6
force a replay after an import.

1. **File order**, preserved verbatim by the compiler (§7.3).
2. **`merged` folds by target**, not by entry.
3. **The working set is live `MILESTONE` records for this tree**; an orphaned record leaves
   it permanently.
4. **The unknown-uid disposition is a final sweep**, not a table row.

### Rule 2 is the one that was actually broken

`LineageEntry` carries a **single** `uid` and an `into: string[]` (§5.2), so an *n*-into-one
merge is *n* separate entries sharing a target. §12.5's merge row is written entirely in the
plural — "`c` becomes complete **only if every predecessor was complete**". A strict
entry-by-entry fold reads the first entry in isolation, sees one predecessor, finds it
complete, and **grants `c`**; the second entry then orphans the predecessor the user never
did. That is R-16's accepted loss inverted into silent over-credit, and it is not a
hypothetical composition problem — it fires on the ordinary two-into-one merge.

It also breaks the replay guarantee at exactly the point the guarantee is for: under a
grouping interpretation, folding both entries in one pass denies `c`, while folding them in
two passes grants it. Rule 2 is therefore load-bearing for rule 1's claim, not an
independent nicety.

### Why file order needed enforcing, not just stating

§5.5 said flatly that "file position is meaningful in exactly **two** places", and made a
point of bounding the exception. This resolution makes it three, so the sentence is amended
rather than quietly contradicted.

More seriously, nothing enforced the ordering. §6.2 rule 15 checks only that an entry's uid
existed in the published tree; §6.4's five checks never mentioned the ledger. A contributor
inserting an entry mid-list would pass every gate and silently change the migration outcome
for every user who skipped a version. §6.4 gains a **sixth check: the baseline's ledger is a
prefix of the head's** — same entries, same order, appended to only at the end. It rides on
the checkout and compile that job already performs. Note this also retroactively secures
§12.5's existing `>` argument, which already assumed prefix-ness ("an older bundle carries a
*shorter* ledger") without anything guaranteeing it.

The check is phrased without naming a baseline ref, because **F6 has not yet decided whether
that ref is `main` or a release tag**. It inherits whatever F6 settles.

### Rule 4, and why it is not a table row

The unknown-uid disposition reads "uid in neither bundle nor lineage". Applied inline, it
orphans any record whose uid the ledger disposes of further down — the fold would destroy
records mid-flight on the strength of not having read the rest of the ledger yet. It runs
once, after the fold, and F13 additionally scopes it to records whose `treeId` is this tree.

### The frozen sets fold in lockstep

§12.5 gave `SKILL.grandfathered` its own conditional semantics — "`merged` replaces the
predecessors with the successor **only if all predecessors were in the set**" — evaluated
against the set as it stands at that entry. Nothing said whether that happened during the
fold or in a second pass over the same ledger, and a split-then-merge sequence gives
different answers depending. One fold, two co-evolving structures.

### Files touched

`docs/ARCHITECTURE.md` §5.5, §6.4, §7.3, §12.5.

### Downstream

**T17** implements the fold and owns the four rules; its property test is the replay
guarantee — fold(1..n) === fold(1..i) ∘ fold(i+1..n) over generated ledgers. **T23** gains
§6.4 check 6, and must not implement it before F6 names the baseline. **T04** preserves
ledger order through compilation. **T02** — no type change.

---

## F13 — `moved` had a reachability hole

**Verdict: amend.** 2026-08-05.

### The finding as raised

A `moved` lineage entry lives in the **source** tree's bundle, so a record only follows its
uid if the user reopens the tree the milestone left. A user who never reopens it keeps the
record on the stale `treeId`, and the destination tree's "uid in neither bundle nor lineage"
row would orphan it as `unknown` — the opposite of what §12.5 intends.

### Resolution

Both halves, because they fix different failures:

- **Scope the unknown-uid sweep to `record.treeId === tree.id`.** Free, and correct
  regardless of what else is decided: it is what stops the two rows claiming the same record.
- **Add a library-wide `moved` map to the manifest** — uid → destination tree id, collected
  by the compiler from every tree's `moved` entries (§7.2, §7.3). `store.applyMoves()` runs
  it at cold start (§13.3), rewriting the record's `treeId` and removing the uid from the
  source skill's frozen sets. Idempotent by construction: after re-homing, the entry no
  longer matches, so no seen-marker is needed.

Repository-wide uid uniqueness (§5.4) is what makes a flat map correct, and §5.4 already
names "a milestone moving between trees without any progress loss" as the reason that
uniqueness exists. This is the mechanism that clause always implied.

### Scoping alone was not enough

The conservative reading — scope the sweep, leave the record stale but intact — has a hazard
the finding did not name. `MILESTONE`'s primary key is the **uid** (§12.2). A user whose
record is invisible to the destination tree will simply tick the milestone again, and that
write lands on the same primary key, **overwriting the original row's `at` and `note`**.
§12.5's "nothing is ever silently deleted from user state" is violated by the most natural
thing the user can do about the bug.

### The uid-keyed alternative, and why it lost

The proposal taken into research was neither of the finding's two options: have the store
assemble `TreeProgress` by looking records up **by uid** against the bundle's uid set, rather
than through the `by-tree` index. A moved record would then be found by the destination tree
with no manifest change at all. It was withdrawn after three independent breakages, each
verified against the spec:

| Breakage | Where |
|---|---|
| §11.5's frozen check reads `progress[uid]` from **that one tree's** `TreeProgress`. A moved uid can never appear in the source tree's map again, so every frozen level naming it un-satisfies — invariant 7 defeated with no user action | §11.5, §14.4 |
| A destination tree the user never started has **no `SKILL` row** ("a `SKILL` row exists only once a skill is started"), so it scores 0 and contributes 0 breadth. The user would see ticked milestones worth nothing, with no explanation | §11.7, §11.6 |
| The final sweep's predicate is "uid in neither bundle nor lineage". For a working set *defined* as "uid in this bundle", that is vacuously false for every member, so the sweep can never fire and `OrphanReason: 'unknown'` becomes dead code | §12.5, §14.5 |

It also quietly deleted a property the by-tree index makes structural: that a record belongs
to exactly **one** tree. Under §7.4's offline branch a stale source bundle and a fresh
destination bundle can be resident at once, both containing the uid, and a uid-keyed lookup
would count the completion toward both trees' scores.

The manifest index is the only one of the three options that can repair the **source** tree
without opening it — and it is the only one that fires §12.5's mandatory summary, since
neither the destination tree's ledger nor a silent uid-keyed lookup produces a
`MigrationReport` entry for a move.

### What it deliberately does not fix

`applyMoves` does not recompute the source tree's `attainedLevel`; that needs the source
bundle, which the whole pass exists to avoid fetching. The value stays stale until §12.3's
reconciliation on next open — the staleness §12.3 already bounds and accepts, arriving
through one more door.

### Cost

One manifest field (~30 bytes per move, and moves are rare), one store method, one line in
§13.3's cold-start sequence. No new module, no new edge in §14.1: `applyMoves` is the
manifest × store join, and the App Shell already owns that join for `domainScores` (§14.4).

### Files touched

`docs/ARCHITECTURE.md` §7.2, §7.3, §12.5, §13.3, §14.5.

### Downstream

**T17** implements `applyMoves` and the scoped sweep; its fixture is the one the acceptance
criterion names — a milestone moves and the source tree is never reopened. **T14** calls it
in the cold-start sequence. **T04** emits the `moved` map. **T02** picks up `MovedIndex =
Manifest['moved']` from the manifest schema, exactly as it does `Taxonomy` (F3). **T07** —
no change; the loader still knows nothing about user state.

---

## F12 — §12.6's merge rule covered milestones only

**Verdict: amend.** 2026-08-05.

### The finding as raised

"Union by `uid`, newest `at` wins" has no analogue for the `skills` array — which has no `at`
field, and whose `startedAt` and `lastActivityAt` mean different things — or for `orphans`.
Import is the flow F38's two-device story depends on, so the gap is reachable in ordinary
use.

### Resolution

A rule per array, and per field where the array's members are not single-timestamped values.

**`skills`** — union by `treeId`, merged field by field: `startedAt` earliest,
`lastActivityAt` latest (present beats absent), `contentVersionSeen` **minimum**,
`grandfathered` per level earliest-`contentVersion` (unchanged), and `attainedLevel`
**never merged**.

**`orphans`** — union by `uid`, more specific `reason` wins, `at` breaks ties.

**A uid that is a live `MILESTONE` on one side and an `ORPHAN` on the other resolves to the
milestone**, and the orphan row is dropped.

### `lastActivityAt` latest was the only available answer

Not a preference: §11.7 rolls this field up to the domain as a **maximum**, and §14.4's
monotonicity clause — which F5 stripped of its last exemption — admits no field that may
decrease. Any rule other than latest-wins could lower it and would break a property test
written three sections away.

### `attainedLevel` is derived, and merging it is a ratchet

Taking the maximum of the two sides is the obvious rule and it is wrong, for the reason
§11.10 already gives about ratcheting: it makes an inflated value permanent and destroys the
number's meaning. The failure is concrete. Device A has a milestone complete and stands at
attained 4. Device B later dismisses it; §12.4 recomputes B's row in the same transaction, so
B stands at 1. On merge, newest-`at` makes the milestone `dismissed`, which scores exactly as
incomplete — and grandfathering does not rescue the level either, since §11.5 requires every
frozen uid still to be `complete`. The honest merged answer is 1. `max(4, 1)` stores 4.

§12.3 corrects it **on tree open**, and the trees a two-device merge touches are precisely
the ones the receiving device is least likely to open. A stale 7 against a true 3 is a
59-point domain-score inflation on the map (`table[7] = 91` versus `table[3] = 32`),
indefinitely. So the field is copied from the side with the later `lastActivityAt` and left
provisional — which is what §12.3 has always called it.

Zeroing it instead was considered and declined: it cannot inflate, but it makes a
restore-to-a-new-device look like data loss until the user opens every skill one at a time.

### `contentVersionSeen` had to enter the export

§12.6 argues that `grandfathered` must be exported because it is "the one piece of user state
that cannot be reconstructed from anything else". The identical argument applies to
`contentVersionSeen` and had never been made — a `SKILL` row could not be faithfully
round-tripped through the file.

It is load-bearing rather than tidy. §12.5's pass runs only when
`bundle.contentVersion > contentVersionSeen`, so a merge from a device sitting two releases
back would deliver pre-migration records into a store whose counter is already current, and
**the pass would never run again**. A milestone retired two releases ago would arrive live,
score nothing, and never surface as an orphan explaining itself. Merging as a **minimum**
rewinds each touched skill to the earlier position, so the next open replays exactly the
entries one side had not applied — safe because F14 made the fold replay-safe, and no-op for
trees where both sides agree.

The alternative was setting the field to 0 on import. It works mechanically (versions start
at 1, so the `>` guard always passes) and needs no format change, but it makes
`MigrationReport.fromVersion` report a version that never existed, and a twelve-skill import
would fire twelve summaries about migrations that mutated nothing. `changed` is now pinned to
**observed mutation** rather than "entries were evaluated" for the same reason.

### The orphan tiebreak is `reason`, not `at`

`at` is the wrong discriminator here, and the mistake is easy to make because it is the right
one for milestones. §12.2 freezes `at` at completion time and never refreshes it, so two
devices holding the same orphan carry an **identical** `at` — the rule ties on exactly the
case it exists to settle. What legitimately differs is `reason`, since the devices may have
migrated at different content versions. `unknown` is by construction the "could not
determine" disposition, so it loses to both others.

### Milestone-beats-orphan, and the dependency it carries

Orphaning is re-derivable — the ledger is append-only and never pruned — while a live record
discarded in favour of an orphan is not recoverable by any mechanism. Dropping the orphan row
is not a violation of "nothing is ever silently deleted": the winning `MILESTONE` row carries
every field the orphan did except `reason`, adds the `slug` the orphan lacks, and the drop is
counted in `ImportReport`.

**But this rule is unsafe without the forced replay above**, and the spec says so. Without
it, a merge from an older device restores a retired milestone into a store whose
`contentVersionSeen` is already past the retiring release, and the ledger never runs again.
Worse, §12.6's *existing* earliest-`contentVersion`-wins rule would simultaneously take the
older device's frozen set — which still names the retired uid, since that device never ran
the removal — so the retirement is undone in both places at once.

### `ImportReport` grew to match

`orphans` was `{ added }` only, so two of the file's three arrays had outcomes the report
could not express. It gains `updated` and `droppedForLiveRecord`, plus `treesRewound` — the
last because a rewind schedules a migration that surfaces on a later tree open, seemingly
unprompted, and the user should have been told it was coming.

### Files touched

`docs/ARCHITECTURE.md` §12.6, §14.5.

### Downstream

**T16** implements all three merge rules and owns the `ImportReport` fields; its round-trip
test must now cover a skill row, not only milestones. **T17** is the beneficiary of the
rewind and must not assume `contentVersionSeen` only ever rises. **T09** writes
`contentVersionSeen` into the export shape. **T18** — no change.

---

## F6 — §6.4's baseline ref contradicted itself

**Verdict: amend.** 2026-08-05.

### The finding as raised

§6.4 opened by checking out tree files "as of the **last release tag**" and closed with
"**the baseline is `main`**". §6.1's table said "vs. last release tag". §16.1 and §16.2
describe merge-to-`main` as the entire release process with no tagging step anywhere, so
"last release tag" had no referent in the spec.

### Resolution

`main` wins, and the evidence is one-sided rather than balanced: §5.4 ("diffing against
`main`"), §6.4's closing, §16.1 and D-12 all say `main`, against two stray phrases. Nothing
in the spec needs a tag — app semver has no stated git-tag source, §16.2 has no tagging
item, `contentVersion` is per-tree and authored, and the manifest's `generated` timestamp
covers human build identification. Introducing tagging would have contradicted §16.1's "no
separate publish step".

A **third** stray reference turned up during resolution and would have survived a fix aimed
only at the two the finding named: §6.8 forwards the reader to "Release tagging and the
deploy workflow are §16.2", and §16.2 contains no tagging step. All three are gone.

### Which `main` — the rider, and it had a wrong answer

The finding did not ask this, but T23 could not be written without it, and the two readings
are not merely different. **The baseline is the tip of `origin/main` and the head is the PR
merged into it** — not the merge-base, which `T23-lst-baseline.md` had been instructed to
implement.

Merge-base is unsound the moment two PRs are in flight, and the failure is silent:

| Check | How merge-base breaks it |
|---|---|
| 5 (`contentVersion` bump) | Two branches cut from the same commit each bump one tree 4 → 5. Each passes against its own merge-base. `main` ends with a version 5 whose compiled output is not the output that shipped as 5 — so §12.5's `>` comparison means every user who already saw 5 never runs the migration for the second change. Undetectable under §16.5's no-telemetry rule. |
| 6 (ledger prefix) | Two branches each append one entry. Both pass. The merged order on `main` satisfies neither one's prefix claim, and §12.5's fold depends on that claim. |

Comparing against the tip catches both. The price is one operational obligation — **a branch
must be up to date with `main` before it merges** — and it is stated in §6.4 rather than left
to be discovered, because it is the only such obligation the section imposes and the
alternative is a class of failure no downstream gate can see.

### The shallow-clone trap, which would have made all of this vacuous

§6.4 said nothing about checkout depth. `actions/checkout` clones at `fetch-depth: 1` by
default, and at depth 1 there is no `origin/main` and no merge-base — so checks 1–7 do not
error, they pass on nothing. §16.1 already records this exact trap as the reason git-derived
counters were rejected ("fail quietly in exactly the environment they would run in"), which
makes its absence here the more conspicuous. Note it would have broken the tag reading too.

### Files touched

`docs/ARCHITECTURE.md` §6.1, §6.4, §6.8.

### Downstream

**T23** implements against `origin/main`'s tip, not the merge-base its notes previously
specified, and its CI job sets `fetch-depth: 0`. **T03** drops the "last release tag /
`main`" hedge. **T25** carries the branch-up-to-date repository setting.

---

## F7 — §6.2 rule 15 needed git history, which §6.4 owns

**Verdict: amend.** 2026-08-05.

### The finding as raised

Rule 15 required every `lineage` entry to reference a uid that existed in the published tree
— a baseline comparison, assigned to `lst validate`, while §6.4's near-identical comparison
is assigned to `lst baseline`. §6.5 runs them as separate parallel jobs, so the primitive
would be built twice or reached across a job boundary.

### Resolution

The rule splits along the line that actually matters, which is not "validate versus
baseline" but "answerable from the working tree versus needing history":

- **§6.2 rule 15 is replaced** by its git-free half — every `lineage` entry's `into` targets
  resolve to a uid present in the repository head. `lst validate` stays git-free by
  construction, and the table stays at fifteen rules, so §6.5's diagram label and T03's five
  hard-coded counts are untouched.
- **§6.4 gains check 7** — every entry *appended since the baseline* names a uid present in
  the baseline.

Moving it wholesale and dropping to fourteen rules was the other option. It is cleaner
conceptually and strictly worse in practice: it discards a check that is genuinely
git-free, and it forces edits to the CI diagram and to five sites in a task document, for
nothing.

### Rule 15 was a time bomb, and moving it unchanged would have relocated the defect

The word **appended** in check 7 is load-bearing. As rule 15 was worded, the check
re-evaluates the whole ledger against today's baseline. The ledger is append-only and never
pruned (§5.4), so a `retired` uid is legitimately absent from `main` three releases later —
at which point the already-merged entry that retired it starts failing, **permanently
blocking every future PR on that tree, with no author action able to clear it.**

The fix was only expressible because Group C's check 6 exists: the baseline ledger being a
prefix of the head's is what makes "the appended suffix" a well-defined set. This is the
second time check 6 has paid for itself in the same section.

### Check 7 is not check 1 restated

They run in opposite directions and neither implies the other. Check 1 asks that nothing
published vanishes undisposed. Check 7 asks that nothing is disposed of that was never
published. Check 1 cannot catch a ledger entry naming a typo'd or invented uid, because such
an entry disposes of nothing — and §12.5's fold treats a non-matching entry as a no-op, so
the error is completely silent at runtime. Folding them together would have lost the check.

### The local-ergonomics regression, and its one-line fix

§6.1 promises "no CI-only check an author cannot reproduce locally", but §6.7's authoring
workflow told authors to run only `lst validate` and `lst lint`. After this split, an author
following the spec's own instructions would stop seeing the lineage-versus-history error.
§6.7 step 4 gains `lst baseline`, and notes it needs an up-to-date local `main`.

### Files touched

`docs/ARCHITECTURE.md` §6.2, §6.4, §6.7.

### Downstream

**T03** implements the git-free rule 15 only — but **its implementation depends on F21**,
still open, for what "resolve" means per `op` (`moved` targets are tree-qualified,
`split`/`merged` are bare uids). **T23** implements check 7 and owns the suffix scoping.
**T22** — no change.

---

## F17 — §10.3's five geometry invariants were "Validated by CI" with no owner

**Verdict: amend.** 2026-08-05.

### The finding as raised

§10.3 closed: "Validated by CI: every domain in `domains.yaml` has a region; no tile is
claimed twice; each region is contiguous; subregion tiles partition their parent's tiles
exactly; subregions appear only under `making`." Nothing owned those checks. §6.1 scoped
`lst validate` to "Schema + semantic rules (F41)"; §6.2's rules were entirely `tree.yaml`
-scoped; §6.5's job graph named no map job; and §5.9 handed `map.yaml` off with "specified
in §10.3", closing the loop without assigning it. This is the spec's only occurrence of the
phrase "Validated by CI", so there was no established pattern to read it against.

### Resolution

`lst validate` extends to `content/taxonomy/`, and the five invariants become **layer 2b**,
rules **M1–M5**, in §6.2. §10.3's sentence points at them; §6.1's table row says "trees and
taxonomy"; §5.9's handoff now names the validator. No new subcommand.

Three of the five are exactly the "JSON Schema cannot express this" class that layer 2
exists for, and validate runs in the seconds-long pre-build job with file and line, where a
geometry error belongs. They go in a **separate sub-table** rather than as rules 16–20:
rules 1–15 are all tree-scoped, and the per-rule fixture convention downstream reads the
numbering.

### Putting them in `lst compile` had a failure the task document could not have known about

`T12-map-geometry.md` had already assumed the opposite, placing `map-validate.ts` under
`tools/src/compile/` and failing the build on a violation. That placement is unsafe for a
reason outside §10: §6.5's `build` job `needs` the app jobs, and §6.5 says the app jobs are
skipped by path filter on a content-only PR. A skipped dependency skips the dependent, so
**`build` does not run on the PRs that change `map.yaml`** — the checks would have been in a
job that never fires on the input they guard. That is a defect in §6.5 in its own right and
is recorded as **F24**; it is also decisive here, because the validate placement does not
depend on how F24 is resolved.

### Contiguity does not fall out of §10.4 for free

The tempting economy is to read contiguity off §10.4's loop-chaining, which already discards
interior edges and warns when a region produces more than one closed loop. It does not work:
a region with a hole and a region in two disconnected pieces both produce two loops.
Distinguishing them needs either a containment test or the tile-adjacency pass M3 was going
to be anyway — and the "free" reading would silently downgrade §10.3's hard requirement into
§10.4's warning.

So §10.4's warning is now **scoped to holes**, with a sentence saying disconnection fails
validation first. Without it, two jobs would return different verdicts on the same input.

### Two riders that make the rules implementable

**M2's scope.** "No tile is claimed twice" was unqualified, and the intra-region case is both
the easier mistake and the silent one: a tile listed twice inside one region gives each of
its six edges a duplicate, §10.4 step 2 discards every doubled edge, and the tile disappears
from the outline with a still-closed path and no diagnostic. M2 ranges over the multiset of
every tile in every region.

**What the file list means.** `lst validate content/trees/foo.yaml` must still read
`map.yaml`, `domains.yaml`, and every other tree. This was already true — rules 2, 10, 11
and 12 cannot be answered from one file — and was nowhere stated. The taxonomy rules make
the consequence visible, since an implementer who scopes M1–M5 to argv runs no map checks on
the common invocation. §6.2 now says the list scopes reporting, not reading.

### Files touched

`docs/ARCHITECTURE.md` §5.9, §6.1, §6.2, §6.5, §10.3, §10.4.

### Downstream

**T12** moves `map-validate.ts` out of `tools/src/compile/`, changes its acceptance criteria
from "fails compilation" to "fails validation", and gains **T03** as a blocker. **T03** owns
M1–M5 and the read-versus-report scoping. **T04** — no change; the compiler still emits the
unioned paths and still warns on a hole.

---

## Also recorded

**PRD D28 — the domain view as a map rather than a list** (§19.4). Raised by the
owner during F1's resolution and logged rather than folded in, since it is new design
rather than reconciliation. `/d/<domainId>` is currently a listing and §10.7 rules out
pan and zoom; the alternative is a two-level map where a domain opens into its skills
laid out as nodes with per-skill fill, plus a hide-unstarted filter and search. Priced
in §19.4: a second layout engine, a new route, and tree-placement geometry. Per-skill
fill would be `attainedLevel / 10` — linear, bounded, and needing no `k`. Not v1.
