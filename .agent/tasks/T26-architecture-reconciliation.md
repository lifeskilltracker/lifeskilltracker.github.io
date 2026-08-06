# T26 — Architecture spec reconciliation

| Field | Value |
|---|---|
| **Status** | **complete** — all twenty-six findings resolved. F1–F14, F16, F17, F20, F21, F23 on 2026-08-05; F15, F18, F19, F22, F24, F25, F26 on 2026-08-06 |
| **Phase** | 0 |
| **Cluster** | judgment |
| **Blocked by** | — |
| **Blocks** | T02, T04, T07, T08, T09, T10, T11, T12, T16, T17, T23 |
| **Spec** | ARCHITECTURE §4.4, §6.1, §6.2, §6.4, §7.2, §7.4, §9.3, §10.3, §11.5, §11.6, §11.9, §12.2, §12.5, §12.6, §12.7, §14.2, §14.4, §14.5, §16.1, §16.4 |
| **PRD** | — |

## Goal

`docs/ARCHITECTURE.md` no longer contradicts itself on any point an implementer must
act on. Twenty-six findings — seventeen raised during task decomposition, F18 and F19
found while resolving F3 and F4, F20–F23 found while resolving F12–F14, F24–F25 found
while resolving F17 and F7, and F26 found while resolving F23 — are each resolved: amended in
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

**In scope** — twenty-six findings, each needing a verdict. F16 and F17 were appended
2026-08-05 by the wave-2 task-doc pass and verified against the spec by the orchestrator;
F18 and F19 were appended 2026-08-05 by the F3/F4/F5 pass, F20–F23 by the F12/F13/F14
pass, F24–F25 by the F6/F7/F17 pass, and F26 by the F20/F21/F23 pass — seven of those
still unresolved:

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

**F3 — Six named types are used and never defined. ✅ RESOLVED 2026-08-05 — amend.**
`TierName`, `DomainScore`, `Taxonomy` (§14.4) and `MigrationReport`, `ImportReport`,
`ExportFile` (§14.5) appeared only at use sites, and four task docs independently recorded
"defined nowhere — do not stub as `unknown`". **Adopted:** all six defined, plus `DomainId`
and `OrphanReason`. Two are recoveries rather than inventions: **`Taxonomy` is
`Manifest['taxonomy']`** — §7.2's manifest already carries it and F9 made the manifest
schema normative, so hand-writing a parallel interface would re-create the drift F9 closed
— and `ExportFile` is a transcription of §12.6's worked example. **`tier` is
`TierName | null`, null exactly at `attainedLevel: 0`**, displayed as "Level 0 — not yet
ranked"; a sixth `'Unranked'` name was declined because `TierName` is F7's vocabulary,
defined in §2 as pairs of levels 1–10. Two riders fell out of typing the reports:
`OrphanReason` has a third member `merged` (§12.5's merge row produces an orphan and never
names its reason, and folding it into `unknown` would make R-16's accepted loss
indistinguishable from an unaccountable record), and `MigrationReport` carries
`attainedLevel` before and after, because a migration is the one path that changes a rank
with no user action. **`DomainScore` deliberately carries no band name** — see F18. See
`docs/SPEC-FINDINGS.md` F3.

**F4 — `domainScores` cannot produce recency. ✅ RESOLVED 2026-08-05 — amend.**
**Adopted:** extend the row. `DomainSkillRow` gains `lastActivityAt?: string` and
`DomainScore` carries `lastActivityAt: string | null` beside `score`, `fill` and `breadth`;
breadth needs no field, being the row count. The objection that this violates
"`domainScores` never reads tree content" is **wrong**: "tree content" means a compiled
bundle, `domain` already comes from the manifest entry, so the row was always a
manifest × IndexedDB join and `lastActivityAt` sits in the same `SKILL` row as
`attainedLevel`. What settled it is that the alternatives are forbidden by §14.1 — the
store can never learn a tree's domain (`STATE ⇢ LOADER` FORBIDDEN) and components may
import neither state nor the engine, leaving only the shell's derived layer, which gives
`DomainScore` two producers. `T11-scoring-engine.md`'s "roll-up is a store concern" was
therefore unimplementable and is deleted. Riders: §12.2 now fixes every stored timestamp as
**ISO-8601 UTC with a `Z` suffix**, without which a lexicographic `max` in a pure engine is
a silent bug; and §3.3's `domainScores(catalogue, userState)` — matching neither the names
nor the types in §14.4 — becomes the real signature, with the manifest × `SKILL` join named
as the shell's (§13.2). **T11b owns it.** See `docs/SPEC-FINDINGS.md` F4.

**F5 — §14.4's monotonicity clause is vestigial. ✅ RESOLVED 2026-08-05 — amend.**
**Adopted:** strike the exemption outright. Two findings during resolution: §11.9's
invariant 1 already stated the same rule *without* an exemption, so §14.4 contradicted the
invariant table in the same document; and the exemption was the smallest of **four** sites
carrying the decay — §2's glossary ("the only channel permitted to decrease"), §10.5's
channel table ("saturation and a slow ambient shimmer, decaying over time") and §15.5's
shimmer. §10.5 is the one that mattered, because `T13-map-renderer.md` reproduces it
verbatim while its own out-of-scope list forbids that channel. All four fixed: recency
occupies no colour or motion channel in v1. Reinstating the clause conditionally was
declined — it keeps the unbuilt channel alive in the contract, which is the harm. R-20
carries the note instead: if the graded channel ever ships, the decayed value is derived in
the Map Renderer from `DomainScore.lastActivityAt` and is not a `DomainScore` field.
**Independent of R-24** — if T00's amendment lands, D-20 becomes compliant rather than
deviant and no section changes; if it is rejected, the response is to build R-20, and R-20
now says where it goes. See `docs/SPEC-FINDINGS.md` F5.

