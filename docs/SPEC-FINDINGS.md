# Spec Findings — Architecture Reconciliation

Decision record for T26, plus findings raised later by implementation. Twenty-nine findings
have been raised against
`docs/ARCHITECTURE.md` — twenty-eight during the v1 task breakdown and F29 during T21;
of the breakdown's twenty-eight, seventeen came from the breakdown itself,
F18 and F19 found while resolving F3 and F4, F20–F23 found while resolving F12–F14,
F24–F25 found while resolving F17 and F7, F26 found while resolving F23, and F27 filed last
to give a verdict to five §8 silences `T06-layout-engine.md` had been carrying. Each gets a
verdict of **amend**, **tolerate**, or **not a defect**, with a reason and a date.

**All twenty-nine are resolved.** The 2026-08-06 session resolved F19, F22, F24, F25 and
F26, then F15, F18 and F27, and folded eight further defects into those resolutions rather
than appending them as new findings — three into F24 and five into F22, at the owner's
direction, on the ground that each was a cause or a consequence of the finding it landed
in. Two more were surfaced and deliberately left unfiled: nothing gates manifest-level
compiled output (§6.4 check 5 is scoped to trees, so a PR touching only `map.yaml` is
compared by nothing, and §17.2's manifest budget has no named enforcer), and §12.4's
"the only writer in the system" overclaimed against §14.5's several mutators — narrowed in
passing to "the only writer of a `MILESTONE` record", but §3.2's single-writer story
deserves a proper pass.

**F29 is resolved (2026-08-15).** It was the first finding raised by implementation rather
than by the breakdown: T21 authored the branching and modular exemplar trees and found that
§9 draws neither a track title nor a module label, so a tree grouped into modules rendered
as though it were linear. **All twenty-nine findings are now resolved.**

**A separate series, A1–A7, was landed by T28 on 2026-08-16.** Those are not defects: they
are places where the architecture was correct as written and superseded by `docs/UI-SPEC.md`,
which settles PRD **D19**. They are tabulated and argued in their own section below, after
F29. One real defect was found while landing them and is filed there as **A2-D**.

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
| F15 | amend | 2026-08-06 | Seven small omissions; `MILESTONE.contentVersion` required as provenance; §12.7's triggers tabled, dismissal per-trigger in `META` |
| F16 | amend | 2026-08-05 | §11 splits at §11.5; §11.1–§11.4 ship in phase 0 |
| F17 | amend | 2026-08-05 | `lst validate` owns the five geometry invariants as §6.2 layer 2b (M1–M5) |
| F18 | amend | 2026-08-06 | Five bands over `fill` — Quiet, Emerging, Moderate, Active, Deep; landmark-anchored; `string`, not a union, because the table is expected to move |
| F19 | amend | 2026-08-06 | `lastActivityAt` is a total, forward-only watermark; `startSkill` seeds it; three writers named |
| F20 | amend | 2026-08-05 | `split` consumes its predecessor and moves the frozen entry; `merged`'s success branch stated to match |
| F21 | amend | 2026-08-05 | `into`'s shape and cardinality fixed per `op`; rule 15 branches on `op` |
| F22 | amend | 2026-08-06 | §6.4 check 8 forbids tree removal and rename; a `SKILL` row with no manifest entry is retained and unscored; `retired` deferred to R-27 |
| F23 | amend | 2026-08-05 | `store.progressFor(treeId)` — synchronous and total; every writer refreshes the mirror; `by-tree` is the write path |
| F24 | amend | 2026-08-06 | `build` splits into `content: compile` and `app: build`; seven gating jobs; skipped ≠ blocked |
| F25 | amend | 2026-08-06 | §6.2 rule 16 is the missing-uid gate; `lst ids` stops gating; it cannot be a layer-1 `required` |
| F26 | amend | 2026-08-06 | `store.reconcileAttainedLevel(treeId, level)`, called by the tree route after `applyLineage` |
| F27 | amend | 2026-08-06 | §8's five layout silences — narrow is level 1 at top, synthetic column, tunable unit constants, side-gutter geometry, mastery edges dropped |
| F28 | amend | 2026-08-07 | Rule 9's module half had no registry; T03 validate enforces `track` only; `module` stays a free-form label (T22 lint if desired) |
| F29 | amend | 2026-08-15 | Track titles as HTML above the `viewBox`; module labels as text on the node; both named in §15.2's description, and the track clause is the correctness half |

## The UI-SPEC amendments (T28)

`docs/UI-SPEC.md` v1.0 settles PRD **D19** — the interface §15.9 deliberately declined to
specify. UI-SPEC is non-normative outside presentation (its §1), so an amendment that lives
only there is not an amendment at all: `docs/ARCHITECTURE.md` remains the document CI, the
tests and every task doc are written against. Its §9 names seven, and **T28 landed all seven
together** on 2026-08-16, in the manner F1–F29 established. They land in one commit because
A1, A2 and A6 touch overlapping sections, and three commits over §10.7 would produce three
intermediate states none of which is coherent.

These carry `A` ids rather than `F` ids because they are not defects. Each is a place where
the architecture is *correct as written and now superseded* by a design decision made after
it — a different thing from the twenty-nine above, and worth keeping distinguishable in the
audit trail.

| # | Verdict | Date | Summary |
|---|---|---|---|
| A1 | amend | 2026-08-16 | §10.7's "no pan, no zoom, no camera" replaced by the two-level stepped camera; the list substitution moves from a viewport size to camera level 1 |
| A2 | amend | 2026-08-16 | §10.1/§10.4 gain the skill-hex sub-lattice and the placement ledger; D-08 is **strengthened**, not excepted |
| A3 | amend | 2026-08-16 | §10.5's fill is a water line at full plate strength, never an opacity ramp |
| A4 | amend | 2026-08-16 | §17.1 gains a ≤ 12 kB font row; first paint 70 → **82 kB**, still enforced by failing |
| A5 | amend | 2026-08-16 | §15.3's convergence claim **restated, not deleted**: same content in the same order, not the same view |
| A6 | amend | 2026-08-16 | `/d/<domainId>` becomes a camera state over the map surface; both routes stay prerendered; `+layout` gains the four persistent controls |
| A7 | amend | 2026-08-16 | §5.9's `palette` gains `light` and `dark` variants; additive schema change |
| A2-D | **defect, filed** | 2026-08-16 | T12's shipped union keys interior-edge cancellation on `toFixed(6)` of pixel floats, not on lattice integers |

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

**T11** implements the table and invariant 4 against it. **T00** (complete 2026-08-07) folded the corrected constants into PRD **F33** via **R-25**; the PRD no longer quotes the old `[2,5,…,36]` figures. `docs/level_weighting.md` retains the original `k = 8` analysis
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
types; note this interacts with F3, resolved later the same day.

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

Add `schema/compiled-tree.schema.json` and `schema/manifest.schema.json`. **T02** authors
them and generates types; **T04**'s `lst compile` validates what it emits against them and
fails the build on mismatch; `app/` generates `CompiledTree` and `Manifest` types from
them, exactly as it already generates authored types from `tree.schema.json`. This invents nothing — §4.2 already makes `schema/` the
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

**T02** authors `schema/compiled-tree.schema.json` and `schema/manifest.schema.json` and
generates `CompiledTree`/`Manifest` from them — it precedes every consumer. **T04**
validates compiler output against those schemas at build time; it does not author them.
**T25** picks up the enforcement line in CI.

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

### What R-24 changed: nothing here

**This resolution does not depend on R-24 and did not pre-empt it.** **T00** (complete 2026-08-07) amended PRD **F35** to require recency to be *represented* and left the channel unspecified; **R-24** is resolved (PRD v1.3, ARCHITECTURE §19.5). D-20 is compliant with the amended requirement — nothing in §14.4, §10.5, §11.9 or §15.4 changed, because all four already described what v1 ships. If a graded fading channel is ever wanted, build **R-20** in the Map Renderer as documented above. Either way this is a rendering decision reached later, not a contract that has to be kept ajar now.

### Files touched

`docs/ARCHITECTURE.md` §2, §10.5, §11.9, §14.4, §15.4, §15.5, §18 D-20, §19.1 R-20.

### Downstream

**T11b** asserts monotonicity over all four fields with no exemption. **T13** replaces the
copied §10.5 row and its contradiction disappears. **T20** drops the recency shimmer from its
reduced-motion criteria and the saturation row from its never-colour-alone table. **R-24** is resolved; **T15** specification is complete (implementation remains blocked by **T11b**).

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

## F20 — `split` never stated the predecessor's fate

**Verdict: amend.** 2026-08-05.

### The finding as raised

§12.5's disposition table gave the *successors'* outcome under `split` — "**every** successor
becomes complete" — and said nothing about the record the split consumed. Every other
disposition states its subject's fate explicitly. The frozen-set clause had the same gap in a
sharper form: "`split` **copies** the set entry to every successor", and a copy leaves the
predecessor uid in the set — a uid now in no bundle, which §11.5 can never read as `complete`.

### The spec did not omit the predecessor's fate — it implied retention, permanently

The finding understated the problem. The final sweep orphans records whose uid is in "neither
bundle **nor lineage**", and a split predecessor's uid *is* in the lineage — it is the entry's
own `uid`. So the sweep spares it by construction, and nothing else in the pass touches it.
The current text therefore has an answer, and the answer is wrong: the record survives every
pass, is exported forever as a live `MILESTONE`, and appears in `TreeProgress` as `complete`
for a uid no bundle contains.

That also settles what the disposition cannot be. A retained record stays in §12.5's working
set, so it re-matches its own `split` entry on every later pass — and §12.6 *forces* a replay
on import. A successor the user deliberately un-checked would be silently re-completed by the
next import. Replay-safety, which F14 had just made a stated guarantee, was already false for
this row.

### Resolution

The predecessor is **consumed**: the record is deleted, `at` and `note` are copied onto every
successor, and the disposition is reported with `outcome: 'rewritten'` and `became` naming the
successors. The frozen-set entry is **moved, not copied** — the predecessor uid is replaced by
all successors.

`merged`'s all-complete branch gets the same sentence, because it has the identical gap and
could not be left in a table that now answers the question one row above.

### Why consume rather than orphan, and what it costs

`merged`'s existing wording is the argument. It orphans predecessors in the "otherwise" branch
— the partial merge — and R-16's paragraph explains why: *"The predecessors survive as orphans
with their notes, so nothing the user wrote is destroyed — only the score contribution goes."*
Orphaning is the consolation for a **lost** credit. Under `split` nothing is lost; the user
holds everything the record stood for, decomposed. An `ORPHAN` row there would put an entry in
"retired achievements" where every other entry means a loss, and would need a fourth
`OrphanReason` on a type F3 had just closed at three.

The cost is real and is stated in the spec rather than argued away: deletion loses the
predecessor's frozen `title` snapshot from persisted state. §12.6's milestone-beats-orphan
rule sets a **two-part** test for a non-silent drop — the surviving row carries every field
the dropped one did, *and* the drop is reported — and consumption satisfies the second half
outright while satisfying the first only for what the user wrote. The user's `note` and `at`
ride onto every successor; the author's title does not. That is acceptable because after the
disposition the successors' own titles describe the same accomplishment, so §12.6's human
reader still gets a readable export.

### The rule that had to come with it

**A successor that already has a live record keeps it.** §6.2 rule 15 requires an `into`
target to *resolve*, not to be new, so an author may legitimately fold a coarse milestone into
one that already shipped — at which point "copying timestamp and note" overwrites the user's
own prose with the predecessor's. This needs no unusual authoring to reach: a device that never
opened the tree still holds the predecessor, §12.6 unions it in and rewinds
`contentVersionSeen`, and the forced replay re-applies the split over successors the other
device already migrated. Timestamps and notes are therefore copied only into successors with no
record of their own.

### The frozen-set move is entailed, not a second decision

Once the predecessor is consumed, `progress[uid]` can never read `complete` for it again, so a
copied set entry fails §11.5's `.every` forever — the same permanent unverifiability the
`retired` and `moved` deviations exist to prevent, reached through a third disposition.
Consuming the record while copying the set entry is not a coherent half-adoption; the pair
ships together or D-19 breaks. §12.5 now says so, because the two clauses sit far enough apart
to be amended independently.

One consequence is stated rather than fixed: §12.6 merges `grandfathered` per level as a whole
entry with the earliest `contentVersion` winning, so an import from a device that never applied
the split reintroduces the predecessor uid into a set whose record is gone. It self-heals —
the same import rewinds `contentVersionSeen` and the next tree open folds the split over the
set again — but the repair waits for a tree open. That is §12.3's existing staleness bound
applied to a D-19 protection instead of a displayed number, and it is worth knowing about
because §11.5's whole premise is that this class of drop is otherwise unobservable.

### Two riders

**Rule 3 gained a second exit.** It defined the working set's only permanent exit as `ORPHAN`;
consumption is a second one and needs the same never-re-examined property, or F14's
replay-safety guarantee is asserted over a case the rules no longer describe.

**`MigrationReport.entries` needed a reading.** `outcome` is one value per row while `split`
now touches two structures. Stated: a row is one *record's* disposition, `rewritten` covers
both re-homing and consumption (`became` distinguishes them), and `unfrozen` is for the case
where a frozen set was the only thing affected.

### Files touched

`docs/ARCHITECTURE.md` §12.5, §14.5.

### Downstream

**T17** owns the fold, the consumption, the no-overwrite rule, and the frozen-set move; its
fixtures need the existing-successor case and the import-reintroduction case. **T16** — no
rule change, but the `grandfathered` merge now has a stated interaction with `split` worth a
test. **T09** — `setMilestoneState` is unaffected; the deletion path already exists for the
`null` case.

---

## F21 — `into:` had two grammars and neither was validated

**Verdict: amend.** 2026-08-05.

### The finding as raised

§5.4's example used a tree-qualified target for `moved` (`into: [bladesmithing/c5fj92tk]`) and
bare uids for `split` and `merged`. §5.2 typed the field `string[]` with no note of the
distinction, and §6.2 rule 15 validated the entry's own `uid` only. F13's manifest index is
built by parsing exactly this grammar, so it had a consumer that would fail unhelpfully on a
malformed target.

### Resolution

One table in §5.4, fixing shape and cardinality per `op`, and rule 15 branches on `op` to
enforce it.

| `op` | `into` | Targets | Target form |
|---|---|---|---|
| `split` | required | ≥ 2 | bare uid, this tree |
| `merged` | required | exactly 1 | bare uid, this tree |
| `retired` | absent or `[]` | 0 | — |
| `moved` | required | exactly 1 | `<treeId>/<uid>`, a different tree, uid equal to the entry's own |

### Three things the grammar decides that the finding did not ask about

**The repeated uid in `moved`'s target is checked, not decorative.** §12.5 re-homes the record
by rewriting `treeId` and keeping the uid — uids are immutable, so there is no other available
reading — which means a mistyped uid in the qualified half currently changes nothing and is
invisible at runtime. Requiring equality is what turns it into a checkable field. The tree half
is not decorative at all: it is the only written record of the destination, and §7.2's index
is built by parsing it rather than by searching every tree for the uid.

**`split` and `merged` stay inside one tree.** §12.5's fold is per-tree and its working set is
this tree's records, so a successor belonging to another tree would produce a record carrying
this tree's `treeId` under a uid that lives elsewhere — invisible in both. An author who wants
both writes two entries.

**Cardinality is part of the grammar.** `split` with `into: []` passes validation today and
disposes of nothing; `split` into one target is a rename under a new uid, which is `merged`'s
case.

### Why not accept both forms everywhere

The permissive reading — qualified or bare under any `op`, bare defaulting to the current tree
— was declined because it reopens F13's hole through the validator. A `moved` entry written
with a bare uid would parse cleanly, contribute no entry to `manifest.moved`, and leave the
record stranded on a tree that no longer contains it: exactly the reachability failure F13 was
resolved to close, arriving by a different route and equally silent.

Naming only the destination tree (`into: [bladesmithing]`) was also declined. It drops a
redundant uid, but a bare treeId and a bare uid are both lowercase tokens with no `/`, so a
`moved` entry written with a uid by mistake would parse as a tree that does not exist rather
than as a malformed target — and it contradicts §5.4's own shipped example.

### Files touched

`docs/ARCHITECTURE.md` §5.2, §5.4, §6.2, §7.2.

### Downstream

**T03** implements rule 15 as an `op`-branching check — this is the rule F7 left as the
git-free half, and it was not implementable until now. **T04** parses the qualified target's
tree half to build `manifest.moved`, and may assume rule 15 has already validated it. **T17**
parses nothing: §12.5 receives a destination `treeId` that the compiler resolved. **T02**'s
`tree.schema.json` carries the shape it can express and no more — the per-`op` constraints are
semantic by construction.

---

## F23 — nothing produced `TreeProgress`

**Verdict: amend.** 2026-08-05.

### The finding as raised

§11.1 and `scoreSkill` consume `TreeProgress`, and §11.9's invariant 7 is enforceable *"only
because §11.5's frozen satisfaction records … reach the engine through `TreeProgress`"* — via a
path that did not exist. `UserStateStore` exposed no accessor returning one. Related and
resolved together: §12.2's `by-tree` index was declared in the ER diagram and no prose anywhere
stated what reads it.

### Resolution

`progressFor(treeId: string): TreeProgress` on `UserStateStore` — **synchronous**, no I/O, a
projection of the §13.2 mirror that `hydrate()` fills wholesale. **Total**: an unstarted tree
returns empty maps, never `undefined` and never a throw. Plus `readonly hydrated: boolean`.

The `by-tree` index's stated consumers are the three places that need one tree's records
*inside a transaction*: §12.4 step 2, §12.5's fold and final sweep, and §12.3's reconciliation.
It is explicitly **not** the read path.

### The mirror was stale in exactly the moments the accessor is read

This is the part that matters, and it is not what the finding asked about. §13.2 described the
mirror as *"written via §12.4"* — the milestone write path and nothing else. But
`applyLineage`, `applyMoves` and `import` all rewrite `MILESTONE` rows wholesale, and a
synchronous read off an unrefreshed mirror is wrong precisely when those have just run:

- A tree renders immediately after its migration (§12.5), so the successors a `split` just
  created would be invisible on the first paint after a content update — the one paint §12.5
  exists to make correct.
- `applyMoves` rewrites `treeId`, which is the key `progressFor` reads on. A re-homed record
  would stay under the source tree for the whole session, defeating §13.3's stated reason for
  running that pass *before* the map derives at all.

§13.2 now says every writer refreshes the mirror on commit. Without that sentence the accessor
is a bug rather than a contract.

### Why synchronous, and why `UserStateStore` is the right home

The weak version of this argument is "a `$derived` cannot await" — weak because the tree route
is not prerendered and already awaits its bundle, so one more await is not an architectural
change. The argument that carries it is that §13.2 already calls this an **in-memory mirror**
and §13.3 already calls `hydrate()` wholesale, while §17.4 budgets a heavy phase-1 user at
under 1 MB — an over-count, since an incomplete milestone has no row at all. There is nothing
to lazily load. An asynchronous per-tree accessor would demote a mirror to a cache in the
spec's own words, in exchange for scaling headroom the storage budget says is not needed.

The home question is a non-issue on inspection: the store interface and the rune mirror are the
same `lib/state` node in §14.1, so no edge changes either way; §14.5's "one transaction"
contract is scoped to *mutating* calls; and `readonly writable` is already a synchronous member
of that interface.

### `hydrated` exists because totality has a failure mode

Empty maps are the right answer for an unstarted tree and the wrong answer for an unhydrated
store, and the caller cannot tell them apart. Under §13.3's hydration-failure branch every tree
would render as having no completions — the user's whole record apparently erased, for the
session. `writable: false` already makes that state safe for *writes*; §13.3's real warning is
about "read as empty, then wrote", and this is its display-side twin. Views branch on
`hydrated` and render progress as unknown while it is false.

### The `by-tree` index's primary consumer is the write path, not §12.5

The obvious guess — that the index serves per-tree reads — is what leads an implementer to
build the asynchronous accessor. Its busiest consumer is §12.4 step 2, on **every** mutation:
the attained-level recompute needs that tree's records, and it cannot read the mirror, because
§12.4 states that reactive state updates only on transaction commit, so at step 2 the mirror
does not yet contain step 1's write. §12.4's step 2 now says this in the step itself.

### Files touched

`docs/ARCHITECTURE.md` §11.9, §12.2, §12.4, §13.2, §13.3, §14.4, §14.5, §16.3.

### Downstream

**T09** owns `progressFor`, `hydrated`, the mirror refresh on every writer, and the `by-tree`
consumers; its open note on this finding is resolved. **T11a** may assume a total, synchronous
`TreeProgress` and needs no null branch. **T14** branches on `hydrated` in the cold-start and
read-only paths. **T17** refreshes the mirror on commit for both passes — the same requirement
that makes §13.3's first-frame guarantee hold.

---

## F25 — nothing owned §5.4's missing-uid gate

### The finding as raised

§5.4 says "CI fails a merge if any `uid` is missing, printing the values to paste", and
§6.1 marked `lst ids` gating with "(missing uid fails)". But §6.5's job graph has no `ids`
job, and `lst ids` **fills uids in place** — a subcommand that rewrites its input cannot be
the gate that rejects it. `T03-lst-validate-and-ids.md` had already inferred the answer
(check in `validate`, write in `ids`), but as an inference from two sentences rather than a
reading of either. Same class as F17: a stated CI guarantee with no named owner.

### Resolution

**Amend.** §6.2 gains **rule 16** — every milestone and mastery entry carries a `uid` —
and `lst ids`' "Gates?" column becomes **no**. The gate is `lst validate`, which already
runs in the content trio on every PR including content-only ones, already reports every
error in one pass with file and line (§6.1), and already owns the fourteen other rules a
JSON Schema cannot express. `lst ids` is the fix, precisely as §6.4's rule 4 is a gate CI
can auto-fix by pushing a commit.

§6.5's validate node moves from "15 semantic rules" to 16, and §5.4's flow sentence now
names rule 16 rather than gesturing at "CI".

### Why it cannot be a layer-1 `required`

This is the half the finding did not ask about, and it is the one an implementer gets
wrong. Making `uid` `required` in `schema/tree.schema.json` is the obvious cheaper fix and
it **destroys §5.4's authoring flow**: the author writes a complete tree with *no `uid`
lines at all* — that is the stated design, and it is what lets a draft be fully writable,
prerequisites and requirement groups included, before any tool runs — and then `lst ids`
fills the blanks. A schema that required the field would reject that draft at layer 1
before `lst ids` could parse it. Layer 1 still constrains the *shape* of a uid that is
present; layer 2 is what makes presence itself checkable without making absence
unparseable.

Rule 2 does not already cover it. Repository-wide uid uniqueness ranges over the uids that
exist and is silent about the ones that do not, so a tree with every uid missing passes
rule 2 trivially.

### Cost

One rule, one table cell, one diagram label. `lst ids` loses its gating status, which
removes a job the job graph never had.

### Files touched

`docs/ARCHITECTURE.md` §5.4 (flow sentence), §6.1 (`lst ids` row), §6.2 (rule 16 and its
two paragraphs), §6.5 (node label), §6.7 (step 4 now leads with `lst ids`).

### Downstream

**T03** owns rule 16 and may state the check/fix split as spec rather than inference; its
"15 semantic rules" references become 16, including the fixture that must violate every
rule. **T25** no longer needs an `ids` job. **T02** and **T04**'s "15 semantic rules"
cross-references, and **T22**'s, are stale by one. **T22** should note that `lst lint`
does not duplicate rule 16 either.

---

## F19 — `SKILL.lastActivityAt` was typed three ways and had an unwritten case

### The finding as raised

§12.2 types `lastActivityAt` non-optional, but only `setMilestoneState` was ever named as
writing it — and un-checking a milestone counted as activity with no statement either way.

### Two things found during resolution

**The field was typed three different ways.** §12.2 required it; §14.4's `DomainSkillRow`
made it optional with the comment "absent if never written"; §14.5's `ExportFile` made it
optional silently. Three declarations of one field, disagreeing — the same class as F15's
`MILESTONE.contentVersion` entry.

**`startSkill` was the unwritten case.** §12.4's three steps fire only on
`setMilestoneState`, so a skill started and not yet touched has a `SKILL` row with no
`lastActivityAt` at all, violating §12.2's own type. That is what `DomainSkillRow`'s
optional was quietly accommodating.

### Resolution

**Amend.** `startSkill` writes `lastActivityAt = startedAt`, making the field **total**,
and the `?` comes off both other declarations. Starting a skill is activity in the domain:
a skill begun yesterday rendering as *"No activity yet"* (§10.5) would be false, and
§11.7's null branch narrows accordingly — a domain reports `lastActivityAt: null` when it
has **no started skills**, and there is no second null case. `DomainScore.lastActivityAt`
stays `string | null` for exactly that one case.

§12.2 now carries the writer table: `startSkill` (`startedAt`), `setMilestoneState` (now,
on every mutation), `import` (the later of the two sides, never now).

On the finding's own question — **yes, un-checking counts**, and the spec already depended
on it. §11.9's invariant 1 and §14.4's monotonicity contract both argue from "§12.4 writes
`lastActivityAt` on **every** mutation". A correction is still the user engaging with the
skill, and the alternative would have made two live clauses false.

### The two riders that matter

**No migration writes it.** §12.5's fold, `applyMoves`, and §12.3's reconciliation all
mutate records without touching the watermark, because a content release is not user
activity. A fold that bumped it would refresh every user's entire map to the day of the
release — a fabricated date, which is the one thing §11.7 says the recency channel must
never render. Nothing in the spec said this, and every one of those three passes writes
`SKILL` rows.

**It is a watermark, not a derivation.** The natural implementation is a `max` over the
tree's `MILESTONE.at` values, and it is wrong in a way no unit test over completions would
catch: un-completing the most recent milestone *lowers* that maximum, which decreases
`DomainScore.lastActivityAt` and breaks §11.9's invariant 1 — the invariant the PRD states
most emphatically. Stored and forward-only, it cannot decrease. This is why the field is
denormalized onto `SKILL` at all, and the reason was written down nowhere.

### Cost

One write in `startSkill`, two `?` removed. §12.6's "present beats absent" survives as a
tolerance for files written before the field became required, labelled as such.

### Files touched

`docs/ARCHITECTURE.md` §11.7 (null branch), §12.2 (writer table, watermark paragraph),
§12.4 (the "only writer" claim scoped to `MILESTONE` records — see F27), §12.6 (merge-rule
note), §14.4 (`DomainSkillRow`), §14.5 (`ExportFile`).

### Downstream

**T09** writes it in `startSkill` and must not write it in `applyLineage`/`applyMoves`; the
forward-only property is a property test, not an example test. **T11b** may treat
`DomainSkillRow.lastActivityAt` as total and needs no absent branch. **T16** merges it as
latest-wins and never as now. **T02** makes it required in the export schema. **T17** must
leave it alone in both passes.

---

## F26 — §12.3's write-back had no owner reachable on an ordinary tree open

### The finding as raised

§12.3 requires the Scoring Engine to recompute attained level on tree open and write it
back if it differs. §14.5 had no method for that write. `applyLineage` is the only
candidate and it is version-gated (§12.5), so it does nothing on an open where the content
version has not advanced — which is every ordinary open. `T09-user-state-store.md` already
carried an acceptance criterion for the reconciliation, making it untestable as drawn.
Raised while resolving F23.

### Resolution

**Amend.** §14.5 gains
`reconcileAttainedLevel(treeId: string, attainedLevel: number): Promise<boolean>`, called
by the **tree route** (§13.4) once the bundle has loaded and the engine has scored it. It
writes `SKILL.attainedLevel` only if the value differs, resolves `true` when it wrote,
touches no other field, and refreshes §13.2's mirror on commit like every other writer
(Group G's rider).

It takes a number, not a `CompiledTree`, and that is the whole design. §14.1 marks
`STATE ⇢ LOADER` forbidden and draws no edge from `lib/state` to `lib/scoring`, so nothing
inside the store can either fetch a bundle or recompute a level from it. The route is the
only place holding both halves. `lib/actions` was declined: it imports the two I/O owners
and not the engine, so routing this through it would mean a new §14.1 edge to buy nothing —
the route already has the engine's output in hand.

### Ordering, which the finding did not raise

**`applyLineage` first, then the reconcile.** When the content version advanced, the
migration ran and its `MigrationReport.attainedLevel.after` has already been rendered as
§12.5's dismissible summary. A reconcile that then computed and stored a different number
would contradict a statement the user is currently reading. Running second it finds the
migration's value and writes nothing, so the two never disagree.

This also completes F13's deferred half. `applyMoves` deliberately does not recompute the
*source* tree's level — it has no bundle — and F13 left that to "§12.3's existing staleness
tolerance". That tolerance now has a mechanism: the source tree reconciles when the user
next opens it.

### The case it must not handle

A tree with no `SKILL` row is unstarted: the call is a no-op resolving `false`, and it
**never creates a row**. Creating one would put an unstarted skill on the map carrying a
rank, and §11.7 counts unstarted trees as breadth 0 precisely to keep them off it.

### Cost

One method, one call site. No new module, no §14.1 edge.

### Files touched

`docs/ARCHITECTURE.md` §12.3 (owner and ordering), §14.5 (signature and contract).

### Downstream

**T09** implements `reconcileAttainedLevel` and the `applyLineage(tree,
evaluateAttainedLevel)` signature; its reconciliation acceptance criterion becomes
testable. **T14** owns the full tree-open orchestration: when the version gate fires,
`applyLineage(tree, (p) => scoreSkill(tree, p).attainedLevel)` — the store imports no
scoring code; the route injects the evaluator — then `scoreSkill`, then
`reconcileAttainedLevel` as the ordinary-open honesty pass (typically a no-op immediately
after migration, but required to catch non-lineage content changes). **T17** implements the
migration fold and, inside the same transaction, calls the injected evaluator, persists
`SKILL.attainedLevel`, and populates truthful `MigrationReport.attainedLevel` before/after.
**T07** defers orchestration to T14; **`lib/actions`** is unchanged (no engine import).

---

## F24 — §6.5's `build` job was unreachable on a content-only PR

### The finding as raised

§6.5's job graph has `V --> BUILD`, `TC --> BUILD`, `T --> BUILD`, and its closing sentence
says "on a content-only PR the app jobs are skipped by path filter". A skipped dependency
skips the dependent, so `build` — the only job running `lst compile`, marked gating in
§6.1 — did not execute on the PRs that change content. The finding concluded that
everything compile enforces is ungated on exactly its own input.

### Two corrections found during resolution

**The severity claim was wrong, and in a way that changes the shape of the fix.** The
`content: baseline` job is not path-filtered, and §6.4 check 5 compiles *both sides* of
the diff. So `lst compile` did run on every content-only PR, and three of the finding's
four "ungated" items — §7.3's transformations, F9's output-schema validation (which lives
inside `lst compile`, not in a build step), and the `moved` map — were in fact covered.
The real defect is narrower and different in kind: **the compile gate was unnamed,
incidental, and contradicted by §6.1's "(build step)" label.** It was a side effect of a
check F8 added the day before, and narrowing check 5 to only the trees whose YAML changed
— a legitimate optimisation nothing forbids — would have silently removed it.

**A skipped job reports success to branch protection.** GitHub counts a `skipped` required
check as passing. So `build` was not merely unenforced; it was *green* while unenforced,
and no reviewer could have seen it. This is the fact that makes the finding worth a
topology change rather than a footnote. (The opposite failure — a required check that never
reports, leaving the PR blocked in Pending forever — belongs to workflow-level
`on.pull_request.paths` filters, and is recorded in §6.5 because it is the trap an
implementer falls into while fixing this one.)

### Resolution

**Amend — split the job.** `content: compile` `needs: [validate]` and runs `lst compile`
plus F9's output-schema check. `app: build` `needs: [typecheck, test, compile]` and runs
`lst compile && vite build` plus §14.7's other six gates and §17.1's budget. Both reach
the merge gate independently, following the pattern `content: baseline` and
`content: status` already set.

`build` as drawn conflated two steps with two different inputs — `content/` for compile,
`app/` for vite. The `needs:` bug was a symptom of that conflation, and both options the
finding named (`if: always() && !failure()`, or making the app jobs no-op-pass) are YAML
patches over the modelling error that pay for the fix in the currency §6.5 and T25 both
say is precious: a content PR would start paying for `vite build`, and "completes in
seconds" would stop being true. Split, every job works with a plain `needs:` and no
conditional expression at all, and `app: build` skipping on a content PR becomes correct
rather than dangerous.

The no-op-pass option was declined on a second ground: a green `app: test` on a PR where
no test ran is a check that lies, and §6's governing principle is that CI's honesty is
what buys human review its budget.

### Why `app: build` recompiles instead of taking an artifact

It runs `lst compile && vite build`, which is §4.3's pipeline and T01's root script
unchanged. The alternative — `upload-artifact` from `content: compile` — compiles once
instead of twice and would make T25's "deploy reuses the build artifact" idea coherent,
but it introduces inter-job artifact passing, a concept this job graph has no other
instance of and the one thing in it that can go stale or transfer partially.

The price is honest and worth recording: one redundant compile on a full PR, and
`lst compile`'s byte-determinism stops being hygiene and becomes load-bearing — the
content-hashed filenames in the deployed manifest must name the bundles that actually
ship (§7.5). T04 already carries that as an acceptance criterion; it is now a CI
correctness property, not a nicety.

### The cost, stated plainly

**Seven gating jobs, not six.** F8 went out of its way one session earlier to keep the
count at six by riding the `contentVersion` check on `content: baseline`; that note in T25
is now a stale boast and is struck. Every job-count reference in §6.5 and T25 moves. And a
content PR no longer exercises a `vite build` at all, so the first one over new content
happens post-merge in `deploy.yml` — acceptable because compiled JSON is a static asset
rather than a module in the chunk graph (§4.3), but it is a real reduction in coverage
that the two declined options did not have.

### Three defects folded in rather than appended

Each lands on text this resolution rewrites anyway.

- **T25 stated the opposite of F24 as settled fact** — that skipping `build` on a content
PR is "fine since content changes cannot affect them", forgetting `lst compile` is in that
job. An implementer following that hazard note would ship the bug, in the same document
whose acceptance criterion says F24 blocks it.
- **"Path filter" was never disambiguated**, and the two Actions features by that name fail
in opposite directions. §6.5 now says job-level `if:`, and says why.
- **§6.5's "validate/baseline/lint trio" undercounted by two.** `content: status` is gating
and a PR adding a tree necessarily changes `REVIEW-STATUS.md`, so it is squarely in a Tree
Author's loop. The sentence was wrong before this finding touched it.

### Files touched

`docs/ARCHITECTURE.md` §6.1 (compile's gate label), §6.4 (check 5 is a comparison, not the
gate), §6.5 (the graph, the classDef, and five paragraphs of replacement prose), §6.7
(step 4 gains `lst compile`), §14.7 (the output-validation bullet names its job).

### Downstream

**T25** owns the split and the largest share of the churn: the six-job list, the verbatim
graph copy, the verbatim quote of the old closing sentence, the F24 acceptance criterion,
F8's six-job note, and the hazard note that must be struck. Its "deploy reuses `ci.yml`'s
build artifact" option is void — that job may have skipped. **T04**'s "the build step §6.1
marks as a gate" names a job that no longer exists, and its byte-determinism criterion is
promoted from hygiene to CI correctness. **T23** notes the check 5 clarification. **T12**'s
open F24 note resolves with no behavioural change.

---

## F22 — a started skill whose tree left the manifest lost everything, silently

### The finding as raised

A user has a `SKILL` row and `MILESTONE` records for tree X; a content release removes X
from `content/trees/`. The skill then contributes to no domain score (§11.6's sum is a
manifest × `SKILL` join and there is no entry to supply `domain`), never migrates (§12.5
fires on tree open and there is no bundle to open), and is not an orphan (the final sweep
is `treeId`-scoped and runs inside that same pass). It is invisible everywhere but a raw
export.

### What resolution found, and it cut against the hypothesis

**Tree deletion was not forbidden, and §6.4 would not have caught it.** The obvious hope
was that check 1 already prevented this — every baseline uid must still exist or appear in
`lineage` with a disposition. It does not, and cannot: **the ledger is a field of the tree
file being deleted.** A ledger cannot dispose of its own file. Checks 1–7 are each a diff
of one tree against its own baseline version, so a tree absent from the head is never
visited; they do not fail, they pass on nothing — the same shape §6.4 already records for
`fetch-depth: 1`.

Nor is there a workaround an author could have used instead. "Move every milestone out and
leave a stub carrying the ledger" is **inexpressible**: §5.3 requires exactly ten levels
and §6.2 bounds each at 4–8 milestones, so a tree that has disposed of all its content has
no legal shape. The only available operation was the one that destroys the dispositions.

Two accidental protections existed and neither was the guarantee: §6.2 rule 15 blocks
deleting a tree that has *received* a move, and only that; and the 4–8 bound above.

**One correction to the finding's framing.** T26 recorded this as brushing invariant 1. It
does not, quite — invariant 1 quantifies over completing a milestone and invariant 7 is
about `attained`, so a content release zeroing a domain contribution slips between both
assertions. That is an argument for fixing it, not for tolerating it, but the record should
be accurate about which invariant is at stake: none, and that is itself the problem.

### Resolution

**Amend, in two halves that fix different failures.**

**§6.4 gains check 8** — every tree `id` in the baseline is present in the head. Trees are
never removed and never renamed. One set difference over two checkouts the job already
has. The scope of checks 1–7 is stated at the same time: they range over trees present on
both sides, check 8 ranges over the set. That statement is load-bearing rather than
tidying, because the alternative reading — check 1 quantifying over every baseline uid
repository-wide — would let a `moved` uid satisfy check 1 by existing in its destination,
and the `moved` disposition F13 is built around would never be needed at all.

**A runtime retention rule**, because no CI rule can make it unnecessary. A `SKILL` row
with no manifest entry is **retained, never deleted**, excluded from §11.6's sum and
§11.7's breadth count, and listed on `/data`. §12.6's import can always manufacture this
state from an export written against a fork or a newer library, and §16.3 defines
behaviour for every other join failure, so it needs a row here too — plus a second row for
`/s/<treeId>` missing from the manifest, which is a lookup miss *before* any fetch and so
a different branch from §16.3's existing bundle-failure row.

### Why not a `retired` flag, and why not an `F13`-style map

**A `retired: true` flag on the tree file, copied to the manifest with the bundle still
shipped, was priced and declined for v1.** It is the better long-run answer — domain,
score, migration and verifiable frozen sets all survive — but it needs a conditional
carve-out from §5.3's ten-levels × 4–8 bound and it makes the manifest grow monotonically
forever, on the one artifact fetched at every cold load. v1 has three exemplar trees and no
retirement need. Recorded as **R-27** with its shape written down, along with the case that
will eventually force it: F45's copyleft answer can turn out to be wrong after merge, and
rule 13 is explicit that CI cannot adjudicate it. The escape hatch until then is a
documented maintainer procedure whose consequence is exactly the state the retention rule
handles.

**A library-wide `retiredTrees` map, by analogy with F13's `moved`, was rejected outright.**
The analogy fails at the joint: `moved` exists because a disposition *exists but is
unreachable*, whereas here no disposition exists at all, so the map could only orphan every
record wholesale with `reason: 'unknown'` — total score loss, mass orphaning, and every
frozen set permanently unverifiable, which is §12.5's stated worst outcome. It would also
cost a new store writer, a line in §13.3, and an entry in Group G's "every writer refreshes
the mirror" list, to do something worse than doing nothing. And it is derived from live tree
files exactly as `moved` is, so it inherits the durability hole it was meant to patch.

The chosen resolution has **no new store method, no new cold-start pass, and no schema
change.** Those three zeros are most of the argument.

### Five defects folded in rather than appended

At the owner's direction, and because each is either a cause or a consequence of this one.

- **Tree `id` had no immutability guarantee** — arguably F22's root cause. §5.3 said only
"unique across the repository, appears in URLs", yet it is the PK of `SKILL`, the FK on
`MILESTONE` and `ORPHAN`, the value type of the `moved` map, the `treeId` on every export
row, and the `/s/<treeId>` URL space. D-05 gave milestones a uid/slug split so the display
name could move; a tree id has no such split, so it cannot. A rename is this finding with a
friendlier trigger and passed every check. Now stated in §5.3 with protobuf's `reserved`
rule and enforced by check 8.
- **§6.4 never diffed the tree set**, and the scope was unstated — covered above.
- **The manifest's `moved` map had no durability guarantee.** It is rebuilt from live tree
files on every build (§7.3), so deleting a source file silently drops its entries, and any
user who had not cold-started between the move release and the deletion release never
re-homes at all. F13's mechanism was only as durable as the file it derives from and
nothing asserted the map was monotone. Check 8 is what makes it so; §7.3 now says it
depends on that.
- **Import can create a `SKILL` row for an unknown `treeId`**, and §16.3 had no row for it.
Unavoidable by CI, which is why the retention rule is a runtime invariant.
`ImportReport` gains `skillsWithNoManifestEntry` on §14.5's stated principle — a
consequence the user could not otherwise observe.
- **A tree cannot be legally emptied** — recorded in §5.4 as the reason the stub workaround
does not exist, and in R-27 as a cost any future retirement mechanism must pay.

### Files touched

`docs/ARCHITECTURE.md` §5.3 (`id` immutability), §5.4 (tree granularity and the empty-tree
bound), §5.9 (why domains are removable and trees are not), §6.4 (check 8, the scope
statement, the two durability consequences, `fetch-depth` now 1–8), §7.3 (the `moved` map's
dependency on check 8), §11.6 (the sum skips unjoined rows), §13.1 (`/s/<treeId>` miss),
§14.4 (dropped from the join, never from storage), §14.5 (`ImportReport`), §16.3 (two rows),
§16.5 (`/data`), §19.3 (**R-27**).

### Downstream

**T23** owns check 8 and the scope statement — the load-bearing edit, and the only one
outside the tasks F22 was filed against. **T02** states tree-id immutability in the schema
notes; no schema change. **T14** drops unjoined rows without deleting them, branches
`/s/<treeId>` on a manifest miss, and owns both §16.3 rows. **T16** reports
`skillsWithNoManifestEntry`, lists the skills on `/data`, and needs a round-trip fixture for
an export naming a tree this library lacks. **T09** gains the retention rule as a store
invariant, no new method. **T04** notes the `moved` map's dependency on check 8.
**T17 is explicitly unchanged**, which is worth recording: the migration passes do not move.

---

## F15 — a cluster of small omissions

### The finding as raised

Seven items, each cheap to fix and each capable of costing an afternoon if hit cold. All
seven are resolved by amendment; none needed a judgment call.

### The seven

**1. §4.4 cited the wrong section.** It forwarded the reader to "§7.3, which treats
manifest freshness explicitly". §7.3 is the compiler's transformation table; freshness is
§7.1 and §7.4. Now cites both, and says what §7.3 actually is so the next reader does not
re-follow the dead pointer.

**2. `MILESTONE.contentVersion` was declared, unconsumed, and typed two ways.** §12.2
required it, §14.5's `ExportFile` made it optional, §12.6's worked example omitted it, and
§12.6's milestone merge rule was silent — so a round trip could drop a required field with
no stated default. **Resolved as required everywhere, and named as provenance rather than
an input:** nothing branches on it (§12.5 migrates off `SKILL.contentVersionSeen`, and the
engine never sees it), it exists so an export read years later says *which version of the
tree the user was looking at when they ticked this* — the same job §12.2 already gives the
frozen `slug` and `title`, and the same justification, since there is no telemetry to
reconstruct it from. It is always available at write time because a milestone cannot be
completed without its bundle loaded, so nothing forces the optional. §12.6's merge rule now
says the whole record travels together: `slug`, `title`, `note` and `contentVersion` are all
provenance of the completion the winning `at` identifies, and mixing fields across the two
sides would describe a completion that never happened.

**3. `ORPHAN` carries no `slug` while `MILESTONE` does.** Confirmed intentional and now
stated, with the reason. A slug is a *live reference* — it resolves through §5.4's `aliases`
into a milestone that still exists and addresses a `/s/<treeId>/m/<slug>` deep link. An
orphan is precisely a milestone that no longer exists, so a retained slug would look exactly
like one that resolves while resolving to nothing, inviting a dead link straight out of the
retired-achievements list. `title` carries the human meaning and `uid` the identity; the
slug's only job was reference, and there is nothing left to refer to.

**4. §12.7 did not say where the export-prompt dismissal flag lives**, and the finding
already named the hazard: persisting it naively silences all three triggers permanently.
**Resolved as a per-trigger record in `META`, never one global boolean** — a single flag
turns the only backup mechanism in a system with no server (N2) into something one stray
click disables forever. Each trigger then re-arms on its own terms, which is what makes the
design need no timers: **T1** never re-fires, being a one-time onboarding nudge superseded
by T2 after thirty days; **T2** re-arms naturally, since its condition goes false at the
next export and true again at the next window, so a dismissal costs one window; **T3**
stores a usage watermark and re-fires ten percentage points later, without which dismissing
at 61% would silence it through 99%.

**5. §12.7's "new activity since" was undefined.** Now `lastActivityAt > lastExportAt`,
compared as ISO-8601 UTC strings — both fields already exist and both are already
`Z`-suffixed (§12.2, and F19 made the first of them total), so this needs no new field and
no clock arithmetic. It is deliberately *activity* and not *completions*: a user who has
been dismissing and re-ticking has unbacked-up work like anyone else.

**6. §12.7's 60%-of-quota trigger cannot fire in phase 1.** §17.4 budgets phase 1 storage
well under 1 MB against origin quotas in the hundreds of megabytes, so 60% is unreachable by
two or three orders of magnitude. **Labelled phase 2** in a new trigger table rather than
left to read as live. It stays specified because it arrives with photos (§12.8), where it
becomes the trigger that matters; building it in phase 1 would be dead code no fixture can
exercise honestly.

**7. §10.5's channel table sourced Breadth to §11.6.** Breadth is §11.7. Same class as item
1, found during F5's sweep of the adjacent Recency row and left for this cluster.

### Files touched

`docs/ARCHITECTURE.md` §4.4, §10.5, §12.2 (two paragraphs), §12.5, §12.6 (example, merge
rule), §12.7 (rewritten), §14.5 (`ExportFile.contentVersion`).

### Downstream

**T18** owns §12.7 and gains the trigger table, the per-trigger dismissal record, the
`lastActivityAt > lastExportAt` definition, and T3's phase-2 label — the largest share.
**T16** makes `contentVersion` required in the export and merges the record whole. **T09**
writes it on completion. **T02** makes it required in the export schema. **T13** takes the
Breadth citation fix. No task gains or loses scope.

---

## F18 — the fill band vocabulary was required in three places and defined in none

### The finding as raised

§11.6 required a "named band" over `fill`, §15.3 announced it to screen readers, and §15.4's
redundancy table listed it — and no section named the bands. Two of the three called it a
**tier**, colliding with F7's `TierName` (Novice, Apprentice, Journeyman, Expert, Master),
which is a different thing over a different quantity. The finding noted this needs the
owner, not a derivation.

### Resolution

**Amend.** Five bands over `fill`: **Quiet** `[0, 0.15)`, **Emerging** `[0.15, 0.35)`,
**Moderate** `[0.35, 0.55)`, **Active** `[0.55, 0.72)`, **Deep** `[0.72, 1)`. §15.3 and
§15.4 stop saying "tier", and §2's glossary gains a `Band` entry beside `Tier` so the
collision cannot quietly return.

The vocabulary is spec-native rather than invented: §11.6 already frames the entire channel
as *"is Body quiet compared to Mind?"*, and §15.3's worked accessible-name example already
read *"Fill: moderate"* — so that example survives the resolution unchanged, which is a
small sign the words were the ones the document was already reaching for.

**The boundaries are anchored to the shipped curve, not to arithmetic.** The top band opens
at 0.72, just under a lone level-10 skill's 74.7%, so one skill taken all the way reaches
the top band. Even quintiles were declined for exactly this: their top band opens at 0.80,
which no single skill however deep can reach, denying the claim R-19's depth premium exists
to make.

### Two constraints that shaped the words

**No band may imply a denominator.** `fill` is `s/(s+48)` — asymptotic, never reaching 1.
Eight mastered skills reach 95.9%. So "Full" or "Complete" at the top would be false, and
§11.6 is explicit that domains have no denominator and F34 forbids showing the number at all.

**The bottom band cannot claim emptiness.** `fill: 0` covers a domain with no started skills
*and* one whose started skills all sit at `attained: 0` (§11.3), and breadth is the channel
that tells them apart. A band named `None` beside a skills-started count of four would
contradict the text next to it. `Quiet` is true of both.

And underneath both: the words are intensity adjectives because a band that congratulates is
a second ladder. §11.3's tiers already rank a user's skill; a band describes a region's
state, and conflating the two is what the word "tier" was doing.

### The rider the owner added, and it changed the shape of the answer

**The table is expected to move** — names, count, and boundaries are all provisional, since
the right vocabulary is the kind of thing only real use settles. That turns this from a
naming decision into a decision about where the names live, and three consequences follow:

- **The band name is `string`, not a closed union.** This is the one most likely to be got
wrong, because `TierName` sits four sections away as a five-member union and looks like the
precedent. It is not: `TierName` is closed because F7 fixes tiers as pairs of levels 1–10, so
a sixth would mean changing the level spine. Bands have no such anchor, and a union would
make renaming one a type change rippling through every consumer.
- **One table, one resolver, no threshold in any component.** The map renderer (§10.5) and
the accessible-name builder (§15.3) call the same resolver over the same ordered table.
- **The table is a pure, dependency-free constant module** — the same class as `lib/types`,
importing nothing and doing no I/O, so §14.1's rules do not reach it and it needs no new node
in that graph.

`DomainScore` still carries no band field, as F3 decided and F18 confirmed for a second
reason: were the band a field there, moving a boundary would be an engine change with
property tests to re-derive, rather than a one-line data edit.

The bar is explicit: **changing a name, moving a boundary, or going from five bands to four
must be a one-line data edit with no type change and no component change.** Worth a property
test that the table is non-empty and ascending, that its first bound is 0, and that every
bound lies in `[0, 1)` — the treatment §11.9 already gives the contribution table.

### Files touched

`docs/ARCHITECTURE.md` §2 (glossary), §11.6 (the table and four paragraphs), §14.4 (why the
band is not a `DomainScore` field), §15.3, §15.4.

### Downstream

**T13** renders the band on the map and must not write a threshold into the component.
**T20** takes the accessible-name wording and §15.4's redundancy row. **T11b** is unaffected
— no engine change, which is the point. Neither task needs a `BandName` union type, and
introducing one would defeat the resolution.

---

## F27 — §8's five layout silences

### The finding as raised

Not raised during the breakdown. `T06-layout-engine.md` had flagged five places where §8's
contract does not determine an implementation, under a heading reading *"Where the spec is
silent — do not invent an answer without flagging it"*. That heading was the last thing
keeping T26's closing acceptance criterion unmet, and the honest way to clear it was to give
the five a verdict rather than to delete the marker. Filed and resolved 2026-08-06.

All five are the same class as F15: individually small, none blocking, each capable of
costing an afternoon or — in two cases — of producing a wrong answer that renders plausibly.

### The five

**1. The narrow layout's vertical direction was unspecified.** §8.2 fixes level 1 at the
*bottom* for wide; §8.5 says only "stacked". **Resolved: level 1 at the TOP in narrow**, the
one place the two modes disagree about direction, and deliberately so. Wide is a spatial
metaphor — a tree grows upward. Narrow is a *reading order*: §8.5 already reuses it as §15's
linear presentation for screen readers **at every viewport**, so level 1 at the bottom would
run that reading order level 10 → level 1, present the deepest achievements first and the
entry point last, and put visual order in opposition to focus order on the one layout where
they are the same list. T06 had guessed this correctly; it is now spec rather than a comment.

**2. `col`, `lane` and `columns` were undefined in narrow.** §8.1's types require all three.
**Resolved:** `col = 0` throughout; `columns` holds exactly one **synthetic** entry
`{ trackId: '', title: '', x: 0, w: width }`, with an empty `trackId` marking it synthetic
and §9 drawing no header for one.

Leaving `columns` empty was the tempting answer — §8.5 already returns `edges: []`, so an
empty array for a concept that does not apply looks like the established pattern. It was
declined because it breaks **`columns[node.col]` resolving**, which is worth more than the
symmetry: it is a property a test can assert and a renderer can rely on without branching on
viewport, and `col = 0` indexing into an empty array is a footgun that type-checks.

The same resolution closes a gap the finding did not name: §8.2 step 2 says a wide tree with
no `tracks` "has exactly one column" and never said what is *in* it. One rule now covers both.

**`lane` keeps its §8.1 meaning** — index within the `(level, col)` cell — so in narrow it is
the index within the level. T06 had proposed a running index over the whole stack; that was
declined because one field must not mean two things across two modes, and `(level, lane)`
recovers the stack order anyway.

**3. No numeric constants existed anywhere in §8.** `slotWidth`, row height, the gutters —
none had a value, and the engine is not buildable or snapshot-testable without them.
**Resolved as tunable data with a v1 set**, on the same principle F18 established for the
fill bands: units are abstract and the renderer rescales them, so no value is normative, and
what carries meaning is the ratios. They live in one module beside the engine, never inline.
**Two are constrained rather than free**, and a retune breaking either is a bug: `rowGutter`
must stay positive or §8.4's edges have no channel to route through, and
`sideGutterLane × (max same-level edges in one row)` must not exceed `sideGutter` or the
outermost lane escapes the tree.

**4. Side-gutter geometry was undefined.** §8.4 said same-level prerequisites "route through
a side gutter" without saying which side, how wide, or how two such edges in one row avoid
drawing on top of each other. **Resolved:** one vertical channel on the right of the whole
tree, outside every column; each edge takes a lane within it, numbered inside out and
assigned per row in `(source lane, target lane)` order; the path is four segments — out of
the source's right edge, right to its lane depth, vertically by `sameLevelBow`, left into the
target's right edge.

One channel rather than one per column, because a same-level prerequisite may cross any
number of tracks and a per-column gutter would have to be entered and left repeatedly. **The
bow is the part an implementer will otherwise get wrong:** both nodes share a row, so both
legs leave from the right edge at the same `y`, and without a vertical offset the outbound
and return legs are the same line. That is the first case anyone hits, and it renders as a
single stroke that looks like a bug in the data.

A target to the *left* of its source produces a path crossing the nodes between it and the
channel. **Accepted, not routed around** — §8.4's stated position is that crossings are never
minimized, and a dodge here is the first step onto the auto-layout path `docs/RESEARCH.md`
§3 rejects.

**5. Mastery `requires` targets had no layout node.** §5.7 lets a mastery achievement declare
`requires` against milestones, and §8.2 step 7 said "for each `requires`" without qualifying
it. **Resolved: step 7 ranges over positioned milestone nodes only**, and an edge with an
unpositioned end is dropped rather than degraded. §6.2 rule 14 forbids a mastery entry
carrying a level, track, order, or requirement group, so it has no cell, no lane, and no
position, and §9.6 renders it in a panel outside the grid entirely. This is a category error
rather than a tolerance: the alternative — inventing a position for mastery — would put it in
the grid §5.7 exists to keep it out of. §9.6 surfaces its prerequisites as text, the same
treatment §8.5 already gives every edge in the narrow layout.

### Files touched

`docs/ARCHITECTURE.md` §8.1 (the constants table and its two hard constraints), §8.2
(synthetic column, step 7's scope, and the mastery paragraph), §8.4 (side-gutter geometry),
§8.5 (narrow direction, `col`/`lane`/`columns`).

### Downstream

**T06** owns all five; its "where the spec is silent" section is replaced by the resolutions
and its guesses on items 1 and 2 are now spec — one confirmed, one overruled on `lane`.
**T08** may rely on `columns[node.col]` resolving in both modes, and draws no header for a
synthetic column. **T20** gets the reading-order guarantee it needs: narrow is level 1 first,
at every viewport. Nothing else moves, and no task gains or loses scope.

---

## F28 — Rule 9's `module` half had no registry

**Verdict: amend.** 2026-08-07.

### The finding as raised

During T03 implementation, rule 9 was extended to treat `module` like `track` — requiring
modular-archetype trees to cluster milestones under declared module ids. The schema has no
`modules[]` registry (only `tracks[]`), and `archetype` is a presentational hint, not a
behavior switch. §6.2's table row and PRD F41 still read "track and module references
resolve to declared values," which implied a registry that does not exist.

### Resolution

**`track` is a reference; `module` is a free-form label at point of use.** Rule 9 validates
only that milestone `track` values appear in the tree's declared `tracks[]`. Any
cross-milestone module naming consistency belongs in `lst lint` (T22), not validate.
§6.2 rule 9 and T03's task doc are amended to say so. The post-T03 modular-cluster check
is removed from `tools/src/validate/`.

### Files touched

`docs/ARCHITECTURE.md` §6.2 rule 9; `.agent/tasks/T03-lst-validate-and-ids.md` rule 9 row;
`tools/src/validate/rules/references.ts`; validate fixtures and tests.

### Downstream

**T22** may add advisory lint for module label consistency if authors want it. No T26
reopen; no new blocker.

---

## F29 — §9 never draws a track title or a module label

**Verdict: amend.** Raised 2026-08-15 during T21, resolved 2026-08-15.

### The finding as raised

D-07 states the renderer's shape-sensitive behaviour exactly twice, and the second half is
not implemented:

> the renderer's only shape-sensitive behaviour is that it draws the number of columns it
> is given and **renders module labels when modules exist**.

`app/src/lib/components/TreeView.svelte` reads `positions.nodes`, `positions.edges`, and
`positions.rows`. It never reads `positions.columns`, and `module` appears nowhere in
`app/src/` outside the generated types. A repository-wide grep finds exactly one consumer of
`TreeLayout.columns` — an assertion in `TreeView.test.ts` — so `columns[].trackId` and
`columns[].title` are computed by §8 and dropped on the floor.

The consequence is visible for the first time now that a branching and a modular tree exist:

- **piano** lays out as three real columns (50 nodes, 3 columns, 57 edges), and a user is
  given no way to learn that the left one is Technique and the right one is Musicianship.
  The x-positions carry the structure; nothing names it.
- **mental-health** carries five module labels on 50 milestones, and the choice-based
  archetype is at present **visually indistinguishable from a linear tree**. Its `n_of`
  groups change what clears a level, but nothing on screen says which milestones belong to
  which practice, so the grouping that motivates the electives is invisible.

There is an accessibility half as well, which is T20's rather than T08's. §15.2's grid order
is `(level, track, lane)` and `keyboard-grid.ts` navigates by track index, but
`nodeAccessibleName`/`nodeDescription` never name the track — so `↑`/`↓` move "within a
track" that a screen reader user has never been told exists.

**§9 is complicit, not merely under-implemented.** §9.2's SVG sketch has three groups —
`edges`, `rows`, `nodes` — and no place for a column header or a module label; §9.3 and §9.5
never mention either. T08 built §9 as drawn. So this is a spec gap that produced a code gap,
which is why it is filed here rather than as a T08 bug.

### Why T21 did not fix it

T21's scope forbids it, deliberately: *"Any change to `lib/layout/`, `lib/scoring/`, or
`lib/components/` themselves… if the renderer cannot handle a legitimate branching or modular
tree without modification, that is a defect in T06 or T08 to report upstream."* Both trees
**do** render — every node is positioned, every edge is routed, both viewports pass — so this
is a legibility defect and not a blocker. Neither tree was bent to avoid it.

### The resolution

**1. Column titles are HTML above the `viewBox`, not a header band inside it.** The header
band was the more "correct by construction" option — titles positioned by the same engine
that positions the nodes cannot drift from them — and it was declined on cost, not on taste.
It changes `TreeLayout.height` *and* `width`, which reopens every layout stability and purity
test in T06 for a change that draws no node. The alignment objection against HTML turns out
not to apply here: `.tree` renders at `width: 100%; height: auto`, so with the default
`xMidYMid meet` the element box has the viewBox's own aspect ratio and there is no
letterboxing to absorb. A percentage of `positions.width` is therefore exactly the same
fraction of the drawn SVG, and the heads are positioned from `columns[].x` and `.w`
directly — the same numbers §8.2 step 2 computed and §9 had been discarding. §8.2's comment
already said an empty `trackId` was the marker meaning "draw no header", so the layout had
anticipated this and only the renderer was missing.

**2. Module labels are text on the node.** Both cheap channels were already spent: §9.3
gives each of the five node states a fill, a border style **and** a glyph, so a glyph-keyed
legend collides with state and a colour-keyed one is the sixth meaning on colour that N5
forbids. That leaves text, and text is also the option that needs no legend and no lookup.
The label is drawn quiet — small, uppercase, reduced opacity, above the title — because it
is orientation rather than the thing the node *is*.

Sub-grouping within the level band was the alternative worth taking seriously, since it
shows the grouping rather than merely asserting membership, and it is what the `n_of`
electives actually motivate. It was declined for the same reason as the header band: it is a
§8 ordering change, and a module absent from a given level leaves that band ragged in a way
the equal-cell geometry of §8.2 has no rule for.

**3. The track joins the *description*, not the name — and this is the correctness half.**
§15.2's grid order is `(level, track, lane)` and `keyboard-grid.ts` navigates `↑`/`↓` by
track index, so a screen-reader user was moving through a structure that no string in the
application ever named. The finding proposed the accessible *name*; that was declined
against `node-description.ts`'s own stated contract that the name is the authored title in
full and nothing else. Prefixing every name with its track makes a fifty-milestone list read
as fifty repetitions of three strings before any entry says what it is. The description is
read after the name and is where the other orientation facts already live, so track and
module sit beside the level — all three answer *where am I*.

**In narrow the two collapse into one per-node line.** Narrow has a single synthetic column
and so no header to carry the track, and §8.5 sorts the stack by
`(level, trackIndex, order, slug)` — so without it the track boundaries inside a level are
invisible in precisely the view §15.1 makes primary for assistive technology.

### Downstream

Amended **§9.2** (the structure sketch, and the two rules above), **§9.5** (the narrow
per-node line) and **§15.2** (the worked example and the track clause). Implemented in
**T08**'s renderer and `node-description.ts`; **T06** is untouched, which was the point of
decision 1. **S1** is unaffected and its evidence is now stronger: the three shapes still go
through one component with no shape branch, and the modular one no longer *looks* linear.

---

## A1 — §10.7 forbade the camera the interface is built on

**Verdict: amend.** 2026-08-16, T28.

§10.7 read **"No pan, no zoom, no camera"** and derived the phone concession from it: the
whole map fits the viewport at every size, and below a legibility threshold a domain list
substitutes. UI-SPEC §5.1 adopts a two-level stepped camera instead, both levels routes.

**This is the sharp one.** The other six amendments correct statements that are merely
stale; this one corrects a statement an implementer would read as normative **and obey**.
Someone building the map from `ARCHITECTURE.md` alone — which is exactly what every task doc
instructs — would have built a fixed single-level map and been correct to. That is why T28
gates T30 and why the amendment could not wait behind the code.

### Resolution

§10.7 is rewritten as *Navigation and the camera*: two levels, `/` at world and
`/d/<domainId>` at one region, every camera state a URL, browser Back as the breadcrumb and
no breadcrumb widget.

**Stepped rather than continuous is argued at its own site rather than by reference**, per
T26's discipline, because it is the claim most likely to be reopened. A single global
level-of-detail flag works over a 5× zoom range at 42 nodes; this library is projected at 164
and eventually 500, where one flag yields either a soup of labels or none. Scoping level 1 to
one domain bounds the labelled-hex count by the largest single domain — Making at 45 —
however large the library grows. **The bound is structural, not tuned**, which is the whole
argument, and a free camera does not have it at any amount of care.

Label sizes therefore become fixed world sizes with no per-zoom rules and no fade thresholds:
a domain label resolving to 22–28 px at level 0, a skill label to below 9 px at level 0 and
14–18 px at level 1. They are computed from world extent and `hexSize` at build time and
asserted, never hand-tuned — a hand-tuned size is the same global-flag failure wearing a
different hat. Outline weight steps 1.3 → 0.9 world units so strokes hold constant *screen*
weight rather than thickening with the camera.

### The list substitution moved, and that is a product fix

Old: substitute below a viewport threshold, so a phone visitor never saw the map. New: level
0 is the map on every device; level 1 substitutes the skill list on a phone. Eight labelled
regions genuinely fit a phone; skill hexes are where labels stop being legible and 44×44 px
targets stop fitting. Since the Curious Browser is disproportionately on a phone and the map
is the entire reason they might care (D25), the old threshold denied the map to precisely the
visitor it was meant to win. The §8.5 concession is unchanged in kind; it lands one level
deeper.

### Downstream

**T30** (the camera), **T31** (the level-1 layer and the phone list). §15.3's convergence
sentence depended on the old threshold and is **A5**. §13.1's route table is **A6**.

---

## A2 — the skill-hex sub-lattice, and the temptation to read it as an exception to D-08

**Verdict: amend.** 2026-08-16, T28.

Level 1 draws one hexagon per published tree, and nothing in the architecture knew where a
skill goes: `map.yaml` assigns tiles to *domains*, not skills to tiles. §10.1, §10.4 and
D-08 all needed the layer named.

### The amendment is a strengthening, and getting it backwards is the hazard

The wrong version of this edit reads *"the map now has a hex grid"*. It would reopen the
decision D-08 closed and hand a later implementer written permission to render 500 hexes at
level 0 — the exact outcome D-08 exists to prevent, arrived at by citing the amendment that
was supposed to preserve it.

So D-08 gains a **"Still live, and reinforced"** clause rather than an exception, making two
distinctions explicit. The layer draws for **one** region at level 1 only; level 0 remains
eight paths. And the layer exists *because* D-08 holds: the union is what keeps level 0 at
eight elements, and that headroom is the only reason a per-skill layer is affordable at all.
A map already spending several hundred elements on its regions would have nothing left to
spend here. The two lattices are also different objects — `map.yaml`'s authored grid still
has no runtime existence, while the sub-lattice is compiler-derived and is the coordinate
system for *skills* rather than for domains.

### The placement mechanism, and why both obvious answers are unavailable

**F13** (contributors never author layout coordinates) rules out a `tile:` field on a tree.
**N11** (a change to one thing shall not visibly reflow the rest) rules out deriving position
from subregion or facet tags — that clusters related skills beautifully and re-packs every
neighbour the moment one is added, which is N11's exact failure mode. Between them the
authored answer and the semantic answer are both gone, which is what makes this the one
genuinely new mechanism in the design.

§10.4 gains steps 5–7: subdivide at `hexSize / cellDivisor`, enumerate in a spiral from the
cell nearest the centroid, and assign the lowest-numbered free cell **append-only** into a
committed ledger, never recomputed. F13 is satisfied because nobody authors anything, and
**N11 is satisfied by construction rather than by care**. The ledger introduces no new
concept: §6.4 already runs a committed baseline with CI failing on unauthorized drift, for
milestone identifier stability (F41).

Three consequences are written down as correct rather than left to be rediscovered as bugs: a
retired skill **leaves a hole** (filling it would move whoever holds the next cell), a
domain change frees the old cell and takes a new one (safe *because* assignment is lowest-free
rather than by count), and editing a region's tiles reflows that domain — the one place N11 is
knowingly traded, for the ability to grow the map at all.

`cellDivisor` is recorded as **frozen at a region's first committed assignment**. Raising it
later renumbers the spiral and reflows every skill in that region, which is the precise
failure the ledger exists to prevent. UI-SPEC **Q2** must therefore be settled against the
real `map.yaml` before T29's first commit, not after.

### Downstream

**T29** owns the mechanism, **T31** draws it. **T30** must not treat the sub-lattice as
present at level 0.

---

## A2-D — T12's union keys cancellation on rounded floats, not lattice integers

**Verdict: defect, filed.** Found 2026-08-16 while landing A2. **Not fixed in T28.**

UI-SPEC §9 closes with a compiler correctness note: region corners must be held as **exact
integers on the hex lattice** — `(2q + r ± 1, 3r ± 1|2)` for pointy-top — and converted to
pixels only at emit. §10.4 step 1's "snapping to a shared vertex grid" is that rule, and it
had never been stated precisely enough to implement. T28's own hazard list says the shipped
implementation must be **checked, not assumed**.

**It was checked, and it does not hold.** `tools/src/compile/map.ts` computes corners in
pixels via `Math.sqrt(3)`, `Math.cos` and `Math.sin`, then keys interior-edge cancellation on
`Number(value.toFixed(6))` of those floats — the `toFixed` the note names by name. Its own
comment is candid about what it is doing: *"adjacent hexes compute their shared corners
through different arithmetic and land a few ULPs apart."*

**It passes today, and that is the point.** Rounding to 1e-6 does cancel correctly until some
true corner value falls near a rounding boundary and two tiles round to opposite sides of it;
that interior edge then survives as a stray boundary edge and the loop fails to close. The
trigger is the *content* — the tile coordinates and `hexSize` in `map.yaml` — so the failure
appears when a maintainer edits the map, not when the code is written, and it appears for
some regions and not others. In the UI-SPEC prototype over these same eight regions, **two of
the eight failed to close.** This is what "silently half-works" means, and it is why 303
passing tools tests are not evidence against it.

§10.4 now states the exact-integer rule and names the failure it prevents, so the spec is
correct. **The implementation is a T12 defect and is filed here rather than fixed quietly**,
per T28's scope: T28 changes documents, and a compiler change carried in a spec commit is
exactly the kind of edit that escapes review. It is not urgent — it is latent and content-
triggered — but it should be fixed before `map.yaml` is edited again, and A2's sub-lattice
gives it new reach, since the spiral is derived from the same polygon.

### Downstream

A **T12** defect. **T29** builds on `map.ts`'s polygon output and should not layer the
sub-lattice on top of float-keyed geometry without this closed first.

---

## A3 — fill was an opacity ramp, and §10.5 already contradicted itself about it

**Verdict: amend.** 2026-08-16, T28.

§10.5 encoded fill as "a clip rectangle rising from the region's base". UI-SPEC §4.3 calls
the water line the single most important rule in the design, and it was wrong in that
document's own first draft too — which is the strongest available evidence that the obvious
implementation is genuinely tempting rather than obviously bad.

### Resolution

The plate renders at **full strength at every score**; the score is a horizontal rule across
the region at height `1 − fill`, plate at full opacity below and at the open plate value
above, the line ruled in ink and clipped to the region path.

A domain at 18% is *a domain with a low water line*, not *a faded domain*. Because most
domains are low-scoring most of the time, opacity-as-fill drains the map of colour exactly
when the map is doing its job, destroying the per-region Lynch-districts identity F21 asks
for.

**The self-contradiction is the part worth recording.** §10.5 already required that "a
partly-filled region keeps its full-strength outline and label" — and an opacity ramp
violates that sentence, in the same section, four lines below the table asserting it. The
amendment did not introduce a new constraint so much as make the rest of the section agree
with a requirement it already carried. The SVG sketch is updated with it, since it named a
`region-fill` element that no longer exists.

`fill` itself is untouched: §11.6's concave `s/(s+k)` curve, never a raw percentage (F34).
Hue is identity and never encodes score, which is what makes the whole eight-hue palette
survive in both themes.

### Downstream

**T30** draws it, **T31** reuses it per skill hex (at `attainedLevel / 10`, linear — §11.6's
`k` is domain-level and does not transfer), **T34** takes the tokens. The glossary entry and
§11.6's `fill` rationale both described the clip rectangle and are updated.

---

## A4 — §17.1 had no font row

**Verdict: amend.** 2026-08-16, T28.

UI-SPEC §4.5 self-hosts one subsetted display face; §17.1's table had four rows and no
budget for it, so the first font added would have failed a gate that was right to fail.

### Resolution

A `Display face` row at ≤ 12 kB, and the total rises 70 → **82 kB**, renamed to
*JS + CSS + font* so the rows visibly sum to it. The face is affordable only because its
glyph set is closed at roughly forty glyphs, which is why subsetting is part of T27 rather
than a later optimisation.

**Raising a budget is the move this document should be most suspicious of**, so: it stays
enforced by failing, the rise is bounded by a stated glyph count rather than by whatever the
chosen face happens to weigh, and it is the only row added. §7's ajv rationale cited the old
70 kB figure and is updated with it, since a stale cross-reference to a budget is how a
budget quietly stops meaning anything.

### Downstream

**T27** implements the row in `tools/src/ci/budget.ts` and picks the face (UI-SPEC **Q1**).

---

## A5 — §15.3's convergence claim, restated rather than deleted

**Verdict: amend.** 2026-08-16, T28.

§15.3 read that below the legibility threshold the map is replaced by a list, "so the
small-viewport experience and the screen-reader experience converge rather than diverging."
A1 moves the substitution to camera level 1, and the sentence as written stops being true at
level 0: the phone now gets the map while the screen reader gets the region list.

**The tempting wrong answer is deletion**, and it is tempting because the sentence is
literally false after A1. But it is the only place in the spec asserting that the two
accessible surfaces carry the same content in the same order, and **N5 depends on that
assertion**, not on the two surfaces looking alike. Deleting it would remove a live
requirement on the grounds that its justification had changed.

### Resolution

The claim is rewritten to assert the property that is actually load-bearing: *the same
content in the same order*, not *the same view*. At level 1 both surfaces get the skill list
and converge outright. At level 0 they differ in form, but every channel a region carries is
present in both, in the same documented order. The rewrite names A1's threshold move as the
reason, so a later reader does not re-derive the false version from the old premise.

### Downstream

**T31** (the phone list must carry the same channels in the same order as the region list),
**T35** (verification across the composed surface).

---

## A6 — `/d/<domainId>` was a separate page

**Verdict: amend.** 2026-08-16, T28.

§13.1 routed `/d/<domainId>` to a "Domain skill listing" and §13.4 composed it as
`DomainListing → SkillCard[]`. Under A1 it is camera level 1 over the *same* rendered
surface, which is what makes entering a domain an animation rather than a navigation.

### Resolution

Both routes stay prerendered — eight prerendered documents, one per domain — so a cold
arrival at a domain URL paints the same first frame as an arrival at `/` and the two differ
only in where the camera rests. **Prerendering and "not a separate page" are not in
tension**, and the amendment says so explicitly, because the natural misreading is that a
camera state cannot be prerendered and the route should become client-only. That would cost
the domain URLs their first paint for no benefit.

§13.4's tree is rewritten to one `MapSurface` under two routes, with `SkillList` as the
phone substitution at level 1.

### The layout gains four controls, and they are not decoration

`+layout` takes the **sidebar** (replacing the top nav, which is what gives the map its
vertical extent back), **Find**, **Info**, and the **next-step card**. They live in the
layout precisely because they must survive a camera move, which both routes sharing a layout
delivers for free.

Two are load-bearing rather than convenience. **Find** highlights in place and never moves
the camera, which is what lets it double as the only filter UI in the application — and its
match count is exposed as text, since a highlight existing only visually is the colour-only
encoding N5 forbids. **Info** carries the legend, which is the only place the water line's
meaning is written down at all, given that F34 forbids showing the percentage. "No legend"
was also the most concrete criticism the prior-art review returned.

### Downstream

**T30** (the shared surface), **T32** (sidebar and next-step card), **T33** (Find and Info).
PRD **D28** is adopted by this amendment and is recorded as such in §19.4.

---

## A7 — `domains.yaml`'s palette had one theme

**Verdict: amend.** 2026-08-16, T28.

§5.9's `palette: { base, accent }` predates a dark theme. UI-SPEC §4.2 gives one pair per
domain per theme.

### Resolution

`palette` becomes `{ light: { base, accent }, dark: { base, accent } }`. Additive, and the
reader change is mechanical.

**The question the amendment actually settles is where the second palette lives**, not what
shape it takes. A parallel CSS table would have been less work and is the wrong answer: hue
is identity and must never encode score (§10.5), which only works if hue has exactly one
source, and `domains.yaml` is already that source since the map renderer reads it today. Two
sources drift, and they drift silently — the failure is a domain whose dark hue is stale, not
an error. Keeping it here means a domain added to the file arrives with both themes or fails
its schema.

**Nothing derives dark from light at runtime.** The separations that keep eight hues distinct
— Mind teal against Work navy, Home blue-green against Outdoors olive — are hand-chosen and
do not survive an algorithmic transform, so both pairs are authored.

### Downstream

**T27** owns the schema change, the migration of existing readers, and the real colours. Note
UI-SPEC §4.2 tabulates one hex per domain per theme while `palette` carries `{ base,
accent }`: **the `accent` half has no answer yet** and must not be silently filled from the
current values, which belong to the superseded direction.

---

## Also recorded

**PRD D28 — the domain view as a map rather than a list** (§19.4). **Adopted 2026-08-16 by
A6**; the note below is kept as the record of how it was priced before it was accepted, and
every cost it named was paid rather than avoided. Raised by the
owner during F1's resolution and logged rather than folded in, since it is new design
rather than reconciliation. `/d/<domainId>` is currently a listing and §10.7 rules out
pan and zoom; the alternative is a two-level map where a domain opens into its skills
laid out as nodes with per-skill fill, plus a hide-unstarted filter and search. Priced
in §19.4: a second layout engine, a new route, and tree-placement geometry. Per-skill
fill would be `attainedLevel / 10` — linear, bounded, and needing no `k`. Not v1.
