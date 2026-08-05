# Spec Findings — Architecture Reconciliation

Decision record for T26. Seventeen findings were raised against `docs/ARCHITECTURE.md`
during the v1 task breakdown. Each gets a verdict of **amend**, **tolerate**, or
**not a defect**, with a reason and a date.

This file is the audit trail. The resolutions themselves live in the spec.

| # | Verdict | Date | Summary |
|---|---|---|---|
| F1 | amend | 2026-08-05 | `k = 6`, `p = 1.25`, table ×8; invariant 4 asserted against the table |
| F2 | amend | 2026-08-05 | `SKILL.grandfathered` holds frozen uid sets; exported and lineage-migrated |
| F3 | — | — | pending |
| F4 | — | — | pending |
| F5 | — | — | pending |
| F6 | — | — | pending |
| F7 | — | — | pending |
| F8 | amend | 2026-08-05 | `contentVersion` is per-tree and authored; the global counter is deleted |
| F9 | amend | 2026-08-05 | `schema/{compiled-tree,manifest}.schema.json`; build-time and codegen only |
| F10 | amend | 2026-08-05 | Service worker → phase 2; pinning moves in-page; gap is R-26 |
| F11 | amend | 2026-08-05 | `lib/actions` is the seam; pinning is best-effort |
| F12 | — | — | pending |
| F13 | — | — | pending |
| F14 | — | — | pending |
| F15 | — | — | pending |
| F16 | amend | 2026-08-05 | §11 splits at §11.5; §11.1–§11.4 ship in phase 0 |
| F17 | — | — | pending |

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

## Also recorded

**PRD D28 — the domain view as a map rather than a list** (§19.4). Raised by the
owner during F1's resolution and logged rather than folded in, since it is new design
rather than reconciliation. `/d/<domainId>` is currently a listing and §10.7 rules out
pan and zoom; the alternative is a two-level map where a domain opens into its skills
laid out as nodes with per-skill fill, plus a hide-unstarted filter and search. Priced
in §19.4: a second layout engine, a new route, and tree-placement geometry. Per-skill
fill would be `attainedLevel / 10` — linear, bounded, and needing no `k`. Not v1.