**F6 — §6.4's baseline ref contradicted itself. ✅ RESOLVED 2026-08-05 — amend.**
**Adopted:** `main`, and the evidence was one-sided rather than balanced — §5.4, §6.4's
closing, §16.1 and D-12 all say `main` against two stray "last release tag" phrases.
Nothing in the spec needs a tag, so introducing tagging would only have contradicted
§16.1's "no separate publish step". A **third** stray reference surfaced during resolution
and would have survived a fix aimed at the two the finding named: §6.8 forwarded the reader
to "Release tagging and the deploy workflow are §16.2", and §16.2 has no tagging step.
**The rider the finding did not ask about had a wrong answer.** The baseline is the tip of
`origin/main` and the head is the PR **merged into it** — not the merge-base, which T23 had
been instructed to implement. Merge-base is unsound the moment two PRs are in flight: two
branches can each bump one tree 4 → 5 and both pass, leaving `main` with a version 5 whose
compiled output is not the output that shipped as 5, so §12.5's `>` guard means those users
never run that migration — silent and undetectable under §16.5. Check 6 breaks identically.
The price is one stated obligation: **a branch must be up to date with `main` before it
merges**. §6.4 also now pins **`fetch-depth: 0`**, without which `origin/main` is absent and
checks 1–7 pass on nothing — the same trap §16.1 already records for git-derived counters,
and one that would have broken the tag reading too. See `docs/SPEC-FINDINGS.md` F6.

**F7 — §6.2 rule 15 needed git history, which §6.4 owns. ✅ RESOLVED 2026-08-05 — amend.**
**Adopted:** split the rule along the line that matters — answerable from the working tree
versus needing history. §6.2's rule 15 is **replaced** by its git-free half (every `into`
target resolves to a uid present in the repository head), keeping the table at fifteen so
§6.5's label and T03's five hard-coded counts are untouched; §6.4 gains **check 7**, every
entry *appended since the baseline* names a uid present in the baseline. Moving it wholesale
was declined: it discards a genuinely git-free check and forces edits to the CI diagram and
five sites in T03 for nothing. **"Appended" is load-bearing.** As worded, rule 15
re-evaluated the whole ledger, and since the ledger is append-only and never pruned a
`retired` uid is legitimately gone from `main` three releases later — at which point the
already-merged entry that retired it fails forever, permanently blocking every future PR on
that tree with no author action able to clear it. Group C's check 6 is what makes "the
appended suffix" well defined, so the correct wording was only expressible after it landed.
Check 7 is **not** check 1 restated: they run in opposite directions, and check 1 cannot
catch an entry naming an invented uid, because such an entry disposes of nothing and §12.5's
fold treats it as a no-op — silent at runtime. Rider: §6.7's authoring workflow gains
`lst baseline`, since it told authors to run only validate and lint and §6.1 promises no
CI-only check. **T03's new rule 15 is not implementable until F21 lands** — it needs the
per-`op` grammar for `into`. See `docs/SPEC-FINDINGS.md` F7.

**F8 — `contentVersion` has no increment mechanism, and its scope is never stated.
✅ RESOLVED 2026-08-05 — amend.** §16.1 said it increments "on every merge touching
`content/`", which `lst compile` cannot implement, and the scope was never stated —
§16.1/§7.2 implied global, §8.6/§12.5 read it per-tree. **Adopted:** an **authored
per-tree integer**, living in `content/trees/*.yaml` → bundle → manifest entry →
`SKILL.contentVersionSeen`. The library-wide counter is **deleted**; §7.2's `generated`
timestamp covers the human-facing job. Written by a new `lst version` subcommand and
enforced as a fifth check in §6.4's baseline job: compile both sides, elide the field,
compare bytes, fail if they differ and it did not increase — §5.4's uid ergonomics
exactly. An intermediate proposal using the bundle content hash as the trigger was
rejected: §7.5's hash is computed over emitted bytes, so any §7.3 compiler change moves
every tree's hash at once, and `lineage` being append-only (§5.4) makes `>` rather than
`!=` load-bearing on rollback. Git-derived counters fail silently under
`actions/checkout`'s `fetch-depth: 1`. See `docs/SPEC-FINDINGS.md` F8.

**F10 — §7.4 ships a service worker that §16.4 defers to phase 2. ✅ RESOLVED
2026-08-05 — amend.** Settled by N9's actual wording: "**once loaded**, the application
shall continue to function without network access". Once loaded — so a cold offline boot
is not required. Against that, only two §7.4 behaviours need a service worker at all
(shell boot, offline deep links); pinning and cache-first reads are plain Cache Storage,
available to window script. **Adopted:** the Content Loader owns a named cache in-page
and checks `caches.match()` before `fetch()`; the service worker stays phase 2. §16.3's
"stale service-worker entry self-heals" loses the assumption (the loader owns the cache,
so it holds), and gains a row for the offline deep link. The v1 gap — no offline cold
start, deep links carrying HTTP 404 — is **R-26** in §19.3. See `docs/SPEC-FINDINGS.md` F10.

