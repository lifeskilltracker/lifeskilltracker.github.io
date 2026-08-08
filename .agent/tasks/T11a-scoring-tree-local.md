# T11a — Scoring Engine: tree-local evaluation

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | pure-engines |
| **Blocked by** | T02 |
| **Blocks** | T08 |
| **Spec** | ARCHITECTURE §11.1, §11.2, §11.3, §11.4, §14.4 |
| **PRD** | F9, F11, F36, D-18, D-22 |

Split from `T11-scoring-engine.md` on 2026-08-06 per T26/F16. The sibling half is
**T11b** (§11.5–§11.9, phase 1). Nothing in the original document was wrong; only its
phase assignment and blocking edges were.

## Goal

`app/src/lib/scoring/` exports one pure function, `scoreSkill(tree, progress)`, which
turns one compiled tree plus that tree's milestone states into a `SkillProgress`: the
per-group and per-level ratios, the attained level, the cleared set, the blocker with its
per-group shortfall, the tier name, the five node states, and the available set. It
imports nothing from Svelte, the DOM, `$app`, `lib/content`, or `lib/state`. Alongside it
ship the generators for `CompiledTree` and `TreeProgress` that both halves of the engine
property-test against. After this task a tree can be rendered and completed — which is
what §16.4's walking skeleton means by "completable" — and nothing yet aggregates across
trees, which is T11b.

## Why this shape

§11 spans the phase boundary and **the seam is §11.5**. §11.1–§11.4 are computable from
one compiled tree plus that tree's progress and touch no persisted state; §11.5 is the
first thing in the section that *writes* (`SKILL.grandfathered`, §12.2), so it belongs
after T10's schema gate rather than before it. This task is the half that must exist
first, because §9.3 reads `complete`, `available` and `locked` directly and has no other
producer for them.

Three shapes are load-bearing and each exists to prevent a specific failure:

- **`attained`, `cleared` and `blocker` are three distinct outputs (§11.3, D-18).**
  Conflating them is the failure the design exists to avoid. `attained` is the highest *L*
  with levels 1..*L* all satisfied and is **the only input to F33**; `cleared` is the
  satisfied set and is never summed; `blocker` is the lowest unsatisfied level with its
  per-group shortfall. The word "level," unqualified, always means `attained` — in the UI,
  in the export format, and in this spec.
- **`all` is evaluated as `n_of` with `n = m` (§11.2).** One branch, not two. `any` was
  already normalized to `n_of` with `n: 1` at build time (§7.3), so the engine sees two
  rule kinds and the compiled type must make a third fail to typecheck.
- **`dismissed` counts exactly as incomplete** — not as complete, and not as removed from
  the denominator (§11.2, §11.10, D-22). That clause is load-bearing and must never be
  "improved"; §11.10 is reproduced in the hazards below because the improvement is the
  obvious one.

## Scope

**In scope**

- §11.2 group evaluation over the two compiled rule kinds (`all`, `n_of`), with `all` over
  a set of size *m* evaluated as `n_of` with `n = m` so there is one branch.
- §11.3 attained / cleared / blocker, with `blocker` carrying per-group shortfall, and the
  `attainedLevel → TierName | null` mapping (F7's pairs of levels 1–10; `null` exactly at
  `attainedLevel: 0`).
- §11.4 the five node states and the derived `available` set (F36).
- **The `satisfiedBy` field on `LevelProgress`** — the uids that satisfy each level now.
  It is tree-local, T09 is the thing that freezes it, and computing it here means T11b adds
  only the grandfathering disjunct rather than a field.
- **The full §14.4 `TreeProgress` type including `grandfathered`**, accepted and left
  unread until T11b. The signature must not move between phases; T08 and T09 are written
  against it in phase 0.
- `invariants.prop.ts` — generators for arbitrary valid `CompiledTree` and `TreeProgress`
  values. Shared: T11b extends them rather than writing its own.
- §11.9 invariant 8 (`attainedLevel <= cleared.length`, `cleared` contains
  `1..attainedLevel` as a prefix) and the tree-local form of invariant 6 (a dismissal mask
  never changes `attainedLevel`), both as property tests, plus the §11.10 counter-test.
- A purity test and an ESLint `no-restricted-imports` entry expressing the §14.1 forbidden
  edge `lib/scoring ⇢ lib/content`, plus the `svelte` / `$app` / `lib/state` exclusions.

**Out of scope**

- **Everything from §11.5 onward is T11b**: grandfathered satisfaction, the D-21
  contribution table, `score`, `fill`, breadth, recency, `domainScores`, `DomainSkillRow`,
  `DomainScore`, `Taxonomy`, `DomainId`, and §11.9 invariants 1–5 and 7. Do not
  pre-implement any of it; a stub `domainScores` returning zeros is worse than its absence,
  because T13 and T14 would render it.
