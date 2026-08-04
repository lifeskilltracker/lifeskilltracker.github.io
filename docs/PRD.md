# Life XP Skill Tracker — Product Requirements Document

**Version:** 1.2
**Date:** 2026-08-04
**Owner:** Ethan Morchy
**Status:** Ready for architecture

> **Changes since v1.1:** A prior-art review of `sjpiper145/MakerSkillTree` (`docs/PRIOR-ART.md`) added the closest existing project to the competitive landscape and produced five changes. D9 (milestone-count range) is resolved and promoted into F8. F43 gains a tier-calibration clause separating professionalization from mastery. F42 adopts a public review status table. A copyleft carve-out is added as F45 and a third milestone state as F46. Civic and community participation is named under the People domain.
>
> **On identifiers.** Unlike v1.1, this revision does **not** renumber. `docs/RESEARCH.md` and `docs/PRIOR-ART.md` now cite requirement and decision IDs, so IDs are treated as stable from v1.2 onward. Resolved deferred decisions leave a numbered gap rather than shifting their successors, and new requirements append at the end of the F-sequence even when they belong to an earlier section — F46 sits in §6.6 for this reason.
>
> **Changes in v1.1:** Deferred decisions D4 (tree layout), D10 (modular archetype), and D19 (domain rollup) were resolved and promoted into requirements. The domain taxonomy expanded from six to eight after a distribution study of 164 candidate skills (`docs/SKILL-CANDIDATES.md`). Archetypes were demoted to non-normative metadata in favour of per-level requirement groups.

---

## 1. Overview

An open-source, browser-based skill tracker that renders **pre-built, content-rich skill trees** for real-life skills. Each skill ships with concrete, testable milestones organized into a uniform 1–10 level spine, so a user can place themselves on the tree and immediately see what to do next ("Blacksmithing Level 1: forge a J hook").

The skill trees are the product; the web app is the reference renderer for them. Trees are authored as portable data files, drafted with AI assistance and merged through human-reviewed pull requests, so the library grows through contribution rather than through the maintainer alone.

---

## 2. Problem Statement

Users want to gamify real-life skill development the way video games handle progression: XP, levels, and unlockable pathways. Existing gamification apps (Habitica, HobbyDex, Skill Quest, Goalos, XPTracker) are mostly **empty containers** — they track XP but require the user to define all milestones and self-assess their own level.

The core gap: no product ships with pre-built skill trees that tell the user (a) what level they currently are and (b) exactly what to do next to level up.

The inverse also exists and also fails: pre-built roadmap projects (roadmap.sh / developer-roadmap) have excellent curated content but no level scale at all — 91 roadmaps, median 112 nodes, range 5 to 301 — so they can never tell you how far along you are.

**The opportunity is the intersection:** curated content *with* a comparable progression scale.

### Competitive landscape

| Product | Strengths | Gap vs. this PRD |
|---|---|---|
| Goalos | AI-generated learning paths, XP, skill tree view | Paths are user-prompted, generic milestones, no self-assessment |
| HobbyDex | Hobby capture, XP via practice, quests, achievements | User defines all quests/milestones |
| MakerSkillTree | ~76 expert-authored, peer-reviewed trees of concrete achievement milestones; large active community | Printable posters only. 73 undifferentiated tiles per tree, no levels, no prerequisites, no completion semantics, no machine-readable format — all by explicit design |
| Skill Quest | Multi-category tracking, streak achievements; MakerSkillTree's companion tracker | Empty container as software; imports MakerSkillTree SVGs, so a loaded tree is 73 checkboxes with no level, ordering, or next action |
| XPTracker | Narrative RPG structure (classes, bosses, arcs) | User writes own questline |
| Habitica | Mature habit RPG (classes, gear, parties) | Habit-focused; delegates categorization to users entirely |
| developer-roadmap / roadmap.sh | Pre-built curated content at scale | Tech-only; no levels or completion scale — cannot express progress |
| Cataclysm: DDA (game) | Skills 0–10, concrete unlockable recipes, real prerequisites | Embedded in a game, not a tracker |

**Closest prior art:** MakerSkillTree, analysed in full in `docs/PRIOR-ART.md`. It is the same gap as developer-roadmap — excellent curated content with no progression scale — reached deliberately rather than by oversight, and in this project's own subject area rather than in tech. Its ~5,500 hand-authored achievement milestones are the strongest available evidence that F2 is achievable by volunteer contributors. Its refusal to define levels, prerequisites, or completion is the space this project occupies. The pairing of MakerSkillTree with Skill Quest is the closest thing to a direct competitor that exists, and it still cannot tell a user what level they are.

**Reference model:** CDDA's crafting system. Uniform 0–10 across every skill, levels act as *unlock gates* rather than effort quanta, and content density per level varies enormously without breaking the scale.

