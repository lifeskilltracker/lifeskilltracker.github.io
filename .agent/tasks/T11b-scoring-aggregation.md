# T11b — Scoring Engine: grandfathering and aggregation

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | pure-engines |
| **Blocked by** | T10 |
| **Blocks** | T13, T14, T15, T17, T19 |
| **Spec** | ARCHITECTURE §11.5, §11.6, §11.7, §11.8, §11.9, §14.4 |
| **PRD** | F33, F34, F35, N12, D-19, D-20, D-21 |

Split from `T11-scoring-engine.md` on 2026-08-06 per T26/F16. The sibling half is
**T11a** (§11.1–§11.4, phase 0), which ships `scoreSkill` and the generators this task
extends. Nothing in the original document was wrong; only its phase assignment and its
blocking edges were.

## Goal

`app/src/lib/scoring/` gains the second half of §11: `scoreSkill` starts honouring §11.5's
frozen satisfaction records, and a new pure function `domainScores(taxonomy, skills)`
turns a list of `{ treeId, domain, attainedLevel, lastActivityAt }` into a
`Map<DomainId, DomainScore>` — score, fill, breadth and recency per domain — **without
reading any tree content at all**. The D-21 contribution table ships as auditable data.
Alongside them ships the property-test suite that holds all eight §11.9 invariants over
generated inputs. After this task the numbers exist and are proven monotonic; nothing
renders them, which is T13 and T14.

## Why this shape

This is the half of §11 that crosses tree boundaries and touches persisted state, and it
is deliberately after **T10**: §11.5 is the first thing in the section that writes
(`SKILL.grandfathered`, §12.2), which is exactly what the phase-0 schema gate exists to
break while the corpus is one tree. Three shapes are load-bearing:

- **`domainScores` takes attained levels, not trees (§14.4).** §3.3 requires the world map
  to render before any bundle is fetched, and §12.3 accepts a denormalized
  `SKILL.attainedLevel` precisely so that it can. A `domainScores` that reached for tree
  content would defeat N4's incremental loading for exactly the view that must be fastest.
- **The D-21 contribution table ships as data, not a formula (§11.6).** Auditable,
  testable, tunable without a code change, and revertible to the flat `[8,16,24,…,80]` by
  config if the owner ever reverses the NG8 call.
- **The engine reads `grandfathered` and never writes it (§11.5, §3.2).** `scoreSkill`
  reports `satisfiedBy`; T09's store decides what to freeze and performs the write inside
  the transaction §12.4 already opens. An engine that froze its own records would be a
  second writer with no transaction.

## Scope

**In scope**

- §11.5 grandfathered satisfaction (D-19) — the one-line disjunct added to `levels.ts`,
  and `LevelProgress.grandfathered` becoming true when only the frozen record holds a
  level up.
- §11.6 the contribution table as data, `score(domain)`, and `fill(domain) = s/(s+48)`.
- §11.6's **five-band table and its resolver** — `Quiet`, `Emerging`, `Moderate`, `Active`,
  `Deep` — as one pure, dependency-free data module. The band name is `string`, not a
  closed union; `DomainScore` carries no band field. See the hazards: this is T26/F18's
  resolution and its constraints are the point of it.
- §11.7 breadth (count of skills started) and recency (`max(lastActivityAt)`) as
  `DomainScore` fields — both rollups belong to this engine per T26/F4. Breadth needs no
  input field, being the row count.
- The remaining §11.9 invariants — **1, 2, 3, 4, 5, 7, and the score half of 6** — as
  property tests over generated inputs, extending T11a's `invariants.prop.ts` with a
  `DomainSkillRow` generator.
- Extending `index.ts` with the aggregation surface, and `eslint.config.js` (root —
  **T01** creates it; add a disjoint `no-restricted-imports` slice here; serialize edits
  with **T06** and **T11a**) /
  `purity.test.ts` coverage over the new files (both already exist from T11a).

**Out of scope**

- **Everything T11a already shipped**: group evaluation, attained/cleared/blocker, the
  tier mapping, the five node states, the available set, and invariants 6 (tree-local) and
  8. Do not restructure them; §11.5 is one added disjunct in `levels.ts`.
