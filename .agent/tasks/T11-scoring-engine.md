# T11 — Scoring Engine

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | pure-engines |
| **Blocked by** | T10 |
| **SUPERSEDED** | Split into **T11a** (§11.1–§11.4, phase 0, blocks T08) and **T11b** (§11.5–§11.8, phase 1) by T26 F16 on 2026-08-05. This document still covers all of §11 and must be split into `T11a-scoring-tree-local.md` and `T11b-scoring-aggregation.md`; both rows are `pending` in `_BREAKDOWN.yaml` until that is done. Nothing in the content below is wrong — only its phase assignment and its blocking edges are. |
| **Blocks** | T13, T14, T15, T17, T19 |
| **Spec** | ARCHITECTURE §11, §14.4 |
| **PRD** | F9, F11, F33, F36, N12, D-18, D-21 |

## Goal

`app/src/lib/scoring/` exports two pure functions. `scoreSkill(tree, progress)` turns one
compiled tree plus that tree's milestone states into a `SkillProgress` — per-group and
per-level ratios, the attained level, the cleared set, the blocker, node states, and the
available set. `domainScores(taxonomy, skills)` turns a list of `{ treeId, domain,
attainedLevel }` into a `Map<DomainId, DomainScore>` **without reading any tree content at
all**. Both import nothing from Svelte, the DOM, `$app`, `lib/content`, or `lib/state`.
Alongside them ships a property-test suite over generated inputs that holds the eight
§11.9 invariants. After this task the numbers exist and are proven monotonic; nothing
renders them, which is T13 and T14.

## Why this shape

This is the most invariant-dense part of the system, so §11 is organized around what must
be true rather than around code structure, and this task follows it. Three shapes are
load-bearing and each exists to prevent a specific failure:

- **`attained`, `cleared` and `blocker` are three distinct outputs (§11.3, D-18).**
  Conflating them is the failure the design exists to avoid. `attained` is the highest *L*
  with levels 1..*L* all satisfied and is **the only input to F33**; `cleared` is the
  satisfied set and is never summed; `blocker` is the lowest unsatisfied level with its
  per-group shortfall. The word "level," unqualified, always means `attained` — in the UI,
  in the export format, and in this spec.
- **`domainScores` takes attained levels, not trees (§14.4).** §3.3 requires the world map
  to render before any bundle is fetched, and §12.3 accepts a denormalized
  `SKILL.attainedLevel` precisely so that it can. A `domainScores` that reached for tree
  content would defeat N4's incremental loading for exactly the view that must be fastest.
- **The D-21 contribution table ships as data, not a formula (§11.6).** Auditable,
  testable, tunable without a code change, and revertible to `[2,4,6,…,20]` by config if
  the owner ever reverses the NG8 call.

`dismissed` counts exactly as incomplete — not as complete, and not as removed from the
denominator (§11.2, §11.10, D-22). That clause is load-bearing and must never be
"improved"; §11.10 is reproduced in the hazards below because the improvement is the
obvious one.

## Scope

**In scope**

- §11.2 group evaluation over the two compiled rule kinds (`all`, `n_of`), with `all` over
  a set of size *m* evaluated as `n_of` with `n = m` so there is one branch.
- §11.3 attained / cleared / blocker, with `blocker` carrying per-group shortfall.
- §11.4 the five node states and the derived `available` set (F36).
- §11.5 grandfathered satisfaction (D-19) — see the contract gap flagged in the hazards.
- §11.6 the contribution table as data, `score(domain)`, and `fill(domain) = s/(s+48)`.
- §11.7 breadth (count of skills started) and recency (`max(lastActivityAt)`) as
  `DomainScore` fields — both rollups belong to this engine per T26/F4. Breadth needs no
  input field, being the row count; recency reads `DomainSkillRow.lastActivityAt`.
- The eight §11.9 invariants as **property tests over generated inputs**, not example
  unit tests. See the dedicated acceptance criteria below.
