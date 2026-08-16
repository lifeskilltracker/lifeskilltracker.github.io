# Contributing a skill tree

This is the author's guide. It is an extract of `docs/ARCHITECTURE.md` §5 (the content
schema) and §6 (the pipeline), written for someone who wants to add a tree and has no
interest in the rest of the system. Where you want the *reasoning* rather than the rule,
each section points back at the section it came from.

Two companion documents:

- **`docs/STYLE-RUBRIC.md`** — how to phrase a milestone, how to pace ten levels, and when
  to reach for which requirement group. Read it before you write, not after.
- **`docs/AUTHORING-WITH-AI.md`** — the four-step manual workflow if you want to draft with
  an AI assistant, and what that does and does not license you to do.

Everything under `content/` is licensed **CC BY 4.0** (PRD D26). By opening a pull request
you agree to publish your tree under it, and to attribute prior authors when you revise
someone else's. See the copyleft carve-out below before you adapt anything.

---

## 1. What a tree is

A tree is one YAML file in `content/trees/`, describing one skill as **exactly ten levels**
of **four to eight milestones each**. A milestone is an achievement with an observable
completion condition — something you either have done or have not.

There is no XP, no time tracking, and no effort quantity anywhere in the schema. "Practise
scales for thirty minutes" is not a milestone; "Play a two-octave scale hands together at
120bpm" is.

Three shipped trees are the worked references, one per progression shape:

| File | Shape | What to look at |
|---|---|---|
| `content/trees/cooking.yaml` | **Linear, single-track** | The plainest case. No `tracks`, no explicit `requirements` — every level uses the default "all of them" rule. Start here. |
| `content/trees/piano.yaml` | **Multi-track** | Three tracks (`technique`, `repertoire`, `musicianship`) rendered as columns, cross-track prerequisites, and explicit multi-group `requirements:` at levels 4 and 7. |
| `content/trees/mental-health.yaml` | **Modular** | Five `module` clusters and `n_of` / `any` elective groups at levels 4, 6 and 10 — the shape for a skill where reasonable people take different paths. |

> **A caveat on modules.** `module` is real in the data and worth authoring, but the
> renderer draws neither track titles nor module labels today, so a modular tree currently
> looks on screen like a linear one. See F29 in `docs/SPEC-FINDINGS.md`. Author modules for
> the structure, not for a picture you will see.

## 2. Writing the file

Start from the scaffold rather than a blank page:

```bash
npx lst new my-skill        # writes content/trees/my-skill.yaml
```

The scaffold has ten levels, four placeholder milestones each, and every required field
marked `TODO`. It deliberately contains **no `uid:` lines** — see §4.

### Fields

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | ✔ | Always `1`. |
| `contentVersion` | ✔ | Integer, scoped to this tree, starting at `1`. **Never edit by hand** — `lst version` writes it. See §5. |
| `id` | ✔ | The tree slug. Appears in URLs. **Immutable after merge and never reused.** |
| `title`, `summary` | ✔ | Display. `summary` is the prose someone browsing the library reads. |
| `domain` | ✔ | Exactly one primary domain from `content/taxonomy/domains.yaml`. |
| `secondaryDomains` | — | Discoverability only. Contributes nothing to any score. Must not repeat `domain`. |
| `subregion` | conditional | Required if and only if `domain: making`. Forbidden otherwise. |
| `facets` | — | Cross-cutting tags from `content/taxonomy/facets.yaml`. This is where `teaching`, `performance` and similar live — see the style rubric on why they are *not* levels. |
| `archetype` | — | `single-track` \| `dual-track` \| `modular`. A label for humans; the renderer never reads it. |
| `tracks` | — | Ordered list; the order is the column order. Omit entirely for a single-column skill. |
| `provenance` | ✔ | Authors, reviews, sources, and the `copyleftDerived` answer. See §6 and §7. |
| `levels` | ✔ | Exactly ten entries, `level: 1` through `level: 10`, in order. |
| `mastery` | — | Flat, unordered, unbounded, and excluded from every calculation. The achievements that are not a level. |
| `lineage` | — | Append-only ledger of structural change. See §4. |

Full field reference and rationale: `docs/ARCHITECTURE.md` §5.3.

### Levels, tracks, and order

Milestones nest **under** their level rather than carrying a `level:` field. Within a level,
`track` picks the column (defaulting to the first declared track) and `order` breaks ties
(defaulting to file order). Write milestones in the sequence you want and you will rarely
need `order` at all.

File position is meaningful in exactly three places, and nowhere else: the `tracks` order,
the `order` default, and the `lineage` ledger.

### Prerequisites and requirement groups

`requires:` draws an edge — a milestone is unavailable until everything it requires is
complete. Targets are slugs in the same tree, and a prerequisite may not sit at a higher
level than its dependent.

`requirements:` says what it takes to *satisfy* a level:

```yaml
requirements:
  - rule: all
    milestones: [forge-a-leaf, punch-and-drift, hot-cut]
  - rule: any
    milestones: [wire-brush-finish, linseed-finish]
```