- The F30 estimator, `(tree, coarseLevel) → uid[]`. §11.8 says it slots into this engine
  with no new subsystem, but its *rule* is PRD **D20** and is unresolved — it is **T15**,
  blocked on **T00**. Do not stub it here; an empty implementation invites a wrong one.
- F29 placement. §11.8 states plainly the engine has **no special mode** for it — placement
  is ordinary milestone completion in bulk, so there is nothing to build. The UI flow is
  **T14**.
- **Deciding what to freeze, and writing it.** The engine reports `satisfiedBy`; the store
  writes `SKILL.grandfathered` — **T09**, §12.4, §3.2's single-writer rule.
- **The manifest × `SKILL` join that produces `DomainSkillRow`.** It is the App Shell's
  `$derived` layer — **T14**, §13.2, T26/F4. This task consumes rows; it does not assemble
  them.
- Any rendering: region fill heights, band labels, the "Last activity — 12 March" string,
  the gap-closer prompt. The map is **T13**, routes and cold-start are **T14**, the
  `dismissed` end-to-end flow is **T19**.
- Recency as a decaying channel. D-20 ships a date; the graded version is **R-20**,
  phase 2. If it ever ships it is a *rendering* function of `lastActivityAt` in the Map
  Renderer, not a `DomainScore` field, and invariant 1 does not need reopening for it.
- Persistence of `attained` and reconciliation on tree open — §12.3, §12.5. **T09**, **T17**.
- Hex geometry and region fill paths — **T12** and **T13**.
- Wiring purity, import, and property-test gates into CI — **T25** (§14.7, §6.5).

## Deliverables

```
app/src/lib/scoring/table.ts             the D-21 contribution table, as DATA
app/src/lib/scoring/bands.ts             §11.6's five bands + resolver, as DATA
app/src/lib/scoring/domain.ts            §11.6 score + fill, §11.7 breadth + recency
app/src/lib/scoring/domain.test.ts       the table, the bands, the §11.6 quoted figures
app/src/lib/scoring/levels.ts            MODIFIED — §11.5's disjunct, grandfathered: true
app/src/lib/scoring/levels.test.ts       MODIFIED — grandfathering cases
app/src/lib/scoring/index.ts             MODIFIED — the aggregation surface
app/src/lib/scoring/invariants.prop.ts   MODIFIED — a DomainSkillRow generator
app/src/lib/scoring/invariants.test.ts   MODIFIED — §11.9 invariants 1–5, 6 (score), 7
eslint.config.js                         MODIFIED — disjoint no-restricted-imports slice (root; serialize with T06/T11a)
```

## Interface contract

Copied verbatim from ARCHITECTURE §14.4, restricted to the declarations this task ships.
T13, T14, T15, T17 and T19 are written against this block, so it is normative. T11a's
half — `MilestoneState`, `NodeState`, `TierName`, `FrozenSatisfaction`, `TreeProgress`,
`GroupProgress`, `LevelProgress`, `SkillProgress`, `scoreSkill` — is unchanged in shape by
this task; only two of its fields change behaviour.

```ts
/** A domain id declared in `domains.yaml` (§5.9). Ids are stable forever and never derived
 *  from the display name, which is the mechanism behind F20. */
export type DomainId = string;

/** The compiled taxonomy block of the manifest (§7.2) — domains, facets, and map geometry.
 *  Not a separate artifact: it is generated from `schema/manifest.schema.json` (§7.3) like
 *  the rest of `Manifest`, so there is one description of it and it lives in `lib/types`.
 *  The Scoring Engine reads only `domains`, and reads it only to emit an entry per domain. */
export type Taxonomy = Manifest['taxonomy'];

/** One started skill, as the App Shell joins it: manifest tree entry × `SKILL` row.
 *  Every field is available without fetching a bundle, which is the whole point. */
export interface DomainSkillRow {
  readonly treeId: string;          // manifest entry id / SKILL key
  readonly domain: DomainId;        // PRIMARY domain — manifest entry (§7.2), never a bundle
  readonly attainedLevel: number;   // SKILL.attainedLevel — §12.2, §12.3
  readonly lastActivityAt: string;  // SKILL.lastActivityAt — §12.2; total, `startSkill` seeds it
}

/** One domain's three map channels (§10.5), computed together because they are three
 *  reductions over the same row set. Returned for every domain in the taxonomy. */
export interface DomainScore {
  readonly domain: DomainId;
  readonly score: number;                 // Σ table[attainedLevel] — §11.6; integer; 0 if none
  readonly fill: number;                  // score / (score + 48) ∈ [0, 1) — §11.6
  readonly breadth: number;               // started skills in this domain — §11.7
  readonly lastActivityAt: string | null; // max over the rows — §11.7; null if no activity
}

export function domainScores(
  taxonomy: Taxonomy,
  skills: ReadonlyArray<DomainSkillRow>,
): Map<DomainId, DomainScore>;
```

