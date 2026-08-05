# T00 — PRD amendments and v1 unblocking

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | judgment |
| **Blocked by** | — |
| **Blocks** | T15 |
| **Spec** | ARCHITECTURE §19.4, §19.5 |
| **PRD** | D20, D26; ARCHITECTURE R-24, R-25 |

## Goal

`docs/PRD.md` no longer contains a requirement the architecture is knowingly unable to
satisfy, and the two product decisions v1 depends on are made and recorded. Four items
close: **D20** gains a stated estimator derivation rule, **F35** is amended to describe
what the system actually ships, **F33** is amended to match D-21's arithmetic, and
**D26** names a content licence. Nothing is implemented; the output is edited prose and
four recorded decisions.

## Why this shape

ARCHITECTURE §19.5 says plainly that two of these are the architecture's findings and
none of them are the architecture's to decide. Until F35 is amended, the spec is
non-compliant with the PRD **and says so in writing** — a state that is honest but should
not survive to a shipped v1, because it leaves the two governing documents disagreeing
about what the product is. D20 is different in kind: it does not correct a document, it
supplies a rule that does not yet exist, and T15 cannot be specified without it. Doing
all four in one pass is right because they are all edits to the same file by the same
decision-maker, and because three of them are cheap only while no code depends on them.

## Scope

**In scope**

- **D20 — estimator derivation.** Decide the rule by which "estimate my level" turns a
  coarse self-assessment into a pre-checked milestone set. §19.4 fixes the shape:
  architecturally it is a pure function `(tree, coarseLevel) → uid[]` that slots into the
  Scoring Engine with no new subsystem, and it must work with **no per-skill authored
  mapping data**. What it must not do is require content authors to hand-map levels to
  self-assessment bands, since that is authoring burden on every tree forever.
- **R-24 — F35 amendment.** F35 currently requires recency as "a separate visual channel,
  which may fade over time". D-20 ships a date instead. The proposed amendment: F35
  requires recency to be *represented*, leaves the channel unspecified, and names the
  graded version as a candidate rather than a requirement. Accept, reject, or reword.
- **R-25 — F33 amendment.** D-21 makes a skill's contribution `table[L]` rather than `L`,
  so F33's "sum of levels attained" is no longer literally accurate. Proposed amendment:
  domain score is an additive, monotonic function of attained levels in which higher
  levels contribute more, with the table held in the architecture spec.
- **`docs/RESEARCH.md` §4 terminology fix.** It describes "later levels worth more" as
  *concavity*; that is **convexity**. The concavity is on the display side (F34).
  Conflating the two is exactly the confusion §11.6's coupling constraint exists to
  prevent, so this is a correctness fix, not a style edit.
- **D26 — content licence.** Must be chosen before the first external contribution.
  Architecturally relevant only to D-11: a licence awkward to scope within one repository
  is one of the two triggers for splitting `content/` out.
- An explicit in-or-out call on **D23** (user-level domain reassignment). §19.4 treats it
  as PRD-blocked and out of scope; the project memory records it as the highest-risk open
  item. The default is **out of v1** — record that decision rather than leaving it
  ambient.

**Out of scope**

- Implementing the estimator — T15, which this task unblocks.
- Any change to the scoring table itself. D-21's weights are an architecture decision with
  a stated reversal cost of one config line; this task amends how F33 *describes* them.
- D24 (tree families), D27 (user-authored milestone slots) — §19.4 records both as
  speculative, and neither blocks v1.
- Re-opening decisions the PRD has already locked. Effort-weighted XP, multi-axis skill
  scoring, and promoting Making's subregions to sibling domains were each considered and
  declined on principle. None is in question here.

## Deliverables

```
docs/PRD.md          F33 and F35 amended; D20 and D26 resolved; D23 recorded out of v1
docs/RESEARCH.md     §4 concavity → convexity correction
docs/ARCHITECTURE.md §19.5 updated — R-24 and R-25 move to resolved, citing the amendment
```

## Interface contract

None — this task exposes no code interface. It does, however, fix one signature that T15
is written against, and the decision must be specific enough to make that function
implementable:

```ts
// ARCHITECTURE §19.4 — the shape is settled; the RULE is what this task decides
(tree: CompiledTree, coarseLevel: number) => string[]   // uids to pre-check
```

The recorded decision must answer, at minimum: what the coarse input is (a 1–10 level, a
named band, something else), which milestones get pre-checked at a given input, whether
pre-checked milestones are distinguishable from user-completed ones in storage, and
whether the result is a suggestion the user edits or a commitment.

## Acceptance criteria

- [ ] `docs/PRD.md` F35 no longer requires a fading visual channel, or the architecture's
      D-20 is reversed — one or the other, not both left standing.
- [ ] `docs/PRD.md` F33 describes an additive monotonic function of attained levels rather
      than a literal sum of levels.
- [ ] `docs/PRD.md` D20 carries a stated derivation rule that satisfies the signature
      above and requires no per-skill authored mapping data.
- [ ] `docs/PRD.md` D26 names a licence for `content/`.
- [ ] `docs/PRD.md` records D23 as out of v1, with the reason.
- [ ] `docs/RESEARCH.md` §4 says convexity where it means convexity.
- [ ] `docs/ARCHITECTURE.md` §19.5 no longer lists R-24 and R-25 as open, and §1.4's
      document relationships still hold.
- [ ] Nothing in the amended PRD contradicts N12 (monotonic scoring) or NG8 (levels do
      not encode estimated effort).
- [ ] `grep -n 'knowingly non-compliant' docs/ARCHITECTURE.md` returns nothing.

## Verification

Read `docs/PRD.md` F33, F35, D20, D23, D26 and `docs/ARCHITECTURE.md` §19.5 side by side.
Passing looks like: no requirement the architecture cannot meet, and T15 specifiable from
D20 alone without further product input.

## Notes and hazards

- **R-19 is the live tension under R-25.** D-21's super-linear weighting is arguably a
  cardinal difficulty claim, which NG8 bars. The architecture accepts it with the flag
  understood, and the counterweight is that linear is also an exchange rate. Amending F33
  should not quietly relitigate D-21 — if the amendment makes the weighting sound
  uncontroversial, it has overreached.
- **R-21 — shallow-tree farming** is a genuine new cost of D-21 that linear does not have.
  The mitigation is F8's milestone bounds and F42's two-round review, not the scoring
  function. Worth a sentence in the amended F33 so it is not rediscovered as a bug.
- **F29 guarantees the data will contain Guttman errors.** Whatever D20 rule is chosen
  will pre-check milestones the user has not actually done, and un-checking them can move
  attained level downward under R-22. The rule should be chosen with that interaction in
  mind rather than in isolation.
- This task is off the critical path and can run at any time. Doing it early is strictly
  better: it is the only thing standing between T11 and T15, and every week it waits is a
  week the two governing documents disagree.