---

## 3. Goals

In priority order:

1. **Ship skill trees with concrete, testable milestones** — achievement-based, never study-hours-based. This is the differentiator; everything else supports it.
2. **Make the content contributor-scalable** — a portable schema, validation tooling, and a review process that let volunteers add trees without maintainer bottleneck or quality erosion.
3. **Let a user place themselves accurately and fast** — self-assessment that produces a correct starting position and an obvious next action within minutes.
4. **Deliver a game-like visual experience** — a hex world map over life domains, per-skill trees whose layout matches the skill's shape.
5. **Support multiple progression mechanics** — one schema that expresses linear, branching, and choice-based skills without per-skill special-casing.

### Explicit trade-offs

- **Content quality over content volume.** Three excellent trees beats thirty generic ones. The failure mode being avoided is becoming another empty container with an AI-generated veneer.
- **Contributor tooling over launch breadth.** Breadth comes from contributors, so the schema, validator, and docs are v1 deliverables of equal weight to the app itself.
- **Zero ops burden over feature richness.** Local-only storage and static hosting are hard constraints, not defaults to revisit.
- **Schema uniformity over per-skill expressiveness.** Where a skill's natural shape conflicts with the uniform spine, the spine wins and the shape is expressed within it.

---

## 4. User Personas

### 4.1 The Player (primary)

Someone building a real-life skill who wants structure and a sense of progress. Arrives not knowing what "good" looks like in a skill, or knowing but unable to sequence it. Opens the app to see where they stand and what's next. Uses it on desktop or mobile browser, sporadically — a few times a week when they complete something.

**Capability scope:** browse the library, start skills, self-assess, complete milestones with notes/photos, export their data. Cannot author trees.

### 4.2 The Tree Author (primary)

A contributor with real knowledge of some skill who wants it represented well. Comfortable with a git PR workflow but not necessarily with the app's codebase, and may never run the app locally. Works with AI assistance to draft a tree from existing roadmaps and their own expertise, then refines it by hand.

**Capability scope:** author and submit tree data files, run the validator locally, respond to review. Receives visible credit on the published tree.

### 4.3 The Maintainer (primary)

Reviews contributions, guards the house style, and owns the domain taxonomy. The person for whom "concrete and testable" is a standard to enforce, not a suggestion.

**Capability scope:** merge/reject trees, evolve the schema and taxonomy, publish releases.

### 4.4 The Curious Browser (secondary)

Lands on the site, has no intention of tracking anything, wants to see what "Level 5 Cooking" means. Never creates data. Matters because they are the top of the contributor funnel.

---

## 5. User Stories

**Player**
- As a Player, I want to browse a map of life domains, so I can find skills worth pursuing.
- As a Player, I want to check off milestones I've already completed when starting a skill, so the tree reflects where I actually am rather than starting me at zero.
- As a Player, I want a coarse "roughly where am I?" shortcut, so I don't have to read every milestone in a 40-node tree to get placed.
- As a Player, I want to see my available next milestones for a skill, so I always know the concrete next action.
- As a Player, I want to record a note or photo when I complete a milestone, so the tree becomes a record of what I actually did.
- As a Player, I want to export my progress to a file, so I never lose it to a cleared browser and can move between devices.
- As a Player, I want to see progress per domain, so I know whether I'm neglecting an area of my life.
- As a Player, I want starting a new skill to never reduce any number I've already earned, so exploring costs me nothing.

**Tree Author**
- As a Tree Author, I want a documented schema and a local validator, so I know my tree is structurally correct before I open a PR.
- As a Tree Author, I want worked exemplar trees, so I can pattern-match instead of guessing the house style.
- As a Tree Author, I want to never write layout coordinates, so adding a milestone is a one-line change rather than a re-layout.
- As a Tree Author, I want to declare that my skill relates to more than one domain, so programming can surface under both Making and Work & Money.
- As a Tree Author, I want to add mastery content above level 10, so deep skills aren't artificially capped.
- As a Tree Author, I want credit on the tree I wrote, so contribution is visibly attributed.

**Maintainer**
- As a Maintainer, I want CI to reject structurally invalid trees automatically, so review effort goes to judging content quality, not catching typos.
- As a Maintainer, I want a written style rubric for "concrete and testable," so review decisions are consistent and defensible.
- As a Maintainer, I want to add or rename a domain without invalidating existing trees, so the taxonomy can evolve as the library grows.

---

## 6. Functional Requirements

### 6.1 Skill trees and content

