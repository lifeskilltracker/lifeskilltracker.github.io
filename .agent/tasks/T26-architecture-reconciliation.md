# T26 — Architecture spec reconciliation

| Field | Value |
|---|---|
| **Status** | in progress — F1–F5, F8–F14, F16 resolved 2026-08-05; F6, F7, F15, F17–F23 open |
| **Phase** | 0 |
| **Cluster** | judgment |
| **Blocked by** | — |
| **Blocks** | T02, T04, T07, T08, T09, T10, T11, T12, T16, T17, T23 |
| **Spec** | ARCHITECTURE §4.4, §6.1, §6.2, §6.4, §7.2, §7.4, §9.3, §10.3, §11.5, §11.6, §11.9, §12.2, §12.5, §12.6, §12.7, §14.2, §14.4, §14.5, §16.1, §16.4 |
| **PRD** | — |

## Goal

`docs/ARCHITECTURE.md` no longer contradicts itself on any point an implementer must
act on. Twenty-three findings — seventeen raised during task decomposition, F18 and F19
found while resolving F3 and F4, and F20–F23 found while resolving F12–F14 — are each
resolved: amended in
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

**In scope** — twenty-three findings, each needing a verdict. F16 and F17 were appended
2026-08-05 by the wave-2 task-doc pass and verified against the spec by the orchestrator;
F18 and F19 were appended 2026-08-05 by the F3/F4/F5 pass and F20–F23 by the F12/F13/F14
pass, all six unresolved:

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
- `MILESTONE.contentVersion` is declared in §12.2's ER diagram and consumed nowhere.
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
no established pattern to read it against. *Decide:* extend `lst validate` to taxonomy
files, or make it part of `lst compile`'s map build step (§10.4), and name it in §6.1.
**Blocks T12.**

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

**F20 — `split` never states the predecessor's fate, in either structure.** §12.5's table
gives the *successors'* outcome — "**every** successor becomes complete" — and says nothing
about the record the split consumed. Every other disposition states its subject's fate
explicitly (`merged` orphans the predecessors, `retired` orphans, `moved` re-homes). The
frozen-set clause has the same gap in a sharper form: "`split` **copies** the set entry to
every successor", and a copy leaves the predecessor uid in the set — a uid now in no bundle,
which §11.5 can never read as `complete`, so the level un-satisfies. That is the same class
as the `moved` frozen-set defect fixed under F13, reached by a different disposition, and it
is why the fix there was not generalized in passing. *Decide:* whether `split` deletes,
orphans, or retains the predecessor record, and whether the frozen-set entry is copied or
moved. **Blocks T17.** Raised 2026-08-05 while resolving F14.

**F21 — `into:` has two grammars and neither is validated.** §5.4's example uses a
tree-qualified target for `moved` (`into: [bladesmithing/c5fj92tk]`) and bare uids for
`split` and `merged` (`into: [m3xk90ab, v8t2ncq5]`). §5.2 types the field `string[]` with no
note of the distinction, and §12.5's `moved` row says "`treeId` updated" without saying the
new `treeId` is parsed out of the qualified target. §6.2 rule 15 validates the entry's own
`uid` only — nothing checks that a `moved` target names a tree that exists, or that
`split`/`merged` targets resolve at all. F13's manifest index is built by parsing exactly
this grammar, so it now has a consumer that will fail unhelpfully on a malformed target.
*Decide:* the grammar per `op`, and the validation rule. **Blocks T03, T04, T17.** Raised
2026-08-05 while resolving F13.

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

**F23 — nothing produces `TreeProgress`.** §11.1 and `scoreSkill` consume it (§14.4), and
§11.9's invariant 7 depends on it reaching the engine — but `UserStateStore` (§14.5) exposes
no accessor that returns one. §13.2 says the store holds an in-memory mirror of user state
and names no read API for it. Related and probably the same fix: §12.2's `by-tree` index is
declared in the ER diagram and **no prose anywhere states what reads it**. This is a
signature an implementer must have, and F13's resolution turned on what it is, so it should
be written down rather than left to the first task that needs it. *Decide:* the accessor's
signature and whether it is the by-tree index's stated consumer. **Blocks T09, T11a.**
Raised 2026-08-05 while resolving F13.

**Out of scope**

- PRD amendments — T00. F1 and F5 are adjacent to R-25 and R-24 respectively, and doing
  both tasks in one sitting is sensible, but the documents and the decision-makers differ.
- Schema changes driven by phase-0 experience — T10. This task fixes the spec's internal
  contradictions; T10 fixes what building against it revealed.
- Anything found by the runtime-io cluster after this document was written. Append; do not
  start a second reconciliation task.

## Deliverables

```
docs/ARCHITECTURE.md    the twenty-three findings resolved in place
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

// F3 — RESOLVED: all eight now defined in §14.4 and §14.5
//   DomainId, TierName, Taxonomy = Manifest['taxonomy'], DomainScore,
//   ExportFile, OrphanReason, MigrationReport, ImportReport
//   and SkillProgress.tier is `TierName | null`
```

## Acceptance criteria

- [ ] `docs/SPEC-FINDINGS.md` records all twenty-three findings with a verdict of *amend*,
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
- [ ] F18: the fill band vocabulary is named, and not called "tier".
- [ ] F19: §12.4 names every writer of `SKILL.lastActivityAt`, and §12.2's field is typed
      to match.
- [ ] F6: §6.4's opening, §6.4's closing, and §6.5's job label all name the same baseline.
- [ ] F7: exactly one subcommand owns the baseline comparison primitive, and both §6.2
      rule 15 and §6.4 reference it.
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
- [ ] F20: §12.5 states the predecessor's fate under `split`, in both the record table and
      the frozen-set clause.
- [ ] F21: `into:`'s grammar is stated per `op` and validated.
- [ ] F22: the spec says what becomes of a started skill whose tree has left the manifest.
- [ ] F23: `TreeProgress` has a named producer with a signature, and §12.2's `by-tree`
      index has a stated consumer.
- [ ] F15: every item in the cluster is either fixed in the spec or recorded as tolerated.
- [x] F16: §9.3 and §16.4 agree on what produces node state in Phase 0. Verified by
      reading §16.4's Phase 0 prose and confirming that every state T10's gate requires
      has a named producer scheduled no later than T08. *§16.4's Phase 0 chain gains the
      §11.1–§11.4 node before TreeView; T11a is that producer and blocks T08.*
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
