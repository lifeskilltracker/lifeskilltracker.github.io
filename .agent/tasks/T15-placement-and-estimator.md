# T15 — Placement and level estimator

| Field | Value |
|---|---|
| **Status** | complete — 2026-08-14 |
| **Phase** | 1 |
| **Cluster** | judgment |
| **Blocked by** | T11b |
| **Blocks** | — |
| **Spec** | ARCHITECTURE §11.8, §19.4, §13.4, §15.6 |
| **PRD** | F29, F30, D20, S3 |

## Goal

A user arriving at a skill they already practise can reach a truthful starting position
without ticking sixty boxes one at a time. Two mechanisms deliver it: **placement**
(F29), which is ordinary milestone completion in bulk, and the **estimator** (F30), a
pure function that turns a coarse self-assessment into a pre-checked milestone set the
user then corrects. `AssessmentFlow` presents both. This is the task **S3** is measured
against.

## Why this shape

§11.8 makes the division sharp, and it is the reason this task adds no subsystem.
Placement has no special engine mode at all — it is bulk completion, which is precisely
what lets F29 "require no additional per-skill authored content". The estimator is a
pure function `(tree, coarseLevel) → uid[]` that slots into the Scoring Engine, again
with no authored data per skill. Any design that asks tree authors to hand-map
self-assessment bands to milestones has failed the task: that is authoring burden on
every tree forever, and C4 already names authoring as the bottleneck.

## Estimator rule (PRD D20, resolved v1.4)

- **Coarse input:** integer **L** ∈ {1..10}. The UI may present named bands mapped to
  **L** for presentation only.
- **Output:** every milestone uid in levels 1..**L** — a full contiguous prefix. Mastery
  achievements are never included.
- **Semantics:** an editable suggestion before commit, not a commitment. No distinct
  stored "estimated" state and no per-tree mapping data. Accepting unchanged yields
  attained **L**.
- **Guttman interaction:** F29 guarantees honest records will contain out-of-order
  satisfaction. The estimator will pre-check milestones the user has not actually done;
  un-checking them can move attained level downward under F32 and F47 (R-22).

## Scope

**In scope**

- `AssessmentFlow` (§13.4) — the placement and estimate entry points on a skill page.
- Bulk completion through the store's existing write path.
- The estimator as a pure function in `lib/scoring`, implementing D20 above.
- The pre-check review step: every pre-checked milestone individually reversible and
  announced as pre-checked.
- The consequence warnings §11.10 requires, since placement can move `attained` sharply
  in both directions.

**Out of scope**

- The Scoring Engine itself — T11a and T11b. The estimator lives in `lib/scoring` and must obey
  its purity constraints, but attainment, groups and node states are already built.
- The write path and transaction semantics — T09.
- Single-milestone completion and the milestone panel — T08.
- Any per-skill authored mapping data. That is not deferred; it is rejected by F29.

## Deliverables

```
app/src/lib/scoring/estimate.ts        pure: (tree, coarseLevel) → uid[]
app/src/lib/scoring/estimate.test.ts
app/src/lib/components/AssessmentFlow.svelte
app/src/lib/components/AssessmentFlow.test.ts
```

## Interface contract

```ts
// ARCHITECTURE §19.4, §11.8 — pure, no I/O, lives in lib/scoring
// coarseLevel: integer L ∈ {1..10}
export function estimateMilestones(tree: CompiledTree, coarseLevel: number): string[];
```

Two behaviours are **architectural rather than product**, and hold for D20 (§11.8):

1. The estimator pre-checks **downward** from the estimate, consistent with §11.3's
   contiguous-prefix definition of attainment.
2. Every pre-checked milestone is **individually reversible** and is **announced as
   pre-checked** (§15.6) — not silently indistinguishable from work the user did.

Bulk writes go through the one existing writer; this task introduces no second path:

```ts
// ARCHITECTURE §14.5 / §12.4
await store.setMilestoneState(uid, 'complete', { … });
```

## Acceptance criteria

- [x] `estimateMilestones` is a pure function: same inputs, same output, no clock, no
      randomness, no I/O. Asserted by calling it twice and comparing.
- [x] `lib/scoring/estimate.ts` imports nothing from `svelte`, `$app`, `lib/state`, or
      `lib/content` — the §14.7 purity check covers it automatically.
- [x] The estimator reads **no** field that does not exist in `CompiledTree` today; adding
      an authored mapping field to satisfy it is a failure of the task.
- [x] For **L** ∈ {1..10}, the returned uid set is exactly every milestone uid in levels
      1..**L** (contiguous prefix); no mastery uids; no skipped levels below **L**.
- [x] Running the estimator at **L** and accepting its output unmodified yields
      `attainedLevel === L`.
- [x] Each pre-checked milestone can be individually un-checked before the flow is
      committed, and un-checking one does not disturb the others.
- [x] Pre-checked milestones carry an accessible announcement distinguishing them from
      user-completed ones (§15.6), verified by a testing-library query on the accessible
      name or description.
- [x] Committing the flow writes through `setMilestoneState` only — a grep proves no
      second write path exists.