- **F1.** The system shall ship a library of pre-built skill trees, each defining levels, milestones, and prerequisite relationships.
- **F2.** Every milestone shall be concrete and testable — an achievement with an observable completion condition ("forge a J hook," "cook a 3-component meal with correct timing"), never an effort quantity ("practice for 10 hours").
- **F3.** Milestones shall support prerequisite/unlock dependencies, rendered as edges in the tree.
- **F4.** Trees shall be defined in a portable, human-editable data format under version control, independent of the rendering application.
- **F5.** A skill shall be able to declare **mastery content above level 10** as an optional, unbounded set, excluded from all progress and score calculations.
- **F6.** Each tree shall record its authors and reviewers, and the application shall display that credit.

### 6.2 Level structure and completion rules

- **F7.** Every skill shall use a uniform **1–10 level spine**, grouped into five named tiers of two levels each:

  | Tier | Levels |
  |---|---|
  | Novice | 1–2 |
  | Apprentice | 3–4 |
  | Journeyman | 5–6 |
  | Expert | 7–8 |
  | Master | 9–10 |

- **F8.** Each level shall contain **4 to 8 milestones**, enforced by schema, giving a tree a total of 40 to 80 milestones. Depth variance between skills is expressed as **milestone count and difficulty within a level**, never as a differing number of levels. The bounds are as much an authoring constraint as a structural one: a ceiling gives a contributor a finish line, which an open-ended range does not.
- **F9.** Each level shall declare a **list of requirement groups**, all of which must be satisfied for the level to complete. Each group declares a rule over a set of milestones:

  | Rule | Meaning |
  |---|---|
  | `all` | every milestone in the set |
  | `n_of` | at least *n* milestones from the set |
  | `any` | at least one milestone from the set |

  This single mechanism expresses every progression shape the project needs: a linear skill is one `all` group; a choice-based skill is one `n_of` group; a skill with a formal spine plus electives is an `all` group AND an `n_of` group on the same level.

- **F10.** Skills may declare an **archetype** label (single-track, dual-track, modular). This is **non-normative metadata** — a UI label and a lint hint for contributors. It shall not drive renderer behaviour, and the renderer shall contain no archetype-specific branching.
- **F11.** Progress within a level shall be reported per requirement group as `min(completed, n) / n`, averaged across the level's groups. A level therefore reads as complete at exactly its threshold, and milestones completed beyond the threshold surface as bonus rather than as missing progress.
- **F12.** Levels are **meaningful relative to their own skill**. The system shall not claim that a given level in one skill is equivalent in effort or achievement to the same level in another.

### 6.3 Layout

- **F13.** Contributors shall never author layout coordinates. Node position shall be a **pure function of declared semantic fields**, so that adding or removing a milestone shifts only its immediate neighbours and never reflows the tree.
- **F14.** The layout fields a contributor may write are:

  | Field | Required | Purpose |
  |---|---|---|
  | `level` | yes | 1–10; determines the row/rank |
  | `track` | no | named column for branching skills; defaults to the first declared track |
  | `order` | no | integer tiebreak within a (level, track) cell |
  | `module` | no | cluster grouping for choice-based skills |

- **F15.** The renderer shall map `(level, track, order)` deterministically onto a grid. Edge crossings are acceptable; layout instability across edits is not.
- **F16.** On narrow viewports the same data shall collapse to a single column per level, without a separate authored mobile layout.

### 6.4 Domains and the world map

- **F17.** The system shall organize skills into eight top-level **domains**:

  | Domain | Covers |
  |---|---|
  | Mind | mental health, meditation, focus, memory, learning, contemplative practice |
  | Body | fitness, sport, martial arts, movement, nutrition |
  | Making | music, art, writing, craft, code, and technical creation |
  | Home | cooking, drink, cultivation, repair, maintenance, pets |
  | People | conversation, conflict, teaching, parenting, languages, community and civic participation |
  | Work & Money | career, budgeting, investing, negotiation, productivity |
  | Play | chess, go, poker, competitive gaming, puzzles, tabletop |
  | Outdoors & Nature | hiking, bushcraft, navigation, foraging, water sports, nature knowledge |

- **F18.** Each skill shall declare exactly one **primary domain** and zero or more **secondary domains**. The primary domain determines map placement and owns the skill for scoring; secondary domains make the skill discoverable and visible from those regions **without** contributing to their score. A skill therefore contributes to exactly one domain's numbers.
- **F19.** Skills shall additionally carry **facet tags** drawn from a maintainer-curated controlled vocabulary, validated by CI. Tags carry cross-cutting properties that are not domains — modes of engagement, materials, settings, and contested claims — and are the designated relief valve for boundary disputes.
- **F20.** The domain taxonomy shall be **versioned data, not a hardcoded constant**. Domains may be added, renamed, or subdivided. Domain identifiers shall be stable and decoupled from display names, so a rename does not invalidate existing trees.
- **F21.** The system shall present a **hex world map** as the global view. Each domain is an **irregular region composed of multiple hex tiles**, with its own silhouette and palette, rather than a single tile in a fixed arrangement. Map geometry shall not constrain the number of domains.
- **F22.** Domains without published skills shall be rendered as **unrevealed/fogged**, signalling forthcoming content and inviting contribution — never as revealed but empty regions.
- **F23.** Selecting a domain region shall open that domain's skill listing; selecting a skill shall open its tree.

