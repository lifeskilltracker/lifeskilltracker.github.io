# T19 — Dismissed state end to end

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | views |
| **Blocked by** | T08, T11b |
| **Blocks** | — |
| **Spec** | ARCHITECTURE §11.10, §9.3 |
| **PRD** | F46, D-22 |

## Goal

The dismiss/undismiss flow works end to end through `TreeView`: a user can mark a
milestone "not for me," see it render recessed-but-not-hidden with a dotted border and a
✕ glyph, reverse the action at any time, and never observe a score change from either
direction. When dismissing a milestone inside an `all` group at or below the current
blocker would cap the skill, the UI intercepts with the exact warning text before the
action commits, offering "hide it instead" as the softer alternative. After this task,
`dismissed` is verifiably inert to every scoring computation in the codebase — not just
by inspection, but by a property test that dismisses and undismisses milestones under
generated inputs and asserts no score ever moves.

## Why this shape

D-22 records `dismissed` as presentation-only *permanently*, specifically so a future
maintainer does not "fix" it into something that shrinks a group's denominator. §11.10
spells out why the obvious improvement is catastrophic rather than merely imperfect:
dismissal is reversible (F46), so on an `all` group of five milestones, letting dismissal
of two milestones shrink the denominator to three would let the level satisfy early —
and **un-dismissing them would then un-satisfy the level and reduce the score**, which is
a direct N12 violation reachable in two clicks, from an action (un-dismissal) that is
itself unambiguously honest and additive. It would also let a user dismiss their way to
level 10 by making an all-dismissed group vacuously satisfied. Because contiguous ranking
(D-18) means a capped level can cap the whole skill, the one place this reasoning must
surface concretely — not just in the invariant — is the moment before a user dismisses
something that would trigger it; §9.4 places that warning in the UI rather than the
engine, because the engine's job is to compute the honest consequence, not to prevent the
user from choosing it.

## Scope

**In scope**

- The dismiss action from the milestone detail panel: sets `MilestoneState` to
  `'dismissed'`, which the Scoring Engine (T11a) already treats as exactly incomplete for
  both `GroupProgress.ratio` and `attained` (§11.2, §11.10).
- The undismiss (undo) action, symmetric to dismiss, with no special-casing anywhere in
  this task's code that differs from a plain state transition (§11.10, F46).
- The `dismissed` node state's rendering per §9.3: recessed fill, dotted border, ✕ glyph,
  **not** hidden and **not** struck through — the visual difference between "set aside"
  and "failed" or "deleted" is the point.
- The §9.4/§11.10 consequence intercept: detecting, before commit, that a dismissal
  targets a milestone in an `all` group at or below the current blocker, and surfacing
  *"Level `N` can't be completed without this. `<Skill>` will stay at Level `M`."* with
  "hide it instead" offered as the non-scoring-affecting alternative.
- Wiring "hide it instead" to a genuinely non-scoring, presentation-only visual
  suppression distinct from `dismissed` state — i.e. it must not silently become a second
  code path that also shrinks a denominator.
- A property test (over generated trees, requirement groups, and dismiss/undismiss
  sequences) asserting invariant 6 (§11.9): "Dismissing or un-dismissing changes no score,
  ever."
- The equivalent intercept and property-test coverage for un-checking a completed
  milestone that would drop `attainedLevel` — §11.10 states this is governed by "the same
  rule," and the warning text *"Un-checking this drops `<Skill>` from Level `X` to Level
  `Y`. Levels `A`–`B` stay cleared."* belongs to the same interaction surface.

**Out of scope**

- The Scoring Engine's treatment of `dismissed` as incomplete-for-scoring — that is
  already T11a's and T11b's responsibility per §11.2/§11.9 invariant 6; this task consumes and
  verifies it end to end through the UI, it does not implement the engine-side rule.
- The five-state node rendering system in general (`complete`, `bonus`, `available`,
  `locked`) — T08 builds the full `TreeView` state machine; this task extends it with the
  dismiss-specific interaction and intercept, and assumes T08's node-state rendering
  already exists.
- Persisting the dismissed state to IndexedDB — the User State Store's write path (§12.4),
  a T09 concern. This task calls the store's `setMilestoneState` mutator; it does not
  implement it.
- General accessibility verification of the dismiss flow beyond what §9.3/§9.4 already
  specify structurally (e.g. the exact ARIA live-region announcement text for a dismissal)
  — T20 owns the full §15 pass.
- "Hide it instead" as a durable, cross-session user preference beyond the current
  session's presentation — if the spec intends this to persist, that is a User State Store
  schema question for T09; this task only needs it to work as a presentation-only
  suppression within the flow.

## Deliverables

```
app/src/lib/components/MilestonePanel.svelte      dismiss/undismiss actions + intercept copy
app/src/lib/components/MilestonePanel.test.ts      intercept trigger conditions
app/src/lib/scoring/dismissed.property.test.ts     invariant 6 property test
```

## Interface contract

```
// ARCHITECTURE §9.3 — dismissed row of the node state table, verbatim

| State | Meaning | Glyph | Fill | Border |
|---|---|---|---|---|
| dismissed | "Not for me" (F46) | ✕ | surface, recessed | dotted |
```