The returned map is **total over `taxonomy.domains`** — every domain gets an entry, so the
map renderer never handles `undefined`. A domain with no started skills is
`{ score: 0, fill: 0, breadth: 0, lastActivityAt: null }`. **`DomainScore` carries no band
name**: the named band is a presentation mapping over `fill`, and keeping it out is what
makes the band table tunable — were it a field here, moving a boundary would be an engine
change with property tests to re-derive.

Domain arithmetic, verbatim from §11.6:

```
contribution(L) = table[L]      // NORMATIVE — L^1.25 × 8, rounded
                                // [8, 19, 32, 45, 60, 75, 91, 108, 125, 142]
score(domain)   = Σ contribution(attained_i)   over skills whose PRIMARY domain is d
                                // an unstarted or level-0 skill contributes 0
                                // a SKILL row with no manifest entry has no domain,
                                // so it joins nothing and is summed nowhere (§14.4)
fill(domain)    = s / (s + 48)  // ∈ [0, 1), asymptotic, never saturates
```

**The table is normative; `p = 1.25` is provenance only.** Invariant 4 is asserted
against these ten integers and this `k`, **never** against `L^p` — see the T26/F1
resolution. The ×8 scale is load-bearing: at ×2 or ×4 the rounding at L=2 breaks the
invariant even for a compliant exponent.

Shipped curve, against which invariant 4 is checked:

| L | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| `table[L]` | 8 | 19 | 32 | 45 | 60 | 75 | 91 | 108 | 125 | 142 |
| fill, lone skill | 14.3% | 28.4% | 40.0% | 48.4% | 55.6% | 61.0% | 65.5% | 69.2% | 72.3% | 74.7% |
| Δ from previous | **14.29** | 14.07 | 11.64 | 8.39 | 7.17 | 5.42 | 4.49 | 3.76 | 3.02 | 2.48 |

The five bands over `fill`, verbatim from §11.6 (T26/F18):

| Band | `fill` | Roughly |
|---|---|---|
| **Quiet** | `[0, 0.15)` | nothing attained, up to one skill at level 1 |
| **Emerging** | `[0.15, 0.35)` | one skill around levels 2–3 |
| **Moderate** | `[0.35, 0.55)` | one skill around levels 3–5 |
| **Active** | `[0.55, 0.72)` | one skill around levels 6–9 |
| **Deep** | `[0.72, 1)` | a mastered skill, and beyond |

The boundaries are landmark-anchored, not quintiles: the top band opens just under a lone
L10's 74.7%, so **one skill taken all the way reaches it** — the claim R-19's depth premium
exists to make.

Grandfathered satisfaction, verbatim from §11.5:

```
satisfied(L) = evaluatedSatisfied(L)
            || (frozen[L] && frozen[L].uids.every(u => progress[u] === 'complete'))
```

`LevelProgress.grandfathered` is true exactly when the second disjunct is what carried it.
Un-checking any frozen uid drops the level, so this is **not** a ratchet and does not
contradict R-22 — tree revision alone never reaches it, which is invariant 7.

Two properties are **contractual** and are what the test suite asserts (§14.4):

- **`domainScores` never reads tree content**, which is what lets the map render before any
  bundle is fetched (§3.3, §12.3). "Tree content" means a compiled bundle: every field of
  `DomainSkillRow` comes from the manifest entry or the `SKILL` row, and the App Shell
  assembles that join in its derived layer (T26/F4).