### 6.5 Making subregions

- **F24.** Making skills shall declare one of three **subregion** values, distinguished by what the skill's output exists as:

  | Subregion | Output is | Examples |
  |---|---|---|
  | Expression | a representation — image, sound, text, performance | piano, drawing, photography, writing, filmmaking, graphic design |
  | Objects | a physical thing someone handles or wears | woodworking, ceramics, knitting, blacksmithing, jewellery |
  | Systems | code, circuits, or machines | programming, electronics, robotics, 3D printing, game development |

- **F25.** The boundary rule shall be stated for reviewers as: *a representation is Expression; a physical object is Objects; a system is Systems*, with physical output taking precedence where a skill is both.
- **F26.** Subregions shall be **required from the first Making tree**, so no re-classification pass is ever needed. They render as visible clusters within the Making region.
- **F27.** Making shall be **subdivided into visible subregions but shall remain one domain**. Subregions shall not be promoted to sibling domains. A user comparing domains is comparing arenas of life, not kinds of making; sub-balance within Making is the user's own concern.
- **F28.** The subregion grouping describes output form and shall be documented, in both contribution guide and UI, as implying no hierarchy of worth. `expressive` shall exist as a facet tag usable by any Objects or Systems skill, and such skills may declare Expression as a secondary relationship.

### 6.6 Progress and self-assessment

- **F29.** On starting a skill, the user shall be able to **check off already-completed milestones** to place themselves on the tree. This is the primary self-assessment mechanism and requires no additional per-skill authored content.
- **F30.** The system shall additionally offer a coarse **"estimate my level"** shortcut (e.g. beginner / intermediate / advanced) that pre-checks a plausible milestone set, which the user then corrects. This is a convenience layer over F29, not a replacement.
- **F31.** Completing a milestone shall record a **timestamp**, and shall optionally accept a **user note and/or photo**.
- **F32.** The system shall display a skill's current level, tier name, and progress toward the next level.
- **F33.** Domain score shall be the **sum of levels attained across all skills in that domain**. It is additive and monotonic: starting a skill contributes zero and can never reduce the score.
- **F34.** Domain score shall be mapped to visual fill through a **concave curve**, so early levels visibly move the region and the display never saturates. The system shall not display a raw percentage for a domain.
- **F35.** Domain regions shall additionally encode **recency of activity** on a separate visual channel, which may fade over time, and **breadth** as a count of skills started. Only the recency channel may decrease.
- **F36.** The system shall show, for each active skill, the milestones currently available — prerequisites satisfied, not yet complete.
- **F46.** A milestone shall support a third user state, **dismissed** ("not for me"), alongside complete and incomplete. Dismissal is required by F9's `n_of` and `any` groups: once a user has chosen their electives, the unchosen remainder would otherwise display as outstanding work indefinitely. Dismissal is local user state, is reversible, is included in export, and shall never alter any score — a dismissed milestone is treated exactly as an incomplete one for F11 progress and F33 domain score, and only its presentation changes. This keeps it monotonic-safe under N12.

  *(F46 appends at the end of the F-sequence despite belonging to §6.6; see the identifier note at the head of this document.)*

### 6.7 Data ownership

- **F37.** All user progress shall be stored locally in the browser. The system shall have no user accounts, no server-side progress storage, and no authentication.
- **F38.** The user shall be able to **export** all progress to a portable file and **import** it back, on any device.
- **F39.** The system shall warn the user about the durability limits of browser storage and prompt export at appropriate moments.

### 6.8 Contribution pipeline

