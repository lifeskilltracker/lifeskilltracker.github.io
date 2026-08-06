# RESUME — T26 spec reconciliation, wave 2

Handoff written 2026-08-05, superseding the wave-2 task-doc handoff (that work is done).
Updated 2026-08-06 after Group I. Read this, then `_BREAKDOWN.yaml`, then
`T26-architecture-reconciliation.md`.

# SESSION 7 — Group I (F19, F22, F24, F25, F26). T26 is now 24 of 26.

**Only F15 and F18 remain open, and neither blocks the critical path the way the rest did.**
F15 is seven mechanical citation and wording fixes — cheap, delegable, no owner call needed.
**F18 still needs the owner**: the fill band vocabulary is a content call that may belong in
the PRD, and it must also rename "tier" at the domain level. Do not derive it.

- **F25** — §6.2 gains **rule 16** (every milestone and mastery entry carries a `uid`) and
`lst ids` **stops gating**; it is the fix, not the gate. The half the finding never asked
about is the one that matters: **it cannot be a layer-1 `required` field**, because §5.4's
authoring flow has the author write a tree with *no `uid` lines at all* and a required field
would make that draft unparseable by `lst ids`. Rule 2 does not cover it either — uniqueness
ranges over the uids that exist. The rule count is now **16** everywhere, including §6.5's
node label and five task docs.
- **F19** — `SKILL.lastActivityAt` was typed three contradictory ways (§12.2 required,
`DomainSkillRow` optional, `ExportFile` optional) and `startSkill` never wrote it at all.
**`startSkill` now seeds it from `startedAt`**, the field is total, both `?` are gone, and
§11.7's null branch narrows to "a domain with no started skills". Un-checking counts as
activity — the spec already depended on it, since §11.9 and §14.4 both argue monotonicity
from "every mutation". **Two riders it did not ask about:** no migration may write it (a fold
that bumped it would refresh every user's map to the day of the content release — the
fabricated date §11.7 forbids), and it is a **forward-only watermark, never a `max` over
records**, because un-completing the most recent milestone lowers that maximum and breaks
invariant 1.
- **F26** — `store.reconcileAttainedLevel(treeId, attainedLevel): Promise<boolean>`, called
by the **tree route** after `applyLineage`. It takes a number, not a bundle: §14.1 gives
`lib/state` no edge to the loader *or* to `lib/scoring`. **Ordering was the rider** —
`MigrationReport.attainedLevel.after` is already on screen when the migration ran, so a
reconcile writing a different number would contradict a statement the user is reading.
- **F24** — **the finding's severity was wrong and research caught it.** `content: baseline`
is not path-filtered and §6.4 check 5 compiles both sides, so `lst compile` *was* running on
content-only PRs; three of the four "ungated" claims were false. The real defect was that the
gate was unnamed, incidental (a side effect of F8's check, one day old) and contradicted by
§6.1 — plus the fact that **a skipped required check reports as passing**, so `build` was
*green* while unenforced. **Adopted:** split into `content: compile` (needs validate only,
never skips) and `app: build` (needs the app jobs, legitimately skips). **Seven gating jobs**
— F8's "the six-job count is unchanged" note in T25 is now stale. `app: build` recompiles
rather than taking an artifact, which promotes T04's byte-determinism criterion from hygiene
to CI correctness. Both spec-named options were declined because they make content PRs pay
for `vite build`, destroying the "completes in seconds" property the path filter exists for.
- **F22** — **the pivotal question inverted the hypothesis.** Tree deletion is *not* forbidden
and §6.4 would not catch it: check 1's escape hatch is "appears in `lineage`", and the ledger
is a field of the file being deleted. **A ledger cannot dispose of its own file.** Checks 1–7
diff each tree against its own baseline version, so a deleted tree is never visited — they
pass on nothing. Nor is there a workaround: §5.3's ten levels × §6.2's 4–8 bound make an
emptied stub *inexpressible*. **Adopted:** §6.4 **check 8** (the baseline's tree-id set is a
subset of the head's — forbids removal *and* rename) plus a **runtime retention rule** (a
`SKILL` row with no manifest entry is retained, excluded from the join, never scored, listed
on `/data`). A `retired` flag was priced and **deferred to R-27** — it needs a conditional
carve-out from the 4–8 bound and makes the manifest grow forever. An F13-style
`retiredTrees` map was rejected outright: the analogy fails because no disposition exists to
be made reachable, so it could only orphan everything wholesale. **Zero new store methods,
zero cold-start cost, no schema change.**

### Eight defects folded in, two left unfiled

Per the owner's direction, F27–F31 were folded into F22 rather than appended: **tree `id`
had no immutability guarantee** (arguably F22's root cause — it is a PK in three stores, the
`moved` map, every export row and the URL space, and D-05 gave it no uid/slug split);
§6.4 **never diffed the tree set**; the **`moved` map had no durability guarantee** (rebuilt
from live tree files each build, so a deletion silently undoes F13); **import can create a
`SKILL` row for an unknown `treeId`** and §16.3 had no row for it; and **a tree cannot be
legally emptied**. Three more folded into F24: T25's hazard note **stated the opposite of
F24 as settled fact**, "path filter" was never disambiguated (workflow-level blocks the PR in
Pending forever; job-level reports skipped), and §6.5's "trio" undercounted by two.

**Two were deliberately left unfiled** and are the obvious candidates if a future session
wants them: **nothing gates manifest-level compiled output** (check 5 is scoped to *trees*,
so a PR touching only `map.yaml` changes the deployed manifest and is compared by nothing;
§17.2's manifest budget also has no named enforcer), and **§12.4's "the only writer in the
system"** overclaimed against §14.5's several mutators — narrowed in passing to "the only
writer of a `MILESTONE` record", but §3.2's single-writer story deserves a proper pass.

### No edge changes

Group I touched no `blocked_by`/`blocks` edge, but the surface change is the largest since
Group C and lands on eight task docs. All eight are updated. The riders most likely to be
dropped on the floor: **check 8 is T23's** and is the only F22 edit outside the tasks F22 was
filed against; **the reconcile's ordering after `applyLineage`** spans T09, T14 and T17 with
nothing in the graph expressing it; and **`app: build` recompiling** makes a T04 acceptance
criterion load-bearing for T25's correctness.


## Where things stand

**All 27 task docs written** (`5c69e91`). **T26 is the front of the critical path** and is
now 19 of 26 findings resolved — the count grew again because Group G found one more.

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
  `T11-scoring-engine.md`'s "roll-up is a store concern" was unimplementable and is gone.
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

## Step 1 — the T11 split is the one loose end

`_BREAKDOWN.yaml` now has **T11a** and **T11b** rows, both `status: pending`, and every
edge in the graph is rewired to them. But `T11-scoring-engine.md` still covers all of §11
and carries a `**SUPERSEDED**` header row. Split it into:

- `T11a-scoring-tree-local.md` — §11.1–§11.4, §14.4. Phase 0. Blocked by T02, T26.
  Blocks T08. This is what unblocks the Phase 0 gate, so it is the higher priority.
- `T11b-scoring-aggregation.md` — §11.5–§11.9, §14.4. Phase 1. Blocked by T10, T26.
  Blocks T13, T14, T15, T17, T19.

Nothing in the existing document is wrong — only its phase assignment and blocking edges.
Set both rows to `status: written` when done.

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

- **T15 is deliberately incomplete.** Written rule-agnostic; its criteria naming "the
  chosen rule" must be rewritten once T00 resolves PRD D20.
- **T26's F1 and F2 needed the user's judgment** and got it. The rest are mostly delegable,
  but F6 (which baseline ref) is a maintainer preference, not a derivation — and **F18's
  band names are the same kind of call**, plus they may belong in the PRD.
- **The T11 split is still step 1, and Group B added to it.** `T11-scoring-engine.md` now
  carries the F3/F4/F5 amendments; when it splits, `DomainSkillRow`, `DomainScore` and both
  rollups go to **T11b**, and `TierName | null` goes to **T11a** (every skill starts at
  `attained: 0`, so the null case is phase 0).
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
- **The coherence pass across all 27 docs has not been done.** Contradictions between docs
  that touch the same file or store, `Out of scope` items naming tasks that exist,
  `blocked_by`/`blocks` symmetry. The T11a/T11b rewiring in this session is the kind of
  thing it would catch.
