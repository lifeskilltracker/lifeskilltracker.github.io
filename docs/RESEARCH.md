# Research Log

**Date:** 2026-08-03 / 2026-08-04
**Purpose:** Evidence base for the design decisions recorded in `docs/PRD.md`. Each section states the question, the evidence found, the options considered, what was decided, and the strongest argument against the decision.

**Method.** Seven research agents across three rounds. Each was given the locked constraints and asked to evaluate a named option set against real systems, preferring primary sources (official documentation, wikis, standards texts, actual repositories and category listings) over commentary.

**Caveat on citations.** Sources below were gathered and reported by research agents. Figures quoted from repositories and specifications are as reported; URLs have not been individually re-verified. Where a number is load-bearing for a decision, it is flagged inline.

**Reading this document.** Sections map to PRD requirements. Appendix A of the PRD is a condensed summary of what follows; this is the long form, including the options that were rejected and why.

---

## 1. Level structure

**Question.** Should every skill use a uniform level range, or should each declare its own depth? And what depth actually works?

### Evidence

**Video game progression systems**

Cataclysm: DDA is the closest structural analogue. Every skill uses an identical **0–10** range across roughly 20 skills, and levels function as *unlock gates*: recipes declare a required skill level, and crafting can only raise a skill to `(difficulty × 1.25) + 1`. Content density per level is wildly non-uniform — Fabrication gates new recipes at nearly every level, while Swimming and Speech gate almost nothing. The uniform spine survives that asymmetry precisely because levels are gates, not effort quanta.

RuneScape uses 1–99 with 13,034,431 XP total and a curve growing roughly 10.4% per level, doubling about every 7 levels. Level 92 is the halfway point of total XP to 99; the step 98→99 costs as much as 1→75. Jagex subsequently added virtual levels to 126 and real 120-caps for newer skills — evidence that a hard cap generates demand for an open-ended tail whether or not you plan for one.

Skyrim uses an identical 15–100 range across all 18 skills, with 251 perks distributed unevenly among them (averaging ~14 per tree, individual perks carrying 1–5 ranks), plus a Legendary reset that returns a maxed skill to 15 and refunds perks, infinitely repeatable. Uniform axis, variable node count, prestige on top.

Duolingo is the cautionary tale. Course sizes range from **11 units / 123 lessons (Navajo) to 1,030 units / 8,274 lessons (Japanese)**; Spanish carries 991 units. Under raw unit counts, "finished the course" means nothing across courses. The fix was to impose a **CEFR-anchored Section spine** over variable unit counts — Section 3 = A1, Section 8 = B2 — with courses filling 4 to 9 sections depending on maturity.

**Real-world graded frameworks**

CEFR uses **6 levels in 3 bands** (A/B/C, each split in two), with an explicit branching principle: implementers may add plus-levels (A2+, B1+, B2+) and Pre-A1 for local granularity without breaking cross-system comparability. Six is the deliberate ceiling for comparability; subdivision is local.

ABRSM uses Grades 1–8 plus three diploma levels (ARSM/LRSM/FRSM, approximately RQF 4/6/7). Time per grade is grossly non-linear — ABRSM's own Total Qualification Time puts **Grade 7→8 at roughly 320 practice hours plus 54 lesson hours**. Grades 1–2 typically run 9–12 months, 3–6 about 12–15 months, and 7–8 up to two years each.

ILR uses 0–5 with plus levels. ACTFL subdivides Novice, Intermediate and Advanced into Low/Mid/High but leaves **Superior and Distinguished undivided** — a respected framework with deliberately uneven granularity on a uniform spine.

Martial arts show enormous variance in tier count (BJJ 5 adult belts, Judo ~7 kyu, karate 8–10 kyu, WT taekwondo ~12) but near-universal convergence on one shape: a bounded coloured ladder, a black-belt threshold, then open-ended dan ranks 1–10. BJJ adds 0–4 stripes within each belt, producing a uniform 5×4 grid with wildly variable time per cell.

FIDE uses continuous Elo underneath with 4 named titles at fixed thresholds (CM 2200, FM 2300, IM 2400, GM 2500) — measure continuously, display coarsely.

The Dreyfus model gives 5 stages (Novice, Advanced Beginner, Competent, Proficient, Expert), the canonical academic answer to how many tiers a skill has.

**Curated roadmap projects**

Counted from the `kamranahmedse/developer-roadmap` master tree: **91 roadmaps, 10,324 content nodes, median 112 nodes, range 5 (`git-github-beginner`) to 301 (`cyber-security`)** — a 60× spread. Structure is `roadmaps/<slug>/content/<topic>@<nanoid>.md`, one markdown file per node. Critically, **there is no level, tier, or difficulty field anywhere in the schema**, so roadmap.sh cannot roll up, cannot compare, and has no notion of how far along a user is. It manages depth variance by splitting hard topics into separate `*-beginner` roadmaps.

### Options considered