**F11 — `pin()` has no caller. ✅ RESOLVED 2026-08-05 — amend.** **Adopted:** a new
`lib/actions` module, the one place permitted to import both I/O owners, containing
only named sequences — `startSkill(treeId): Promise<{ pinned: boolean }>` is its sole v1
export. Chosen over "`routes/` is the seam" because §11.8's placement flow and the tree
route both start skills, and an orchestration rule living in a route gets forgotten at
the second call site. The two forbidden edges it implies (`lib/content ↛ lib/state` and
the reverse) are added to §14.1 and to §14.7's `no-restricted-imports` gate. **Pinning is
best-effort:** the store write happens first, a rejected pin resolves `pinned: false`,
because a user near quota must still be able to start a skill. See
`docs/SPEC-FINDINGS.md` F11.

**F12 — §12.6's merge rule covered milestones only. ✅ RESOLVED 2026-08-05 — amend.**
"Union by `uid`, newest `at` wins" had no analogue for `skills` (no `at` field) or
`orphans`. **Adopted:** a rule per array. `skills` merges per `treeId` field by field —
`startedAt` earliest, `lastActivityAt` latest (present beats absent), `contentVersionSeen`
**minimum**, `grandfathered` unchanged, and **`attainedLevel` never merged**, copied from
the later-activity side as the provisional snapshot §12.3 already calls it. Taking the
maximum was rejected as a ratchet §11.10 already forbids, and it is concretely wrong: if one
device dismissed what the other completed, the honest merged level is the lower one and
§12.3 only corrects it *on tree open* — the trees a merge touches are the ones least likely
to be opened, so a stale 7 against a true 3 inflates a domain score by 59 points
indefinitely. **`contentVersionSeen` enters the export file**, by the same argument §12.6
already makes for `grandfathered`; merged as a minimum it forces §12.5's replay, without
which a merge from an older device delivers pre-migration records into a store whose counter
is already past the retiring release and **the pass never runs again**. `orphans` union by
uid with the more specific `reason` winning — `at` is frozen at completion time (§12.2) and
therefore ties on exactly the case it would have to settle. A uid live on one side and
orphaned on the other resolves to the **milestone**, since orphaning is re-derivable from an
append-only ledger and a discarded live record is not; that rule **must not ship without the
forced replay**. `ImportReport` gains `orphans.updated`, `droppedForLiveRecord`, and
`treesRewound`. See `docs/SPEC-FINDINGS.md` F12.

**F13 — `moved` had a reachability hole. ✅ RESOLVED 2026-08-05 — amend.** **Adopted:**
both halves. The unknown-uid disposition is scoped to `record.treeId === tree.id` — free,
and what stops the two rows claiming the same record — **and** the manifest gains a
library-wide `moved` map (uid → destination tree id), collected by the compiler, applied by
`store.applyMoves()` at cold start (§13.3). Repository-wide uid uniqueness (§5.4) makes a
flat map correct, and §5.4 already names the cross-tree move as the reason that uniqueness
exists. Scoping alone was insufficient: `MILESTONE`'s PK is the uid, so a user whose record
is invisible to the destination tree re-ticks the milestone and **overwrites the original
`at` and `note`** — §12.5's no-silent-deletion rule broken by the most natural response to
the bug. A uid-keyed `TreeProgress` lookup was taken into research and withdrawn on three
verified breakages: §11.5's frozen check is per-tree so the source tree un-grandfathers; an
unstarted destination tree has no `SKILL` row (§11.7) so completions render and score zero;
and the final sweep's predicate goes vacuously false, making `OrphanReason: 'unknown'` dead
code. The index is also the only option that repairs the *source* tree without opening it and
the only one that fires §12.5's mandatory summary. It deliberately does **not** recompute the
source's `attainedLevel` — that needs the bundle — leaving §12.3's existing staleness
tolerance to cover it. See `docs/SPEC-FINDINGS.md` F13.

**F14 — §12.5 never stated whether the migration pass is replay-safe. ✅ RESOLVED
2026-08-05 — amend.** **Adopted:** the pass is a **fold over the ledger in file order**
under four rules, with the guarantee stated — fold(1..n) equals fold(1..i) then
fold(i+1..n), because every entry is a no-op when its subject is absent. (1) File order,
preserved verbatim by the compiler. (2) **`merged` folds by target, not by entry** —
`LineageEntry` carries a single `uid` (§5.2), so an *n*-into-one merge is *n* entries, and
reading them in isolation grants the merged milestone to a user who completed only the first
predecessor, inverting R-16's accepted loss into silent over-credit. (3) The working set is
live `MILESTONE` records for this tree; an orphaned record leaves it permanently, which is
what makes "no-op when absent" well defined. (4) The unknown-uid disposition is a **final
sweep**, not a table row — applied inline it destroys records mid-fold. Frozen sets fold in
lockstep with records rather than in a second pass. File order needed *enforcing*, not just
stating: §5.5 bounded file-position significance to two places (now three) and nothing
checked ordering, so **§6.4 gains a sixth check — the baseline's ledger is a prefix of the
head's**, which also retroactively secures §12.5's existing `>` argument. That check inherits
whatever baseline **F6** settles. See `docs/SPEC-FINDINGS.md` F14.

**F15 — a cluster of small omissions**, each cheap to fix and each capable of costing an
afternoon if hit cold:
- §4.4 cross-references "§7.3, which treats manifest freshness explicitly". §7.3 is the
  compiler's transformation table; freshness is §7.1 and §7.4.
