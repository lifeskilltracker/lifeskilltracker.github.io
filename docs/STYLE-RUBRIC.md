# Style rubric

The house standard for milestone phrasing, level pacing, tier calibration, and
requirement-group usage (PRD **F43**). It is written for authors and for reviewers, who are
applying the same rules from opposite directions.

Read this **before** writing, not after. `npx lst lint` implements a thin, advisory slice of
what follows; the rest is judgment, and the linter is deliberately incapable of failing a
merge because a rule that is wrong even occasionally trains contributors to write around it
rather than to write well (`docs/ARCHITECTURE.md` §6.3).

Contents: [1. Phrasing](#1-phrasing) · [2. Pacing](#2-pacing) ·
[3. Professionalization is not mastery](#3-professionalization-is-not-mastery) ·
[4. Requirement groups](#4-requirement-groups) ·
[5. When a revised milestone is still the same milestone](#5-when-a-revised-milestone-is-still-the-same-milestone)

---

## 1. Phrasing

**A milestone is an achievement with an observable completion condition** (PRD **F2**).
Someone else, watching, could tell you had done it. If the only person who can say whether
it is complete is you, and you would have to consult a feeling to decide, rewrite it.

Two phrasings fail this and both are common:

**Effort quantities.** *Practise scales for thirty minutes a day.* *Spend ten hours on
knife work.* *Study the circle of fifths.* These measure input, not attainment. Two people
who did the identical thing for the identical time can be in completely different places,
and the schema has no field for hours anywhere on purpose.

**Hedges.** *Understand mise en place.* *Learn about tempering.* *Be familiar with
sharpening angles.* These have no completion condition at all. There is no moment at which
you have finished understanding something.

| Instead of | Write |
|---|---|
| Practise scales for 30 minutes a day | Play a two-octave C major scale hands together, evenly, at ♩=120 |
| Understand knife safety | Break down a whole chicken into eight pieces without a slip |
| Learn about bread hydration | Bake a 75%-hydration loaf with an open crumb |
| Spend a season gardening | Grow one crop from seed to harvest and save its seed |

The test that catches almost everything: **could someone else confirm it?** Not "would they
bother" — could they, in principle, if they watched.

`vague-milestone` in `lst lint` flags the two families above by keyword. It has a real
false-positive rate — in a contemplative skill, "practice" is the domain's own vocabulary
and not an effort quantity at all — which is exactly why it advises rather than gates. Read
each finding and decide.

### Detail, not padding

`title` is the achievement. `detail` is for the condition that makes it judgeable when the
title alone would be ambiguous — *"reach and hold an even orange heat, judged by eye,
without burning the stock."* If `detail` is restating the title in more words, delete it.

`label` exists only for the node box in the tree renderer and is capped at 36 characters. Use
it when the title genuinely will not fit; otherwise leave it out and let the renderer fall
back.

## 2. Pacing

Ten levels, four to eight milestones each. Beyond the bound, three things matter.

**Even steps.** Each level should feel like a comparable increment of difficulty from the
one below. A level with eight milestones sitting between two levels of four is a wall, and
it reads to the user as the tree's author losing interest. `lst lint`'s `level-pacing` flags
counts that deviate sharply from their neighbours'.

**Level 1 is genuinely level 1.** Someone with no exposure to the skill should be able to
complete it. The most common calibration failure at the bottom is an author writing for
someone who already has the hobby.

**Level 10 is the ceiling of the skill, not of a career.** Depth, not commercialization —
see §3. A useful test: level 10 should describe something the best amateur practitioner you
know could plausibly do, not something requiring an institution.

**Levels are unlock gates.** Level 5 means levels 1–5 are all satisfied, so a milestone
misfiled two levels too low blocks people who have plainly moved past it. When in doubt
about where something belongs, ask what it *presupposes*, not how hard it feels.

Mastery achievements (`mastery:`) are the escape valve for anything that is genuinely
outstanding but not a rung: unbounded, unordered, and excluded from every calculation. If a
milestone is fighting the ten-level spine, it may belong there.

## 3. Professionalization is not mastery

Copied from PRD **F43**, because it is the clause this rubric exists for:

> The rubric shall state that **professionalization is not mastery**: teaching, selling,
> publishing, competing, and certifying are modes of engagement available at many
> levels, not markers of the top tier, and shall not be placed at levels 9–10 by default.
> A beginner can teach a beginner. These are expressed as **facet tags** (F19), orthogonal
> to level, and the initial controlled vocabulary shall reserve terms for them.

### Why this has its own section

`docs/PRIOR-ART.md` §7.3 records the concrete case. MakerSkillTree's open issue **#47** is a
contributor's objection to exactly this pattern:

> *"I see a lot of Skill Trees here that have 'Teach a Class' as a single Tile at the very
> top. The most Advanced, I guess. But I'm thinking every Tile is a small task that could
> (should?) be taught too. I'm thinking 'Teaching' should not be Advanced, it should be Basic
> and common."*

Their Cooking tree's two topmost tiles are "Publish a recipe you've created" and "Teach a
cooking class", with "Sell something you've cooked" one row below. The error is conflating
professionalization with skill mastery: a level-2 cook can teach a friend to boil an egg,
and selling at a bake sale is not evidence of mastery. Placing these at the ceiling both
misgrades them and implies that the point of a skill is to commercialize it.

This project would inherit the bug by default, because a contributor pattern-matching on
existing trees reproduces it.

### The mechanism

The distinction is carried by **facet tags** (F19), which are orthogonal to level, not by
tier position:

```yaml
facets: [performance, teaching]
```

`content/taxonomy/facets.yaml` reserves terms for these modes — `teaching`, `performance`,
and their neighbours. A skill where passing it on is a real part of the practice says so in
`facets`, at the tree level, where it belongs.

### In practice

- **Do** write "teach someone else to do X" at whatever level the *X* actually sits at.
- **Do** put a genuinely advanced achievement at level 9 or 10 when the difficulty is in the
  skill: "teach a certification course" is legitimately advanced, because the certification
  is the hard part, not the teaching.
- **Don't** reach for teaching, selling or publishing because you have run out of level-10
  ideas. That is the tell. If the top of your tree is a career ladder, the skill's actual
  depth is missing.

`lst lint`'s `professionalization-tier` flags these verbs at levels 9–10 and nowhere else. It
will flag legitimate cases like the certification course; that is expected, and it is why the
rule advises rather than gates.

## 4. Requirement groups

A requirement group says what it takes to **satisfy a level** — which is what unlocks the
levels above it. Three rules:

| Rule | Meaning | Reach for it when |
|---|---|---|
| `all` | every listed milestone | the level's content is genuinely presupposed by everything above |
| `n_of` | at least *n* of the listed | there is a real floor, but which ones is the practitioner's business |
| `any` | at least one | the milestones are alternative routes to the same competence |

Omitting `requirements:` gives you one `all` group over the whole level. That default is
correct for most levels of most trees — `content/trees/cooking.yaml` uses it throughout —
and reaching for explicit groups when you do not need them makes the tree harder to read.
`lst lint`'s `group-shape-drift` flags a tree carrying more than three distinct shapes,
which is D14's worry made concrete: a reader should not have to hold ten subtly different
rules in mind.

### The `all` warning (F46)

**An `all` group at or below a user's blocking level is the strongest claim you can make,
and it has a consequence most authors do not anticipate.**

A user may mark a milestone **dismissed** ("not for me"). Dismissal never changes any score
— a dismissed milestone counts exactly as an incomplete one — but it also never satisfies a
group. So dismissing a milestone inside an `all` group at or below the blocking level makes
that level permanently unsatisfiable and **caps the skill at that rank forever**. The app
warns before such a dismissal and offers to hide the milestone instead, but the real fix is
upstream, and it is yours. From F46:

> Upstream, the style rubric (F43) shall direct authors to reserve `all` for content
> genuinely presupposed by everything above it, and to place anything a reasonable
> practitioner might legitimately skip in an `n_of` group.

The question to ask of every milestone inside an `all` group: **would a competent
practitioner of this skill ever reasonably not do this?** If the answer is yes — a
vegetarian cook and butchery, a jazz pianist and sight-reading orchestral parts — it belongs
in an `n_of` group, not an `all` one. `content/trees/mental-health.yaml` is the worked
example: five modules, with `n_of` and `any` electives at levels 4, 6 and 10, precisely
because reasonable people take different routes through it.

### Prerequisites are a different thing

`requires:` gates *availability* — a milestone is locked until its prerequisites are done.
Requirement groups gate *level satisfaction*. Use `requires:` for genuine dependency ("you
cannot forge a hook before you can draw a taper"), not to express ordering preference.
Prerequisites may not point at a higher level than their dependent, and cross-track edges
are fine — `content/trees/piano.yaml` has fifteen of them.

`module` is a presentational cluster label with no completion semantics at all. If you want
a choice to mean something, that is a requirement group's job.

## 5. When a revised milestone is still the same milestone

This is the most important paragraph in this document, and it is the mitigation for a
failure nothing in the pipeline can detect (**R-03**).

A `uid` is permanent and a user's completion record points at it. If you keep a uid but turn
the milestone into a materially different achievement, every user who completed the old one
is silently credited with the new one. No check catches this. `lst baseline` verifies that
uids are stable and that slugs are accounted for; it has no way to know what a milestone
*means*.

The rule, adopted from Mozilla's localization practice and carried verbatim from **F43**:

> *a typo or clarity fix keeps the milestone's identity; a change of meaning requires a new
> one.*

And the same rule in the architecture's own words (§5.4), which is the operational form:

> *a typo or clarity fix keeps the uid; a change of meaning requires a new uid and a lineage
> entry.*

### Applying it

**Keeps the uid** — rewording, fixing a typo, tightening the completion condition, adding
`detail`, changing the level, changing the track, changing the slug (with the old value
recorded in `aliases`), reordering.

**Needs a new uid and a `lineage` entry** — the achievement now asks for something a person
who completed the old one has not necessarily done.

The honest test, and the one to apply as a reviewer: **would someone who completed the old
milestone be entitled to tick the new one without doing anything else?** If yes, it is the
same milestone. If you have to think about it, it is not.

```yaml
lineage:
  - uid: q4np8w2r
    op: split
    into: [m3xk90ab, v8t2ncq5]
    note: "separated tapering from bending (2027-03)"
```

The ledger is append-only and never pruned. `split`, `merged`, `retired` and `moved` each
have a defined effect on existing user progress — see `docs/ARCHITECTURE.md` §12.5 — and one
of them is a documented loss: where two milestones merge and the user completed only one,
the merged milestone is not granted, because the user has not done the merged thing.

---

## For reviewers

Two rounds, two different reviewers. CI has already proved the tree is structurally correct
before you see it; none of your budget should go on structure.

What only you can judge:

1. **Is every milestone concrete and testable?** (§1) This is the single highest-value pass.
2. **Is the ceiling depth, or is it a career ladder?** (§3)
3. **Does any `all` group contain something a reasonable practitioner might skip?** (§4)
4. **On a revision: did any milestone change meaning under a stable uid?** (§5)
5. **Is `copyleftDerived` answered honestly?** A `true` answer passes CI and is rejected
   here; that is the design (see `docs/CONTRIBUTING.md` §7).

`lst lint`'s findings appear as annotations on the PR. They are prompts. Dismiss any of them
you disagree with — that is what "advisory" means, and a reviewer who defers to the linter
has moved an editorial judgment into a tool that cannot make it.

Record your round in the tree's `provenance.reviews`, then run `npx lst status` so
`content/REVIEW-STATUS.md` stays current.