- A purity test and an ESLint `no-restricted-imports` entry expressing the §14.1 forbidden
  edge `lib/scoring ⇢ lib/content`, plus the `svelte` / `$app` / `lib/state` exclusions.

**Out of scope**

- The F30 estimator, `(tree, coarseLevel) → uid[]`. §11.8 says it slots into this engine
  with no new subsystem, but its *rule* is PRD **D20** and is unresolved — it is **T15**,
  blocked on **T00**. Do not stub it here; an empty implementation invites a wrong one.
- F29 placement. §11.8 states plainly the engine has **no special mode** for it — placement
  is ordinary milestone completion in bulk, so there is nothing to build. The UI flow is
  **T14**.
- Any rendering: bands, fill heights, tier labels, the gap-closer prompt, the un-check
  consequence dialogue. Tree presentation is **T08**, the map is **T13**, routes and
  cold-start are **T14**, the `dismissed` end-to-end flow is **T19**.
- Persistence of `attained`, the grandfathering record, and reconciliation on tree open —
  §12.3, §12.4, §12.5. That is **T09** and **T17**.
- Recency as a decaying channel. D-20 ships a date; the graded version is **R-20**,
  phase 2. (An earlier draft of this line sent the `lastActivityAt` roll-up to the store.
  T26/F4 found that unimplementable — the roll-up is *per domain*, `domain` lives only in
  the manifest, and §14.1 marks `STATE ⇢ LOADER` FORBIDDEN, so `lib/state` can never know
  which domain a tree belongs to. The roll-up is **in scope** here.)
- Hex geometry and region fill paths — **T12** and **T13**.
- Wiring purity, import, and property-test gates into CI — **T25** (§14.7, §6.5).

## Deliverables

```
app/src/lib/scoring/index.ts             public surface — the §14.4 block verbatim
app/src/lib/scoring/table.ts             the D-21 contribution table, as DATA
app/src/lib/scoring/groups.ts            §11.2 group evaluation
app/src/lib/scoring/levels.ts            §11.3 attained / cleared / blocker
app/src/lib/scoring/nodes.ts             §11.4 node states and the available set
app/src/lib/scoring/domain.ts            §11.6 score + fill, §11.7 breadth
app/src/lib/scoring/groups.test.ts       ratio, surplus, dismissed-as-incomplete
app/src/lib/scoring/levels.test.ts       the §11.3 worked example, {1,3,4,6} short at 2
app/src/lib/scoring/domain.test.ts       the table, and the §11.6 quoted figures
app/src/lib/scoring/invariants.prop.ts   generators for CompiledTree + TreeProgress
app/src/lib/scoring/invariants.test.ts   §11.9 invariants 1–8, property-based
app/src/lib/scoring/purity.test.ts       §14.7 purity + archetype grep over this dir
app/eslint.config.js                     MODIFIED — no-restricted-imports for §14.1
```

## Interface contract

Copied verbatim from ARCHITECTURE §14.4. Every downstream task — T13, T14, T15, T17, T19
— is written against this block.

