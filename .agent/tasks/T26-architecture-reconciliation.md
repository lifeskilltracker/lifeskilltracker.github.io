# T26 — Architecture spec reconciliation

| Field | Value |
|---|---|
| **Status** | in progress — F1, F2 resolved 2026-08-05; F3–F17 open |
| **Phase** | 0 |
| **Cluster** | judgment |
| **Blocked by** | — |
| **Blocks** | T02, T04, T07, T08, T09, T10, T11, T12, T16, T17, T23 |
| **Spec** | ARCHITECTURE §4.4, §6.1, §6.2, §6.4, §7.2, §7.4, §9.3, §10.3, §11.5, §11.6, §11.9, §12.2, §12.5, §12.6, §12.7, §14.2, §14.4, §14.5, §16.1, §16.4 |
| **PRD** | — |

## Goal

`docs/ARCHITECTURE.md` no longer contradicts itself on any point an implementer must
act on. Seventeen findings raised during task decomposition are each resolved — amended in
the spec, or recorded as a deliberate tolerance with the consequence stated. After this
task, no downstream task doc contains the phrase "the spec is silent on".

## Why this shape

These were not found by review; they were found by trying to write implementable task
documents against the spec and discovering that several sections could not be
implemented as written. That is the cheapest moment to catch them and the most expensive
moment to skip them — several of the seventeen block tasks near the front of the critical
path (F9 blocks T02 and T04; F16 blocks T08 and T10, which are the Phase 0 gate itself),
and two of them (F1, F2) would be discovered mid-implementation as a failing property
test or a missing object store, at which point the fix is a schema migration rather than
a prose edit. This is the architecture-side sibling of T00, which does the same job for
the PRD.

## Scope

**In scope** — seventeen findings, each needing a verdict. F16 and F17 were appended
2026-08-05 by the wave-2 task-doc pass and verified against the spec by the orchestrator:

**F1 — Invariant 4 is false against the shipped constants. ✅ RESOLVED 2026-08-05 —
amend.** §11.9 made `Δfill(0→1) ≥ Δfill(L→L+1)` an executable property test while §11.6
shipped `p = 1.25` at `k = 8`, ~5% over the boundary of 1.193. Resolution investigation
found the breach was **14%, not 5%** — §11.6's claim that the ×2 table `[2,5,…,36]` at
`k = 16` is "the identical curve" is false, because `2 × 2^1.25 = 4.757` rounds *up* to 5,
inflating exactly the step the invariant is tightest on. **Adopted:** `k = 6` with the
table scaled ×8 — `[8, 19, 32, 45, 60, 75, 91, 108, 125, 142]`, `fill = s/(s+48)` — which
clears the constraint strictly (1.25 ≤ 1.263) and keeps the R-19 depth premium intact.
The table is normative and `p` is provenance; **invariant 4 is asserted against the
shipped integers, never against `L^p`**, which is the clause that would have caught the
original defect. Verified numerically: Δ = 14.29, 14.07, 11.64, 8.39, 7.17, 5.42, 4.49,
3.76, 3.02, 2.48 — strictly decreasing, maximum first. See `docs/SPEC-FINDINGS.md` F1.

**F2 — Grandfathering (D-19) is unimplementable as specified. ✅ RESOLVED 2026-08-05 —
amend.** §11.5 required a per-level frozen record that nothing in the spec could hold, so
invariant 7 was unfalsifiable. **Adopted:** freeze the *satisfying uid set* on the skill
row as `SKILL.grandfathered: { [level]: { uids, contentVersion } }`, with
`satisfied(L) = evaluated(L) || frozen[L].uids.every(complete)`. `TreeProgress` widens to
`{ milestones, grandfathered }`, keeping `scoreSkill`'s arity at two; `LevelProgress`
gains `grandfathered` and `satisfiedBy`. The engine stays pure — it reports `satisfiedBy`,
the store freezes and writes, preserving §3.2. Three riders, each of which silently breaks
D-19 if skipped: the write in §12.4's transaction, §12.5 lineage migration (`retired` uids
are **removed from** frozen sets, not orphaned), and export in §12.6 (merged earliest-
`contentVersion`-wins). See `docs/SPEC-FINDINGS.md` F2.

**F3 — Six named types are used and never defined.** `TierName`, `DomainScore` and
`Taxonomy` appear only at use sites in §14.4; `MigrationReport`, `ImportReport` and
`ExportFile` only at use sites in §14.5. `DomainId` is trivially inferable and
`ExportFile` is recoverable from §12.6's worked example; the other five are not.
`DomainScore`'s field list is only reconstructable from §11.6, §11.7 and §10.5, and
`TierName` says nothing about the `attainedLevel: 0` case. *Decide:* the definitions.
Stubbing any of them as `unknown` is not a resolution. **Blocks T02, T16, T17.**