- The F30 estimator, `(tree, coarseLevel) → uid[]`. Its rule is PRD **D20** and is
  unresolved — **T15**, blocked on **T00**.
- F29 placement. §11.8 states plainly the engine has **no special mode** for it — placement
  is ordinary milestone completion in bulk. The UI flow is **T14**.
- Any rendering: tier labels, the gap-closer prompt, the un-check consequence dialogue,
  the three-state tree rows. Tree presentation is **T08**, the `dismissed` end-to-end flow
  is **T19**.
- Persistence of `attained`, the grandfathering record, and reconciliation on tree open —
  §12.3, §12.4, §12.5. That is **T09** and **T17**.
- Hex geometry and region fill paths — **T12** and **T13**.
- Wiring purity, import, and property-test gates into CI — **T25** (§14.7, §6.5).

## Deliverables

```
app/src/lib/scoring/index.ts             public surface — the tree-local half of §14.4
app/src/lib/scoring/groups.ts            §11.2 group evaluation
app/src/lib/scoring/levels.ts            §11.3 attained / cleared / blocker / tier
app/src/lib/scoring/nodes.ts             §11.4 node states and the available set
app/src/lib/scoring/groups.test.ts       ratio, surplus, dismissed-as-incomplete
app/src/lib/scoring/levels.test.ts       the §11.3 worked example, {1,3,4,6} short at 2
app/src/lib/scoring/nodes.test.ts        one fixture per node state, including bonus
app/src/lib/scoring/invariants.prop.ts   generators for CompiledTree + TreeProgress
app/src/lib/scoring/invariants.test.ts   §11.9 invariants 6 (tree-local) and 8
app/src/lib/scoring/purity.test.ts       §14.7 purity + archetype grep over this dir
eslint.config.js                     MODIFIED — disjoint no-restricted-imports slice for §14.1
app/package.json                         MODIFIED — fast-check as an app devDependency
```

`table.ts`, `domain.ts`, `domain.test.ts` and the remaining invariant tests are **T11b's**.
`levels.ts`, `index.ts` and `invariants.prop.ts` are modified again by T11b; write them so
that the grandfathering disjunct is one added clause, not a restructure.

## Interface contract

Copied verbatim from ARCHITECTURE §14.4, restricted to the declarations this task ships.
T08 is written against this block, so it is normative.

```ts
export type MilestoneState = 'complete' | 'dismissed' | null;
export type NodeState = 'complete' | 'bonus' | 'available' | 'locked' | 'dismissed';

/** The five tier names, F7's presentation vocabulary over pairs of levels (§2). Carries no
 *  completion semantics of its own — it is a rendering of `attainedLevel`. */
export type TierName = 'Novice' | 'Apprentice' | 'Journeyman' | 'Expert' | 'Master';

/** A level's frozen satisfaction record — §11.5, D-19. Declared here so `TreeProgress`
 *  is complete in phase 0; the field it types is READ BY T11b, not by this task. */
export interface FrozenSatisfaction {
  readonly uids: readonly string[];   // the set that first satisfied the level
  readonly contentVersion: number;    // the version it was frozen against
}

/** Everything the engine needs about one tree's user state. Produced by
 *  `store.progressFor(treeId)` (§14.5, T26/F23) — synchronous, and total for an unstarted
 *  tree, so the engine never handles `undefined` here. */
export interface TreeProgress {
  readonly milestones: ReadonlyMap<string, MilestoneState>;
  readonly grandfathered: ReadonlyMap<number, FrozenSatisfaction>;   // §11.5 — T11b
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
  satisfied: boolean;            // satisfied by evaluation OR grandfathered — §11.5
  grandfathered: boolean;        // true when only the frozen record holds it up
  satisfiedBy: readonly string[];// uids that satisfy it now; the store freezes this — §11.5
}

export interface SkillProgress {
  levels: LevelProgress[];       // always 10 entries
  attainedLevel: number;         // §11.3 — highest contiguous satisfied prefix
  cleared: number[];             // §11.3 — satisfied levels; never summed
  blocker?: { level: number; shortfall: GroupProgress[] };   // §11.3
  tier: TierName | null;         // null iff attainedLevel === 0 — §11.3
  nodeStates: ReadonlyMap<string, NodeState>;
  available: string[];           // uids, prerequisites met, incomplete — F36
}

export function scoreSkill(tree: CompiledTree, progress: TreeProgress): SkillProgress;
```