- [x] Placement that would lower `attained` states the consequence before the action, in
      the form §11.10 specifies.
- [x] Placement is reachable and completable by keyboard alone (§15.8).

## Verification

```bash
npm test --workspace app -- estimate
npx vitest run app/src/lib/components/AssessmentFlow.test.ts
```

Then by hand: place into a tree at a mid-level estimate, un-check two pre-checked
milestones, commit, reload, and confirm the persisted state matches what was on screen.

## Notes and hazards

- **F29 guarantees the data will contain Guttman errors.** A user placed at level 6 will
  have pre-checked milestones they have not done, and un-checking them can drop attained
  level sharply under R-22's contiguous ranking. This interaction is the estimator's main
  hazard and the reason §11.10's warnings apply here and not only to ordinary un-checking.
- **Do not let placement write a distinguishing state into storage.** §12.2 has exactly
  two states, `complete` and `dismissed`, and incomplete is the absence of a record. A
  third "estimated" state would leak an assessment artifact into the durable user record
  and into every export. The pre-check *announcement* is a property of the flow before
  commit, not of the stored data.
- **R-23** notes that a Guttman diagnostic over real completion patterns would identify
  mis-levelled content, and that N2/D-17 make the telemetry for it unavailable. Not this
  task's problem, recorded so the connection is not rediscovered.
- S3 is measured against this task, so the flow's usability matters as much as its
  correctness — an estimator that is right and unusable fails the metric just as squarely.

## Implementation notes — 2026-08-14

```
app/src/lib/scoring/estimate.ts             estimateMilestones — the whole of D20
app/src/lib/scoring/estimate.test.ts
app/src/lib/components/AssessmentFlow.svelte
app/src/lib/components/AssessmentFlow.test.ts
app/src/lib/components/consequences.ts      + placementWarning (§11.10, bulk form)
app/src/lib/actions/uncheck-consequence.ts  + placementConsequenceOf
app/src/lib/actions/tree-session.svelte.ts  + estimate/placementConsequence; serialized writes
app/src/routes/s/[tree]/SkillPage.svelte    mounts the flow below the tree
```

### Four decisions this document did not make

- **The two mechanisms share one review list.** F29 and F30 produce the same thing — a
  set of milestones the user asserts they have done — and §15.6 puts five obligations on
  the list (level grouping, a running count, keyboard operation, interruptibility,
  per-item reversal). Two screens would have meant two copies of all five, and the second
  copy is the one that rots.
- **The estimate is added to what is already recorded, never substituted for it.** §11.8
  makes the prefix a suggestion; a suggestion that silently un-ticked real work would be
  asserting something about the user, which §15.6 rules out in as many words. The
  consequence is that only what the estimate *adds* is marked as pre-checked — a
  milestone the user genuinely completed is their work, not the estimator's guess.
- **§11.10's warning needed a bulk form.** Its sentences are written for one milestone,
  and F29 makes the bulk case ordinary: a user correcting the estimator un-checks several
  things in one action, so `placementConsequenceOf` re-scores the whole selection and
  `placementWarning` states it before the commit. Stating it one milestone at a time
  after the fact would be stating it too late.
- **`TreeSession.apply` now serializes writes.** §12.4 makes each write its own
  transaction that reads the tree's records back and recomputes `attainedLevel`; a review
  list committing twelve of them at once had them racing, and the denormalized level
  settled on whichever finished last. Rapid clicking in `TreeView` is the same hazard
  arriving more slowly, so the fix sits in the session rather than in the flow.

### Smaller things worth knowing

- **`bonus` counts as recorded.** §11.4's `bonus` is surplus completion inside an `n_of`
  group, not a different kind of record. Treating it as incomplete would have the flow
  offer to re-complete work already done, and then write it again.
- **The pre-check marker is inside the `<label>`**, so it is part of the checkbox's
  accessible name rather than decoration a screen reader would skip. It is also visible:
  a sighted user has the same right to know which ticks are guesses.
- **The accessible-name assertion is a DOM query, not a testing-library one.** The
  acceptance criterion named testing-library; the repository has no such dependency (T08
  built `test-harness.svelte.ts` instead), and adding one to read `label.textContent`
  would buy nothing. The assertion is the same: the marker is inside the label, so it is
  in the accessible name.
- **The draft survives leaving the flow** ("Finish later"), which is §15.6's
  interruptible-and-resumable clause. It is component state and dies with the page —
  §12.2 has two stored states and neither of them is "half-placed".
- **Out-of-range coarse input throws** rather than clamping. Clamping turns a caller's
  arithmetic bug into a silent bulk write over the only copy of someone's progress.
- **The estimator was checked against a tree carrying only `uid` and `level`** on its
  milestones, which is the mechanical form of "reads no field that does not exist in
  `CompiledTree` today".

### Out-of-scope items confirmed still out

The Scoring Engine proper (T11a, T11b), the write path (T09), the milestone panel (T08),
and any per-skill authored mapping — the last rejected by F29 rather than deferred.
R-23's Guttman diagnostic over real completion patterns stays unavailable: N2 and D-17
forbid the telemetry it would need.