```ts
// ARCHITECTURE §14.4 — the state value this task's actions set
export type MilestoneState = 'complete' | 'dismissed' | null;
```

```
// ARCHITECTURE §11.2 — the invariant a dismissed milestone must satisfy in group scoring
completed = |{ m in group.milestones : progress[m] === 'complete' }|
ratio     = min(completed, n) / n                    // F11
satisfied = completed >= n

// A dismissed milestone counts exactly as incomplete. Not as complete, and not as
// removed from the denominator.
```

```
// ARCHITECTURE §11.9 — invariant 6, the property this task's test suite asserts
| 6 | Dismissing or un-dismissing changes no score, ever | F46, §11.10 |
```

```
// ARCHITECTURE §11.10 — the two intercept copy templates, verbatim in spirit

"Level 2 can't be completed without this. Cooking will stay at Level 1."
"Un-checking this drops Cooking from Level 8 to Level 1. Levels 3–8 stay cleared."
```

## Acceptance criteria

- [ ] Dismissing any milestone in a fixture tree leaves every `GroupProgress.ratio`,
      `LevelProgress.satisfied`, `attainedLevel`, and `DomainScore` field byte-identical to
      before the dismissal, for both `all` and `n_of` groups (§11.2, §11.9 invariant 6).
- [ ] Undismissing that same milestone leaves every one of those values byte-identical to
      the pre-dismissal state (§11.9 invariant 6, F46).
- [ ] A property test generates random trees, requirement-group shapes, and
      dismiss/undismiss sequences and asserts invariant 6 holds across all of them — not a
      fixed set of example cases (§11.9).
- [ ] A fixture with an `all` group of five milestones, two dismissed, evaluates
      `completed = 3` against `n = 5`, `satisfied = false` — proving the denominator did
      not shrink to 3 (§11.10's specific catastrophe scenario, run as a named regression
      test).
- [ ] Dismissing a milestone renders the `dismissed` state — recessed fill, dotted border,
      ✕ glyph — and the node is neither `display: none` nor styled with `text-decoration:
      line-through` anywhere in the rendered output (§9.3).
- [ ] A fixture where the target milestone belongs to an `all` group at or below the
      current blocker triggers the intercept dialog before the state mutation is called —
      a test spies on the store's `setMilestoneState` and asserts it is not called until
      the intercept is confirmed (§9.4, §11.10).
- [ ] The same fixture with "hide it instead" chosen results in the milestone visually
      suppressed but its `MilestoneState` unchanged (still incomplete, not `dismissed`) —
      a test asserts no score field and no `MilestoneState` value changed (§11.10).
- [ ] A fixture where the target milestone is in an `n_of` group, or in an `all` group
      above the current blocker, dismisses immediately with **no** intercept shown (the
      intercept is conditional, not universal) — a negative test proving the intercept
      does not over-fire.
- [ ] A fixture un-checking a completed milestone that would drop `attainedLevel` shows the
      before/after level intercept with the specific numbers, before the mutation commits
      (§11.10).
- [ ] `npm run --workspace app test -- MilestonePanel dismissed` passes.

## Verification

```bash
npm run --workspace app test -- MilestonePanel
npm run --workspace app test -- dismissed.property
npx tsc --noEmit --project app
```

Passing looks like: the property test running its full generated-input suite green (not
skipped or reduced to a handful of examples), the intercept tests all passing including
the negative case, and a clean typecheck.

## Notes and hazards

- **Do not "fix" the denominator.** This is the one behaviour in the whole system that
  D-22 explicitly anticipates a future maintainer trying to improve, and explains in
  advance why the improvement is wrong. If a design review during this task's
  implementation surfaces the idea that dismissal "should" shrink the denominator so
  `n_of` groups read more honestly, that is the exact failure mode D-22 and §11.10 were
  written against — re-read §11.10 rather than re-deriving the answer.
- **The intercept is UI-side, never engine-side.** T11a's `scoreSkill` must remain pure and
  must never refuse a state transition or ask for confirmation — it computes the honest
  consequence and this task's components decide whether and how to warn about it before
  calling the mutator. Putting a confirmation gate inside the Scoring Engine would give it
  side effects it is not supposed to have.
- **"Hide it instead" must not become a second dismissal state.** It is explicitly the
  *non-scoring-affecting* alternative — a presentation suppression only. If it is
  implemented by writing any `MilestoneState` other than what the milestone already had,
  re-check against §11.10's intent: the whole reason it exists is to let the user avoid
  triggering the cap while leaving their options open, not to give them a second way to
  reach the same catastrophe.
- **Un-checking is governed by "the same rule" per §11.10**, but is a distinct action from
  dismissal (it applies to `complete → incomplete`, not `incomplete → dismissed`) — do not
  conflate the two intercepts into one code path that cannot express both warning
  messages correctly.
- The `cleared` set surviving an un-check is what makes the consequence tolerable per
  §11.10 — "the user loses a rank, not their history." Verify the intercept copy and the
  post-action state both reflect this (cleared levels above the new `attainedLevel` remain
  in `cleared`, not silently dropped).
