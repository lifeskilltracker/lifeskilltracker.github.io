# Life XP Skill Tracker — Product Requirements Document

**Version:** 1.0
**Date:** 2026-08-03
**Owner:** Ethan Morchy
**Status:** Ready for architecture

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
| Skill Quest | Multi-category tracking, streak achievements | Empty container; no pre-built content |
| XPTracker | Narrative RPG structure (classes, bosses, arcs) | User writes own questline |
| Habitica | Mature habit RPG (classes, gear, parties) | Habit-focused, not skill-tree-focused; delegates categorization to users entirely |
| developer-roadmap / roadmap.sh | Pre-built curated content at scale | Tech-only; no levels, tiers, or completion scale — cannot express progress |
| Cataclysm: DDA (game) | Skills 0–10, concrete unlockable recipes, real prerequisites | Embedded in a game, not a tracker |

**Reference model:** CDDA's crafting system. Uniform 0–10 across every skill, levels act as *unlock gates* rather than effort quanta, and content density per level varies enormously without breaking the scale. This is the shape being adapted.

---

## 3. Goals

In priority order:

1. **Ship skill trees with concrete, testable milestones** — achievement-based, never study-hours-based. This is the differentiator; everything else supports it.
2. **Make the content contributor-scalable** — a portable schema, validation tooling, and a review process that let volunteers add trees without maintainer bottleneck or quality erosion.
3. **Let a user place themselves accurately and fast** — self-assessment that produces a correct starting position and an obvious next action within minutes.
4. **Deliver a game-like visual experience** — hex world map over life domains, per-skill trees whose layout matches the skill's progression archetype.
5. **Support multiple progression mechanics** — one schema that expresses linear, dual-track, and modular skills without per-skill special-casing.

### Explicit trade-offs

- **Content quality over content volume.** Three excellent trees beats thirty generic ones. The failure mode being avoided is becoming another empty container with an AI-generated veneer.
- **Contributor tooling over launch breadth.** Breadth comes from contributors, so the schema, validator, and docs are v1 deliverables of equal weight to the app itself.
- **Zero ops burden over feature richness.** Local-only storage and static hosting are hard constraints, not defaults to revisit.

---

## 4. User Personas

### 4.1 The Player (primary)

Someone building a real-life skill who wants structure and a sense of progress. Arrives not knowing what "good" looks like in a skill, or knowing but unable to sequence it. Opens the app to see where they stand and what's next. Uses it on desktop or mobile browser, sporadically — a few times a week when they complete something.

**Capability scope:** browse the library, start skills, self-assess, complete milestones with notes/photos, export their data. Cannot author trees.

### 4.2 The Tree Author (primary)

A contributor with real knowledge of some skill who wants it represented well. Comfortable with a git PR workflow but not necessarily with the app's codebase. Works with AI assistance to draft a tree from existing roadmaps and their own expertise, then refines it by hand.

**Capability scope:** author and submit tree data files, run the validator locally, respond to review.

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
- As a Player, I want to see progress at the domain level, so I know whether I'm neglecting an area of my life.

**Tree Author**
- As a Tree Author, I want a documented schema and a local validator, so I know my tree is structurally correct before I open a PR.
- As a Tree Author, I want worked exemplar trees for each archetype, so I can pattern-match instead of guessing the house style.
- As a Tree Author, I want to declare that my skill belongs to more than one domain, so programming can surface under both Making and Work & Money.
- As a Tree Author, I want to add mastery content above level 10, so deep skills aren't artificially capped.

**Maintainer**
- As a Maintainer, I want CI to reject structurally invalid trees automatically, so review effort goes to judging content quality, not catching typos.
- As a Maintainer, I want a written style rubric for "concrete and testable," so review decisions are consistent and defensible.
- As a Maintainer, I want to add or rename a domain without invalidating existing trees, so the taxonomy can evolve as the library grows.

---

## 6. Functional Requirements

### 6.1 Skill trees and content

- **F1.** The system shall ship a library of pre-built skill trees, each defining levels, milestones, and prerequisite relationships.
- **F2.** Every milestone shall be concrete and testable — an achievement with an observable completion condition ("forge a J hook," "cook a 3-component meal with correct timing"), never an effort quantity ("practice for 10 hours").
- **F3.** Each skill shall declare a progression **archetype**, which drives its layout and completion rules:
  - **Single-track** — linear milestones gated by prerequisites (cooking, blacksmithing, technical skills)
  - **Dual-track** — a formal spine (grades, certifications) plus branching sub-quests (piano, languages, martial arts)
  - **Modular** — clusters where the user completes X of Y modules (mental health, fitness, general wellness)