```ts
export type MilestoneState = 'complete' | 'dismissed' | null;
export type NodeState = 'complete' | 'bonus' | 'available' | 'locked' | 'dismissed';

/** Everything the engine needs about one tree's user state. Widened by T26/F2 from a bare
 *  map; produced by `store.progressFor(treeId)` (§14.5, T26/F23) — synchronous, and total
 *  for an unstarted tree, so the engine never handles `undefined` here. */
export interface TreeProgress {
  readonly milestones: ReadonlyMap<string, MilestoneState>;
  readonly grandfathered: ReadonlyMap<number, FrozenSatisfaction>;   // §11.5
}

export interface GroupProgress {
  rule: 'all' | 'n_of';
  n: number;                     // threshold
  completed: number;             // raw count, may exceed n
  ratio: number;                 // min(completed, n) / n   — F11
  satisfied: boolean;
}

export interface LevelProgress {
  level: number;
  groups: GroupProgress[];
  ratio: number;                 // mean of group ratios    — F11
  satisfied: boolean;            // every group satisfied
}

export interface SkillProgress {
  levels: LevelProgress[];       // always 10 entries
  attainedLevel: number;         // §11.3 — highest contiguous satisfied prefix
  cleared: number[];             // §11.3 — satisfied levels; never summed
  blocker?: { level: number; shortfall: GroupProgress[] };   // §11.3
  tier: TierName | null;         // null iff attainedLevel === 0 — T26/F3
  nodeStates: ReadonlyMap<string, NodeState>;
  available: string[];           // uids, prerequisites met, incomplete — F36
}

export function scoreSkill(tree: CompiledTree, progress: TreeProgress): SkillProgress;

// T26/F3 + F4 — all of these are now defined in §14.4 and generated or declared in
// lib/types. Do not redeclare them locally.
export type DomainId = string;
export type TierName = 'Novice' | 'Apprentice' | 'Journeyman' | 'Expert' | 'Master';
export type Taxonomy = Manifest['taxonomy'];   // §7.2 — the engine reads only `domains`

export interface DomainSkillRow {
  readonly treeId: string;
  readonly domain: DomainId;          // PRIMARY domain, from the manifest entry
  readonly attainedLevel: number;
  readonly lastActivityAt?: string;   // ISO-8601 UTC, 'Z'-suffixed (§12.2)
}

export interface DomainScore {
  readonly domain: DomainId;
  readonly score: number;                 // Σ table[attainedLevel]
  readonly fill: number;                  // score / (score + 48)
  readonly breadth: number;               // started skills in this domain
  readonly lastActivityAt: string | null; // max over the rows; null if none
}

export function domainScores(
  taxonomy: Taxonomy,
  skills: ReadonlyArray<DomainSkillRow>,
): Map<DomainId, DomainScore>;
```

The returned map is **total over `taxonomy.domains`** — every domain gets an entry, so the
map renderer never handles `undefined`. A domain with no started skills is
`{ score: 0, fill: 0, breadth: 0, lastActivityAt: null }`. `DomainScore` carries **no band
name**: the named band is a presentation mapping over `fill` (T26/F18 owns its vocabulary,
which does not exist yet), and keeping it out means F18 changes no engine type.

Group and level arithmetic, verbatim from §11.2:

```
completed = |{ m in group.milestones : progress[m] === 'complete' }|
ratio     = min(completed, n) / n                    // F11
satisfied = completed >= n
```

Domain arithmetic, verbatim from §11.6:

```
contribution(L) = table[L]      // NORMATIVE — L^1.25 × 8, rounded
                                // [8, 19, 32, 45, 60, 75, 91, 108, 125, 142]
score(domain)   = Σ contribution(attained_i)   over skills whose PRIMARY domain is d
                                // an unstarted or level-0 skill contributes 0
fill(domain)    = s / (s + 48)  // ∈ [0, 1), asymptotic, never saturates
```

**The table is normative; `p = 1.25` is provenance only.** Invariant 4 is asserted
against these ten integers and this `k`, **never** against `L^p` — see the T26/F1
resolution. The ×8 scale is load-bearing: at ×2 or ×4 the rounding at L=2 breaks the
invariant even for a compliant exponent.

Node states, verbatim from §11.4:

| State | Condition |
|---|---|
| `complete` | `progress[uid] === 'complete'` and it is within its group's threshold |
| `bonus` | complete, but its group already had `completed >= n` without it (F11's surplus) |
| `dismissed` | `progress[uid] === 'dismissed'` |
| `available` | not complete, not dismissed, and every `requires` target is complete (F36) |
| `locked` | otherwise |

Two properties are **contractual** and are what the test suite asserts (§14.4):

- **`domainScores` never reads tree content**, which is what lets the map render before any
  bundle is fetched (§3.3, §12.3). "Tree content" means a compiled bundle: every field of
  `DomainSkillRow` comes from the manifest entry or the `SKILL` row, and the shell assembles
  that join in its derived layer (T26/F4).
- **Monotonicity (N12).** Adding a skill or completing a milestone never decreases any
  `DomainScore` field — **no exemption**, including `lastActivityAt`, which is a maximum
  over timestamps under D-20 (T26/F5). **This is a property
  test over generated inputs, not a unit test over examples** — it is the one invariant the
  PRD states most emphatically, and it deserves to be checked exhaustively rather than
  anecdotally.

## Acceptance criteria

**Group and level arithmetic (§11.2)**

- [ ] A compiled fixture containing a rule other than `all` or `n_of` fails to typecheck —
      `any` was normalized at build time (§7.3) and the engine has two rule kinds, not three.
- [ ] `all` over five milestones with three complete reports `n: 5, completed: 3,
      ratio: 0.6, satisfied: false`; with all five, `ratio: 1, satisfied: true`.
- [ ] `n_of` with `n: 2` and four complete reports `completed: 4, ratio: 1` — `ratio` is
      `min(completed, n) / n` and never exceeds 1 (F11).
- [ ] A level with an `all` group at ratio 1 and an `n_of` group at ratio 0.5 reports
      `LevelProgress.ratio === 0.75` and `satisfied === false`, and both group ratios
      survive individually in `groups[]` (§11.2, §9.6).
- [ ] Marking a milestone `dismissed` produces exactly the same `GroupProgress` as leaving
      it `null` — same `completed`, same `n`, same `ratio`, same `satisfied`. Asserted by
      deep-equality on a fixture, not by inspection (§11.2, §11.10, D-22).

**Attained, cleared, blocker (§11.3, D-18)**

- [ ] The §11.3 worked case is a named test: satisfied levels `{1, 3, 4, 6}`, one
      milestone short at level 2, yields `attainedLevel: 1`, `cleared: [1, 3, 4, 6]`, and
      `blocker.level === 2` with a non-empty `shortfall`.
- [ ] Completing that one milestone in the same fixture moves `attainedLevel` 1 → 4 and
      raises the containing domain's score by exactly 9 (`table[4] − table[1] = 11 − 2`).
- [ ] `attainedLevel === 0` for a tree with no completions, and `cleared` is `[]`.
- [ ] `blocker` is `undefined` when every level is satisfied.
- [ ] `levels` always has exactly 10 entries regardless of progress (§14.4).

**Node states and availability (§11.4, F36)**

- [ ] Each of the five states has a fixture producing it, including `bonus` — complete, but
      its group already had `completed >= n` without it.
- [ ] `available` contains only uids that are not complete, not dismissed, and whose every
      `requires` target is complete; it is derived on each call and never read from input.
- [ ] A milestone whose prerequisite is `dismissed` is `locked`, not `available` — dismissal
      is not completion.

**Domain score and fill (§11.6, D-21)**

- [ ] `table.ts` exports the literal `[8, 19, 32, 45, 60, 75, 91, 108, 125, 142]` and
      `K = 48` as data with a documented index convention, and a test asserts each entry
      equals `Math.round(L ** 1.25 * 8)` for L = 1..10. The literal is the source of
      truth; the `Math.round` test guards provenance, not behaviour.
- [ ] `score` sums `contribution(attainedLevel)` over skills whose **primary** domain is
      *d*; a test asserts a skill's `secondaryDomains` contribute to no domain's score.
- [ ] A skill at `attainedLevel: 0` contributes exactly 0.
- [ ] `domainScores` is called with a `skills` array and a taxonomy and **no tree
      argument**; a test asserts `domain.ts` imports nothing from `lib/content` and that
      `CompiledTree` does not appear in `domainScores`' type signature (§14.4, §3.3).
- [ ] One skill at L10 yields `fill ≈ 0.747` and five skills at L2 yield `fill ≈ 0.664`,
      reproducing the §11.6 depth-beats-breadth claim on the **shipped ×8 table**.
- [ ] The limits §11.6 states are also tested so they are not later mistaken for bugs:
      ten skills at L2 (`fill ≈ 0.798`) still outscores one at L9 (`fill ≈ 0.723`), and a
      domain at 8×L10 reaches `fill ≈ 0.959` without saturating.
- [ ] Breadth for a domain equals the number of entries in `skills` carrying that primary
      domain, independent of their attained levels (§11.7, F35).

**Invariants — property tests over generated inputs (§11.9, §14.4)**

- [ ] `invariants.prop.ts` exports generators producing arbitrary valid `CompiledTree`
      values (1–10 levels populated, 4–8 milestones per level, mixed `all` / `n_of` groups,
      acyclic `requires`) and arbitrary `TreeProgress` maps over their uids.
- [ ] Invariant 1 — **completing a milestone never decreases any `DomainScore` field** —
      runs over at least 1,000 generated cases and is the suite's headline test. N12.
- [ ] Invariant 2 — starting a skill contributes exactly 0. N12, F33.
- [ ] Invariant 3 — `fill` strictly increases with every level attained. F34.
- [ ] Invariant 4 — `Δfill(0→1) ≥ Δfill(L→L+1)` for all L ≥ 1 on a lone skill, computed
      **from the exported `table` and `K`, never from `L ** 1.25`.** Holds strictly against
      the shipped constants: Δ = 14.29, 14.07, 11.64, 8.39, 7.17, 5.42, 4.49, 3.76, 3.02,
      2.48 (percentage points). Resolved by T26/F1 — the earlier `k = 8` × 2 table failed
      this, and failed it invisibly because the test was written against the continuous
      curve rather than the rounded integers the app ships.
- [ ] Invariant 5 — `fill < 1` for all finite inputs, including a generated domain of 500
      skills all at L10. F34's never-saturate.
- [ ] Invariant 6 — dismissing or un-dismissing changes no score, ever; generated as a
      random dismissal mask applied to a random progress map. F46, §11.10.
- [ ] Invariant 7 — tree revision alone never decreases `attained` (§11.5). See the
      grandfathering contract gap below; if the signature cannot express it, the test
      documents the gap rather than silently passing.
- [ ] Invariant 8 — `attainedLevel <= cleared.length`, and `cleared` contains
      `1..attainedLevel` as a prefix. §11.3.
- [ ] A counter-test proves the property suite has teeth: temporarily changing §11.2 so a
      dismissed milestone shrinks the denominator makes invariant 6 **fail**, and the
      failing case is reported. This is the §11.10 catastrophe, and the suite must catch it.

**Boundaries (§14.1, §14.7)**

- [ ] `purity.test.ts` fails if any `.ts` under `app/src/lib/scoring/` imports `svelte`,
      `$app`, `$lib/state`, or `$lib/content` (§14.7 purity check, §14.1 forbidden edge).
- [ ] `purity.test.ts` fails if the literal string `archetype` appears anywhere under
      `app/src/lib/scoring/` — the §14.7 grep gate, the mechanical form of **S1**.
- [ ] `npx eslint app/src/lib/scoring` passes, and temporarily adding
      `import { x } from '$lib/content'` to `domain.ts` makes it fail on
      `no-restricted-imports`.
- [ ] A domain score recompute over 50 in-memory skills completes in under 1 ms (§17.3).
- [ ] `npx tsc --noEmit` passes with `strict: true`.

## Verification

```bash
npm run --workspace app test -- lib/scoring
npx eslint app/src/lib/scoring
npx tsc --noEmit
```

Passing looks like: every invariant test green over its generated corpus with the case
count printed, the §11.3 worked example reproducing `attained 1 → 4` and `+9`, ESLint
clean, a clean typecheck. A reviewer should be able to read the eight §11.9 invariants off
the test names in `invariants.test.ts`.

## Notes and hazards

- **§11.10 is not advice.** Letting dismissal remove a milestone from its group's
  denominator looks safe on `n_of` and is catastrophic. Dismissal is reversible (F46): on
  an `all` group over five milestones, dismissing two would let the level satisfy with
  three completions, and **un-dismissing them would then un-satisfy the level and reduce
  the score** — a direct N12 violation reachable in two clicks by an honest, additive user
  action. Denominator-shrinking also makes an all-dismissed group vacuously satisfied,
  letting a user dismiss their way to level 10. **D-22 makes this permanent.**
- **The consequence of D-22 is handled in the UI, not here.** Dismissing a milestone inside
  an `all` group at or below the blocker makes that level permanently unsatisfiable and
  caps the skill. §9.4 intercepts with a warning; the engine just recomputes honestly. Do
  not add an engine-side guard.
- **R-19 — super-linear weighting is a cardinal difficulty claim.** D-21 makes level 8
  worth 36 and level 2 worth 5, and the only reason is that level 8 is harder to reach.
  NG8 says levels do not encode estimated effort, and it is arguable this is exactly that.
  **Accepted with the flag understood.** Reversal cost is one config line, which is why the
  table ships as data. Do not replace it with a formula.
- **R-21 — shallow-tree farming.** A tree whose levels 9–10 are cheap pays out 36 for
  little. **Accepted**; the mitigation is F8's milestone bounds and F42's two-round review,
  not the scoring function. Do not add per-tree normalization.
- **R-22 — un-check blast radius.** Un-checking one milestone that was the last satisfying
  level 2 can drop attained from 8 to 1 and strip most of a domain score. **Accepted**; the
  engine recomputes honestly rather than ratcheting, because ratcheting makes an accidental
  check permanently inflating and destroys the number's meaning. Mitigated by §11.10's
  warn-before-acting and by `cleared` surviving. Do not implement a high-water mark.
- **§11.6's two constants are coupled and neither may be retuned alone.** `p = 1.25` and
  `k = 6` (`k = 48` over the ×8 table) sit on the constraint `p ≤ log₂(2k/(k−1))`, whose
  ceiling at `k = 6` is 1.263. Invariant 4 exists specifically to catch a future maintainer
  changing one of them, and it can only do so if it reads the shipped integers.

**Contradictions and gaps in the spec — flag, do not paper over:**

- **~~Invariant 4 does not hold for the shipped table.~~ RESOLVED by T26/F1, 2026-08-05.**
  The spec previously shipped `p = 1.25` at `k = 8` while asserting a boundary of 1.193 as
  a property test, and the ×2 rounding (`2 × 2^1.25 = 4.757 → 5`) widened the breach from
  6% to 14%. Now `k = 6` with the table scaled ×8, which clears the constraint strictly
  with no tolerance. **Two consequences for this task:** assert invariant 4 against the
  exported `table` and `K` rather than against `L ** 1.25`, and do **not** implement a
  tolerance — the invariant is `≥`, exact. See `docs/SPEC-FINDINGS.md` F1.
- **~~`TierName`, `DomainScore`, `Taxonomy`, and `DomainId` are used in §14.4 and defined
  nowhere.~~ RESOLVED by T26/F3, 2026-08-05.** All four are now in §14.4. Two points that
  change what this task writes: **`tier` is `TierName | null`, null exactly at
  `attainedLevel: 0`** — do not default it to Novice — and **`Taxonomy` is
  `Manifest['taxonomy']`**, generated from `schema/manifest.schema.json`, so it must not be
  hand-declared here or in `lib/types`. `DomainScore` deliberately has no band field.
- **~~`domainScores`' signature cannot produce recency.~~ RESOLVED by T26/F4,
  2026-08-05.** The row type is now `DomainSkillRow` and carries `lastActivityAt`; the
  rollup is this engine's. It is a lexicographic `max` over ISO-8601 UTC strings, which is
  safe only because §12.2 now pins that format — if a timestamp without a `Z` suffix ever
  reaches this function the comparison is silently wrong, so the property tests should
  include a mixed-precision fixture. Started skills with no `lastActivityAt` still count
  toward `breadth`; they are skipped by the max. See `docs/SPEC-FINDINGS.md` F4.
- **~~Grandfathering (§11.5, D-19) has no channel in the `scoreSkill` signature.~~
  RESOLVED by T26/F2, 2026-08-05.** `TreeProgress` widens from a bare map to
  `{ milestones: ReadonlyMap<string, MilestoneState>; grandfathered: ReadonlyMap<number,
  FrozenSatisfaction> }`, so `scoreSkill`'s arity stays at two. What the engine owes:

  ```
  satisfied(L) = evaluatedSatisfied(L)
              || (frozen[L] && frozen[L].uids.every(u => milestones.get(u) === 'complete'))
  ```

  `LevelProgress` gains `grandfathered: boolean` and `satisfiedBy: readonly string[]`.
  **The engine never writes.** It reports `satisfiedBy`; T09's store decides what to freeze
  and writes it, preserving §3.2's single-writer rule. Invariant 7 is now expressible and
  must be a real test, not a documented gap. See `docs/SPEC-FINDINGS.md` F2.
- **`blocker.shortfall: GroupProgress[]` carries no group identity.** `GroupProgress` has
  no index, id, or milestone list, so §9.6's per-group readout cannot attribute a shortfall
  to a specific group. Note it for T08/T14 rather than adding a field unilaterally.
- **`bonus` is ambiguous for a multi-group milestone.** §5.6 permits a milestone to appear
  in more than one group, and §11.4 defines `bonus` relative to "its group" as though there
  were one. A milestone can be within threshold in one group and surplus in another. Pick
  the least-surprising rule (surplus in *every* group containing it), document it in
  `nodes.ts`, and flag it.
- **§9.3 and §11.4 disagree about who owns `dismissed`.** §9.3 says four states come from
  the Scoring Engine and "`dismissed` comes from user state directly", but `NodeState`
  includes `dismissed` and §11.4 defines it. Follow §14.4 — the engine emits all five —
  and note the discrepancy for T19.
- **Index convention still needs stating, and the prose figures were re-derived.**
  T26/F1 recomputed every quoted figure against the ×8 table and corrected the spec:
  R-22 now reads 100 (`table[8] − table[1]` = 108 − 8, **1-based**), §11.3 reads 37
  (45 − 8), R-21 reads 142, and the 10×L2 vs 1×L9 gap is 7.6 points. Declare the index
  convention in `table.ts` before writing anything that indexes it, and assert against the
  **shipped table** rather than any prose figure — the whole class of defect F1 caught was
  prose and artefact drifting apart.
- **No property-testing library is named anywhere in the architecture.** `fast-check` is
  the obvious fit for a Vitest workspace; whichever is chosen, it is a devDependency of
  `app/` only — `tools/` declares no application dependencies (§4.2).
- **§11.1's pipeline diagram has two wrong cross-references**: it cites §11.6 for
  grandfathering (which is §11.5) and §11.7 for `domainScores` (which is §11.6). Harmless,
  but do not follow the diagram's section numbers when hunting for a rule.

## T26 amendments — 2026-08-06

**F19 — `DomainSkillRow.lastActivityAt` is `string`, not `string | undefined`.** §12.2's
watermark is total: `startSkill` seeds it from `startedAt`, so a started skill always
carries a date and the row needs no absent branch. `DomainScore.lastActivityAt` stays
`string | null`, and there is now exactly **one** null case — a domain with no started
skills. §11.7's second null case ("started skills with no recorded activity") is gone.

Goes to **T11b** when this doc splits.

**F22.** §11.6's sum skips a `SKILL` row with no manifest entry: no entry means no `domain`,
so it never becomes a `DomainSkillRow` and is summed nowhere. It is not deleted — see T14's
join and T09's retention rule. Nothing in the engine changes; the row simply never arrives.