- `MILESTONE.contentVersion` is declared in §12.2's ER diagram and consumed nowhere — and
  §14.5's `ExportFile` types it **optional** while §12.2 types it required, with §12.6's
  example row omitting it and §12.6's milestone merge rule silent on it, so a round trip can
  drop a required field with no stated default. Extended 2026-08-05 during F20's pass.
- `ORPHAN` carries no `slug` while `MILESTONE` does. Probably intentional per §12.5's
  "title, timestamp, and note", but unstated.
- §12.7 does not say where the export-prompt dismissal flag lives. Persisting it naively
  silences all three triggers permanently.
- §12.7's "more than thirty days since the last export **with new activity since**" never
  defines new activity.
- §12.7's 60%-of-quota trigger cannot fire in phase 1 given §17.4's sub-1 MB budget.
  Harmless, but it should be labelled phase-2 rather than read as live.
- §10.5's channel table sources **Breadth** to §11.6; breadth is defined in §11.7. Added
  2026-08-05 during F5's sweep of the adjacent Recency row, and left for this cluster
  rather than fixed in passing. Same class as the §4.4 → §7.3 mis-citation above.

**F9 — the compiled-bundle shape is unenforced across the workspace boundary.
✅ RESOLVED 2026-08-05 — amend.** **Adopted:** `schema/compiled-tree.schema.json` and
`schema/manifest.schema.json`. `lst compile` validates its own output against them and
fails the build on mismatch; `app/` generates `CompiledTree` and `Manifest` types from
them. This invents nothing — §4.2 already makes `schema/` the one thing both workspaces
read and §14.7 already gates type generation. §14.6's "internal" is restated as
**unversioned, not unspecified**. Rider, stated in both §7.3 and §7.5: these are
**build-time and codegen artifacts only**, the app ships no validator, and the runtime
check remains §7.5's narrow shape assertion — ajv in the Content Loader would spend
§17.1 budget re-proving what CI proved, in front of a user who can do nothing about it.
Fixture parity was declined: it catches only what the fixture exercises. See
`docs/SPEC-FINDINGS.md` F9.

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
already an edge, so making T08 depend on T11 creates a cycle. **✅ RESOLVED 2026-08-05 —
amend.** **Adopted:** split §11 at §11.5. §11.1–§11.4 (requirement groups, attained
level, node states) are tree-local, consume only the compiled bundle plus that tree's
progress, and ship in **phase 0**; §11.5–§11.8 (grandfathering, domain score, fill,
recency, breadth, self-assessment) ship in **phase 1**. §16.4's "no scoring" becomes "no
**domain** scoring" — which the surrounding clauses (no map, no export) show was the
intent. The seam falls at §11.5 because that is the first point §11 writes persisted
state (`SKILL.grandfathered`, per F2), and persisted state is what Phase 0 exists to
falsify. **T11 splits into T11a (phase 0, blocks T08) and T11b (phase 1, blocked by
T10)**, and the cycle dissolves: `T11a → T08 → T10 → T11b`. Deriving node state in the
Layout Engine was rejected outright — §14.1 marks `LAYOUT → STATE` FORBIDDEN and it
would destroy N11. See `docs/SPEC-FINDINGS.md` F16.

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
no established pattern to read it against. **✅ RESOLVED 2026-08-05 — amend.**
**Adopted:** `lst validate` extends to `content/taxonomy/`, and the five become **layer 2b**,
rules **M1–M5**, in a separate sub-table (rules 1–15 are all tree-scoped and the numbering is
read downstream). Three of the five are exactly layer 2's "JSON Schema cannot express this"
class, and a geometry error belongs in the seconds-long pre-build job with a file and line.
**The `lst compile` placement — which `T12-map-geometry.md` had already assumed — is unsafe
for a reason outside §10:** §6.5's `build` job `needs` the app jobs, which the path filter
skips on a content-only PR, and a skipped dependency skips the dependent, so `build` does not
run on the PRs that change `map.yaml`. That is **F24**, and it is decisive here because the
validate placement does not depend on how F24 resolves. Contiguity does **not** fall out of
§10.4's loop-chaining: a hole and a two-piece region both produce two loops, so §10.4's
warning is now scoped to holes with disconnection failing validation first — otherwise two
jobs return different verdicts on one input. Two riders make the rules implementable: **M2
ranges over the multiset of every tile in every region**, because a tile listed twice inside
one region has each of its six edges discarded by §10.4 step 2 and vanishes from the outline
with a still-closed path and no diagnostic; and **the file list scopes what is reported, not
what is read** — already true for rules 2, 10–12, nowhere stated, and fatal here since
scoping M1–M5 to argv runs no map checks on the common invocation.
See `docs/SPEC-FINDINGS.md` F17.

