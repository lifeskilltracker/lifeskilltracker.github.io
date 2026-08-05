# T11 — Scoring Engine

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | pure-engines |
| **Blocked by** | T10 |
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
- §11.6 the contribution table as data, `score(domain)`, and `fill(domain) = s/(s+16)`.
- §11.7 breadth (count of skills started) as a `DomainScore` field.
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
  phase 2. `lastActivityAt` roll-up is a store concern (§12.4, T09).
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

/** All milestone states for one tree, keyed by uid. */
export type TreeProgress = ReadonlyMap<string, MilestoneState>;

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
  tier: TierName;
  nodeStates: ReadonlyMap<string, NodeState>;
  available: string[];           // uids, prerequisites met, incomplete — F36
}

export function scoreSkill(tree: CompiledTree, progress: TreeProgress): SkillProgress;

export function domainScores(
  taxonomy: Taxonomy,
  skills: ReadonlyArray<{ treeId: string; domain: DomainId; attainedLevel: number }>,
): Map<DomainId, DomainScore>;
```

Group and level arithmetic, verbatim from §11.2:

```
completed = |{ m in group.milestones : progress[m] === 'complete' }|
ratio     = min(completed, n) / n                    // F11
satisfied = completed >= n
```

Domain arithmetic, verbatim from §11.6:

```
contribution(L) = table[L]      // L^1.25 × 2, rounded — integer arithmetic
                                // [2, 5, 8, 11, 15, 19, 23, 27, 31, 36]
score(domain)   = Σ contribution(attained_i)   over skills whose PRIMARY domain is d
                                // an unstarted or level-0 skill contributes 0
fill(domain)    = s / (s + 16)  // ∈ [0, 1), asymptotic, never saturates
```

Node states, verbatim from §11.4:

| State | Condition |
|---|---|
| `complete` | `progress[uid] === 'complete'` and it is within its group's threshold |
| `bonus` | complete, but its group already had `completed >= n` without it (F11's surplus) |
| `dismissed` | `progress[uid] === 'dismissed'` |
| `available` | not complete, not dismissed, and every `requires` target is complete (F36) |
| `locked` | otherwise |

Two properties are **contractual** and are what the test suite asserts (§14.4):

- **`domainScores` never reads tree content.** It takes attained levels only, which is
  what lets the map render before any bundle is fetched (§3.3, §12.3).
- **Monotonicity (N12).** Adding a skill or completing a milestone never decreases any
  `DomainScore` field except the explicitly decaying recency channel. **This is a property
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

- [ ] `table.ts` exports the literal `[2, 5, 8, 11, 15, 19, 23, 27, 31, 36]` as data with a
      documented index convention, and a test asserts each entry equals
      `Math.round(L ** 1.25 * 2)` for L = 1..10.
- [ ] `score` sums `contribution(attainedLevel)` over skills whose **primary** domain is
      *d*; a test asserts a skill's `secondaryDomains` contribute to no domain's score.
- [ ] A skill at `attainedLevel: 0` contributes exactly 0.
- [ ] `domainScores` is called with a `skills` array and a taxonomy and **no tree
      argument**; a test asserts `domain.ts` imports nothing from `lib/content` and that
      `CompiledTree` does not appear in `domainScores`' type signature (§14.4, §3.3).
- [ ] One skill at L10 yields `fill ≈ 0.692` and five skills at L2 yield `fill ≈ 0.610`,
      reproducing the §11.6 depth-beats-breadth claim on the **shipped doubled table**.
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
- [ ] Invariant 4 — `Δfill(0→1) ≥ Δfill(L→L+1)` for all L ≥ 1 on a lone skill. **This test
      fails against the shipped `p = 1.25` table; see the hazard below before writing it.**
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
  `k = 8` (`k = 16` over the doubled table) sit on the constraint `p ≤ log₂(2k/(k−1))`.
  Invariant 4 exists specifically to catch a future maintainer changing one of them.

**Contradictions and gaps in the spec — flag, do not paper over:**

- **Invariant 4 does not hold for the shipped table.** §11.9 makes
  `Δfill(0→1) ≥ Δfill(L→L+1)` an executable test, but §11.6 states in the same section that
  `p = 1.25` at `k = 8` "sits 5% over the strict boundary" — Δ(0→1) = 11.1% against
  Δ(1→2) = 11.8%. The invariant as written **fails on the table as shipped**. §11.6 offers
  the resolution ("ship `p = 1.19` instead if strict concavity by construction matters more
  than the depth premium") but does not take it. This is a genuine self-contradiction and
  it is not this task's to settle — it is adjacent to **R-25**, which is **T00**. Implement
  invariant 4 as a test with an explicit, documented tolerance matching the shipped table,
  and record the discrepancy in the test body so the next maintainer sees it. Do not
  quietly weaken the invariant to `≥ 0`.
- **`TierName`, `DomainScore`, `Taxonomy`, and `DomainId` are used in §14.4 and defined
  nowhere in the architecture.** `TierName` is recoverable from §2's glossary — Novice
  (1–2), Apprentice (3–4), Journeyman (5–6), Expert (7–8), Master (9–10) — but the spec
  never says what tier `attainedLevel: 0` reports. `DomainScore`'s fields are inferable
  from §11.6, §11.7 and §10.5 (score, fill, band name, breadth, last activity) but are
  never typed. These belong in `lib/types` from T02/T10; if they are absent, raise it
  rather than defining them locally in `lib/scoring`.
- **`domainScores`' signature cannot produce recency.** §11.7 requires each domain to
  report `lastActivityAt` rolled up as a maximum, but the `skills` rows carry only
  `{ treeId, domain, attainedLevel }`. Either `DomainScore` omits recency (and T13 gets it
  from the store) or the signature is incomplete. The §14.4 block is normative, so do not
  silently widen it — surface the mismatch to whoever owns T13.
- **Grandfathering (§11.5, D-19) has no channel in the `scoreSkill` signature.** §11.5
  requires re-evaluation against the *frozen* group definition and the `contentVersion` at
  the moment a level was first satisfied, and says user state persists that record. But
  `scoreSkill(tree, progress)` receives only the tree and a `uid → MilestoneState` map —
  there is nowhere for the frozen record to enter. Invariant 7 is therefore not expressible
  against the contract as typed. **This is the most consequential gap in §11** and must be
  resolved with T09/T17 before implementation: either the signature gains an optional third
  argument, or grandfathering moves out of this engine entirely.
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
- **Minor arithmetic drift, worth knowing before a test disagrees with the prose.**
  R-22 says dropping attained 8 → 1 removes 31 from a domain score; `table[8] − table[1]`
  is `27 − 2 = 25` under 1-based indexing, and 31 is `table[8]` under **0-based** indexing.
  Fix the index convention in `table.ts` first and state it. Separately, §11.6 claims the
  doubled table over `s/(s+16)` is "the identical curve" to the raw `L^1.25` over
  `s/(s+8)`; rounding breaks that identity, and the quoted 10×L2 vs 1×L9 gap of 8.7 points
  is 9.8 points on the shipped rounded table. Assert against the **shipped table**, not
  against the prose's unscaled figures.
- **No property-testing library is named anywhere in the architecture.** `fast-check` is
  the obvious fit for a Vitest workspace; whichever is chosen, it is a devDependency of
  `app/` only — `tools/` declares no application dependencies (§4.2).
- **§11.1's pipeline diagram has two wrong cross-references**: it cites §11.6 for
  grandfathering (which is §11.5) and §11.7 for `domainScores` (which is §11.6). Harmless,
  but do not follow the diagram's section numbers when hunting for a rule.
