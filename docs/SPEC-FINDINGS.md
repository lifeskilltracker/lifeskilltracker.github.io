# Spec Findings — Architecture Reconciliation

Decision record for T26. Fifteen findings were raised against `docs/ARCHITECTURE.md`
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
| F8 | — | — | pending |
| F9 | — | — | pending |
| F10 | — | — | pending |
| F11 | — | — | pending |
| F12 | — | — | pending |
| F13 | — | — | pending |
| F14 | — | — | pending |
| F15 | — | — | pending |

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

## Also recorded

**PRD D28 — the domain view as a map rather than a list** (§19.4). Raised by the
owner during F1's resolution and logged rather than folded in, since it is new design
rather than reconciliation. `/d/<domainId>` is currently a listing and §10.7 rules out
pan and zoom; the alternative is a two-level map where a domain opens into its skills
laid out as nodes with per-skill fill, plus a hide-unstarted filter and search. Priced
in §19.4: a second layout engine, a new route, and tree-placement geometry. Per-skill
fill would be `attainedLevel / 10` — linear, bounded, and needing no `k`. Not v1.