**Two fields are shipped in their final shape but not in their final behaviour**, and this
is the only place in the split where that is true:

- `LevelProgress.grandfathered` is **always `false`** after this task. T11b adds the
  §11.5 disjunct that can make it true.
- `TreeProgress.grandfathered` is accepted and **not read**. It is in the type because
  `store.progressFor` (T09, phase 0) returns it and because widening the signature in
  phase 1 would break T08, which is already written against it.

Do not narrow either one "until T11b needs it". The whole point of shipping the §14.4
block whole is that no downstream task's types change at the phase boundary.

Group and level arithmetic, verbatim from §11.2:

```
completed = |{ m in group.milestones : progress[m] === 'complete' }|
ratio     = min(completed, n) / n                    // F11
satisfied = completed >= n
```

A level is satisfied when every one of its groups is satisfied; its reported ratio is the
unweighted mean of its groups' ratios. Per-group ratios survive individually, because a
level with an `all` group and an `n_of` group has two independent things to report and
§9.6 renders them separately.

Attained, cleared, blocker, verbatim from §11.3:

| | Definition | Feeds score? | Displayed as |
|---|---|---|---|
| **`attained`** | Highest *L* such that levels 1..*L* are all satisfied | **yes — the only input to F33** | "Level 4 · Apprentice" |
| **`cleared`** | The set of satisfied levels, contiguous or not | never | "6 of 10 levels cleared" |
| **`blocker`** | Lowest unsatisfied level, with per-group shortfall | never | "Level 2 needs 1 more milestone" |

`tier` is F7's pairs over levels 1–10 — Novice 1–2, Apprentice 3–4, Journeyman 5–6, Expert
7–8, Master 9–10 — and **`null` at `attainedLevel: 0`**, which §11.3 displays as "Level 0
— not yet ranked". Do not default it to Novice: a nullable field makes every consumer
handle a case a defaulted one would hide.

Node states, verbatim from §11.4:

| State | Condition |
|---|---|
| `complete` | `progress[uid] === 'complete'` and it is within its group's threshold |
| `bonus` | complete, but its group already had `completed >= n` without it (F11's surplus) |
| `dismissed` | `progress[uid] === 'dismissed'` |
| `available` | not complete, not dismissed, and every `requires` target is complete (F36) |
| `locked` | otherwise |

`available` is derived, never stored, and is the concrete-next-action set the product
exists to supply (§15.2's `.` shortcut jumps between them).

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

**Attained, cleared, blocker, tier (§11.3, D-18)**

- [ ] The §11.3 worked case is a named test: satisfied levels `{1, 3, 4, 6}`, one
      milestone short at level 2, yields `attainedLevel: 1`, `cleared: [1, 3, 4, 6]`, and
      `blocker.level === 2` with a non-empty `shortfall`.
- [ ] Completing that one milestone in the same fixture moves `attainedLevel` 1 → 4. (The
      domain-score consequence — **+37**, `table[4] − table[1] = 45 − 8` — is T11b's
      criterion, not this one.)
- [ ] `attainedLevel === 0` for a tree with no completions, `cleared` is `[]`, and
      `tier` is `null` — not `'Novice'`.
- [ ] `tier` reads Novice at attained 1 and 2, Apprentice at 3 and 4, Journeyman at 5 and
      6, Expert at 7 and 8, Master at 9 and 10 — one assertion per level, ten in all.
- [ ] `blocker` is `undefined` when every level is satisfied.
- [ ] `levels` always has exactly 10 entries regardless of progress (§14.4).
- [ ] `LevelProgress.satisfiedBy` lists exactly the complete uids that make each satisfied
      level satisfied, and is `[]` for an unsatisfied level. On an `n_of` group with
      surplus completions it contains **all** of them, not the first `n` — the store freezes
      what the user actually did (§11.5), and picking `n` of them would make the frozen set
      depend on iteration order.
- [ ] `LevelProgress.grandfathered` is `false` for every level, on every fixture, including
      one whose `TreeProgress.grandfathered` map is non-empty. A test asserts this
      explicitly and names T11b, so the phase-1 change has a failing counterpart to flip.

**Node states and availability (§11.4, F36)**

- [ ] Each of the five states has a fixture producing it, including `bonus` — complete, but
      its group already had `completed >= n` without it.
- [ ] `available` contains only uids that are not complete, not dismissed, and whose every
      `requires` target is complete; it is derived on each call and never read from input.
- [ ] A milestone whose prerequisite is `dismissed` is `locked`, not `available` — dismissal
      is not completion.
- [ ] A milestone appearing in two groups, surplus in one and within threshold in the
      other, has its rule documented in `nodes.ts` and asserted by a fixture. See the
      hazard below; pick surplus-in-every-group and flag it.

**Invariants — property tests over generated inputs (§11.9, §14.4)**

- [ ] `invariants.prop.ts` exports generators producing arbitrary valid `CompiledTree`
      values (1–10 levels populated, 4–8 milestones per level, mixed `all` / `n_of` groups,
      acyclic `requires`) and arbitrary `TreeProgress` values over their uids, with an
      empty `grandfathered` map. The generators are **exported**, because T11b extends them.
- [ ] Invariant 8 — `attainedLevel <= cleared.length`, and `cleared` contains
      `1..attainedLevel` as a prefix — runs over at least 1,000 generated cases. §11.3.
- [ ] Invariant 6, tree-local half — applying a random dismissal mask to a random progress
      map changes no `attainedLevel`, no `cleared`, and no `GroupProgress`. F46, §11.10.
      (The score half of invariant 6 is T11b's; it cannot be stated before `score` exists.)
- [ ] A counter-test proves the property suite has teeth: temporarily changing §11.2 so a
      dismissed milestone shrinks the denominator makes the tree-local invariant 6 **fail**,
      and the failing case is reported. This is the §11.10 catastrophe, and the suite must
      catch it in phase 0 — before any content is authored against it.

**Boundaries (§14.1, §14.7)**

- [ ] `purity.test.ts` fails if any `.ts` under `app/src/lib/scoring/` imports `svelte`,
      `$app`, `$lib/state`, or `$lib/content` (§14.7 purity check, §14.1 forbidden edge).
- [ ] `purity.test.ts` fails if the literal string `archetype` appears anywhere under
      `app/src/lib/scoring/` — the §14.7 grep gate, the mechanical form of **S1**.
- [ ] `npx eslint app/src/lib/scoring` passes, and temporarily adding
      `import { x } from '$lib/content'` to `levels.ts` makes it fail on
      `no-restricted-imports`.
- [ ] `scoreSkill` over a 10-level, 80-milestone tree completes in under 1 ms (§17.3).
- [ ] `npx tsc --noEmit` passes with `strict: true`.

## Verification

```bash
npm run --workspace app test -- lib/scoring
npx eslint app/src/lib/scoring
npx tsc --noEmit
```

Passing looks like: the §11.3 worked example reproducing `attained 1 → 4`, ten tier
assertions green, invariants 6 and 8 green over their generated corpora with the case
count printed, ESLint clean, a clean typecheck.

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
- **R-22 — un-check blast radius.** Un-checking one milestone that was the last satisfying
  level 2 can drop attained from 8 to 1. **Accepted**; the engine recomputes honestly
  rather than ratcheting, because ratcheting makes an accidental check permanently
  inflating and destroys the number's meaning. Mitigated by §11.10's warn-before-acting and
  by `cleared` surviving. Do not implement a high-water mark. (§11.5's grandfathering is
  **not** a ratchet and does not contradict this — un-checking a frozen uid drops the
  level. It is T11b's, and it is the only mechanism permitted to preserve satisfaction.)
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
- **§11.1's pipeline diagram has two wrong cross-references**: it cites §11.6 for
  grandfathering (which is §11.5) and §11.7 for `domainScores` (which is §11.6). Harmless,
  but do not follow the diagram's section numbers when hunting for a rule.
- **No property-testing library is named anywhere in the architecture.** `fast-check` is
  the obvious fit for a Vitest workspace; whichever is chosen, it is a devDependency of
  `app/` only — `tools/` declares no application dependencies (§4.2). **This task makes the
  choice**, because it ships the first property tests; T11b inherits it.
- **~~`TierName` is used in §14.4 and defined nowhere.~~ RESOLVED by T26/F3, 2026-08-05.**
  It is now in §14.4. Two points that change what this task writes: **`tier` is
  `TierName | null`, null exactly at `attainedLevel: 0`** — do not default it to Novice —
  and `Taxonomy` is `Manifest['taxonomy']`, generated from `schema/manifest.schema.json`,
  so it must not be hand-declared anywhere (that one matters to **T11b**, which uses it).
- **~~Grandfathering has no channel in the `scoreSkill` signature.~~ RESOLVED by T26/F2,
  2026-08-05.** `TreeProgress` widens from a bare map to
  `{ milestones; grandfathered }`, so `scoreSkill`'s arity stays at two, and
  `LevelProgress` gains `grandfathered` and `satisfiedBy`. **This task ships all three
  fields and implements `satisfiedBy` only** — see the interface contract. The behaviour
  behind `grandfathered` is T11b's.