| Option | Verdict |
|---|---|
| Uniform 1–10, flat | Viable; CDDA and Skyrim both ship it. Loses the tier vocabulary. |
| Per-skill variable depth | Rejected. Empirically destroys comparability (Duolingo pre-restructure, roadmap.sh). No target shape for volunteers. |
| Uniform 1–10 + open mastery tier | Good; fixes the ceiling but not the floor — shallow skills still owe 10 levels. |
| 5 named tiers only | Too coarse. A piano tier could be 300 hours wide; feedback cadence collapses. |
| **5 tiers × 2 levels = 1–10 spine, variable milestone counts, optional mastery** | **Adopted.** |

### Decision

PRD **F7, F8, F5**. Fixed levels 1–10 grouped into five named tiers of two (Novice, Apprentice, Journeyman, Expert, Master), variable milestone count per level within a schema-enforced range, optional unbounded mastery content above 10 excluded from scoring.

This is structurally CEFR (3 bands × 2), ABRSM (8 grades + diplomas), and BJJ (belt × stripe). Contributors get a fixed 10-slot target; depth variance is absorbed as milestone count and difficulty rather than as level count.

### Strongest argument against

The schema asserts that level 7 in knife skills and level 7 in piano occupy the same slot, and they do not — ABRSM Grade 7→8 alone is ~374 hours while an entire knife-skills tree might be 30. The project's answer is not to fix the comparison but to stop making it: PRD **F12** states levels are meaningful relative to their own skill, and **NG9** disclaims cross-skill comparability outright.

---

## 2. Requirement groups (replacing archetypes)

**Question.** Choice-based skills like mental health were conceived with coarse tier tags, not levels. How does "choose 3 of 5" map onto ten discrete levels without special-casing the renderer?

### Evidence

**SCORM 2004 / IMS Simple Sequencing** is the direct precedent and has shipped for two decades. Its `childActivitySet` vocabulary is exactly `all | any | none | atLeastCount | atLeastPercent`, with a `minimumCount` integer, and an activity may carry **several rollup rules that are ANDed together**. "Satisfied if at least 3 of its children are satisfied" alongside strict `all` is the industry default, not a novel design.

**Scouting** is the closest real-world analogue and does not use per-rank clusters. Star requires 6 badges including any 4 Eagle-required; Life requires 11 total including 3 more required; Eagle requires 21 including 14 required, with substitution pairs (Emergency Preparedness *or* Lifesaving). A linear rank number driven by cumulative thresholds against one shared pool, mixing `all`-of-required with `n_of`-elective plus `any_of` choice pairs.

**Duke of Edinburgh** reuses identical categories at every level. Bronze, Silver and Gold have the same four sections; only duration and depth escalate (3–6 / 6–9 / 12–18 months), with Gold adding a fifth. Levels represent intensity of the same peer categories, never new categories.

**Mental health has no advanced tier — it has repetition.** Standard DBT teaches four modules in 24 weeks and then **runs the identical cycle a second time** for a full year; the second pass is the same content for depth of mastery, not higher-level content. Mindfulness is re-taught at the head of every module, and graduate groups repeat rather than escalate. This is load-bearing: it means framing "Master-tier self-care" as new, harder content is a category error, while framing it as sustained, generalized, longer-duration practice is honest.

**Games already separate the linear number from the chosen content.** Skyrim raises skill level linearly from use while perks are chosen from a tree gated by that level — two axes, no conflict. Path of Exile grants passive points by character level and lets you spend them anywhere. Guild Wars 2 masteries require both track XP (linear) and mastery points from a deliberately over-supplied achievement pool (choice).

### Options considered

| Option | Verdict |
|---|---|
| Ten per-level "choose X of Y" clusters | Rejected. 30–50 modules per tree; no system authors ten distinct elective pools. |
| Clusters at tier, 2 levels from partial completion | Good as an *authoring convention*; as schema it is a choice-based-only branch in the renderer, violating S1. |
| Few clusters, levels from cumulative thresholds | Scouting's model. Low burden, but levels stop being content-bearing. |
| Drop the archetype, force linear with optional milestones | Rejected as dishonest — imposes false sequence on genuinely peer modules. |
| **Spine invariant, completion rule variable, as a LIST of ANDed groups** | **Adopted.** |

The single-scalar version of the last option fails piano, which needs "all of the ABRSM spine **and** 2 of the branch sub-quests." SCORM's own answer — multiple rules ANDed — resolves it.

### Decision

PRD **F9, F10, F11**. Each level declares a list of requirement groups, all of which must hold. Linear skills use one `all` group; choice-based skills use one `n_of`; branching skills use `all` + `n_of` on the same level. `archetype` survives as non-normative metadata — a UI label and lint hint — explicitly barred from driving renderer behaviour.

Progress within a group reports as `min(done, n) / n`, so a level reads complete at exactly its threshold and surplus surfaces as bonus, matching the GW2 over-supply model.

**Worked example.** Mental health, Novice tier: a five-module pool, one per category (emotional regulation, cognitive reframing, stress management, social connection, self-care). Level 1 requires 3 of 5, level 2 requires all 5. Authoring cost is 5 modules per tier, 25 per tree — comparable to a linear tree. Levels 9–10 follow DBT's second cycle: same five categories, requirements framed as sustained duration and teaching or generalizing to others.

