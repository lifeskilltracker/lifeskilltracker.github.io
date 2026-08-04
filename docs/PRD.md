# PRD: Life XP Skill Tracker

## Problem Statement

Users want to gamify real-life skill development (hobbies, health, creative pursuits) the way video games handle progression: XP, levels, and unlockable pathways. Existing gamification apps (Habitica, HobbyDex, Skill Quest, Goalos) are mostly **empty containers** — they track XP but require the user to define all milestones and self-assess their level.

The core gap: no product ships with **pre-built, content-rich skill trees** that tell the user (a) what level they currently are and (b) exactly what to do next to level up (e.g., "Blacksmithing Level 1: forge a J hook").

## Goals

- Provide skill roadmaps with concrete, testable milestones (achievement-based, not study-hours-based).
- Support self-assessment of current level per skill.
- Support multiple progression mechanics per skill type.
- Deliver a satisfying "game-like" visual experience across many life domains.

## Non-Goals (v1)

- Social/multiplayer features, leaderboards, parties.
- Verified/certified assessments (no formal exam integration initially).
- Mobile native apps (design targets web first).

## Competitive Landscape

| Product | Strengths | Gap vs. This PRD |
|---|---|---|
| Goalos | AI-generated learning paths, XP in 8 life skills, skill tree view | Paths are user-prompted, generic/educational milestones, no self-assessment |
| HobbyDex | Hobby "capture," XP via practice, quests, achievements | User defines all quests/milestones |
| Skill Quest | Multi-category tracking, streak achievements | Empty container; no pre-built content |
| XPTracker | Narrative RPG structure (classes, bosses, arcs) | User writes own questline |
| Habitica | Mature habit RPG (classes, gear, parties) | Habit-focused, not skill-tree-focused |
| GitHub roadmap repos (developer-roadmap, CDDA crafting data) | Pre-built structured content | Tech-only, or embedded in a game; not a tracker |

Key insight from CDDA (Cataclysm: Dark Days Ahead): its crafting system demonstrates the target model — skill levels 0–10+, concrete unlockable recipes, prerequisites (tools/materials/skill), realistic progression.

## Progression Mechanics (Standardized Templates)

Three skill archetypes emerged from analysis of Mental Health, Piano, and Cooking:

| Archetype | Mechanic | XP Model | Levels | Example Skills |
|---|---|---|---|---|
| **Single-track** | Linear milestones, gated by prerequisites | Per milestone | Clear levels (1–10+) | Cooking, blacksmithing, technical skills |
| **Dual-track** | Formal "spine" (grades/certifications) + branching sub-quests | Per piece/exercise/module | Grades + sub-quest tiers | Piano, languages (CEFR), martial arts (belts) |
| **Modular ("choose X of Y")** | Clusters of modules; complete X of Y per cluster | Per module | Tags (Foundational/Intermediate/Advanced) | Mental health, fitness, general wellness |

### Examples

- **Cooking (single-track):** L1 = master 5 basic techniques (sauté, boil, bake, chop, season); L2 = multi-step techniques (searing, pan sauce, braising, dough, timing a 3-component meal); L3 = advanced (tempering, laminated dough, emulsification, fermentation, plating).
- **Piano (dual-track):** Spine = ABRSM/RCM grades 1–8; branches = Classical / Jazz / Theory sub-quests ("choose 3 of: Bach Minuet in G, Chopin Prelude in E minor, ...").
- **Mental Health (modular):** Categories (emotional regulation, cognitive reframing, stress management, social connection, self-care); each tier = choose 3 of 5 modules (e.g., "7-day mood journal," "complete a CBT workbook").

## Visual / UX Design

Two-layer system:

1. **World map / hex map (global view):** Life domains as hex tiles/regions (inspired by Hextree.io Hexmap). Color-coded by recent activity or level. Zooming into a region opens the skill view. Confidence: 8/10.
2. **Per-skill tree/path (skill view):** Skill-type-dependent layout:
   - Duolingo-style rows/tree for linear skills (cooking, technical). Confidence: 9/10.
   - Video-game perk tree (Skyrim-style) for branching/specialization skills (piano). Confidence: 7/10.
   - Course-style module layout as an alternative for structured curricula. Confidence: 6/10.
3. **Execution view (secondary):** Task list / Kanban for daily/weekly quests pulled from active milestones. Not the primary visual (confidence as primary: 3/10).

## Functional Requirements (Draft)

- FR-1: Users can browse a library of skills, each with a pre-built tree of levels and milestones.
- FR-2: Each milestone is concrete and testable (an achievement, not "study for N hours").
- FR-3: Completing a milestone awards XP; XP fills per-skill level bars.
- FR-4: Milestones support prerequisites/unlock dependencies rendered as tree edges.
- FR-5: Skills declare their archetype (single-track, dual-track, modular) which drives layout and completion rules.
- FR-6: Self-assessment flow: on starting a skill, user answers questions or checks off already-completed milestones to place themselves on the tree.
- FR-7: Daily/weekly "quest" view aggregates available next milestones across active skills.

## Open Questions

1. **Platform:** Web app, Notion/Obsidian template, or native? (Affects feasibility of hex map + tree rendering.)
2. **Content sourcing:** Hand-authored skill trees, community-contributed (GitHub-style repo of tree definitions), AI-generated (Goalos-style), or a hybrid?
3. **Self-assessment depth:** Simple "check off what you've already done" vs. diagnostic quizzes per skill?
4. **XP economy:** Is XP comparable across skills (one global character level) or strictly per-skill?
5. **Scope of v1 skill library:** How many skills at launch, and which (cooking, piano, mental health as the three archetype exemplars)?
6. **Data format:** Should trees be defined in a portable schema (JSON/YAML, like CDDA recipe data) so the community can contribute new skill trees?