**F18 — the fill band vocabulary is required in three places and defined nowhere, and it
is called a "tier".** §11.6 closes on presentation: "a **named band** over the same number
carries the legibility a continuous bar cannot, and is what §15.3 announces to screen
readers." §15.3 then says "Fill is announced by its **named tier**", §15.4's redundancy
table gives "Domain fill level | fill height | **named tier** in text on focus", and §15.3's
worked example shows one specimen word — *"Fill: moderate."* The vocabulary itself appears
nowhere. Two distinct problems: the names do not exist, and "tier" already means something
else — §2 defines **Tier** as F7's Novice/Apprentice/…/Master over pairs of *levels*, which
is a per-skill notion, while this band is a per-domain rendering of `fill`. A screen-reader
user hearing "Journeyman" would have no way to tell which of the two was meant. Note the
band is genuinely needed rather than cosmetic: F34 forbids showing the number, so the band
is the *only* form in which fill reaches a screen-reader user, which makes N5 depend on it.
*Decide:* the band names (a PRD-adjacent content decision, so possibly T00's), and a term
for them that is not "tier". **Blocks T13, T20.** Raised 2026-08-05 while resolving F3;
`DomainScore` was deliberately left without a band field so that resolving this changes no
engine type.

**F19 — `SKILL.lastActivityAt` has no defined value before the first completion, and no
stated writers other than `setMilestoneState`.** §12.2 types it non-optional
(`string lastActivityAt`), but §12.4 — which opens "Every user-visible mutation is one
function" — documents exactly one writer, whose step 3 writes it. §14.5 exposes four other
mutators (`startSkill`, `applyLineage`, `import`, and the `replace` path). So a skill that
has been started but has no completion has an undefined value in a non-optional field, and
nothing says whether starting a skill, a lineage migration, or an import counts as
"activity". Second, related question the same clause raises: step 3 runs for `null` and
`'dismissed'` too, so **un-checking a milestone currently counts as activity** — defensible,
and undocumented. This reaches the user directly, since §11.7's domain recency is a maximum
over this field. *Decide:* which mutators write it, and whether the field is optional in the
store. **Blocks T09.** Raised 2026-08-05 while resolving F4, whose `DomainSkillRow` types
the field as optional and whose `DomainScore` reports `null` — that is F4 tolerating the
ambiguity at the engine boundary, not resolving it at the store.

**F20 — `split` never stated the predecessor's fate. ✅ RESOLVED 2026-08-05 — amend.**
**Adopted:** the predecessor is **consumed** — deleted, with `at` and `note` copied onto every
successor, reported as `outcome: 'rewritten'` with `became` naming them — and the frozen-set
entry is **moved, not copied**. The same sentence goes into `merged`'s all-complete branch,
which had the identical gap. **The spec did not omit the fate; it implied retention**: the
final sweep orphans a uid in "neither bundle **nor** lineage", and a split predecessor's uid
*is* in the lineage, so the sweep spares it by construction — the record survives every pass
and reads `complete` for a uid no bundle contains. That also settles the disposition, because
a retained record stays in §12.5's working set, re-matches its own entry, and §12.6 *forces* a
replay on import — silently re-completing a successor the user deliberately un-checked, which
made F14's replay guarantee already false for this row. Orphaning was declined on `merged`'s
own wording: it orphans in the "otherwise" branch because R-16's partial merge is a **loss**,
and under `split` nothing is lost. Cost stated rather than argued away: the predecessor's
frozen `title` snapshot leaves persisted state, so consumption meets only half of §12.6's
two-part non-silent-drop test — the half covering what the *user* wrote. Two riders:
**a successor that already has a live record keeps its own `at` and `note`** (rule 15 requires
targets to resolve, not to be new, and §12.6's rewind reaches the same collision with ordinary
authoring), and **rule 3 gains consumption as a second permanent exit** from the working set.
The frozen-set move is **entailed** by the deletion, not an independent choice. See
`docs/SPEC-FINDINGS.md` F20.

**F21 — `into:` had two grammars and neither was validated. ✅ RESOLVED 2026-08-05 — amend.**
**Adopted:** one table in §5.4 fixing shape and cardinality per `op`, with §6.2 rule 15
branching on `op` to enforce it — `split` ≥ 2 bare uids in this tree, `merged` exactly one,
`retired` none, `moved` exactly one `<treeId>/<uid>` in a **different** tree whose uid
**equals the entry's own**. Three decisions the finding did not ask about: the repeated uid in
a `moved` target is now checked rather than decorative (§12.5 keeps the uid and rewrites
`treeId`, so a typo there currently changes nothing and is invisible at runtime);
`split`/`merged` targets stay inside one tree (the fold's working set is per-tree, so a
foreign successor produces a record invisible in both trees); and cardinality is part of the
grammar (`split` with `into: []` passes today and disposes of nothing). The permissive
"accept either form anywhere" reading was declined because it **reopens F13's hole through the
validator** — a `moved` entry written bare parses cleanly, contributes no `manifest.moved`
entry, and strands the record exactly as before. Naming only the destination tree was declined
too: a bare treeId and a bare uid are indistinguishable by shape. See `docs/SPEC-FINDINGS.md`
F21.

**F22 — a started skill whose tree leaves the manifest loses its score silently.** §5.9
contemplates removing taxonomy entries; nothing covers removing a *tree*.
`DomainSkillRow.domain` comes from the manifest entry "never a bundle" (§14.4) and the join
is the App Shell's, so a `SKILL` row with no manifest entry has no domain, cannot be placed,
and drops out of §11.6's sum — a score decrease with no user action, which brushes invariant
1 and §14.4's now-exemption-free monotonicity clause. Its milestone records are also never
migrated (no bundle, so no pass) and never swept (the sweep is per-tree). Neither §12 nor
§13.3 says what to do. *Decide:* whether a tree may leave the library at all, and if so
whether its records orphan, persist unplaced, or hold their score. **Blocks T14, T16.**
Raised 2026-08-05 while resolving F12.

**F23 — nothing produced `TreeProgress`. ✅ RESOLVED 2026-08-05 — amend.** **Adopted:**
`progressFor(treeId: string): TreeProgress` on `UserStateStore` — **synchronous**, no I/O, a
projection of §13.2's mirror, and **total** (an unstarted tree returns empty maps, never
`undefined`) — plus `readonly hydrated: boolean`. **The load-bearing part is not the
signature.** §13.2 described the mirror as "written via §12.4", so `applyLineage`,
`applyMoves` and `import` never refreshed it — meaning a synchronous read is wrong precisely
when those have just run: the successors a `split` just created are invisible on the first
paint after a content update, and `applyMoves` rewrites the very `treeId` the accessor keys
on, stranding a re-homed record under the source tree for the session and defeating §13.3's
stated reason for running that pass before the map derives. §13.2 now says every writer
refreshes the mirror on commit. `hydrated` exists because totality has a failure mode: empty
maps are right for an unstarted tree and a lie for an unhydrated store, and under §13.3's
read-only branch every tree would render as having no completions — the display-side twin of
"read as empty, then wrote". The `by-tree` index is named as the **write path's**, its busiest
consumer being §12.4 step 2 on every mutation, which cannot read the mirror because reactive
state updates only on transaction commit; §12.5's fold and sweep and §12.3's reconciliation
are the others. An async per-tree accessor was declined: §17.4 budgets a heavy phase-1 user
under 1 MB — an over-count, since incomplete milestones have no row — so it would demote a
mirror to a cache for headroom the budget says is not needed. See `docs/SPEC-FINDINGS.md` F23.