### Strongest argument against

This moves complexity out of the renderer and into the author's head. The archetype label was doing real work as contributor documentation — "you are writing a choice-based tree, here is its shape." A free-form rule engine lets a contributor write ten subtly different rule combinations per tree, and CI can validate syntax but not coherence. Logged as PRD **D14**; mitigation is authoring templates plus a linter that rejects unusual rule mixes.

---

## 3. Tree layout

**Question.** Do contributors author node coordinates, or does an algorithm compute them?

### Evidence

**roadmap.sh ran this experiment and retreated.** Its public repo now contains only `roadmaps/<slug>/content/<topic>@<nanoid>.md` — a pull of the full git tree (10,548 paths) found no roadmap structure or position JSON in the contributor-facing repo at all. `contributing.md` states that typos go to a PR but **"Adding/Removing Nodes and Modifying Node Titles — please open an issue."** New roadmaps arrive as a plain-text outline or via the GUI editor at `draw.roadmap.sh`. The project with the best-funded visual editor in this space removed graph authoring from the PR workflow entirely. This is the single most important datum for the decision.

**FTB Quests** uses authored coordinates (`x`, `y`, `size`, `shape`, `dependencies` per quest in `.snbt` chapter files) and is survivable only because of its in-game editor (`/ftbquests editing_mode`). Third-party editors exist (`Jasons-impart/ftb-quests-editor`, `jmoiron/qbedit`) precisely because hand-editing SNBT coordinates is intolerable.

**Factorio** refuses hand layout: the technology graph is non-planar and mods define arbitrary technologies, so the game draws only the sub-graph relevant to the selected tech. Community full-tree views are Graphviz dumps. Directly analogous — you cannot hand-place what contributors will author.

**Path of Exile** is the instructive hybrid: only *groups* carry absolute `x`/`y`; individual nodes carry `group` plus `orbit` plus `orbitIndex`, a slot index on a polar ring. Authors place clusters, the renderer computes node pixels.

**KSP** tech trees use `pos = x,y,z` per node in `TechTree.cfg`; modders reached for GUI tools.

**Cataclysm: DDA** has a genuine proficiency DAG (Antique Gunsmithing requires Principles of Metalworking plus Principles of Gunsmithing) and never draws it — categorized, filterable lists with textual requirements.

**Duolingo** replaced its branching skill tree with a single linear path in 2022. Controversial with power users; better beginner completion and substantially better on mobile.

**Layout stability** is a known-hard research problem, studied as "mental map preservation." Incremental and dynamic layout holds up only for small graphs with small changes, and pays in edge crossings and edge length. dagre and ELK are deterministic per input but not continuous across inputs — one added node can flip crossing-minimization and reshuffle an entire layer.

### Options considered

| Option | Verdict |
|---|---|
| Fully authored coordinates | Rejected. roadmap.sh's retreat is the verdict for a PR-based workflow. |
| Fully computed auto-layout | Rejected as primary. Unstable across edits; force-directed is decorative at 40–100 nodes on mobile. |
| Auto-layout with rank constraints (ELK/dagre) | Better — the 1–10 spine supplies the layer assignment — but crossing-minimization can still flip order within a level. |
| Layout-free lists and cards | What CDDA does. Free, responsive, accessible, stable; abandons the visual goal. |
| **Deterministic slot assignment from declared semantics** | **Adopted.** |

### Decision

PRD **F13–F16**, **N11**. No layout algorithm runs. Contributors write `level` (required, the row), `track` (optional, the column, branching skills only), `order` (optional integer tiebreak), and `module` (optional, clustered skills). The renderer maps `(level, track index, order)` onto a grid cell — CSS grid on desktop, collapsing to one column per level on mobile, which yields the layout-free fallback for free. Edges are drawn between cells and may cross; crossings are accepted in exchange for stability. Adding a milestone shifts one lane, never the whole graph.

CI validates level ∈ 1–10, that `requires` targets exist, that there are no cycles, that a prerequisite's level is at or below its dependent's, and that `track` and `module` references resolve.

### Strongest argument against

Refusing crossing minimization guarantees spaghetti in exactly the case that motivated wanting a perk tree — a piano tree with many cross-track prerequisites will render as a rat's nest that hand placement would have made legible. Separately, `track` is itself a modeling burden: a domain expert who does not grasp it will dump everything into one lane, degrading the tree into a plain list. Mitigation is editorial rather than technical — ship exemplar trees and schema docs, and treat a skill needing more than about four tracks as a signal to split the skill.

---

## 4. Domain scoring

**Question.** Mean completion percentage across a domain's skills drops when a user starts a new skill, punishing exploration. What replaces it?

### Evidence

**Averaged aggregates produce avoidance.** Steam's per-game achievement percentage and library completion rate produce a well-documented "don't touch it" pattern: players avoid launching new games because a 0% entry drags the visible average down, and third-party completionist sites exist largely to re-frame Steam's numbers. This is the exact defect, already observed at scale.