- **F40.** The repository shall provide a **machine-readable schema** for tree definitions, plus documentation and worked exemplars covering linear, branching, and choice-based shapes.
- **F41.** CI shall automatically validate every submitted tree for: schema conformance, presence of all ten levels, well-formed requirement groups, milestone counts within the permitted range, absence of dependency cycles, prerequisites at or below the dependent milestone's level, valid domain and subregion references, valid facet tags, and resolvable track/module references.
- **F42.** Every tree shall additionally pass **human review** before merge, judging whether milestones meet the "concrete and testable" standard. Automated validation is necessary but never sufficient. Review shall run in **two rounds by separate reviewers**, and review state shall be published as a **status table in the repository** — one row per tree, columns for authored, review 1, review 2 — so a contributor can see where their submission stands without asking. This requires no infrastructure beyond a markdown table and is a deliberately low-tech substitute for a project board.
- **F43.** The repository shall publish a **written style rubric** defining the house standard for milestone phrasing, level pacing, tier calibration, and requirement-group usage. The rubric shall state that **professionalization is not mastery**: teaching, selling, publishing, competing, and certifying are modes of engagement available at many levels, not markers of the top tier, and shall not be placed at levels 9–10 by default. A beginner can teach a beginner. These are expressed as **facet tags** (F19), orthogonal to level, and the initial controlled vocabulary shall reserve terms for them.
- **F44.** Where an established roadmap, curriculum, or graded framework exists for a skill (ABRSM grades, CEFR levels, belt systems, PADI certifications, published curricula), authors shall be directed to adapt it to the house format rather than invent a parallel structure — while normalizing it onto the uniform 1–10 spine.
- **F45.** **Copyleft carve-out to F44.** F44 covers *structure and sequencing* drawn from published frameworks, cited and not reproduced. It shall not be read as permission to adapt content under a **ShareAlike licence** (CC BY-SA, CC BY-NC-SA). Because all trees live under one content licence, a single derived tree would propagate those terms to the whole library and bind every future contributor. The contribution checklist shall ask explicitly whether any part of a submission derives from a copyleft-licensed source, and CI-passing trees with an affirmative answer shall be rejected at review. `docs/PRIOR-ART.md` §6 records the concrete case that prompted this.

---

## 7. Non-Functional Requirements

- **N1. Static hosting.** The application shall deploy as a static site with no backend service, no database, and no recurring hosting cost.
- **N2. Client-side only.** All logic shall execute in the browser. No user data shall leave the user's device.
- **N3. Responsive.** The application shall be usable on desktop and mobile browsers. The hex map and tree views shall remain navigable at small viewport sizes.
- **N4. Performance.** Tree and map views shall render without perceptible delay on mid-range hardware. Content shall load incrementally rather than shipping the entire library on first paint.
- **N5. Accessibility.** Core flows — browsing, self-assessment, completing milestones — shall be keyboard-navigable and screen-reader usable. Progress and status shall never be conveyed by color alone.
- **N6. Content/code separation.** Tree data shall be editable without touching application code, and a contributor shall be able to author and validate a tree without running the app.
- **N7. Data portability.** Exported progress shall be human-readable and documented, so a user's history survives the project itself.
- **N8. Schema stability.** Schema changes shall be versioned, with a documented migration path for existing trees. Breaking changes to tree data are a maintainer cost paid by every contributor and shall be treated accordingly.
- **N9. Offline tolerance.** Once loaded, the application shall continue to function without network access.
- **N10. Solo maintainability.** The system shall be operable and reviewable by a single maintainer working part-time. Any feature requiring ongoing operational attention is out of scope by construction.
- **N11. Layout stability.** A change to one milestone shall not visibly reflow the rest of a tree. Users return to these views repeatedly, and visual churn erodes the sense of a stable place.
- **N12. Monotonic scoring.** No user action that adds to the library of what they track shall reduce any displayed score. Only explicitly time-decaying channels may decrease.

---

## 8. Success Metrics

### 8.1 Hard requirements — v1 has failed if any of these fails

- **S1.** A single schema expresses linear, branching, and choice-based skills — cooking, piano, and mental health — with **no per-skill or per-archetype special-casing** in the renderer.
- **S2.** An **outside contributor** authors a skill tree that passes CI and human review and is merged.
- **S3.** A new user can go from landing on the site to **placed on a skill tree with a concrete next action in under five minutes**.
- **S4.** The maintainer **personally uses the app for 30 consecutive days**.

### 8.2 Quality signals — not blockers

- Contributors report the schema was learnable from docs and exemplars alone, without maintainer help.
- Returning users complete milestones across multiple sessions rather than only during initial self-assessment.
- Users add notes or photos to a meaningful share of completed milestones.
- Merged trees require few review rounds, indicating the style rubric is working.
- Boundary disputes over domain and subregion placement are rare, and resolved by tags rather than by re-filing.

---

## 9. Constraints

- **C1.** Solo developer, part-time.
- **C2.** **$0 hosting budget.** Static hosting on a free tier. This constraint is the root cause of local-only storage; it forecloses accounts, sync, server-side AI generation, and any server-rendered content.
- **C3.** Web browsers only. No native mobile or desktop applications.
- **C4.** Content authoring is the genuine bottleneck. Any requirement that increases per-tree authoring cost must justify itself against launch breadth.
- **C5.** Contributors work through a git PR workflow. There is no in-app or web-based tree editor in v1, and the schema must remain hand-authorable without one.
- **C6.** Where a tree adapts an existing curriculum or graded framework, that source shall be attributed and licensing respected — structure and sequencing may be adapted, copyrighted material may not be reproduced.