**F24 — §6.5's `build` job is unreachable on a content-only PR.** The job graph has
`V --> BUILD`, `TC --> BUILD` and `T --> BUILD`, and §6.5's closing sentence says "on a
content-only PR the app jobs are skipped by path filter". Under GitHub Actions' default
`needs` semantics a skipped dependency skips the dependent — so `build`, which §6.1 marks
gating and which is the only place `lst compile` runs, **does not execute on the PRs that
change content**. Everything compile enforces is therefore ungated on exactly its own input:
§7.3's transformations, F9's schema validation of the emitted bundle, the manifest's `moved`
map (F13), and §6.4 check 5's compile-both-sides comparison. *Decide:* whether `build` runs
with `if: always() && !failure()`, or whether the path filter makes the app jobs no-op-pass
rather than skip. An implementer cannot guess this from the diagram. **Blocks T25, and
weakens T04, T12, T23 until settled.** Raised 2026-08-05 while resolving F17, whose original
`lst compile` placement it invalidated.

**F25 — nothing owns §5.4's missing-uid gate.** §5.4 says "CI fails a merge if any `uid` is
missing, printing the values to paste", and §6.1 marks `lst ids` gating with "(missing uid
fails)". But §6.5's job graph has no `ids` job, and `lst ids` **fills uids in place** — a
subcommand that writes files cannot be the CI gate that rejects them. `T03-lst-validate-and-
ids.md` resolves this by putting the *check* in `lst validate` and the *write* in `lst ids`,
which is almost certainly right, but that is an inference from two sentences rather than a
reading of either. Same class as F17: a stated CI guarantee with no named owner. *Decide:*
which subcommand fails a missing uid, and whether it is a semantic rule in §6.2's table.
**Blocks T03, T25.** Raised 2026-08-05 while resolving F7.

**F26 — §12.3's reconciliation has no interface.** §12.3 requires that on tree open the
Scoring Engine "recomputes attained level from first principles and **writes it back** if it
differs" — a write, and the mechanism that keeps the design's one accepted denormalization
honest. §14.5's `UserStateStore` exposes no method for it. The only mutator taking a
`CompiledTree` is `applyLineage`, which §12.5 gates on `contentVersion > contentVersionSeen`
and which therefore does nothing on the ordinary tree open where reconciliation is supposed to
run. The gap is not cosmetic: §12.6's import rule copies `attainedLevel` rather than merging
it and names §12.3's reconciliation as the correction that later unwinds a provisional value,
so an unowned reconciliation leaves an imported rank wrong indefinitely; and F13's `moved`
pass deliberately does not recompute the source tree's level, deferring to the same
mechanism. *Decide:* whether reconciliation is a distinct `UserStateStore` method, a
documented effect of an existing one, or the App Shell's sequence — and who calls it on tree
open. **Blocks T09, T14; weakens T16 and T17 until settled.** Raised 2026-08-05 while
resolving F23, whose accessor made the missing write-back path visible.

**Out of scope**

- PRD amendments — T00. F1 and F5 are adjacent to R-25 and R-24 respectively, and doing
  both tasks in one sitting is sensible, but the documents and the decision-makers differ.
- Schema changes driven by phase-0 experience — T10. This task fixes the spec's internal
  contradictions; T10 fixes what building against it revealed.
- Anything found by the runtime-io cluster after this document was written. Append; do not
  start a second reconciliation task.

## Deliverables

```
docs/ARCHITECTURE.md    the twenty-five findings resolved in place
docs/SPEC-FINDINGS.md   the decision record: finding, verdict, reason, date
```

## Interface contract

Three findings change contracts other tasks are written against. When resolved, the
amended forms must be propagated into the affected task documents in the same commit —
otherwise the task docs become the new stale copy:

```ts
// F2 — scoreSkill's signature, if grandfathering enters the engine
export function scoreSkill(tree: CompiledTree, progress: TreeProgress): SkillProgress;

// F4 — RESOLVED: the row gains lastActivityAt and is named
export interface DomainSkillRow {
  readonly treeId: string;
  readonly domain: DomainId;
  readonly attainedLevel: number;
  readonly lastActivityAt?: string;   // ISO-8601 UTC, 'Z'-suffixed (§12.2)
}
export function domainScores(
  taxonomy: Taxonomy,
  skills: ReadonlyArray<DomainSkillRow>,
): Map<DomainId, DomainScore>;

// F13 — RESOLVED: the store gains a cold-start pass over the manifest's moved index
export type MovedIndex = Manifest['moved'];              // uid → destination treeId
applyMoves(moved: MovedIndex): Promise<readonly MigrationReport[]>;

// F23 — RESOLVED: TreeProgress has a producer. Synchronous, no I/O, total for an
// unstarted tree. `hydrated` is what stops an empty result meaning two things.
progressFor(treeId: string): TreeProgress;
readonly hydrated: boolean;

// F3 — RESOLVED: all eight now defined in §14.4 and §14.5
//   DomainId, TierName, Taxonomy = Manifest['taxonomy'], DomainScore,
//   ExportFile, OrphanReason, MigrationReport, ImportReport
//   and SkillProgress.tier is `TierName | null`
```

## Acceptance criteria

- [ ] `docs/SPEC-FINDINGS.md` records all twenty-six findings with a verdict of *amend*,
      *tolerate*, or *not a defect*, each with a reason and a date.
- [ ] F1: §11.6's table and §11.9's invariant 4 agree. Verified by computing
      Δfill(0→1) and Δfill(1→2) from the shipped constants and checking the invariant
      holds, or by the invariant's text admitting the margin.
- [ ] F2: §12.2 has a place to store per-level frozen satisfaction, §14.4's signature can
      reach it, and §12.6 states whether it is exported.
- [x] F3: `TierName`, `DomainScore`, and `Taxonomy` are defined in the spec, including
      the `attainedLevel: 0` case for `TierName`. *All six named types plus `DomainId` and
      `OrphanReason` are in §14.4 and §14.5; `tier` is `TierName | null` and §11.3 gives
      the display string. `Taxonomy` is `Manifest['taxonomy']`, not a new declaration.*
- [x] F4: recency rollup has a stated home and the types support it. *The Scoring Engine
      owns it — `DomainSkillRow.lastActivityAt` in, `DomainScore.lastActivityAt` out. T11b.
      The manifest × `SKILL` join that feeds it is named as the shell's (§3.3, §13.2).*
- [x] F5: §14.4's monotonicity clause matches D-20's shipped behaviour. *The exemption is
      struck, and the same decay language is gone from §2, §10.5 and §15.5. Verified by
      `grep -n "decaying\|shimmer" docs/ARCHITECTURE.md` returning only D-20/R-20's own
      descriptions of the deferred channel.*
- [x] F18: the fill band vocabulary is named, and not called "tier". *Five bands over
      `fill` — Quiet `[0,.15)`, Emerging `[.15,.35)`, Moderate `[.35,.55)`, Active
`[.55,.72)`, Deep `[.72,1)` — in §11.6, with §2 gaining a `Band` glossary entry beside
`Tier` and §15.3/§15.4 renamed. The top band opens just under a lone L10's 74.7%, so one
mastered skill reaches it. The name is typed `string`, **not** a closed union like
`TierName`: the owner expects to tune names, count and boundaries from real use, so the
table ships as data and a change must be one line with no type or component change.*
- [x] F19: §12.4 names every writer of `SKILL.lastActivityAt`, and §12.2's field is typed
      to match. *§12.2 carries the writer table — `startSkill` (seeded from `startedAt`),
`setMilestoneState` (every mutation, un-completing included), `import` (the later side).
No migration writes it. The field is total, so the `?` came off `DomainSkillRow` and
`ExportFile`, and it is a forward-only watermark, never a `max` over records.*
- [x] F6: §6.4's opening, §6.4's closing, and §6.5's job label all name the same baseline.
      *All three say `main`, plus §6.1's table row and §6.8's dangling tag reference. §6.4
      additionally pins `origin/main`'s tip versus the PR merge result, the
      branch-up-to-date requirement, and `fetch-depth: 0`.*
- [x] F7: exactly one subcommand owns the baseline comparison primitive, and both §6.2
      rule 15 and §6.4 reference it. *`lst baseline` owns everything needing history; §6.2's
      rule 15 is now the git-free `into`-resolution half, and §6.4 check 7 is the historical
      half, scoped to entries appended since the baseline.*
- [x] F8: `contentVersion`'s source is named and is reproducible in a local build, not
      only in CI. *`lst version` writes it into the tree file; §6.4 enforces it. No git
      history, no CI-only state — an author reproduces the exact value offline.*
- [x] F9: either `schema/` contains a compiled-bundle schema, or a fixture parity test is
      specified with an owning task. *Both schemas added under `schema/`; T04 owns them.*
- [x] F10: §7.4 and §16.3 no longer assume a service worker that v1 does not ship, and
      §4.4's offline deep-link consequence is stated wherever the gap is accepted.
      *§4.4's table row, §16.3's new branch, §16.4's Phase 0 prose, and R-26.*
- [x] F11: exactly one component is named as the caller of `pin()`, and it is one §14.1
      permits. *`lib/actions`, added to §14.1 with the two forbidden edges it implies.*