**Additive aggregates produce breadth.** Xbox Gamerscore is permanent and cumulative, with cert rules (XR-055) ensuring every title contributes on the same scale; players start games they would otherwise skip because starting is pure upside. Sony's October 2020 trophy rework kept additivity and re-curved it (1–100 to 1–999) explicitly to make progression feel continuous — a curve change, not a metric change. Guild Wars 2 issues far more mastery points than are needed to buy all masteries, deliberately making the pool non-scarce so nothing feels lost by exploring.

Duolingo's XP is additive; its *leagues* — relative and zero-sum — are what generate the documented anxiety, gaming and bot use. The additive component is not what broke.

**The general problem.** This is denominator choice: the user controls both numerator and denominator, so a good-faith act (honest self-assessment, exploration) moves the ratio the wrong way. It is a Goodhart trap, since the rational response is to hoard skills as unstarted.

**Earned Value Management** solves the same problem by rebaselining: when scope is added, Budget at Completion changes and the baseline resets, rather than pretending the old percentage still means the same thing. The trusted EVM figure is BCWP — earned value, an additive quantity of work performed — not percent complete, which EVM explicitly treats as unreliable when scope moves.

**Motivation literature.** The endowed progress effect (Nunes & Drèze 2006, car wash): a 10-stamp card pre-stamped twice redeemed at **34%** versus **19%** for an 8-stamp card requiring identical work — a new skill should never present as a bare zero. Koo & Fishbach's small-area hypothesis (JCR 2012) holds that early in pursuit you should display accumulated progress and only near the goal display what remains. A mean-completion domain number does the opposite, making early exploration read as loss.

**Self-tracking precedent.** Habitica scores per task and accumulates XP and gold, so adding a habit costs nothing. Beeminder is per-goal with no cross-goal composite at all. GitHub removed streak counters in 2016; the natural-experiment study measured an immediate drop in long streaks, evidence that a purely additive non-punitive display changes behaviour less coercively. Whoop and Oura composite readiness scores are the cautionary case — opaque single numbers users read as a grade and argue with.

### Options considered

| Option | Verdict |
|---|---|
| Mean completion percentage | Rejected. The defect itself; Steam demonstrates it at scale. |
| Max or top-N skill | Monotone but discards breadth entirely; eight dabbled skills read as one. |
| Grace period for new skills | Rejected. Arbitrary threshold; the cliff-edge drop still arrives, just later and more confusingly. |
| Recency heat only | Abandons accumulated progress; a mastered-then-dormant domain goes cold, reading as loss. |
| Depth and breadth as two numbers | Strong as a companion display, but does not answer what fills the map region. |
| **Additive level-sum on a concave curve, plus separate recency and breadth channels** | **Adopted.** |

### Decision

PRD **F33–F35**, **N12**. Domain score is the sum of levels attained across its skills — monotonic by construction, since starting a skill adds zero. Mapped to region fill through a concave curve so early levels visibly move the region and the display never saturates. Raw percentages are never shown for a domain. Recency of activity rides a separate visual channel that may fade; breadth appears as a count of skills started. Only the recency channel may decrease.

This introduces no new comparability claim beyond what the 1–10 spine already commits to: it does not say level 7 piano equals level 7 knife skills, only that a level-up is a level-up.

### Strongest argument against

An additive level-sum makes breadth the cheapest way to raise a domain — ten skills at level 2 outscores one at level 9. That inverts the original defect rather than dissolving it, and it does quietly treat levels as fungible units, which is the comparability claim the project is otherwise careful about. Mitigation is the paired breadth/depth readout, and optionally mild per-skill concavity so later levels are worth slightly more.

---

## 5. Domain taxonomy

**Question.** What top-level domains anchor the map, how many, and are they durable as content scales?

### Evidence

**Existing life-area taxonomies.** The standard Wheel of Life uses 8 segments — Health/Fitness, Career/Business, Finances, Relationships/Family, Personal Growth, Fun & Recreation, Physical Environment, Spirituality — and coaching guidance is explicit that **6–10 is the workable band**: under 6 means you lumped or omitted, over 10 becomes unmanageable. Coaches routinely relabel segments per client, so the set is a convention rather than a standard.

SAMHSA's 8 Dimensions of Wellness are Emotional, Environmental, Financial, Intellectual, Occupational, Physical, Social, Spiritual. Hettler / National Wellness Institute (1976) gives the ancestral 6: Physical, Social, Intellectual, Spiritual, Emotional, Occupational — SAMHSA's 8 is Hettler's 6 plus Financial and Environmental.

GoalOS does not use life domains at all; its "skills" are dispositional stats (Organization, Focus, Discipline) on a radar chart. Habitica uses four RPG attributes assigned **per task and chosen by the user**, defaulting to Strength — Habitica never solved the "where does this belong" problem, it delegated it.

**Hobby and skill classification.** Wikipedia's `List of hobbies` was merged into `Hobby`, which uses 6 top-level types: Collecting, Observing, Making and tinkering, Activity participation, Liberal arts pursuits, **Sports and games**. These are verbs — modes of engagement — not life areas. The older list used a 2-axis grid (Indoor/Outdoor × Collection/Competitive/Observation), a faceted scheme rather than a tree.

