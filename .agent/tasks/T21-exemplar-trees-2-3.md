# T21 — Exemplar trees 2 and 3 — branching and modular

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | content-gates |
| **Blocked by** | T10 |
| **Blocks** | T24 |
| **Spec** | ARCHITECTURE §16.4, §5.3 |
| **PRD** | S1, F10, R-12 |

## Goal

`content/trees/piano.yaml` and `content/trees/mental-health.yaml` exist: two more
hand-authored, complete, ten-level trees exercising the two progression shapes T05's
cooking tree deliberately left untouched — piano as a **branching**, multi-track skill
with cross-track prerequisites, and a mental-health tree as a **modular**, choice-based
skill using `module` grouping and `n_of`/`any` requirement groups for genuine electives.
After this task, all three trees named in **S1** — cooking, piano, mental health — exist
in `content/trees/`, each validates and id-fills cleanly through T03's `lst`, and each
renders through the same `TreeView` component T08 already built for T05's tree, with no
code path in `lib/layout/`, `lib/scoring/`, or `lib/components/` that branches on which
of the three it is looking at.

## Why this shape

**S1 is a hard requirement, not a quality signal**: "a single schema expresses linear,
branching, and choice-based skills — cooking, piano, and mental health — with no
per-skill or per-archetype special-casing in the renderer," and the PRD states plainly
that v1 has failed if this is false. T05 proved the schema and the renderer against the
linear case; that is necessary but not sufficient evidence for S1, because a renderer
that happens to work for one column of milestones with no requirement-group variety could
still be secretly relying on an assumption that breaks the moment a second track or an
`n_of` group appears. These two trees are what convert "the architecture claims one
component handles three shapes" (**D-07**) into a claim two more real, independently
plausible fixtures actually back up.

**Piano and the mental-health tree are not arbitrary choices.** §11's worked scoring
examples run on "Cooking" throughout, which only makes sense if cooking is the tree with
no tracks; **R-11** names "a piano tree with many cross-track prerequisites" as the
architecture's own example of the case edge-routing (§8.4) has to survive without
crossing-minimization, and §5.3's own worked field-reference example (blacksmithing) is
itself a `dual-track` skill in the same shape piano needs here — piano is that shape
applied to the tree S1 actually names. A mental-health tree is the natural home for
**F9**'s `n_of` and `any` groups used as genuine electives (several contemplative
practices, of which a practitioner reasonably does only some), which is exactly the
choice-based archetype S1 requires and which T05's cooking tree, by design, never
exercises.

**R-12 is the risk this task is written against, not merely near.** "A domain expert who
does not grasp tracks will dump everything into one lane, degrading the tree to a list"
is explicitly named as an editorial risk with an editorial mitigation: exemplar trees and
the `lonely-track` lint. These two trees, done well, are half of that mitigation — a
future contributor authoring a branching skill has a real worked example to imitate
instead of a schema section to interpret cold.

## Scope

**In scope**