**F4 — `domainScores` cannot produce recency.** §11.7 requires `lastActivityAt` rolled up
per domain as a maximum, but the signature's `skills` rows carry only
`{ treeId, domain, attainedLevel }`. *Decide:* extend the row type, or move recency
rollup out of the Scoring Engine. **Blocks T11, T13.**

**F5 — §14.4's monotonicity clause is vestigial.** It exempts "the explicitly decaying
recency channel", but D-20 ships a date with no decay and R-20 defers the graded channel
to phase 2. The exemption currently protects nothing and invites an implementer to build
the decay. *Decide:* strike the clause, or reinstate it conditionally against R-20.
Adjacent to T00's R-24.

**F6 — §6.4's baseline ref contradicts itself.** The section opens by checking out tree
files "as of the **last release tag**" and closes with "**the baseline is `main`**".
§6.5's CI graph says "vs last tag". §16.1 and §16.2 describe merge-to-`main` as the
entire release process with no tagging step anywhere, so "last release tag" has no
referent in the spec. *Decide:* `main` as the operative baseline (and fix §6.4's opening
plus §6.5's node label), or introduce release tagging into §16. **Blocks T23.**

**F7 — §6.2 rule 15 needs git history, which §6.4 owns.** Rule 15 requires every
`lineage` entry to reference a uid that existed in the published tree — a baseline
comparison, assigned to `lst validate` while §6.4's near-identical comparison is assigned
to `lst baseline`. §6.5 runs them as separate parallel jobs. *Decide:* whether the
comparison primitive is shared, and which subcommand owns it. Affects T03 and T23.

**F8 — `contentVersion` has no increment mechanism, and its scope is never stated.** Two
defects in one field. First: §16.1 says it increments on every merge touching `content/`;
§7.2 shows it in the manifest; `lst compile` emits it as a build step with no counter
source named, and a build step has no notion of "a merge". Second: §16.1 and §7.2 imply a
**global** counter while §8.6's memo key and §12.5's trigger read it as though it were
**per-tree** — never stated outright either way. If it is global, every content release
invalidates every tree's layout memo and fires §12.5's migration pass on every started
tree, including trees nothing changed in. This is not cosmetic: §12.5's entire pass
triggers on `contentVersion > contentVersionSeen`, so getting either half wrong means
migrations that never run, or run on every load. *Decide:* the source of truth and the
scope. **Blocks T04, T07, T17.**

**F10 — §7.4 ships a service worker that §16.4 defers to phase 2.** §7.4's closing
paragraph specifies the `@vite-pwa/sveltekit` service worker as part of the Content
Loader; §16.4's phase diagram puts "PWA / offline hardening" in phase 2. The task
breakdown resolves for §16.4, and the consequence must be accepted explicitly rather than
discovered: **without shell precaching, §4.4's fix for GitHub Pages' 404-status deep links
does not land in v1**, and §16.3's "so a stale service-worker entry self-heals on retry"
assumes machinery that will not exist. *Decide:* accept the v1 gap and amend §7.4 and
§16.3's wording, or promote the service worker into v1. **Blocks T07.**

**F11 — `pin()` has no caller.** §7.4 pins a bundle when the user starts a skill, but
`pin()` lives on the Content Loader (§14.2) and `startSkill()` on the User State Store
(§14.5), and no section says what joins them. §14.1's graph routes both through
`routes/`, which makes the shell the only legal seam, but this is inference rather than
specification. *Decide:* name the seam. **Blocks T07.**

**F12 — §12.6's merge rule covers milestones only.** "Union by `uid`, newest `at` wins"
has no analogue for the `skills` array (which has no `at` field — `startedAt` and
`lastActivityAt` are both candidates and mean different things) or for `orphans`. Import
is the flow F38's two-device story depends on, so the gap is reachable in ordinary use.
*Decide:* the rule for both arrays. **Blocks T16.**

**F13 — `moved` has a reachability hole.** A `moved` lineage entry lives in the *source*
tree's bundle, so a record only follows its uid if the user reopens the tree the milestone
left. A user who never reopens it keeps the record on the stale `treeId`, and the
destination tree's "uid in neither bundle nor lineage" row would orphan it as `unknown` —
the opposite of what §12.5 intends. *Decide:* scope the unknown-row strictly to matching
`treeId` (the conservative reading, which leaves the record stale but intact), or give
`moved` a manifest-level index so it applies without opening the source tree.
**Blocks T17.**

**F14 — §12.5 never states whether the migration pass is replay-safe.** A user who skips
several content versions runs one pass against the latest bundle's accumulated `lineage`,
not a sequence of passes. Whether the dispositions compose correctly under that — a
`split` whose successors were later `merged`, for instance — is unaddressed. *Decide:*
state the guarantee and the ordering rule. **Blocks T17.**

**F15 — a cluster of small omissions**, each cheap to fix and each capable of costing an
afternoon if hit cold:
- §4.4 cross-references "§7.3, which treats manifest freshness explicitly". §7.3 is the
  compiler's transformation table; freshness is §7.1 and §7.4.
- `MILESTONE.contentVersion` is declared in §12.2's ER diagram and consumed nowhere.
- `ORPHAN` carries no `slug` while `MILESTONE` does. Probably intentional per §12.5's
  "title, timestamp, and note", but unstated.
- §12.7 does not say where the export-prompt dismissal flag lives. Persisting it naively
  silences all three triggers permanently.
- §12.7's "more than thirty days since the last export **with new activity since**" never
  defines new activity.
- §12.7's 60%-of-quota trigger cannot fire in phase 1 given §17.4's sub-1 MB budget.
  Harmless, but it should be labelled phase-2 rather than read as live.

**F9 — the compiled-bundle shape is unenforced across the workspace boundary.** §4.2
forbids `tools/ → app/`, and §14.6 declares the compiled bundle "internal" with no
schema. T02 therefore places the hand-written `CompiledTree` types in `app/`, where the
compiler that produces the JSON cannot import them. The two can drift with nothing
catching it. *Decide:* add a compiled-bundle JSON Schema under `schema/` — "internal"
means unversioned, not unspecified — or enforce parity with shared fixtures.
**Blocks T02, T04.**

**F16 — §9.3 requires the Scoring Engine in a phase §16.4 says has no scoring.** §9.3
opens: "Five presentational states. Four come from the Scoring Engine (§11.4);
`dismissed` comes from user state directly." §16.4 places TreeView (A5) inside Phase 0
and closes: the skeleton "deliberately has no map, **no scoring**, and no export" — the
Scoring Engine is B1, the *first* Phase 1 item. §16.4 also requires the Phase 0 tree to
be "authored, validated, compiled, laid out, rendered, and completable", which cannot be
shown without `complete`, `available`, and `locked`. So the walking skeleton must render
four states whose only specified producer the phase diagram defers to the next phase.
This is the same class as F10 (a section assuming a module §16.4 defers) with a
different subject, and it cannot be resolved in the task graph: T08 → T10 → T11 is
already an edge, so making T08 depend on T11 creates a cycle. *Decide:* name the Phase 0
node-state source — a prerequisite-only derivation living with the Layout Engine, a
scoring slice pulled forward into Phase 0, or an explicit statement that the Phase 0
gate renders `complete`/`locked` only. **Blocks T08, T10.**

**F17 — §10.3's five geometry invariants are "Validated by CI" with no owner.** §10.3
closes: "Validated by CI: every domain in `domains.yaml` has a region; no tile is claimed
twice; each region is contiguous; subregion tiles partition their parent's tiles exactly;
subregions appear only under `making`." Nothing owns those checks. §6.1's subcommand
table scopes `lst validate` to "Schema + semantic rules (F41)"; §6.2's fifteen semantic
rules are entirely `tree.yaml`-scoped; §6.5's job graph names no map job; and §5.9 hands
the file off with "`map.yaml` assigns hex tiles to domains and is specified in §10.3",
closing the loop without assigning it. Three of the five are contiguity and partition
checks that JSON Schema cannot express, so §6.2 layer 1 does not silently cover them.
Note this is the *only* occurrence of the phrase "Validated by CI" in the spec — there is
no established pattern to read it against. *Decide:* extend `lst validate` to taxonomy
files, or make it part of `lst compile`'s map build step (§10.4), and name it in §6.1.
**Blocks T12.**

**Out of scope**

- PRD amendments — T00. F1 and F5 are adjacent to R-25 and R-24 respectively, and doing
  both tasks in one sitting is sensible, but the documents and the decision-makers differ.
- Schema changes driven by phase-0 experience — T10. This task fixes the spec's internal
  contradictions; T10 fixes what building against it revealed.
- Anything found by the runtime-io cluster after this document was written. Append; do not
  start a second reconciliation task.

## Deliverables

```
docs/ARCHITECTURE.md    the seventeen findings resolved in place
docs/SPEC-FINDINGS.md   the decision record: finding, verdict, reason, date
```

## Interface contract

Three findings change contracts other tasks are written against. When resolved, the
amended forms must be propagated into the affected task documents in the same commit —
otherwise the task docs become the new stale copy:

```ts
// F2 — scoreSkill's signature, if grandfathering enters the engine
export function scoreSkill(tree: CompiledTree, progress: TreeProgress): SkillProgress;

// F4 — the domainScores skills row
skills: ReadonlyArray<{ treeId: string; domain: DomainId; attainedLevel: number }>

// F3 — TierName, DomainScore, Taxonomy: definitions do not currently exist
```

## Acceptance criteria

- [ ] `docs/SPEC-FINDINGS.md` records all seventeen findings with a verdict of *amend*,
      *tolerate*, or *not a defect*, each with a reason and a date.
- [ ] F1: §11.6's table and §11.9's invariant 4 agree. Verified by computing
      Δfill(0→1) and Δfill(1→2) from the shipped constants and checking the invariant
      holds, or by the invariant's text admitting the margin.
- [ ] F2: §12.2 has a place to store per-level frozen satisfaction, §14.4's signature can
      reach it, and §12.6 states whether it is exported.
- [ ] F3: `TierName`, `DomainScore`, and `Taxonomy` are defined in the spec, including
      the `attainedLevel: 0` case for `TierName`.
- [ ] F4: recency rollup has a stated home and the types support it.
- [ ] F5: §14.4's monotonicity clause matches D-20's shipped behaviour.
- [ ] F6: §6.4's opening, §6.4's closing, and §6.5's job label all name the same baseline.
- [ ] F7: exactly one subcommand owns the baseline comparison primitive, and both §6.2
      rule 15 and §6.4 reference it.
- [ ] F8: `contentVersion`'s source is named and is reproducible in a local build, not
      only in CI.
- [ ] F9: either `schema/` contains a compiled-bundle schema, or a fixture parity test is
      specified with an owning task.
- [ ] F10: §7.4 and §16.3 no longer assume a service worker that v1 does not ship, and
      §4.4's offline deep-link consequence is stated wherever the gap is accepted.
- [ ] F11: exactly one component is named as the caller of `pin()`, and it is one §14.1
      permits.
- [ ] F12: §12.6 states a merge rule for `skills` and for `orphans`, not only milestones.
- [ ] F13: §12.5's unknown-uid row and its `moved` row cannot both claim the same record.
      Verified by a fixture where a milestone moves and the source tree is never reopened.
- [ ] F14: §12.5 states whether the pass is replay-safe across skipped content versions,
      and the ordering rule for composing dispositions.
- [ ] F15: every item in the cluster is either fixed in the spec or recorded as tolerated.
- [ ] F16: §9.3 and §16.4 agree on what produces node state in Phase 0. Verified by
      reading §16.4's Phase 0 prose and confirming that every state T10's gate requires
      has a named producer scheduled no later than T08.
- [ ] F17: §6.1's subcommand table names the command that validates `map.yaml`, and
      §10.3's "Validated by CI" sentence points at it. Verified by
      `grep -n "map.yaml" docs/ARCHITECTURE.md` returning a §6 hit.
- [ ] Every affected task doc under `.agent/tasks/` is updated to match the resolutions,
      and `grep -ril "spec is silent\|unresolved spec gap" .agent/tasks/` returns nothing.

## Verification

```bash
grep -n "last release tag\|baseline is .main." docs/ARCHITECTURE.md   # must agree
grep -rn "TierName\|DomainScore\|Taxonomy" docs/ARCHITECTURE.md       # must find definitions
grep -ril "unresolved spec gap" .agent/tasks/                          # must be empty
```

## Notes and hazards

- **None of these were found by reading the spec.** They surfaced from trying to write
  implementable tasks against it, which is why a tenth and eleventh may yet appear during
  T05 and T08. Treat the findings file as append-only and keep resolving in place rather
  than opening successor tasks.
- **F2 is the expensive one.** It is the only finding that changes a persisted schema, and
  §12.2's stores are written in T09 and read forever after. Resolving it after T09 ships
  means a migration; resolving it before means a field.
- **F1 has a tempting wrong answer.** Retuning `p` alone, or `k` alone, is precisely the
  mistake §11.6's coupling constraint and §11.9's invariant 4 exist to catch. Whichever
  verdict is taken, re-check the other constant against `p ≤ log₂(2k/(k−1))`.
- **Do not treat these as licence to redesign.** Every finding above is a place where the
  spec disagrees with itself or omits something an implementer must have. A section that
  is merely arguable is not on this list, and adding one would turn a reconciliation pass
  into a rewrite.