O\*NET's Content Model uses 2 top-level skill classes (Basic, Cross-Functional), 7 mid-level clusters (Content, Process, Social, Complex Problem Solving, Technical, Systems, Resource Management) and 46 leaf skills — a working professional taxonomy settling on about 7 at the navigable tier.

**Game map design.** Zone design maps onto Lynch's *Image of the City* districts: a region reads as a region when it has its own palette and silhouette. The named failure mode is "icon vomit" — density without meaning. Fog-of-war is the established convention for unrevealed content (Fortnite greys unexplored map, WoW likewise): **an unrevealed region reads as promise; a revealed-but-empty region reads as a bug.** The documented player complaint is not locked content but *uncommunicated* locked content.

**Taxonomy design principles.** Miller's 7±2 does **not** apply to visible on-screen choices — Miller's paper concerns short-term memory recall, and the UX literature treats the navigation "rule of 7" as a misattribution. Empirically broad-and-shallow beats deep. Faceted classification is the canonical fix for churn: use facets when categories repeat at lower levels or when there are no clear candidates for top-level categories. Single hierarchies churn precisely where an item has two valid parents.

### The distribution study

Rather than reason from principle, 164 candidate skills were classified and counted (`docs/SKILL-CANDIDATES.md`). Method: a Haiku agent generated 120 candidates from Wikipedia's Hobby taxonomy, Scouting merit badges, adult-education catalogues and graded-framework directories; the list was then verified — near-duplicates merged, meta-entries removed, gaps filled.

**Verification found a systematic bias worth recording.** The generated list over-sampled skills with formal certification ladders and returned zero entries for parenting, teaching, conversation, conflict resolution, active listening, personal budgeting, sleep, home repair, car maintenance, cleaning, driving, or religious practice. Classifying it unmodified would have shown People and Mind as tiny and argued for merging them — an artifact of sampling, not of reality. Roughly 60 entries were added during verification.

Final distribution:

| Domain | Count | Share |
|---|---|---|
| Making | 45 | 27% |
| Body | 27 | 16% |
| Home | 23 | 14% |
| People | 18 | 11% |
| Outdoors & Nature | 17 | 10% |
| Mind | 16 | 10% |
| Play | 14 | 9% |
| Work & Money | 14 | 9% |

### Options considered

| Option | Verdict |
|---|---|
| 4 domains (Creative/Physical/Mental/Practical) | Rejected. "Practical" becomes a grab-bag absorbing cooking, finance, repair, coding and negotiation. |
| 3 domains (Mind/Body/Craft) | Rejected. Craft absorbs everything; three regions is not a map. |
| 6–8 wellness dimensions imported directly | Rejected. Wellness dimensions are *states*, not skill spaces — Spiritual, Environmental and Occupational have few authorable trees. Cardinality lesson kept. |
| Two-level taxonomy from the start | Rejected as launch structure. With 3 skills you would have ~20 sub-regions, 17 empty. It is what you grow into. |
| 6 domains + facet tags | Adopted initially. |
| **8 domains + facet tags** | **Adopted after the distribution study.** |

Play and Outdoors & Nature were each added on evidence. Play is supported by Wikipedia's "Sports and games" at top level and Wheel of Life's "Fun & Recreation", and brings the best-formalized progression scale in the project (Elo with FIDE titles at 2200/2300/2400/2500). Outdoors & Nature had 17 candidates with no coherent home — scuba scattering to Body, foraging to Home, navigation and birding to Mind, on no shared principle. Both are single-axis arenas of capability consistent with the other six, and both carry strong external frameworks (PADI, RYA, BCU star awards, river grades I–VI, alpine grades, orienteering courses).

**Rejected domain candidates.** "Exploration" and "Knowledge" were proposed and rejected as axis violations — exploration is a mode of engagement (you can explore coffee, hiking or literature) and knowledge is a state produced by nearly every skill. Both would draw members from every region, which is the churn the design avoids. Collecting was rejected as a domain despite Wikipedia placing it top-level, because collecting skills are thin on trainable progression apart from authentication and grading; it became a facet tag.

### Decision

PRD **F17–F23**. Eight domains: Mind, Body, Making, Home, People, Work & Money, Play, Outdoors & Nature. One primary domain per skill plus optional secondaries (discoverability only, no double-counting), plus controlled-vocabulary facet tags. Domain IDs stable and decoupled from display names. Unpopulated domains render fogged rather than empty.

Map geometry is **irregular multi-tile hex regions**, not a fixed flower — hex grids have six neighbours, so neither 7 nor 8 domains tiles cleanly, and coupling taxonomy to geometry would let the display dictate the model. Irregular regions also give each domain its own silhouette, the Lynch-districts property.

### Strongest argument against

Making at 27% is a genuine imbalance the eight-domain set does not resolve, addressed separately in section 6. More broadly, domain IDs are permanent, and a taxonomy validated against a 164-skill projection may still be wrong at 500 — the mitigation is F20's stable-ID/versioned-taxonomy requirement and the subregion mechanism, not confidence in the projection.