- **F4.** Milestones shall support prerequisite/unlock dependencies, rendered as edges in the tree.
- **F5.** Trees shall be defined in a portable, human-editable data format under version control, independent of the rendering application.
- **F6.** A skill shall be able to declare **mastery content above level 10** as an optional, unbounded set, excluded from completion-percentage calculations.

### 6.2 Level structure

- **F7.** Every skill shall use a uniform **1–10 level spine**, grouped into five named tiers of two levels each:

  | Tier | Levels |
  |---|---|
  | Novice | 1–2 |
  | Apprentice | 3–4 |
  | Journeyman | 5–6 |
  | Expert | 7–8 |
  | Master | 9–10 |

- **F8.** Each level shall contain a variable number of milestones within a schema-enforced range. Depth variance between skills is expressed as **milestone count and difficulty within a level**, never as a differing number of levels.
- **F9.** A level shall be complete when its completion rule is satisfied — all milestones for single-track and dual-track spines, or the declared "X of Y" threshold for modular clusters.
- **F10.** Levels are **meaningful relative to their own skill**. The system shall not claim that a given level in one skill is equivalent in effort or achievement to the same level in another.

### 6.3 Domains and the world map

- **F11.** The system shall organize skills into six top-level **domains**:

  | Domain | Covers |
  |---|---|
  | Mind | mental health, meditation, focus, memory, learning |
  | Body | fitness, sport, nutrition, sleep, martial arts |
  | Making | music, drawing, writing, photography, woodworking, code, ceramics |
  | Home | cooking, gardening, repair, cleaning, driving |
  | People | conversation, conflict, teaching, languages, parenting |
  | Work & Money | career, budgeting, investing, negotiation, productivity |

- **F12.** Each skill shall declare exactly one **primary domain** and zero or more **secondary domains**. The primary domain determines hex-map placement and owns the skill for rollup purposes; secondary domains make the skill discoverable and visible from those regions **without** counting toward their progress. A skill therefore contributes to exactly one domain's numbers.
- **F13.** The domain taxonomy shall be **versioned data, not a hardcoded constant**. Domains may be added, renamed, or subdivided in later releases. Domain identifiers shall be stable and decoupled from display names so a rename does not invalidate existing trees.
- **F14.** The system shall present a **hex world map** as the global view: one hex region per domain, sized to actual content, colored by activity or progress.
- **F15.** Domains without published skills shall be rendered as **unrevealed/fogged**, signalling forthcoming content and inviting contribution — never as empty populated regions.
- **F16.** Selecting a domain region shall open that domain's skill listing; selecting a skill shall open its tree.

### 6.4 Progress and self-assessment

- **F17.** On starting a skill, the user shall be able to **check off already-completed milestones** to place themselves on the tree. This is the primary self-assessment mechanism and requires no additional per-skill authored content.
- **F18.** The system shall additionally offer a coarse **"estimate my level"** shortcut (e.g. beginner / intermediate / advanced) that pre-checks a plausible milestone set, which the user then corrects. This is a convenience layer over F17, not a replacement.
- **F19.** Completing a milestone shall record a **timestamp**, and shall optionally accept a **user note and/or photo**.
- **F20.** The system shall display a skill's current level, tier name, and progress toward the next level.
- **F21.** The system shall display **domain progress as the mean completion percentage across the skills the user has started in that domain**, where each skill's completion is normalized against its own tree. Mastery-tier content is excluded from this calculation.
- **F22.** The system shall show, for each active skill, the milestones currently available (prerequisites satisfied, not yet complete).

### 6.5 Data ownership

- **F23.** All user progress shall be stored locally in the browser. The system shall have no user accounts, no server-side progress storage, and no authentication.
- **F24.** The user shall be able to **export** all progress to a portable file and **import** it back, on any device.
- **F25.** The system shall warn the user about the durability limits of browser storage and prompt export at appropriate moments.

### 6.6 Contribution pipeline

- **F26.** The repository shall provide a **machine-readable schema** for tree definitions, plus documentation and worked exemplars for all three archetypes.
- **F27.** CI shall automatically validate every submitted tree for: schema conformance, valid archetype and completion rules, presence of all ten levels, milestone counts within the permitted range, absence of dependency cycles, and valid domain references.
- **F28.** Every tree shall additionally pass **human review** before merge, judging whether milestones meet the "concrete and testable" standard. Automated validation is necessary but never sufficient.
- **F29.** The repository shall publish a **written style rubric** defining the house standard for milestone phrasing, level pacing, and tier calibration.
- **F30.** Where an established roadmap, curriculum, or graded framework exists for a skill (ABRSM grades, CEFR levels, belt systems, published curricula), authors shall be directed to adapt it to the house format rather than invent a parallel structure — while normalizing it onto the uniform 1–10 spine.

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
- **N10. Solo maintainability.** The system shall be operable and reviewable by a single maintainer working part-time. Any feature that requires ongoing operational attention is out of scope by construction.