- **Monotonicity (N12).** Adding a skill or completing a milestone never decreases any
  `DomainScore` field — **no exemption**, including `lastActivityAt`, which is a maximum
  over timestamps under D-20 (T26/F5). **This is a property test over generated inputs,
  not a unit test over examples** — it is the one invariant the PRD states most
  emphatically, and it deserves to be checked exhaustively rather than anecdotally.

## Acceptance criteria

**Grandfathered satisfaction (§11.5, D-19)**

- [ ] A level that evaluates unsatisfied but has a frozen record whose every uid is still
      complete reports `satisfied: true` and `grandfathered: true`.
- [ ] Un-checking any single uid in that frozen record drops the level back to
      `satisfied: false`, `grandfathered: false` — the record is not a ratchet.
- [ ] A level satisfied by evaluation *and* covered by a frozen record reports
      `satisfied: true` with `grandfathered: false`; the flag means "only the record holds
      it up", not "a record exists".
- [ ] `satisfiedBy` is still reported for grandfathered levels, and `scoreSkill` performs
      **no write of any kind** — asserted by passing a frozen `TreeProgress` and
      deep-equality on it after the call (§3.2's single-writer rule).
- [ ] T11a's placeholder test asserting `grandfathered` is always `false` is replaced, not
      deleted, by the cases above.

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
- [ ] The §11.3 worked example's score consequence: moving one skill from `attainedLevel: 1`
      to `attainedLevel: 4` raises its domain's score by exactly **37**
      (`table[4] − table[1] = 45 − 8`). Assert against the shipped table, not the figure.
- [ ] One skill at L10 yields `fill ≈ 0.747` and five skills at L2 yield `fill ≈ 0.664`,
      reproducing the §11.6 depth-beats-breadth claim on the **shipped ×8 table**.
- [ ] The limits §11.6 states are also tested so they are not later mistaken for bugs:
      ten skills at L2 (`fill ≈ 0.798`) still outscores one at L9 (`fill ≈ 0.723`), and a
      domain at 8×L10 reaches `fill ≈ 0.959` without saturating.
- [ ] The returned map is total over `taxonomy.domains`: a taxonomy of eight domains with
      rows in two of them returns eight entries, and the six empty ones are
      `{ score: 0, fill: 0, breadth: 0, lastActivityAt: null }`.

**Bands (§11.6, T26/F18)**

- [ ] `bands.ts` is a pure, dependency-free module exporting one ordered table
      `[{ name: string; from: number }, …]` and one resolver `bandFor(fill): string`. The
      name type is **`string`**, not a union — renaming a band must be a one-line data edit.
- [ ] A property test asserts the table is non-empty and ascending, its first bound is 0,
      and every bound lies in `[0, 1)`.
- [ ] `bandFor` returns `Quiet` at 0, `Deep` at 0.9999, and the correct band at each of
      the four interior boundaries — boundaries are half-open `[from, next)`.
- [ ] `bandFor(fill(oneSkillAtL10))` is `Deep`. This is the landmark the boundaries were
      chosen for; if it ever fails, the table moved and the R-19 claim moved with it.
- [ ] A grep test asserts no numeric band threshold appears anywhere outside `bands.ts` —
      the mechanical form of "one table, one resolver, no thresholds in components". T13
      and T20 both consume this resolver.
- [ ] `DomainScore` has **no band field**; a test asserts the string `band` does not appear
      in `domain.ts`'s exported types.

**Breadth and recency (§11.7, D-20, F35)**

- [ ] Breadth for a domain equals the number of entries in `skills` carrying that primary
      domain, independent of their attained levels (§11.7, F35).
- [ ] A domain whose every started skill is at `attainedLevel: 0` reports
      `score: 0, fill: 0` with `breadth > 0` — the two channels are independent, which is
      what stops `Quiet` from claiming emptiness beside a skills-started count of four.
- [ ] `lastActivityAt` is the lexicographic maximum over the domain's rows, and `null`
      **only** for a domain with no started skills. There is no second null case: `SKILL.
      lastActivityAt` is total (T26/F19).
- [ ] A mixed-precision fixture proves the string comparison is safe: every input carries
      the §12.2 `Z` suffix, and a test asserts the function rejects or is never handed a
      timestamp without one. A non-`Z` value makes the comparison silently wrong.

**Invariants — property tests over generated inputs (§11.9, §14.4)**

- [ ] `invariants.prop.ts` gains a generator for `ReadonlyArray<DomainSkillRow>` over a
      generated taxonomy, and a generator for non-empty `TreeProgress.grandfathered` maps.
      It extends T11a's exported generators rather than duplicating them.
- [ ] Invariant 1 — **completing a milestone never decreases any `DomainScore` field** —
      runs over at least 1,000 generated cases and is the suite's headline test. N12.
- [ ] Invariant 2 — starting a skill contributes exactly 0 to `score`, while raising
      `breadth` by 1. N12, F33.
- [ ] Invariant 3 — `fill` strictly increases with every level attained. F34.
- [ ] Invariant 4 — `Δfill(0→1) ≥ Δfill(L→L+1)` for all L ≥ 1 on a lone skill, computed
      **from the exported `table` and `K`, never from `L ** 1.25`.** Holds strictly against
      the shipped constants: Δ = 14.29, 14.07, 11.64, 8.39, 7.17, 5.42, 4.49, 3.76, 3.02,
      2.48 (percentage points). Resolved by T26/F1 — the earlier `k = 8` × 2 table failed
      this, and failed it invisibly because the test was written against the continuous
      curve rather than the rounded integers the app ships. **Implement no tolerance**; the
      invariant is `≥`, exact.
- [ ] Invariant 5 — `fill < 1` for all finite inputs, including a generated domain of 500
      skills all at L10. F34's never-saturate.
- [ ] Invariant 6, score half — dismissing or un-dismissing changes no `DomainScore` field,
      ever; generated as a random dismissal mask applied to a random progress map. F46,
      §11.10. (The tree-local half is T11a's and already green.)
- [ ] Invariant 7 — **tree revision alone never decreases `attained`** (§11.5). Generate a
      tree, a progress map, and a revision that adds milestones to already-satisfied
      levels; freeze the satisfying sets as T09 would; assert `attainedLevel` does not fall.
      T26/F2 made this expressible, so it is a **real test, not a documented gap**.
- [ ] A reviewer can read all eight §11.9 invariants off the test names across T11a's and
      T11b's `invariants.test.ts`.

**Boundaries (§14.1, §14.7)**

- [ ] `purity.test.ts` (T11a's, unmodified) still passes over the new files — no import of
      `svelte`, `$app`, `$lib/state`, or `$lib/content`, and no literal `archetype`.
- [ ] `npx eslint app/src/lib/scoring` passes via the root `eslint.config.js` slice, and
      temporarily adding
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
count printed, the §11.3 worked example reproducing `+37`, the band landmark test green,
ESLint clean, a clean typecheck.

## Notes and hazards

- **R-19 — super-linear weighting is a cardinal difficulty claim.** D-21 makes level 8
  worth 108 and level 2 worth 19, and the only reason is that level 8 is harder to reach.
  NG8 says levels do not encode estimated effort, and it is arguable this is exactly that.
  **Accepted with the flag understood.** Reversal cost is one config line, which is why the
  table ships as data. Do not replace it with a formula.
- **R-21 — shallow-tree farming.** A tree whose levels 9–10 are cheap pays out 142 for
  little. **Accepted**; the mitigation is F8's milestone bounds and F42's two-round review,
  not the scoring function. Do not add per-tree normalization.
- **R-22 — un-check blast radius.** Un-checking one milestone that was the last satisfying
  level 2 can drop attained from 8 to 1 and strip 100 points (`table[8] − table[1]`) from a
  domain score. **Accepted**; the engine recomputes honestly rather than ratcheting.
  Do not implement a high-water mark. §11.5's grandfathering is the *only* sanctioned
  preservation mechanism and it drops the moment a frozen uid is un-checked.
- **§11.6's two constants are coupled and neither may be retuned alone.** `p = 1.25` and
  `k = 6` (`K = 48` over the ×8 table) sit on the constraint `p ≤ log₂(2k/(k−1))`, whose
  ceiling at `k = 6` is 1.263. Invariant 4 exists specifically to catch a future maintainer
  changing one of them, and it can only do so if it reads the shipped integers.
- **The band table is expected to move, and that is the design.** Names, count and
  boundaries are provisional and the owner expects to tune them from real use. The bar
  T26/F18 set: renaming a band or moving a boundary is a one-line data edit with **no type
  change and no component change**. That is why the name is `string` and why the grep test
  above exists. Do not "tighten" it into a union — `TierName` is closed only because F7
  fixes tiers as pairs of levels 1–10, and bands have no such anchor.
- **`fill` is a rendering function, not a progress bar.** It is not claiming a domain is
  70% complete — domains have no denominator and F34 forbids ever showing the number. Only
  the ordering across a user's own eight regions carries information.
- **F35 is knowingly not satisfied as written.** It asks for recency on a separate visual
  channel that may fade; D-20 ships a date. The deviation is deliberate and researched —
  every shipped system that faded a user-visible value for inactivity was withdrawn,
  reviled, or justified by a claim a life-domain map does not make. The graded channel is
  **R-20**, phase 2, and PRD amendment **R-24** is T00's. Do not build a decay function.
- **§11.1's pipeline diagram has two wrong cross-references**: it cites §11.6 for
  grandfathering (which is §11.5) and §11.7 for `domainScores` (which is §11.6). Harmless,
  but do not follow the diagram's section numbers when hunting for a rule.
- **`fast-check` (or whatever T11a chose) is already an `app/` devDependency.** Do not add
  a second property-testing library, and do not add one to `tools/` — it declares no
  application dependencies (§4.2).

**Resolved spec gaps, kept for the reasoning:**

- **~~Invariant 4 does not hold for the shipped table.~~ RESOLVED by T26/F1, 2026-08-05.**
  The spec previously shipped `p = 1.25` at `k = 8` while asserting a boundary of 1.193 as
  a property test, and the ×2 rounding (`2 × 2^1.25 = 4.757 → 5`) widened the breach from
  6% to 14%. Now `k = 6` with the table scaled ×8, which clears the constraint strictly
  with no tolerance. See `docs/SPEC-FINDINGS.md` F1.
- **~~`DomainScore`, `Taxonomy` and `DomainId` are used in §14.4 and defined nowhere.~~
  RESOLVED by T26/F3, 2026-08-05.** All three are now in §14.4. **`Taxonomy` is
  `Manifest['taxonomy']`**, generated from `schema/manifest.schema.json` — it must not be
  hand-declared here or in `lib/types`.
- **~~`domainScores`' signature cannot produce recency.~~ RESOLVED by T26/F4,
  2026-08-05.** The row type is now `DomainSkillRow` and carries `lastActivityAt`; the
  rollup is this engine's, because `lib/state` may not import the loader (§14.1) and so can
  never learn which domain a tree belongs to. It is a lexicographic `max` over ISO-8601 UTC
  strings, safe only because §12.2 pins that format.
- **~~Grandfathering (§11.5, D-19) has no channel in the `scoreSkill` signature.~~
  RESOLVED by T26/F2, 2026-08-05.** `TreeProgress` carries `grandfathered` and
  `LevelProgress` carries `grandfathered` / `satisfiedBy`; T11a ships all three fields, and
  this task supplies the behaviour. See `docs/SPEC-FINDINGS.md` F2.
- **~~`DomainSkillRow.lastActivityAt` is optional.~~ RESOLVED by T26/F19, 2026-08-06.**
  It is `string`, not `string | undefined`. §12.2's watermark is total — `startSkill` seeds
  it from `startedAt`, so a started skill always carries a date and the row needs no absent
  branch. `DomainScore.lastActivityAt` stays `string | null` with exactly **one** null
  case: a domain with no started skills. §11.7's second null case ("started skills with no
  recorded activity") is gone.
- **T26/F22 — a `SKILL` row with no manifest entry.** §11.6's sum skips it: no entry means
  no `domain`, so it never becomes a `DomainSkillRow` and is summed nowhere. It is **not
  deleted** — see T14's join and T09's retention rule, and `ImportReport.
  skillsWithNoManifestEntry` (T16). Nothing in this engine changes; the row simply never
  arrives. Do not add a fallback domain.
