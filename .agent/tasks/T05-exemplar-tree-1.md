# T05 — Exemplar tree 1 — linear, single-track

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | content-gates |
| **Blocked by** | T03 |
| **Blocks** | T10 |
| **Spec** | ARCHITECTURE §5.3, §16.4 |
| **PRD** | F2, F8, S1 |

## Goal

`content/trees/cooking.yaml` exists: one hand-authored, complete, single-track linear
skill tree — ten levels, 4–8 milestones each, no `tracks:` block, no `requirements:`
blocks (every level relies on §5.6's default single `all` group), and **no `uid:` lines
anywhere**. After this task, `npx lst validate content/trees/cooking.yaml` (T03) passes
at both schema and semantic layers, and `npx lst ids content/trees/cooking.yaml` (T03)
fills every missing `uid` in place with no further validation failures. This is the tree
the Phase 0 gate (T10) proves end to end — authored, validated, id-filled, and, once T04,
T06, and T08 exist, compiled, laid out, and rendered — and it is deliberately the simplest
of the three progression shapes, not the richest.

## Why this shape

§16.4's Phase 0 diagram names its third step plainly: **"one exemplar tree, linear"**
(A3), positioned before the Layout Engine (A4) and TreeView (A5) so that the schema is
falsified against real content before either consumer is built against it — R-14's
entire premise is that this is cheaper now than after three trees exist. Cooking is named
explicitly for this role: §4.2's repository layout lists `content/trees/cooking.yaml` as
the first worked example, and §11's scoring narrative uses "Cooking" as its running
example throughout ("You've cleared 4 of Cooking's 10 levels," "Cooking will stay at
Level 1"), which only reads naturally if Cooking is the tree with no tracks to reason
about. **S1** requires linear, branching, and choice-based skills to render through one
`TreeView` with no per-archetype branch (D-07); T05 supplies the linear case, and T21
supplies the other two. Proving the simplest shape first means a schema defect surfaces
against a tree with one column and no requirement-group combinations to confound it,
rather than against T21's branching and modular trees where a failure could plausibly be
blamed on the shape instead of the schema.

No `uid:` lines is not a simplification — it is §5.4's mandatory authoring flow. An
author writes a complete draft entirely in slugs (`requires:`, requirement groups) and
runs `lst ids` once, at the end. A tree drafted with hand-picked uids up front is not an
exemplar of the authoring flow the rest of the pipeline is built to expect; it is a
different, unsupported flow.

## Scope

**In scope**

- `content/trees/cooking.yaml`: `schemaVersion: 1`, `id: cooking`, `title`, `summary`,
  `domain: home` (F17's table places cooking under Home), no `secondaryDomains` required
  but permitted, no `subregion` (forbidden — domain is not `making`), `facets` drawn from
  T02's seeded `content/taxonomy/facets.yaml`, no `tracks:` block (single-column by
  omission, per §5.3's field reference: "Omitting `tracks` makes the tree single-column"),
  no `archetype:` field or `archetype: single-track` — non-normative either way (F10).
- `provenance` block: `authors` (at least one), `copyleftDerived: false` (or a documented
  `true` with a citation — F45's checklist is answered either way, not left blank), no
  `reviews` yet (review rounds are recorded by the actual PR process, F42, not authored
  ahead of it).
- Exactly ten `levels`, `level: 1` through `level: 10` in order, each with 4–8 milestones,
  each milestone concrete and testable per F2 — an observable action ("sear a steak to a
  target internal temperature"), never an effort quantity ("practice knife skills for ten
  hours").
- Every level **omits `requirements:` entirely**, relying on §5.6's default: "a single
  `all` group over every milestone in the level." This is the deliberate, purest linear
  case — no `n_of`, no `any`, no mixed groups. T21 is where those shapes get exercised.
- `requires:` edges between milestones, forming a valid DAG with no cycles, every
  prerequisite at or below its dependent's level (rules 4–5, §6.2) — enough of them to
  give the tree a real dependency shape, not a flat unordered list within each level.
- No `uid:` line on any milestone or mastery entry, anywhere in the file.
- `lineage: []` (or omitted — a tree that has never been merged has no lineage history).

**Out of scope**

- Running `lst ids` and committing the id-filled result — that is a mechanical step the
  implementer performs once the draft is complete; the deliverable this task specifies is
  the **draft**, with no uids. (The Phase 0 gate, T10, is where the id-filled, validated,
  compiled, laid out, and rendered pipeline is proven end to end.)
- `lst validate`, `lst ids` themselves — T03, already a dependency.
- `lst compile`, the Layout Engine, and TreeView — T04, T06, T08 respectively. T05 hands
  them a tree; it does not exercise them.
- The other two exemplar trees (piano — branching; a mental-health tree — modular) — T21.
- `mastery:` content. Permitted by the schema (§5.7, D-14) but not required to prove the
  Phase 0 gate's "authored, validated, compiled, laid out, rendered, and completable"
  bar, and adding it here would blur T05's job of being the *minimal* linear case. If
  included, it must still pass rule 14 (no level, track, order, or requirement group on
  mastery entries) — but it is not mandated by this task's acceptance criteria.
- `content/taxonomy/domains.yaml` and `facets.yaml` content — T02 seeded both; this task
  only consumes them.
- `content/taxonomy/map.yaml` placement for the `home` domain — T12. Cooking existing
  does not require a map tile to exist yet; T05 and T12 are independent branches off T10.
- The style rubric and CONTRIBUTING.md that will eventually govern trees like this one —
  T24. T05 is authored directly against F2 and §5.3, ahead of the rubric's existence.

## Deliverables

```
content/trees/cooking.yaml     the exemplar — linear, single-track, no uid lines
```

## Interface contract

The shape this file must satisfy, copied verbatim from §5.3's field reference (T02's
`tree.schema.json` is the enforcement mechanism; this table is what the content must
conform to):

| Field | Req. | Notes |
|---|---|---|
| `schemaVersion` | ✔ | Integer. §5.8. |
| `id` | ✔ | Tree slug, unique across the repository. Appears in URLs. |
| `title`, `summary` | ✔ | Display. `summary` is prose for the library listing and the Curious Browser. |
| `domain` | ✔ | Exactly one primary domain id (F18). `home` for this tree. |
| `secondaryDomains` | — | Discoverability only; contributes no score (F18). Must not contain `domain`. |
| `subregion` | conditional | Required iff `domain: making`; forbidden otherwise (F26). **Absent here.** |
| `facets` | — | All must exist in `content/taxonomy/facets.yaml` (F19). |
| `archetype` | — | `single-track` \| `dual-track` \| `modular`. UI label and lint hint only; **the renderer never reads it** (F10). |
| `tracks` | — | **Omitted.** Omitting `tracks` makes the tree single-column. |
| `provenance` | ✔ | Drives the F6 credit display and the F45 licensing gate. `copyleftDerived` has no default. |
| `levels` | ✔ | Exactly ten entries, `level: 1` through `level: 10`, in order (F7). |
| `mastery` | — | Not required for this exemplar. |
| `lineage` | — | Append-only ledger, empty for an unmerged tree. §5.4. |

The identifier rule this draft must follow, copied verbatim from §5.4:

> **Authoring flow.** The author writes a complete tree with no `uid` lines at all.
> `npx lst ids content/trees/mytree.yaml` fills every blank in place. CI fails a merge if
> any `uid` is missing, printing the values to paste. Because in-file references use
> slugs, the draft is fully writable — including all prerequisites and requirement
> groups — before the tool is ever run.

The requirement-group default this tree relies on for every level, copied verbatim from
§5.6:

> **Default.** Omitting `requirements` entirely is equivalent to a single `all` group
> over every milestone in the level. Linear skills — the majority — therefore author no
> requirement groups at all, which keeps principle §5.1(2) honest.

## Acceptance criteria

- [ ] `content/trees/cooking.yaml` parses as YAML and contains no `uid:` key anywhere —
      verified by `grep -c 'uid:' content/trees/cooking.yaml` returning `0`.
- [ ] The file contains no `tracks:` key and no milestone declares a `track:` field —
      verified by `grep -c 'track' content/trees/cooking.yaml` returning `0`.
- [ ] The file contains no `requirements:` key at any level — verified by
      `grep -c '^\s*requirements:' content/trees/cooking.yaml` returning `0`.
- [ ] Exactly ten `level:` entries, valued `1` through `10`, each appearing once, in
      order — verified by reading the file.
- [ ] Every level has between 4 and 8 milestones, inclusive — verified by reading the
      file.
- [ ] `domain: home` is present; `subregion` is absent.
- [ ] `provenance.copyleftDerived` is present with a boolean value.
- [ ] Every `requires:` target names a milestone `id` declared elsewhere in the same
      file, at or below its own level, and the graph contains no cycles — verified by
      reading the file (mechanically re-verified once T03 exists, below).
- [ ] Once T03 exists: `npx lst validate content/trees/cooking.yaml` exits 0 with zero
      Layer 1 and zero Layer 2 findings, including passing schema rule 8 (every milestone
      in ≥1 requirement group at its level) via the default `all` group.
- [ ] Once T03 exists: `npx lst ids content/trees/cooking.yaml` fills every missing
      `uid`, each 8-character Crockford base32, each unique in the repository at that
      point; a second `npx lst validate` run afterward still exits 0.

## Verification

```bash
grep -c 'uid:' content/trees/cooking.yaml       # expect 0, before lst ids has run
grep -c 'tracks:' content/trees/cooking.yaml    # expect 0
npx lst validate content/trees/cooking.yaml     # once T03 exists — expect exit 0
npx lst ids content/trees/cooking.yaml && npx lst validate content/trees/cooking.yaml
```

Passing looks like: the draft file has no uids and no tracks, validates cleanly once T03
exists, and remains valid after `lst ids` fills every identifier.

## Notes and hazards

- **This tree is a load-bearing fixture, not merely example content.** T10's Phase 0 gate
  is defined as "one tree authored, validated, compiled, laid out, rendered and
  completable" — this file is that one tree. A schema gap this tree happens not to
  exercise (a field combination it never uses) will not be caught until T21's richer
  trees arrive in Phase 1, which is why R-14 explicitly expects at least one breaking bump
  between phase 0 and phase 1 (taken at T10) rather than assuming T05 alone proves the
  schema complete.
- **Do not add a `tracks:` block "to be safe."** A single-column tree is the entire point
  of this exemplar; if the milestone content naturally wants two lanes, that is a signal
  the skill was mis-scoped for this role, not a reason to add tracks here. Branching
  belongs to T21's piano tree.
- **F2 compliance is a human judgment this task cannot mechanically prove.** "Concrete and
  testable" is checked by human review (F42) once CI exists, not by a command. The
  acceptance criteria above are the mechanical floor; the milestone wording itself should
  still be written to the F2 standard even though no task in Phase 0 can gate on it.
- Real subject-matter content (forty to eighty actual cooking milestones spanning novice
  to advanced) is authoring work, not a design decision — F44 encourages grounding it in
  an existing curriculum or graded framework where one exists, cited in `provenance`, but
  this task does not mandate a specific source.
