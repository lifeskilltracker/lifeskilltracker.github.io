# T15 — Placement and level estimator

| Field | Value |
|---|---|
| **Status** | pending — **specification incomplete until T00 resolves PRD D20** |
| **Phase** | 1 |
| **Cluster** | judgment |
| **Blocked by** | T00, T11b |
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

## Scope

**In scope**

- `AssessmentFlow` (§13.4) — the placement and estimate entry points on a skill page.
- Bulk completion through the store's existing write path.
- The estimator as a pure function in `lib/scoring`, per the rule T00 records.
- The pre-check review step: every pre-checked milestone individually reversible and
  announced as pre-checked.
- The consequence warnings §11.10 requires, since placement can move `attained` sharply
  in both directions.

**Out of scope**

- Deciding the estimator rule — **T00**. This task implements a decision; it does not
  make one.
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
export function estimateMilestones(tree: CompiledTree, coarseLevel: number): string[];
```

Two behaviours are **architectural rather than product**, and hold whatever rule T00
chooses (§11.8):

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

- [ ] `estimateMilestones` is a pure function: same inputs, same output, no clock, no
      randomness, no I/O. Asserted by calling it twice and comparing.
- [ ] `lib/scoring/estimate.ts` imports nothing from `svelte`, `$app`, `lib/state`, or
      `lib/content` — the §14.7 purity check covers it automatically.
- [ ] The estimator reads **no** field that does not exist in `CompiledTree` today; adding
      an authored mapping field to satisfy it is a failure of the task.
- [ ] For every coarse input, the returned uid set is downward-closed with respect to
      level: if a milestone at level L is returned, the estimate does not skip levels
      below L that the chosen rule includes.
- [ ] Running the estimator and accepting its output unmodified yields an `attainedLevel`
      consistent with the coarse input, per the rule T00 recorded.
- [ ] Each pre-checked milestone can be individually un-checked before the flow is
      committed, and un-checking one does not disturb the others.
- [ ] Pre-checked milestones carry an accessible announcement distinguishing them from
      user-completed ones (§15.6), verified by a testing-library query on the accessible
      name or description.
- [ ] Committing the flow writes through `setMilestoneState` only — a grep proves no
      second write path exists.
- [ ] Placement that would lower `attained` states the consequence before the action, in
      the form §11.10 specifies.
- [ ] Placement is reachable and completable by keyboard alone (§15.8).

## Verification

```bash
npm test --workspace app -- estimate
npx vitest run app/src/lib/components/AssessmentFlow.test.ts
```

Then by hand: place into a tree at a mid-level estimate, un-check two pre-checked
milestones, commit, reload, and confirm the persisted state matches what was on screen.

## Notes and hazards

- **This document cannot be finished until T00 lands.** The acceptance criteria above are
  written to be rule-agnostic on purpose; once D20 is decided, the criteria naming "the
  chosen rule" must be replaced with the concrete rule. Do not implement against a guessed
  rule — the whole point of blocking on T00 is that the guess would be a product decision
  made by an implementer.
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