---

## 10. Scope / Non-Goals

- **NG1.** No social features — no leaderboards, parties, friends, sharing, or comparison between users.
- **NG2.** No accounts, authentication, or server-side storage of user progress.
- **NG3.** No verified or certified assessment. All progress is self-reported.
- **NG4.** No native mobile or desktop applications.
- **NG5.** No daily/weekly quest or Kanban execution view in v1.
- **NG6.** No per-skill diagnostic quizzes.
- **NG7.** No global "character level" across all skills. Progress rolls up to domains only.
- **NG8.** No effort or time tracking. The system does not record hours practiced, and levels do not encode estimated effort.
- **NG9.** No cross-skill comparability claims.
- **NG10.** No streaks, habit loops, or daily-check-in mechanics. This is a skill-progression tracker, not a habit tracker.
- **NG11.** No in-app tree editor or web-based contribution UI in v1.
- **NG12.** No AI generation at runtime in the shipped app. AI assists authoring upstream; every published tree is human-reviewed.
- **NG13.** No monetization, payments, or premium content.
- **NG14.** No authored layout coordinates, and therefore no pixel-perfect bespoke tree art.
- **NG15.** No multi-dimensional skill scoring. Skills are not rated along several axes at once; they have one primary domain, optional secondary relationships, and tags.

---

## 11. Deferred Decisions

**Technology and rendering**
- **D1.** Frontend framework and build tooling.
- **D2.** Hex map rendering approach — SVG, canvas, or a hex/graph library — and how irregular multi-tile regions are defined and stored.
- **D3.** How the three tree shapes are presented within one deterministic grid renderer: whether a linear skill, a branching skill, and a clustered skill share one component with different data, or share a layout engine behind distinct presentational shells.
- **D4.** Browser storage mechanism and its quota implications for milestone photos.
- **D5.** Photo handling — storage format, size limits, and whether photos are included in export or exported separately.
- **D6.** The exact concave curve mapping domain score to visual fill, and the named fill tiers along it.
- **D7.** How recency decay is computed and rendered without reading as punishment.

**Content schema**
- **D8.** Serialization format for tree definitions (JSON, YAML, or other).
- **D9.** *Resolved in v1.2 — promoted into F8 as 4–8 milestones per level, 40–80 per tree. Number retained as a gap; successors are not renumbered.* The open remainder is whether the range should vary by tier, which is deferred to the first three authored trees rather than decided in advance.
- **D10.** How mastery content above level 10 is structured — freeform list, continued levels, or named achievements.
- **D11.** Whether XP exists as a distinct quantity at all, or whether level progress is simply derived from milestone completion. Milestone-derived progress is assumed unless architecture finds a reason otherwise.
- **D12.** The initial controlled vocabulary of facet tags, and the process for extending it.
- **D13.** Schema versioning and migration mechanics.
- **D14.** Whether a linter should reject unusual requirement-group combinations. F9's expressiveness is deliberate, but it lets a contributor write ten subtly different rule shapes in one tree; CI can validate syntax but not coherence.

**Contribution pipeline**
- **D15.** Concrete AI-assisted authoring workflow: prompts, source-roadmap ingestion, and how a draft is normalized to house style before human refinement.
- **D16.** Whether an automated style check flagging vague milestones is added to CI, and whether it gates or merely advises.
- **D17.** Repository structure — single repo for app and content, or separate content repo.
- **D18.** Provenance detail — how authorship and review credit are recorded and displayed, and how they are updated as trees are revised by others.