Omit `requirements:` and the level defaults to one `all` group over every milestone in it —
which is what the cooking tree does throughout. Groups may only name milestones at their own
level, and every milestone must appear in at least one group at its level.

**Choosing between `all`, `n_of` and `any` is the decision the style rubric spends the most
time on.** Read `docs/STYLE-RUBRIC.md` §4 before you write an `all` group at a low level.

## 3. Running the checks

Everything CI runs, you can run. There is no CI-only check.

| Command | Purpose | Gates? |
|---|---|---|
| `npx lst validate [files…]` | Schema plus the sixteen semantic rules, over trees **and** taxonomy | **yes** |
| `npx lst baseline` | uid immutability and `contentVersion` against `main` | **yes** |
| `npx lst lint [files…]` | Advisory coherence and style warnings | no |
| `npx lst ids [files…]` | Fill missing `uid` values in place | no — it is the fix; the gate is validate's rule 16 |
| `npx lst version [files…]` | Bump `contentVersion` where compiled output changed | **yes** (a stale version fails `lst baseline`) |
| `npx lst status` | Regenerate `content/REVIEW-STATUS.md` | **yes** (drift fails) |
| `npx lst compile` | YAML → JSON bundles and manifest | **yes** |
| `npx lst new <id>` | Scaffold a tree skeleton | no |

The order you will actually use them in:

```bash
npx lst ids content/trees/my-skill.yaml        # fill the uids, once the draft is complete
npx lst validate content/trees/my-skill.yaml   # every error at once, with file and line
npx lst lint content/trees/my-skill.yaml       # advisory — read it, then use your judgment
npx lst compile                                # what CI will build
git fetch origin main
npx lst baseline                               # only matters once your tree has merged before
```

`lst validate` reports every error it can find in one pass, with file, line, and column. If
it prints nothing, it found nothing.

**`lst lint` never fails.** Its exit code is 0 no matter how many findings it reports. The
findings are prompts for a reviewer, not gates, and you are free to disagree with any of
them — see `docs/ARCHITECTURE.md` §6.3 for why that is deliberate rather than unfinished.
On a pull request they arrive as inline annotations on the diff rather than as a red X.

### Which CI job is telling you off

A tree-only PR runs five jobs and none of them build the app, so your feedback loop is
seconds rather than minutes. If a check goes red, this is the command it ran:

| Job | Command | Required to merge? |
|---|---|---|
| `content: validate` | `npx lst validate` | yes |
| `content: compile` | `npx lst compile` | yes |
| `content: baseline` | `npx lst baseline --against origin/main` | yes |
| `content: status` | `npx lst status` | yes |
| `content: lint` | `npx lst lint --format github` | **no** — annotations only |
| `app: typecheck` | `npm run typecheck && npx eslint .` | yes, when the PR touches app code |
| `app: test` | `npm test` | yes, when the PR touches app code |
| `app: build` | `npm run build` plus the §14.7 and §17.1 gates | yes, when the PR touches app code |

The three `app:` jobs report **skipped** on a content-only PR. That is the path filter doing
its job, not a check that failed to run.

One check is deliberately **not** in CI:

| | Command | Required to merge? |
|---|---|---|
| §15.8's keyboard pass | `npm run build && npm run a11y:manual --workspace app` | no — a release checklist item |

It drives browse → place → complete → export keyboard-only through a real browser against
the production build, and asserts roles and accessible names rather than markup, so a
restyle does not break it. It is a release item rather than a merge gate because it needs a
full build and a browser download; `docs/RELEASE-CHECKLIST.md` is where its result is
recorded. **Run it if you touch anything a keyboard user traverses** — it catches the
class of defect the axe gate structurally cannot, axe being mounted on components in jsdom
where there is no document head, no focus order across a page, and no navigation.

One CI-only requirement worth knowing before you push: **your branch must be up to date with
`main`**. `lst baseline` compares your tree against the tip of `origin/main`, and against a
stale branch two of its checks can both pass while leaving `main` inconsistent — so the
repository requires the merge to be current. `git fetch origin && git merge origin/main` (or
a rebase) before pushing is enough.

## 4. Identifiers: the one thing you cannot undo

Every milestone and mastery entry carries **two** identifiers doing different jobs:

| | `id` (slug) | `uid` |
|---|---|---|
| Written by | you | `lst ids`, once |
| Unique within | the tree | the whole repository |
| Referenced by | `requires:`, requirement groups, URLs | user state, export files |
| Mutable | yes | **never** |

Write the whole tree with no `uid` lines at all — every in-file reference uses slugs, so the
draft is complete without them — then run `lst ids` to fill them in. After that, they are
permanent.

**Before your tree merges**, nothing is frozen: rename, reorder, split, delete, iterate
freely across review rounds. **The moment it merges it is published**, because merging
deploys, and from then on a real person's progress may be keyed to those uids. `lst baseline`
enforces what follows:

- A published `uid` never simply vanishes. It still exists, or a `lineage` entry says what
  happened to it (`split`, `merged`, `retired`, `moved`).
- A `uid` is never reattached to a different milestone.
- A retired slug is never reused by a different `uid`.
- A changed slug keeps its old value in `aliases:`, so existing deep links resolve. CI can
  fix this one for you.
- A tree is never deleted and never renamed.
- The `lineage` ledger is **append-only** — never insert, reorder, or edit an existing entry.

What you may change freely under a stable uid: title, detail, level, track, order, module,
prerequisites, and the slug. What you may **not**: the meaning. See the style rubric's
identity rule — it is the only thing standing between a reworded milestone and a silent data
error, and no tool can catch it.

## 5. `contentVersion`

Bump it whenever the compiled output of your tree changes, and let the tool do it:

```bash
git fetch origin main
npx lst version
```

CI fails the merge if compiled output moved and the version did not, printing the value to
paste. Do not edit the field by hand and do not guess — it is the sole trigger for the
migration pass that carries existing users' progress across your change.

## 6. Review

Every tree gets **two review rounds by two different reviewers** before it merges. CI proves
your tree is structurally correct; the reviewers judge the one thing a tool cannot — whether
each milestone is concrete and testable.

Review state lives in each tree's `provenance` block and is rolled up into
**`content/REVIEW-STATUS.md`**, which is *generated*. Do not edit it by hand: run
`npx lst status` and commit the result. CI fails on drift between the committed table and a
freshly generated one, and on nothing else — a tree with no reviews recorded is not a CI
failure, it is a tree awaiting review.

```yaml
provenance:
  authors:
    - { name: A. Contributor, github: acontributor }
    - { name: B. Later,       github: blater, role: reviser, since: 2027-04-11 }
  reviews:
    - { round: 1, reviewer: R. One, date: 2026-09-02 }
    - { round: 2, reviewer: R. Two, date: 2026-09-14 }
```

`authors` is append-only. The original author carries no `role`; anyone who later revises
appends themselves as `role: reviser` with a date. Nobody is ever removed or replaced.

Releases have their own checklist, including the accessibility passes — see
`docs/RELEASE-CHECKLIST.md`. It is not part of contributing a tree.

## 7. The contribution checklist

Work through this before you open the PR. The last item is the one people miss.

- [ ] Ten levels, four to eight milestones each, in order.
- [ ] Every milestone is an achievement with an observable completion condition. No effort
      quantities, no "understand", no "be familiar with".
- [ ] Level pacing is even; no level is wildly heavier than its neighbours.
- [ ] Teaching, selling, publishing, competing and certifying are **not** parked at levels
      9–10 by default. They are facet tags, not a tier. See `docs/STYLE-RUBRIC.md` §3.
- [ ] `requirements:` groups reserve `all` for content genuinely presupposed by everything
      above it.
- [ ] `npx lst ids`, then `npx lst validate` clean, then `npx lst lint` read and considered.
- [ ] `provenance.authors` filled in, and `provenance.sources` cites any framework you drew
      structure or sequencing from.
- [ ] `provenance.copyleftDerived` is answered. **It has no default and you must answer it.**
- [ ] `npx lst status` run and `content/REVIEW-STATUS.md` committed.

### The copyleft question, in full

F44 lets you draw **structure and sequencing** from a published framework — an ABRSM
syllabus, CEFR descriptors, a belt curriculum, a course outline — provided you cite it and
do not reproduce it. F45 carves out the case that permission does *not* cover:

> F44 covers *structure and sequencing* drawn from published frameworks, cited and not
> reproduced. It shall not be read as permission to adapt content under a **ShareAlike
> licence** (CC BY-SA, CC BY-NC-SA). Because all trees live under one content licence, a
> single derived tree would propagate those terms to the whole library and bind every future
> contributor. The contribution checklist shall ask explicitly whether any part of a
> submission derives from a copyleft-licensed source, and CI-passing trees with an
> affirmative answer shall be rejected at review.

So: `copyleftDerived: true` passes CI and is rejected at review. That is the design. CI can
only tell whether you answered; it cannot tell whether you answered honestly, which is why
the question is unskippable and the judgment is a human's.

The concrete case that prompted the rule is recorded in `docs/PRIOR-ART.md` §6 —
MakerSkillTree is CC BY-NC-SA, its maintainer welcomes trackers built on the project, and a
single tree adapted from it would still propagate ShareAlike across this entire library.
Treat it as validation and never as a source.

---

## Where to read further

| You want | Read |
|---|---|
| How to phrase, pace and calibrate | `docs/STYLE-RUBRIC.md` |
| Drafting with AI assistance | `docs/AUTHORING-WITH-AI.md` |
| Why the product is shaped this way | `docs/PRD.md` |
| The normative schema and pipeline | `docs/ARCHITECTURE.md` §5, §6 |
| The prior art that produced several of these rules | `docs/PRIOR-ART.md` |
| Release-time checks | `docs/RELEASE-CHECKLIST.md` |
