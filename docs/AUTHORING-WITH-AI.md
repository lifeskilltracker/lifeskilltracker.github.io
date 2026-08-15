# Authoring with AI assistance

**This document is documentation, not software.** It describes a manual, four-step workflow
a human runs, plus a versioned prompt template you copy and paste. It ships no code, no
service, and no CI integration, and that is a design decision rather than an unfinished
state — see [What is not built](#what-is-not-built) at the end.

Using it is entirely optional. Every tree in `content/trees/` could have been written
without it, and the review standard is identical either way.

Read `docs/CONTRIBUTING.md` and `docs/STYLE-RUBRIC.md` first. This guide assumes both.

---

## The workflow

Copied from `docs/ARCHITECTURE.md` §6.7:

> 1. **Gather** an existing curriculum or graded framework for the skill (F44) — ABRSM
>    syllabus, CEFR descriptors, a belt curriculum, a published course outline — plus the
>    author's own expertise. F45's copyleft carve-out is checked *here*, before any
>    drafting, because that is the last cheap moment to check it.
> 2. **Draft** against a published prompt template that carries the house rules inline:
>    the 1–10 spine, 4–8 milestones per level, achievement phrasing with observable
>    completion conditions, no effort quantities, and the professionalization-is-not-
>    mastery rule from F43.
> 3. **Normalize** by hand. The author rewrites every milestone in their own words and
>    deletes anything they cannot personally judge. This step is the one the guide should
>    press hardest on, because an unedited draft is exactly the "empty container with an
>    AI-generated veneer" the PRD's §3 trade-offs name as the failure mode to avoid.
> 4. **Validate** with `lst ids`, `lst validate`, `lst baseline`, `lst compile`, and
>    `lst lint`, then open the PR.

Each step in full below.

---

### Step 1 — Gather

Find the framework before you find the assistant. A graded syllabus that real teachers use
carries decades of sequencing knowledge that no amount of prompting reproduces: which thing
has to come before which, and where the genuine difficulty steps are.

Good sources: an ABRSM or Trinity syllabus, CEFR descriptors, a martial-arts belt
curriculum, a trade apprenticeship outline, a published course syllabus, a professional
body's competency framework.

Record what you used in `provenance.sources`, with how you adapted it:

```yaml
provenance:
  sources:
    - title: ABRSM Piano Syllabus 2025–2026
      url: https://example.org/syllabus
      adapted: sequencing          # structure | sequencing | none
```

**Check the licence now.** This is the last cheap moment: after drafting, discovering the
source was ShareAlike means throwing the draft away. Copied verbatim from **F45**:

> F44 covers *structure and sequencing* drawn from published frameworks, cited and not
> reproduced. It shall not be read as permission to adapt content under a **ShareAlike
> licence** (CC BY-SA, CC BY-NC-SA). Because all trees live under one content licence, a
> single derived tree would propagate those terms to the whole library and bind every future
> contributor. The contribution checklist shall ask explicitly whether any part of a
> submission derives from a copyleft-licensed source, and CI-passing trees with an
> affirmative answer shall be rejected at review.

F44 covers structure and sequencing, cited and not reproduced. It does not cover copying
text, and it does not cover adapting from a ShareAlike source at all.

A second reason to check here: an assistant will happily reproduce copyrighted text it was
trained on without telling you where it came from. Knowing which framework you are working
from is what lets you notice.

### Step 2 — Draft

Use the [prompt template](#prompt-template-v1) below. It carries the house rules inline so
you are not correcting the same four mistakes on every pass.

Draft **without `uid` lines** — the whole file, including every prerequisite and requirement
group, is writable with slugs alone. `lst ids` fills the uids once the content is settled,
and running it early only means you have permanent identifiers on milestones you are about
to delete.

Expect the first draft to be wrong in a specific, predictable way: plausible-sounding
milestones with no observable completion condition, and a level 9–10 made of teaching and
selling. Both are what step 3 is for.

### Step 3 — Normalize by hand

**This is the step that matters, and the one that is tempting to skip.**

Rewrite every milestone in your own words. Not "review and adjust" — rewrite. Then delete
anything you cannot personally judge: if you could not tell whether someone had completed
it, or you are not confident it belongs at that level, it goes.

The failure mode this prevents is named in the PRD's §3 trade-offs: an **empty container
with an AI-generated veneer**. A tree that looks complete, passes every check, and is not
grounded in anyone's actual knowledge of the skill is worse than no tree, because it is
indistinguishable from a good one until someone tries to use it.

A practical filter: for each milestone, could you tell a beginner *how* to get there, and
recognise when they had? If not, you cannot review it, and nobody downstream can either.

Expect to delete a third of the draft. That is the process working.

### Step 4 — Validate, then open the PR

```bash
npx lst ids content/trees/my-skill.yaml
npx lst validate content/trees/my-skill.yaml
git fetch origin main
npx lst baseline
npx lst compile
npx lst lint content/trees/my-skill.yaml
npx lst status
```

`lst ids` leads because the draft has no `uid` lines and validate's rule 16 fails a tree that
still lacks them. `lst compile` and `lst baseline` are in the list because there is no
CI-only check — running them locally is the whole of F40's promise that you can know your
tree is correct before opening the PR.

Then the same two review rounds as any other tree. There is no separate track for
AI-assisted submissions and no disclosure requirement beyond citing your sources, because
the standard being applied is the standard for the content, not for how it was typed.

---

## Prompt template v1

Versioned in this repository so that its output quality is itself reviewable, and so a
maintainer who notices a recurring flaw across submissions can fix it once at the source.
Copy it, fill in the two bracketed fields, and paste.

```text
You are helping draft a skill tree for a personal skill-tracking project. Follow
these house rules exactly; they are not suggestions.

SKILL: [name the skill]
SOURCE FRAMEWORK: [name the syllabus / curriculum / outline you are working from]

STRUCTURE
- Exactly ten levels, numbered 1 to 10. Level 1 must be completable by someone
  with no prior exposure to the skill. Level 10 is the ceiling of the skill's
  depth.
- Four to eight milestones per level. Aim for five. Keep the count even across
  levels — a level far heavier than its neighbours is a defect.
- Levels are unlock gates: level N presupposes levels 1 to N-1. Place a
  milestone by what it presupposes, not by how hard it feels.

MILESTONE PHRASING
- Every milestone is an ACHIEVEMENT with an OBSERVABLE COMPLETION CONDITION.
  Someone else, watching, could tell it had been done.
- NEVER use effort quantities. No "practise for 30 minutes", no "spend N hours",
  no "study X". These measure input, not attainment.
- NEVER use hedges. No "understand X", no "learn about X", no "be familiar
  with X". These have no completion condition.
- Write the title as the achievement. If the title alone is ambiguous, add one
  sentence of detail giving the condition that makes it judgeable.

TIER CALIBRATION
- Professionalization is NOT mastery. Teaching, selling, publishing, competing
  and certifying are modes of engagement available at many levels, not markers
  of the top tier. A beginner can teach a beginner.
- Do NOT place teaching/selling/publishing at levels 9-10 by default. If the
  top of the tree is a career ladder, the skill's actual depth is missing.

OUTPUT
- YAML. For each level: the level number and its milestones. For each
  milestone: a lowercase-hyphenated slug id, a title, and optional detail.
- Do NOT emit uid fields. Do NOT invent identifiers of any kind.
- Do NOT emit contentVersion, provenance, or lineage.
- Where the source framework drove a sequencing decision, say so in a comment
  so the author can verify it.

Draft the ten levels now. Be concrete and specific to this skill; generic
milestones that would fit any skill are failures.
```

**Changelog.** v1 — initial template (2026-08-15).

If you change this template, bump the version and say what moved. A template that drifts
silently makes every submission drafted against it un-reviewable in hindsight.

---

## What is not built

Copied verbatim from `docs/ARCHITECTURE.md` §6.7:

> **Explicitly not built:** no roadmap-ingestion tool, no AI service, no generation endpoint, no bot that opens PRs.
> Each would create an ops surface (N10) and would put unreviewed content one merge-button
> away from publication.

To be unambiguous about the current state of the repository: there is **no AI service**,
**no generation endpoint**, **no bot** of any kind, and no plan to add one. Nothing in
`tools/` or `app/` calls a model. NG12 already bars AI from the running application; this
keeps it out of the pipeline too, so that "every published tree is human-reviewed" has no
automated back door.

The template above is a text file you copy. That is the entire integration, and it is
deliberately the entire integration.