**Product and taxonomy**
- **D19.** Visual identity per domain — palette and silhouette that make each region legible as its own place.
- **D20.** How the "estimate my level" shortcut (F30) derives a milestone pre-selection without per-skill authored mapping data.
- **D21.** **Making subregion split trigger.** Subregions are authored from day one (F26), but the point at which they become visually prominent divisions rather than light grouping is unset. Proposed trigger: Making ≥ 60 skills, or any single subregion ≥ 25. Making remains one domain regardless (F27).
- **D22.** Whether other domains eventually need subregions. Body (27 projected) and Home (23) are the next largest; the same mechanism should serve them if so.
- **D23.** **User-level domain reassignment.** A skill can be a hobby for one person and a profession for another, and a user may reasonably want their coding counted under Work & Money rather than Making. Blocked on a conflict: moving a skill out of a domain would reduce that domain's additive score, violating N12. Needs a resolution — frozen historical contribution, counting in both, or a display-only override — before it can ship.
- **D24.** **Tree families.** Languages, instruments, and martial arts are open-ended families of structurally near-identical trees; six languages appear in the candidate list and there could plausibly be thirty. Whether a template or inheritance mechanism is needed, or whether per-language content differences make standalone trees correct.
- **D25.** Onboarding for the Curious Browser persona — how someone with no intention of tracking anything reaches a compelling view of a tree.
- **D26.** **Content licence.** The licence covering tree data must be chosen and stated before the first external contribution, since it cannot be changed afterwards without every contributor's consent. F45 rules out inheriting a copyleft licence by accident but does not choose one. The trade-off is between a permissive licence that maximizes downstream reuse and a ShareAlike one that keeps forks open; NonCommercial is available but forecloses makerspace and curriculum use that costs this project nothing.
- **D27.** **User-authored milestone slots.** Whether a tree may reserve slots a user fills with their own goals, as several MakerSkillTree trees do (their issue #34). It composes well with F9 electives — a user-defined milestone satisfying an `n_of` slot — but collides with the closed, reviewed content model, since nothing validates a user-written milestone against F2. Not proposed for v1.

---

## Appendix A: Research basis for key decisions

Six decisions were researched rather than assumed. The candidate skill library used for the taxonomy work is in `docs/SKILL-CANDIDATES.md`; the prior-art review is in `docs/PRIOR-ART.md`.

**Prior art: MakerSkillTree (F2, F8, F42, F43, F45).** The closest existing project is `sjpiper145/MakerSkillTree` — 3,407 stars, 964 commits since April 2023, ~76 of 121 planned trees published. Each is a printable poster of exactly 73 hexagonal tiles running basic at the bottom to advanced at the top. Extracting tile geometry from the published Cooking tree confirms a real difficulty gradient — bottom row "make instant noodles," top row "teach a cooking class" — across roughly twenty staggered rows carrying no labels, no thresholds, and no edges. Completion is deliberately undefined: *"tiles can be completed out of order… skill trees do not need to be completed to 100%."* Content ships as SVG and PDF only; the request for machine-readable versions (their issue #17) is open and the FAQ answers "not in the short term." The two projects are duals — they fix the node budget at 73 and drop the level scale, this one fixes the scale at 1–10 and varies the node count — and every structural difference follows from that one choice.

Three things transfer. First, their corpus of roughly 5,500 volunteer-authored, twice-reviewed, achievement-phrased tiles, containing no effort-quantity phrasing at all, is the best evidence that **F2** is achievable by contributors who are subject experts rather than tooling experts; before this the standard rested on CDDA, a game with paid designers. Second, the fixed 73-tile budget held across cooking, Kubernetes, roller derby and astronomy without per-tree negotiation, and a 40-tile Mini template validates a second point — evidence that a bounded budget survives contact with arbitrary subject matter, and the basis for **F8**'s 40–80 range. Third, their issue #47 identifies a calibration failure this project would otherwise have inherited: "teach a class," "sell something you've cooked," and "publish a recipe" sit at the ceiling of tree after tree, conflating professionalization with mastery. **F43** now rules against it and **F19** facet tags carry the distinction instead. Their SVG coordinates also spawned two independent third-party tools, a drag-and-drop generator and an SVG↔YAML converter — a third instance, after roadmap.sh and FTB Quests, of authored-coordinate content pulling toward a GUI, and their own unadopted `input.yml` prototype is a row-indexed tile list with no coordinates, arriving independently at **F14**.

The licence is CC BY-NC-SA 4.0. The maintainer explicitly welcomes open-source trackers built on the project, so **nothing here blocks this one** — but ShareAlike means a single derived tree would propagate copyleft to the entire content library. **F45** exists for that reason, and the recommendation is to treat the project as validation and never as a content source.

**Uniform 1–10 spine with variable milestone counts (F7, F8).** Cataclysm: DDA runs uniform 0–10 across every skill and tolerates enormous variance in content per level because levels function as unlock gates, not effort quanta. Skyrim likewise uses an identical 15–100 range across all 18 skills while distributing 251 perks unevenly. The counterexamples are decisive: roadmap.sh has no level scale and a 60× node-count spread (5 to 301, median 112), so it can never express progress; Duolingo had a 90× course-size spread (11 to 1,030 units) and fixed it by imposing a uniform CEFR-anchored section spine over variable unit counts. The five named tiers follow CEFR (three bands × two levels), ABRSM (grades 1–8 plus diplomas), BJJ (belt × stripe), and Dreyfus (five stages). The unbounded mastery tier follows RuneScape's virtual levels past 99, Skyrim's Legendary reset, and the kyu→dan transition.

**Requirement groups instead of archetypes (F9, F10).** SCORM 2004 and IMS Simple Sequencing have shipped this exact vocabulary for two decades — `all | any | none | atLeastCount | atLeastPercent`, with multiple rollup rules ANDed on one activity. Scouting is the closest real-world analogue: Star requires 6 badges including any 4 Eagle-required, Life 11 including 3 more required, Eagle 21 including 14 — cumulative thresholds mixing required and elective against a shared pool. On whether forcing a mental-health tree to level 10 is honest: standard DBT teaches four modules in 24 weeks and then **runs the identical cycle again** for a full year, and mindfulness is re-taught at the head of every module. Advanced tiers are therefore framed as sustained duration and generalization, not as invented harder content. Duke of Edinburgh's Bronze/Silver/Gold reuse identical sections at escalating depth, supporting the same pattern.

**Deterministic layout from semantic fields (F13–F16).** roadmap.sh ran the authored-coordinate experiment and retreated: its contributor repo now holds only markdown content files, `contributing.md` routes node additions to an *issue* rather than a PR, and new roadmaps arrive as plain-text outlines or through a GUI editor. The best-funded visual editor in this space removed graph authoring from the PR workflow entirely. FTB Quests uses authored `x`/`y` coordinates in SNBT and is survivable only because of an in-game editor, which spawned third-party editors besides. Factorio refuses hand layout because mods define arbitrary technologies. Path of Exile is the instructive hybrid — groups carry absolute coordinates, individual nodes carry group plus orbit index — which is the same principle adopted here. Layout stability under small input changes is a known-hard research problem; the 1–10 spine supplies the rank constraint that most auto-layout ugliness comes from lacking.

**Additive monotonic domain scoring (F33–F35, N12).** Steam demonstrates the defect at scale: averaged completion percentage produces a documented pattern of players declining to launch new games because a 0% entry drags the visible average down. Gamerscore, PSN trophy level, and GW2 mastery points are additive and never decrease, and produce aggressive breadth instead; GW2 deliberately over-supplies mastery points so nothing feels scarce. Earned Value Management solves the same denominator problem by trusting earned value — an additive quantity — over percent complete, which it treats as unreliable when scope moves. Nunes and Drèze's car-wash study found a 10-stamp card pre-stamped twice redeemed at 34% against 19% for an 8-stamp card requiring identical work, and Koo and Fishbach's small-area hypothesis holds that early in pursuit you should show accumulated rather than remaining progress. A mean-completion number does the opposite.

**Eight domains (F17).** Derived from classifying 164 candidate skills rather than from first principles. Six is the hexagon's native number but the distribution did not respect it: Play (14 candidates) and Outdoors & Nature (17) each had no coherent home, with outdoors skills scattering across Body, Home, and Mind on no shared principle — the grab-bag symptom that disqualified "Practical" from an earlier four-domain design. Both are single-axis arenas of capability, consistent with the other six, and both carry strong external grading frameworks (FIDE titles, Elo, PADI, RYA, BCU star awards, river grades I–VI). Wikipedia's Hobby taxonomy carries "Sports and games" at top level and the standard Wheel of Life carries "Fun & Recreation," supporting Play. The final eight distribute between 9% and 27%, with only Making an outlier. Miller's 7±2 was checked and does not apply — it concerns short-term recall, not visible on-screen choices, and the UX literature treats the navigation "rule of seven" as a misattribution. Fogging unpopulated regions follows the fog-of-war convention: an unrevealed region reads as promise, a revealed-but-empty one reads as a bug.

**Making subregions on output form (F24–F28).** Making is 45 of 164 projected skills (27%), 1.7× the next domain. The intuitive Art/Craft split was rejected on evidence: Gropius's 1919 Bauhaus manifesto explicitly denied any essential difference between artist and craftsman and reorganized teaching by material; the studio craft movement existed to erase the line; and RISD places Ceramics, Glass, Jewelry + Metalsmithing, Textiles, Photography and Printmaking in **Fine Arts** while Graphic, Industrial, Furniture and Apparel Design sit in Architecture + Design — so the operative institutional line is autonomous versus commissioned, and craft media fall on the fine-art side. Practically, "expressive" is a property of maker's intent and unobservable from a tree, leaving roughly 13 of 45 skills contested — a judgment call on one PR in three. The adopted axis makes the same distinction observable by asking what the output exists as, which is the UK national split (GCSE Art & Design defined by "personal creative expression and visual communication," Design & Technology by "user, purpose and function") and matches Dewey's 700-Arts against 600-Technology and Etsy's category structure. Material-based grouping has the strongest durability record: FFXIV's eight Disciples of the Hand have been stable since 2010, and CDDA in 0.D deleted its `construction` skill and redistributed the recipes by material, explicitly migrating away from a mixed axis. Contested rate falls to roughly one PR in nine. Subregion names avoid "Art" and "Craft" entirely because those words carry the ranking the axis is trying not to import.