- `content/trees/piano.yaml`: `domain: making`, `subregion: expression` (piano's output
  is a performance — F24's Expression definition), `tracks:` declaring at least two
  lanes (e.g. technique and repertoire), milestones distributed across both tracks with
  genuine **cross-track** `requires:` edges (a repertoire milestone gated on a technique
  milestone, or vice versa) so the tree is a real test of §8.4's edge routing under
  crossings, not just of column assignment. At least one level uses a non-default
  `requirements:` block (an `all` group per track, or similar) to exercise multi-group
  levels beyond T05's all-omitted default.
- `content/trees/mental-health.yaml`: `domain: mind` (F17's table), `module:` labels
  grouping milestones into clusters (e.g. distinct contemplative practices), and at least
  one level whose `requirements:` uses `n_of` or `any` over milestones that are genuine
  electives — completing the level does not require every named practice, by design.
- Both trees: exactly ten levels, 4–8 milestones each, no `uid:` lines anywhere (§5.4's
  draft-first flow, same as T05), valid `requires:` DAGs with no cycles, `provenance`
  with `copyleftDerived` answered.
- Both trees pass `npx lst validate` (T03) and `npx lst ids` (T03) cleanly.
- Both trees render through the existing `TreeView` (T08) and lay out through the
  existing Layout Engine (T06) with **no changes to either** — a change required in
  `lib/layout/` or `lib/components/` to accommodate one of these trees is itself a
  finding to report, not something to silently patch around (see hazards).

**Out of scope**

- `content/trees/cooking.yaml` — T05, already written; this task's job is the other two
  named in S1.
- Any change to `lib/layout/`, `lib/scoring/`, or `lib/components/` themselves. This task
  supplies content that exercises the existing renderer; if the renderer cannot handle a
  legitimate branching or modular tree without modification, that is a defect in T06 or
  T08 to report upstream, not something this task's content should be bent to avoid.
- The `archetype` grep gate and other §14.7 enforcement mechanics that make S1 checkable
  in CI — T25.
- `lonely-track` and `track-overuse` lint rule implementations — T22. This task's trees
  should simply not trip them (piano's track count should stay reasonable; no track
  should end up with fewer than three milestones), since the lints do not exist yet to
  catch it if they did.
- The style rubric and CONTRIBUTING.md — T24, which is blocked by this task specifically
  so these two trees can serve as its worked examples.
- `content/taxonomy/map.yaml` tile placement for `making`/`mind` — T12, independent.

## Deliverables

```
content/trees/piano.yaml            branching, dual-track (or more), Making/Expression
content/trees/mental-health.yaml    modular, choice-based, Mind, n_of/any electives
```

## Interface contract

The three progression shapes these trees, together with T05's cooking tree, must jointly
express — copied verbatim from **D-07**:

> A linear skill is a tree with one column. A branching skill is a tree with several. A
> choice-based skill is a tree whose milestones carry `module` labels and whose levels
> carry `n_of` groups. All three are the same shape of data with different values, and
> the renderer's only shape-sensitive behaviour is that it draws the number of columns it
> is given and renders module labels when modules exist.

The success metric these three trees exist to satisfy, copied verbatim from the PRD:

> **S1.** A single schema expresses linear, branching, and choice-based skills — cooking,
> piano, and mental health — with **no per-skill or per-archetype special-casing** in the
> renderer.

The requirement-group mechanism piano's multi-group level and the mental-health tree's
elective levels both draw on, copied verbatim from §5.6 / F9:

```yaml
requirements:
  - rule: all
    milestones: [a, b, c]
  - rule: n_of
    n: 2
    milestones: [d, e, f, g]
  - rule: any                # sugar for n_of with n: 1
    milestones: [h, i]
```

The layout fields these trees author beyond T05's minimal set, copied verbatim from F14:

| Field | Required | Purpose |
|---|---|---|
| `level` | yes | 1–10; determines the row/rank |
| `track` | no | named column for branching skills; defaults to the first declared track |
| `order` | no | integer tiebreak within a (level, track) cell |
| `module` | no | cluster grouping for choice-based skills |

## Acceptance criteria

- [ ] `content/trees/piano.yaml` declares `tracks:` with at least two entries, and at
      least one milestone's `requires:` names a milestone declared under a **different**
      track — verified by reading the file.
- [ ] `content/trees/piano.yaml` has at least one level whose `requirements:` is
      explicitly authored (not omitted/defaulted), containing at least two requirement
      groups.
- [ ] `content/trees/mental-health.yaml` has at least one level whose `requirements:`
      contains an `n_of` or `any` group over milestones spanning more than one `module:`
      value.
- [ ] `content/trees/mental-health.yaml` uses `module:` on at least two distinct values
      across its milestones.
- [ ] Neither file contains a `uid:` key anywhere — verified by
      `grep -c 'uid:' content/trees/piano.yaml content/trees/mental-health.yaml`
      returning `0` for both.
- [ ] Both files have exactly ten `level:` entries in order, each with 4–8 milestones.
- [ ] `npx lst validate` exits 0 for both files, including rule 8 (every milestone in
      ≥1 requirement group at its level) for the explicitly-authored groups.
- [ ] `npx lst ids` fills every uid in both files with no repository-wide collisions
      against each other, T05's cooking tree, or any other existing tree.
- [ ] Both trees render via the existing TreeView (T08) and lay out via the existing
      Layout Engine (T06) with `git diff --stat` showing **no changes** under
      `app/src/lib/layout/`, `app/src/lib/scoring/`, or `app/src/lib/components/` as a
      result of this task.
- [ ] `grep -rn archetype app/src/lib/layout app/src/lib/scoring app/src/lib/components`
      returns nothing — the same check T25 will later wire into CI, exercised manually
      here as this task's own proof that its two trees didn't require special-casing.

## Verification

```bash
grep -c 'uid:' content/trees/piano.yaml content/trees/mental-health.yaml   # both 0, pre-ids
npx lst validate content/trees/piano.yaml content/trees/mental-health.yaml
npx lst ids content/trees/piano.yaml content/trees/mental-health.yaml
npx lst validate content/trees/piano.yaml content/trees/mental-health.yaml  # still 0 after
git diff --stat -- app/src/lib/layout app/src/lib/scoring app/src/lib/components
grep -rn archetype app/src/lib/layout app/src/lib/scoring app/src/lib/components  # empty
```

Passing looks like: both trees valid and id-filled with no collisions, both rendering
through the unmodified T06/T08 output, and the archetype grep coming back empty.

## Notes and hazards

- **If either tree cannot be authored without touching the renderer, that is the actual
  finding — do not paper over it by simplifying the tree until it fits.** S1's entire
  value is that it forces a real branching and a real choice-based tree through the
  existing pipeline; a piano tree quietly trimmed to a single track to make T08 happy
  would make S1 pass on paper while failing in substance. Report any such gap for T26
  rather than authoring around it.
- **R-12's failure mode is available to the author of this task too.** It is easier to
  write piano as a single wide `all` group than to genuinely use tracks, and easier to
  write mental-health with one big `all` group than to author real electives. Both
  shortcuts would produce schema-valid trees that fail this task's actual purpose. The
  acceptance criteria above are written to make that shortcut mechanically detectable
  (track count, cross-track `requires`, non-default `requirements:`, multi-module `n_of`)
  rather than relying on review judgment alone.
- **R-11 — edge spaghetti is an accepted outcome for piano, not a defect to fix here.**
  §8.4 accepts crossings in exchange for layout stability; if piano's cross-track
  prerequisites render with visible edge crossings, that is the spec working as intended,
  not something this task should re-author the tree to avoid. The `track-overuse` lint
  (T22) and edge-highlighting-on-focus (§9.4, T08) are the designated mitigations, not
  fewer cross-track edges.
- **Facet tags, not tier position, carry piano's professionalization distinction.**
  Following the style rubric's eventual F43 rule (this task runs before T24 writes it
  down, but the rule itself is already fixed by the PRD): "teach a piano lesson" is not
  level-9 content by default. Keep any teaching/performing/publishing milestones spread
  across levels rather than clustered at the ceiling, so this tree is a correct worked
  example for T24 to point at rather than one it has to caveat.
- `content/taxonomy/facets.yaml` may need entries this task's trees want (e.g. a
  `contemplative` or `performance` facet) that T02's minimal seed didn't anticipate.
  Extending `facets.yaml` is a maintainer PR per §5.9, not out of bounds for this task —
  but stay minimal; do not seed the full facet vocabulary here (still D12, still open).