---

## 8. Success Metrics

### 8.1 Hard requirements — v1 has failed if any of these fails

- **S1.** A single schema expresses all three archetypes — cooking (single-track), piano (dual-track), and mental health (modular) — with **no per-skill special-casing** in the renderer.
- **S2.** An **outside contributor** authors a skill tree that passes CI and human review and is merged. This is the real test of the open-source content model.
- **S3.** A new user can go from landing on the site to **placed on a skill tree with a concrete next action in under five minutes**.
- **S4.** The maintainer **personally uses the app for 30 consecutive days**, catching the "looks great, nobody opens it twice" failure mode.

### 8.2 Quality signals — not blockers

- Contributors report the schema was learnable from docs and exemplars alone, without maintainer help.
- Returning users complete milestones across multiple sessions rather than only during initial self-assessment.
- Users add notes or photos to a meaningful share of completed milestones, indicating the tree functions as a record and not just a checklist.
- Merged trees require few review rounds, indicating the style rubric is doing its job.

---

## 9. Constraints

- **C1.** Solo developer, part-time.
- **C2.** **$0 hosting budget.** Static hosting on a free tier. This constraint is what makes local-only storage a requirement rather than a preference; it forecloses accounts, sync, server-side AI generation, and any server-rendered content.
- **C3.** Web browsers only. No native mobile or desktop applications.
- **C4.** Content authoring is the genuine bottleneck. Any requirement that increases per-tree authoring cost must justify itself against launch breadth.
- **C5.** Contributors work through a git PR workflow. There is no in-app or web-based tree editor in v1.
- **C6.** Where a tree adapts an existing curriculum or graded framework, that source shall be attributed, and licensing shall be respected — structure and sequencing may be adapted, copyrighted material may not be reproduced.

---

## 10. Scope / Non-Goals

- **NG1.** No social features — no leaderboards, parties, friends, sharing, or comparison between users.
- **NG2.** No accounts, authentication, or server-side storage of user progress.
- **NG3.** No verified or certified assessment. All progress is self-reported, and the system makes no claim of external validity.
- **NG4.** No native mobile or desktop applications.
- **NG5.** No daily/weekly quest or Kanban execution view in v1. Deferred to v2 — with three launch skills, the "available next" list is short enough to read directly off the tree.
- **NG6.** No per-skill diagnostic quizzes. Self-assessment is checkbox-based (F17) plus a coarse shortcut (F18); quizzes would tax the content pipeline that is already the bottleneck.
- **NG7.** No global "character level" across all skills. Progress rolls up to domains only, and stops there.
- **NG8.** No effort-based or time-based tracking. The system does not record hours practiced, and levels do not encode estimated effort.
- **NG9.** No cross-skill comparability claims. Level 7 in one skill is not asserted to equal level 7 in another (F10).
- **NG10.** No streaks, habit loops, or daily-check-in mechanics. This is a skill-progression tracker, not a habit tracker — that space is well served by Habitica.
- **NG11.** No in-app tree editor or web-based contribution UI in v1.
- **NG12.** No AI generation at runtime in the shipped app. AI assists authoring upstream, in the contributor's own environment; every published tree is human-reviewed.
- **NG13.** No monetization, payments, or premium content.

---

## 11. Deferred Decisions

Open questions intentionally pushed to architecture or design.

**Technology and rendering**
- **D1.** Frontend framework and build tooling.
- **D2.** Hex map rendering approach — SVG, canvas, or a hex/graph library.
- **D3.** Tree rendering approach per archetype: Duolingo-style path for single-track, perk-tree layout for dual-track branching, module/cluster layout for modular. Whether one rendering engine serves all three or each gets a dedicated view.
- **D4.** Whether tree layout is authored (explicit coordinates in the data) or computed (automatic graph layout). This materially changes contributor burden and should be decided early.
- **D5.** Browser storage mechanism and its quota implications for milestone photos.
- **D6.** Photo handling — storage format, size limits, and whether photos are included in export or exported separately.