---

## 6. Making subdivision

**Question.** Making is 27% of the projected library, 1.7× the next domain. On what axis should it eventually split?

### Evidence

**The intuitive Art/Craft split fails, and has been failing for a century.** Gropius's 1919 Bauhaus manifesto explicitly denied any "essential difference between the artist and the craftsman" and reorganized teaching into *material* workshops — metal, weaving, cabinetmaking, pottery, typography, wall-painting. The 1960s studio craft movement existed to erase the line. Decisively, **RISD places Ceramics, Glass, Jewelry + Metalsmithing, Textiles, Photography and Printmaking in the Fine Arts division**, while Graphic, Industrial, Furniture and Apparel Design sit in Architecture + Design — the operative institutional line is autonomous versus commissioned, and craft media fall on the *fine art* side.

The practical objection is stronger than the historical one: "expressive" is a property of the maker's *intent*, which is unobservable from a skill tree. Roughly **13 of 45** Making skills are contested under this axis (Graphic Design, Calligraphy, Furniture Making, Pottery, Glassblowing, Stained Glass, Embroidery, Jewelry Making, Model Building, Taxidermy, Video Editing, Game Development), meaning a judgment call on about **one PR in three, forever**.

**Material-based grouping has the best durability record.** FFXIV's Disciples of the Hand are eight classes cut by material — Carpenter (wood), Blacksmith/Armorer (metal), Goldsmith (mineral), Leatherworker (hide), Weaver (cloth), Alchemist (reagents), Culinarian (food) — stable since 2010 with essentially no recategorization. Cataclysm: DDA cuts crafting into Fabrication / Tailoring / Cooking / Electronics / Mechanics, and in version 0.D **deleted the `construction` skill** — a *setting* axis — and redistributed its recipes by material, an explicit migration away from a mixed axis. RuneScape's four buckets are Combat / Gathering / Artisan / Support, a source-versus-transform axis rather than art-versus-craft.

**The adopted axis is the UK national split.** GCSE **Art & Design** is defined by "personal creative expression and visual communication"; GCSE **Design & Technology** by "user, purpose and function" — two separate qualifications, decades stable, with Art & Design internally endorsed by medium (Fine Art, Photography, Textile Design, 3D Design, Graphic Communication). Etsy converged independently on the same shape: Art & Collectibles versus object categories (Jewelry, Home & Living, Clothing) versus Craft Supplies & Tools. Dewey separates 700 Arts from 600 Technology.

**Two-way versus three-way.** A two-way split of 45 yields two ~22s, each already near Body's size, which would re-cross any threshold within a year — you would publish a split axis twice. The technology cluster is the one bucket every precedent system keeps separate (Dewey 600, CDDA Electronics, FFXIV's material classes) and the only home that places Game Development without a judgment call.

### Options considered

| Option | Verdict |
|---|---|
| Expressive vs. functional (Art/Craft) | Rejected. ~1 PR in 3 contested; intent is unobservable; re-fights an abandoned boundary. |
| Performance vs. artifact | Rejected on balance — isolates only 5–7 music skills, leaving Making at ~38. |
| Raw material medium (physical/digital/symbolic) | Right instinct, wrong cut point — splits Jewelry Making from Jewelry CAD, cannot place 3D Printing or Photography. |
| **Output form, three-way** | **Adopted.** |

### Decision

PRD **F24–F28**, **D21**. Three subregions distinguished by what the output exists as: **Expression** (a representation — image, sound, text, performance), **Objects** (a physical thing someone handles or wears), **Systems** (code, circuits, machines). Sizes 19 / 20 / 6.

Reviewer rule in one line: *a representation is Expression; a physical object is Objects; a system is Systems*, with physical output taking precedence where a skill is both. Hard cases resolve mechanically — Photography, Graphic Design, Creative Writing, Calligraphy, Music Production and Video Editing to Expression; Furniture Making, Model Building, Taxidermy and Jewelry CAD to Objects; 3D Printing, Game Development, Robotics and Electronics to Systems. Sculpture to Expression and Pottery to Objects, resolved by "does it hold soup," which is how accession policies operate in practice. Residual contested rate is roughly **1 PR in 9**.

Subregions are **required from the first Making tree**, so no re-classification pass is ever needed. Proposed promotion trigger is Making ≥ 60 skills or any subregion ≥ 25.

**Making remains one domain.** Subregions are not promoted to sibling domains. Rationale is product, not taxonomic: domains are arenas of life, and a user comparing them is asking which part of their life they are neglecting. Three kinds of making as top-level peers would muddy that comparison. Sub-balance within Making is the user's own concern.

**Naming.** The subregions deliberately avoid the words "Art" and "Craft", which import the ranking the axis exists to sidestep. Naming them after output form makes the boundary rule self-documenting and removes the prestige gradient by removing the value-laden vocabulary.

### Strongest argument against