- [x] F12: §12.6 states a merge rule for `skills` and for `orphans`, not only milestones.
      *Per-field for `skills`, `reason`-specificity for `orphans`, plus the cross-array
      milestone-beats-orphan rule. `attainedLevel` is never merged; `contentVersionSeen` is
      exported and merged as a minimum, which is what forces §12.5's replay.*
- [x] F13: §12.5's unknown-uid row and its `moved` row cannot both claim the same record.
      Verified by a fixture where a milestone moves and the source tree is never reopened.
      *The sweep is scoped to `record.treeId === tree.id`, so it cannot reach a re-homed
      record; the manifest's `moved` map re-homes it at cold start without the source
      bundle. T17 owns the fixture.*
- [x] F14: §12.5 states whether the pass is replay-safe across skipped content versions,
      and the ordering rule for composing dispositions. *A fold in file order;
      fold(1..n) = fold(1..i) ∘ fold(i+1..n); `merged` groups by target; the unknown-uid
      disposition is a final sweep. §6.4 check 6 enforces the ordering.*
- [x] F20: §12.5 states the predecessor's fate under `split`, in both the record table and
      the frozen-set clause. *Consumed in both, and in `merged`'s all-complete branch too;
      the frozen entry moves rather than copies. Rule 3 gains consumption as a second exit,
      and a successor with a live record of its own is never overwritten.*
- [x] F21: `into:`'s grammar is stated per `op` and validated. *§5.4's table fixes shape and
      cardinality; §6.2 rule 15 branches on `op`; §5.2 flags the non-uniformity at the type;
      §7.2 says the compiler parses the tree half.*
- [x] F22: the spec says what becomes of a started skill whose tree has left the manifest.
      *It cannot leave: §6.4 check 8 forbids removing or renaming a tree, because the
lineage ledger lives inside the file being deleted and cannot dispose of it. If an import
produces the state anyway, the row is retained, excluded from the join, never scored, and
listed on `/data` (§16.3). A `retired` flag was priced and deferred to R-27.*
- [x] F23: `TreeProgress` has a named producer with a signature, and §12.2's `by-tree`
      index has a stated consumer. *`store.progressFor(treeId)` — synchronous, total, off
      §13.2's mirror, which every writer now refreshes. `by-tree` serves §12.4 step 2,
      §12.5's fold and sweep, and §12.3's reconciliation — never the render path.*
- [x] F15: every item in the cluster is either fixed in the spec or recorded as tolerated.
      *All seven amended. §4.4 and §10.5's mis-citations fixed; `MILESTONE.contentVersion`
made required everywhere and named as provenance, with §12.6's example and merge rule
following; `ORPHAN`'s missing slug confirmed deliberate and explained; §12.7 rewritten with
a trigger table, a per-trigger dismissal record in `META`, `lastActivityAt > lastExportAt`
as the definition of new activity, and T3 labelled phase 2.*
- [x] F16: §9.3 and §16.4 agree on what produces node state in Phase 0. Verified by
      reading §16.4's Phase 0 prose and confirming that every state T10's gate requires
      has a named producer scheduled no later than T08. *§16.4's Phase 0 chain gains the
      §11.1–§11.4 node before TreeView; T11a is that producer and blocks T08.*
- [x] F17: §6.1's subcommand table names the command that validates `map.yaml`, and
      §10.3's "Validated by CI" sentence points at it. Verified by
      `grep -n "map.yaml" docs/ARCHITECTURE.md` returning a §6 hit. *`lst validate`, via
      §6.2's layer 2b rules M1–M5; §5.9's handoff also names it now.*
- [x] F24: §6.5 states whether `build` runs on a content-only PR. *It does not, and that
      is now correct: `build` split into `content: compile` (needs validate only, always
runs) and `app: build` (needs the app jobs, legitimately skips). Seven gating jobs.
Severity was overstated — §6.4 check 5 was compiling the head all along — so the real
defect was an unnamed, incidental gate plus the fact that a skipped required check reports
as passing.*
- [x] F25: exactly one subcommand is named as the gate that fails a missing `uid`.
      *`lst validate`, as §6.2 rule 16; `lst ids` stops gating and is the fix. It cannot be
a layer-1 `required` — §5.4's authoring flow has the author write a tree with no `uid`
lines at all, which a required field would make unparseable.*
- [x] F26: §12.3's write-back has a named owner reachable on an ordinary tree open.
      *`store.reconcileAttainedLevel(treeId, level)`, called by the tree route after
`applyLineage`. The store cannot compute it — §14.1 gives `lib/state` no edge to the
loader or to `lib/scoring` — so it takes a number, not a bundle.*
- [x] Every affected task doc under `.agent/tasks/` is updated to match the resolutions.
      *Done for all twenty-six findings.*
- [ ] `grep -ril "spec is silent\|unresolved spec gap" .agent/tasks/` returns nothing.
      **Not met, and deliberately not forced.** One doc still trips it:
      `T06-layout-engine.md` flags four §8 gaps — the narrow layout's vertical direction,
      `col`/`lane`/`columns` in narrow mode, the absence of any numeric constant in §8, and
      side-gutter geometry for same-level edges. **None was ever raised as a T26 finding**,
      so no verdict covers them and deleting the marker would only make the grep lie. They
      are F15's class — small, cheap, each capable of costing an afternoon — and are the
      obvious content of a successor finding or a short §8 pass. T06 already tells an
      implementer to pick a default and record it in a comment, so nothing is blocked; this
      is unrecorded, not unresolved.

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