**Content schema**
- **D7.** Serialization format for tree definitions (JSON, YAML, or other), and the tradeoff between machine-validation ergonomics and human authoring comfort.
- **D8.** The permitted milestone-count range per level, and whether it varies by tier. Research suggests deep skills naturally carry more milestones at higher tiers; the schema should constrain enough to prevent the roadmap.sh 5-to-301 spread without forcing filler into shallow skills.
- **D9.** How dual-track skills encode the spine/branch relationship, and how branch sub-quests map onto the 1–10 spine.
- **D10.** How modular "choose X of Y" clusters map onto the 1–10 spine, given that modular skills were originally conceived with tier tags rather than levels.
- **D11.** Whether XP is a distinct quantity at all, or whether level progress is simply derived from milestone completion. Milestone-derived progress is simpler and is assumed unless architecture finds a reason otherwise.
- **D12.** Mastery-tier structure above level 10 — freeform list, continued levels, or named achievements.
- **D13.** Schema versioning and migration mechanics.

**Contribution pipeline**
- **D14.** Concrete AI-assisted authoring workflow: prompts, source-roadmap ingestion, and how a draft is normalized to house style before human refinement.
- **D15.** Whether an automated style check (flagging vague milestones against the rubric) is added to CI alongside schema validation, and whether it gates or merely advises.
- **D16.** Repository structure — single repo for app and content, or separate content repo.

**Design and product**
- **D17.** Visual identity per domain — palette and silhouette that make each hex region legible as its own place.
- **D18.** How the "estimate my level" shortcut (F18) derives a milestone pre-selection without per-skill authored mapping data.
- **D19.** Known issue with F21: mean completion percentage *drops* when a user starts a new skill in a domain, which perversely discourages exploration. Candidate mitigations include weighting by engagement, showing a separate breadth indicator alongside, or excluding newly started skills for a grace period. Needs resolution before the domain number ships.
- **D20.** When a domain accumulates enough skills to warrant subdivision (Making → Sound / Image / Object), how sub-regions render and how existing trees migrate. F13 requires this be possible; the mechanism is deferred.
- **D21.** Onboarding for the Curious Browser persona — how someone with no intention of tracking anything gets to a compelling view of a tree.

---

## Appendix A: Research basis for key decisions

The level structure and domain taxonomy were the two decisions researched rather than assumed. Summary of what drove them:

**Uniform 1–10 spine with variable milestone counts (F7, F8).** Cataclysm: DDA runs uniform 0–10 across every skill and tolerates enormous variance in content per level because levels function as unlock gates, not effort quanta. Skyrim likewise uses an identical 15–100 range across all 18 skills while distributing 251 perks unevenly among them. The counterexamples are decisive: roadmap.sh has no level scale and a 60× node-count spread (5 to 301, median 112), so it can never express progress; Duolingo had a 90× course-size spread (11 to 1,030 units) and fixed it by imposing a uniform CEFR-anchored section spine over variable unit counts. The five named tiers follow CEFR (three bands × two levels), ABRSM (grades 1–8 plus diplomas), BJJ (belt × stripe), and Dreyfus (five stages) — all of which pair a coarse comparable spine with variable depth inside each step. The unbounded mastery tier follows RuneScape's virtual levels past 99, Skyrim's Legendary reset, and the kyu→dan transition.

**Six domains with primary/secondary membership (F11, F12).** Six is the hexagon's native number, tiling cleanly as a ring around a central hub. It sits within the 6–10 band that Wheel-of-Life coaching practice identifies as workable, and near O\*NET's seven mid-level skill clusters. Miller's 7±2 was checked and does not apply — it concerns short-term recall, not visible on-screen choices, and the UX literature treats the navigation "rule of 7" as a misattribution. Merging creative and technical pursuits into a single **Making** domain deliberately removes the largest boundary dispute (photography, programming, woodworking are all Making). Wellness taxonomies (SAMHSA's eight dimensions, Hettler's six) were rejected as a direct import because wellness dimensions describe *states* rather than *skill spaces* — Spiritual, Environmental, and Occupational have few authorable trees — though their cardinality lesson was kept. Habitica's approach of delegating categorization to users was rejected as an abdication of the problem. Fogging unpopulated regions (F15) follows the fog-of-war convention: an unrevealed region reads as promise, whereas a revealed-but-empty region reads as a bug.

**Known open risk.** Both research threads independently flagged that domain-level aggregation across genuinely incomparable skills is the weakest part of the design. The resolution adopted here is to make the honest claim rather than a false one: levels are meaningful relative to their own skill (F10, NG9), and the domain number reports mean *completion* against each skill's own tree rather than mean *level* (F21). The residual issue with that formulation is logged as D19.