The rule re-imposes the vessel-versus-bronze line that Bauhaus, the American Craft Council and RISD spent a century demonstrating is intellectually indefensible. A contributor authoring Ceramics or Weaving may see their expressive discipline filed under objects while Sculpture gets Expression, and read it as a status judgment. Mitigations, all adopted in **F28**: neutral output-form naming, `expressive` as a first-class facet tag usable by any Objects or Systems skill, permission for such skills to declare Expression as a secondary relationship, and an explicit statement in both the contribution guide and the UI that the grouping describes output form and implies no hierarchy of worth.

### Rejected alternative: multi-axis scoring

A proposal to replace buckets entirely with per-skill scores on three axes (e.g. Ceramics as Expression 6 / Objects 9 / Systems 3) was considered and rejected, recorded as **NG15**. It genuinely dissolves the status question, and would rate well in a system designed around it. Here it breaks three locked decisions: map placement has no answer (threshold it back into a bucket, or render the skill in three regions, violating F18's no-double-counting); the additive integer rollup breaks, since fractional contribution turns level 7 into 2.1 + 3.15 + 1.05 across subregions when F33's monotonicity depends on indivisible integer level-ups; and authoring burden inverts, replacing one boundary judgment per nine PRs with three unanchored 0–10 judgments on every PR, where "why is weaving 5 and not 7" is unfalsifiable and infinitely arguable.

---

## 7. Open questions this research did not settle

- **D14** — whether a linter can meaningfully validate requirement-group *coherence*, not just syntax.
- **D21** — the exact promotion trigger for Making subregions; the proposed threshold is reasoned, not evidenced.
- **D23** — user-level domain reassignment conflicts with N12 monotonic scoring; no researched precedent resolves it.
- **D24** — tree families for languages, instruments and martial arts. Six languages appear in the candidate list against a plausible thirty; no precedent was researched for template or inheritance mechanisms in contributor-authored content.
- Whether the eight-domain set holds at 500 skills rather than 164.

---

## Sources

**Progression systems**
- [RuneScape Wiki — Experience](https://runescape.wiki/w/Experience)
- [Cataclysm: DDA — Skills](https://cddawiki.danmakudan.com/wiki/index.php/Skills) · [Crafting](https://cddawiki.danmakudan.com/wiki/index.php/Crafting) · [Recipe JSON](https://srgnis.github.io/cdda-wiki/cdda_wiki/Recipe_JSON_Info.html) · [skills.json](https://github.com/CleverRaven/Cataclysm-DDA/blob/master/data/json/skills.json) · [Proficiencies](https://docs.cataclysmdda.org/JSON/PROFICIENCY.html)
- [UESP — Skyrim:Leveling](https://en.uesp.net/wiki/Skyrim:Leveling) · [Skyrim:Skills](https://en.uesp.net/wiki/Skyrim:Skills)
- [Unofficial Duolingo Course Data](https://duolingodata.com/) · [Duolingo path redesign](https://blog.duolingo.com/new-duolingo-home-screen-design)
- [Guild Wars 2 Wiki — Mastery](https://wiki.guildwars2.com/wiki/Mastery)
- [FFXIV — Crafting](https://ffxiv.consolegameswiki.com/wiki/Crafting)
- [OSRS Wiki — Artisan skills](https://oldschool.runescape.wiki/w/Artisan)
- [Cookie Clicker Wiki — Ascension](https://cookieclicker.wiki.gg/wiki/Ascension_guide)

**Graded frameworks**
- [Council of Europe — CEFR level descriptions](https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions)
- [ABRSM — Performance Grades Qualification Specification](https://www.abrsm.org/sites/default/files/2025-01/00%20Performance%20Grades%20Qual%20Spec%20-%20Generic%20Parts%2020240529_access.pdf) · [Diplomas](https://www.abrsm.org/en-gb/other-assessments/diplomas/music-performance)
- [ACTFL / ILR proficiency scales](https://www.languagetesting.com/proficiency-scales) · [ILR scale](https://www.languagetesting.com/ilr-scale)
- [FIDE Title Regulations](https://handbook.fide.com/chapter/B012024)
- [Dreyfus model of skill acquisition](https://en.wikipedia.org/wiki/Dreyfus_model_of_skill_acquisition)
- [Scouting America — rank requirements](https://www.scouting.org/about/faq/question37/) · [Ranks in Scouts BSA](https://en.wikipedia.org/wiki/Ranks_in_Scouts_BSA) · [Merit badges](https://www.scouting.org/skills/merit-badges/)
- [Duke of Edinburgh — timescales](https://www.dofe.org/do/timescales/)

**Sequencing and curriculum standards**
- [SCORM — sequencing definition model](https://scorm.com/scorm-explained/technical-scorm/sequencing/sequencing-definition-model/)
- [IMS Simple Sequencing XML binding](https://www.imsglobal.org/simplesequencing/ssv1p0/imsss_bindv1p0.html)
- [DBT — four skill modules](https://dbtskillsgroupnj.com/four-skill-modules/) · [two-cycle year](https://www.therapyexplained.com/blog/dbt-support-groups)

**Layout and graph rendering**
- [developer-roadmap — contributing.md](https://github.com/kamranahmedse/developer-roadmap/blob/master/contributing.md) · [repo](https://github.com/kamranahmedse/developer-roadmap)
- [FTB Quests — creator guide](https://help.ftb.team/help/en-gb/5-ftb-quests/26-quest-creator-guide) · [ftb-quests-editor](https://github.com/Jasons-impart/ftb-quests-editor/blob/main/README.md) · [qbedit](https://github.com/jmoiron/qbedit)
- [Factorio — tech tree interface](https://forums.factorio.com/viewtopic.php?t=42980) · [factorio-trees](https://github.com/ingmar/factorio-trees)
- [Path of Exile — skilltree-export](https://github.com/grindinggear/skilltree-export) · [Passive Skill Tree JSON](https://pathofexile.fandom.com/wiki/Passive_Skill_Tree_JSON)
- [ksp-techtree-edit](https://github.com/jcalero/ksp-techtree-edit)
- [ELK — layer constraints](https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html)
- [Mental map preservation](https://inside.java/2023/06/12/preserving-mental-map/)
- [Obsidian graph view critique](https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful)

**Scoring, metrics and motivation**
- [Nunes & Drèze — endowed progress effect](https://www.coglode.com/nuggets/endowed-progress-effect)
- [Koo & Fishbach — small-area hypothesis, JCR](https://academic.oup.com/jcr/article-abstract/39/3/493/1822606)
- [PlayStation — trophy levelling changes](https://blog.playstation.com/2020/10/07/upcoming-trophy-levelling-changes-detailed/)
- [Achievement system design history](https://wellstsai.com/single-page-conclusion/Game-Achievement-Systems-History-Design-Philosophy.html)
- [GitHub streaks natural experiment (arXiv 2006.02371)](https://arxiv.org/pdf/2006.02371)
- [Duolingo gamification misuse (arXiv 2203.16175)](https://arxiv.org/pdf/2203.16175)
- [Earned Value Management basics](https://www.humphreys-assoc.com/basic-concepts-of-earned-value-management-evm/)
- [Radar chart critique](https://blog.scottlogic.com/2011/09/23/a-critique-of-radar-charts.html)

**Taxonomy and classification**
- [Wheel of Life categories](https://www.thecoachingtoolscompany.com/wheel-of-life-categories/) · [Wheel of Life in practice](https://positivepsychology.com/wheel-of-life-coaching/)
- [SAMHSA — Eight Dimensions of Wellness](https://library.samhsa.gov/sites/default/files/sma16-4953.pdf)
- [NWI — Six Dimensions of Wellness](https://cdn.ymaws.com/members.nationalwellness.org/resource/resmgr/pdfs/sixdimensionsfactsheet.pdf)
- [Wikipedia — Hobby](https://en.wikipedia.org/wiki/Hobby)
- [Habitica Wiki — Task Stats](https://habitica.fandom.com/wiki/Task_Stats) · [GoalOS](https://goalos.io/goal-setting-app)
- [O\*NET Content Model (National Academies)](https://www.nationalacademies.org/read/12814/chapter/5)
- [UX Myths #23 — 7±2](https://uxmyths.com/post/931925744/myth-23-choices-should-always-be-limited-to-seven) · [Menus don't need Miller's rule](https://stephaniewalter.design/blog/your-menu-doesnt-need-millers-7-plus-minus-2-rule/)
- [Hedden — faceted classification](https://www.hedden-information.com/faceted-classification-and-faceted-taxonomies/)
- [OCLC — Dewey 700 Arts](https://www.oclc.org/content/dam/oclc/dewey/resources/teachingsite/courses/700.pdf)

**Art, craft and design institutions**
- [Getty — Bauhaus curriculum](https://www.getty.edu/research/exhibitions_events/exhibitions/bauhaus/new_artist/history/principles_curriculum/) · [Met — The Bauhaus 1919–1933](https://www.metmuseum.org/essays/the-bauhaus-1919-1933)
- [Studio craft](https://en.wikipedia.org/wiki/Studio_craft)
- [RISD — Fine Arts division](https://www.risd.edu/about/directory/fine-arts-division) · [Architecture + Design division](https://academicaffairs.risd.edu/directory/divisions-departments-and-other-college-programs/academic-affairs-administration/academic-divisions/architecture-and-design-division/)
- [AQA GCSE Art & Design 8202](https://www.aqa.org.uk/subjects/art-and-design/gcse/art-and-design-8202/specification/subject-content/art-craft-and-design) · [AQA GCSE Design & Technology 8552](https://www.aqa.org.uk/subjects/design-and-technology/gcse/design-and-technology-8552/specification/subject-content) · [DfE Art & Design subject content](https://assets.publishing.service.gov.uk/media/5a7dcc7ded915d2ac884d9f9/GCSE_subject_content_for_art_and_design.pdf)

**World and map design**
- [MMO world design / level architecture](https://medium.com/@alexander.bakharev_16063/so-you-want-to-build-an-mmo-8-18-world-design-level-architecture-c07798d17f1c)
- [Fortnite greyed-out map](https://www.thegamer.com/fortnite-greyed-out-map-explained-guide/)
