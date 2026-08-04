# Prior Art: MakerSkillTree

**Date:** 2026-08-04
**Purpose:** Assess `sjpiper145/MakerSkillTree` — the closest existing project to this one — for overlap, differentiation, and transferable design. Establishes whether this project has merit given that MakerSkillTree exists and is actively maintained.
**Status:** Analysis complete. All recommendations decided and applied to `docs/PRD.md` v1.2; see §8.

**Method.** Direct inspection rather than agent-reported summary. The repository API, the README, `Poster_schema.json`, `python/input.yml`, the open issue list, and the raw SVG of one published tree (Cooking) were fetched and read. Tile text and tile geometry were extracted programmatically from the SVG to test the README's claims about structure. Figures in §1 are verified against the GitHub API as of 2026-08-04 and are not agent-reported.

**Relationship to other docs.** `docs/RESEARCH.md` covers progression systems, graded frameworks, and layout precedent. It does not cover MakerSkillTree, which is a gap this document closes. Conclusions here feed the competitive landscape in PRD §2 and Appendix A.

---

## 1. What the project is

| | |
|---|---|
| Repository | `sjpiper145/MakerSkillTree` |
| Owner | Steph Piper (Maker Queen, AU) |
| Created | 2023-04-12 |
| Last push | 2026-05-06 |
| Commits | 964 |
| Stars / forks | 3,407 / 178 |
| Root directories | 80 |
| Trees published | ~76 of 121 planned |
| Content formats | SVG, PDF, PNG, PPTX, AI |
| Machine-readable content | **None** |
| License | CC BY-NC-SA 4.0, with a maintainer overlay on software use |

Each tree is a printable poster of **exactly 73 hexagonal tiles**, ordered bottom-to-top from basic to advanced. The user colours in tiles they have completed. A 40-tile "Mini" template also ships.

Two side products extend the project commercially: *Skill Seeker: Maker Edition* and *Young Maker Edition* (published books combining 15 and 12 skill areas, with a "Maker XP score" and a video-game-style level dashboard), and *Life Quest: Adulting Survival Skills*, a life-skills book announced for 2026 covering cooking, self care, life admin and travel.

### Ecosystem

- **Skill Tree Generator** (`schme16`) — browser drag-and-drop tile editor, exports SVG.
- **Skill Tree Tool** (`josephlewis42`) — converts generator SVGs to and from YAML, with a changelog generator used to diff a tree across peer-review rounds.
- **Skill Quest** (`IvanR3D`) — free open-source tracker, vanilla HTML/CSS/JS, localStorage-only, no accounts. Imports generator SVGs. Adds XP, levels, achievements, daily streaks.

---

## 2. What the structure actually is

The README states tiles run "in a spectrum of basic skills at the bottom to more advanced skills at the top." Extracting tile positions from the Cooking tree tests what that means in practice:

| Row (top → bottom) | Tiles |
|---|---|
| 0 | Publish a recipe you've created · Teach a cooking class |
| 1 | Make smoked meats · Deep fry something in a meal · Sell something you've cooked |
| 2 | Make gnocchi from scratch · Make sushi · Use an alternate heat source · Make a barista coffee |
| … | … |
| 17 | Use a wok or fry-pan · Make hamburgers · Make popcorn |
| 18 | Make a hot breakfast · Make garlic bread · Make a salad · Make boiled eggs |
| 19 | Make instant noodles · Make a sandwich · Make an omelette |

**Findings:**

1. **The difficulty gradient is real.** Bottom rows are genuinely easier than top rows. This is not a random arrangement.
2. **It is a gradient, not a scale.** ~20 staggered rows of 3–4 tiles, with no row labels, no thresholds, and no declared meaning. Row 12 is not a level.
3. **There are no edges.** No prerequisite is expressed anywhere in the format. The word "tree" is inherited from the visual metaphor, not from the data structure — it is a grid.
4. **Completion is deliberately undefined.** README: *"Tiles can be completed out of order… Skill trees do not need to be completed to 100%… Think of the tiles as suggestions that can be changed based on your priorities and ability."*
5. **Milestones are concrete and achievement-phrased throughout.** "Make gnocchi from scratch," "Sharpen and maintain your knives," "Use a pressure cooker." Across 73 tiles there is no effort-quantity phrasing ("practice for N hours") at all.

Finding 5 is the most important result in this document, and §5 returns to it.

### The schema question

`Poster_schema.json` exists at repo root — a JSON Schema (authored in French by a contributor) describing `title`, `id`, `skills[]` with `desc`/`icon`/`level`, `ressources[]`, and `authors[]`. `python/input.yml` prototypes a row-indexed tile list. Neither is used by any published tree; both are unadopted proposals.

Issue **#17**, *"Is there an appetite for JSON/Machine readable versions of skill trees?"* — opened by someone wanting to integrate the trees into a makerspace induction system — remains open. The FAQ answers the general question: *"Not in the short term."* Three years in, the content is still pixels.

---

## 3. Similarities

| Dimension | Shared position |
|---|---|
| Milestone philosophy | Concrete, testable achievements rather than study hours. This project's **F2**, independently arrived at and executed across ~76 trees. |
| Hex visual language | Hexagons as the atomic unit, though at different scales — theirs within a skill, this project's across domains (**F21**). |
| Human-authored, human-reviewed | Expert authorship, two rounds of peer review, visible author credit at the base of each tree (**F6**, **F42**). |
| No AI in shipped content | Their FAQ: *"made in collaboration with experts or using my own expertise, without any AI usage."* Compare **NG12** — same endpoint for published content, but this project uses AI upstream in drafting (**D15**), which they would likely reject. |
| Local-only, static, no accounts | Skill Quest is localStorage-only with no backend. Same constraint set as **N1**, **N2**, **F37**. |
| Contributor-scalable by design | Growth through community contribution rather than maintainer authorship (**Goal 2**). |

---

## 4. Differences

The two projects are duals. **MakerSkillTree fixes the node budget at 73 and abandons the level scale. This project fixes the level scale at 1–10 and varies the node count.** Every other difference follows from that.

| Dimension | MakerSkillTree | This project |
|---|---|---|
| Level scale | None | Uniform 1–10, five named tiers (**F7**) |
| "What level am I?" | Cannot answer; not a goal | The central premise (**F32**, **S3**) |
| Prerequisites | None | Declared, rendered, cycle-checked (**F3**, **F41**) |
| Completion semantics | Explicitly refused | Requirement groups, per-group progress (**F9**, **F11**) |
| Node count | Fixed at 73 (or 40 mini) | Variable within a range (**F8**, range unset — **D9**) |
| Machine-readable | No; issue #17 open, FAQ says not soon | Schema + CI validator as v1 deliverables (**F4**, **F40**) |
| Layout authoring | Coordinates, via GUI generator | Derived from semantic fields (**F13**) |
| Cross-skill rollup | None | Domain scoring, hex world map (**F33**–**F35**) |
| Taxonomy | README headings: Classic · Tech · Life · Science & Maths · Sports & Games · Cultural Practices · Kids & Schools | Eight domains on one axis (**F17**) |
| Self-assessment | Colour in what you've done, on paper | Same idea, plus a coarse estimator (**F29**, **F30**) |
| Delivery | Print and colour | Web app |
| Mind / inner life | One tree (Self Care) | A full domain |
| Monetization | Books, sponsorship, commercial licence | None (**NG13**) |

Their category headings are worth noting as a negative example: *Classic* / *Tech* / *Life* / *Kids & Schools* mixes era, subject matter and audience on a single level. It is a README table rather than a product surface, so it costs them little — but it is exactly the mixed-axis failure the eight-domain distribution study was run to avoid.

---

## 5. Does this project still have merit?

**Yes, and MakerSkillTree strengthens rather than weakens the case.** Three arguments.

**It is the same gap, in a different subject area.** PRD §2 identifies the failure of curated-content-without-a-scale using developer-roadmap: 91 roadmaps, median 112 nodes, no level field, therefore no ability to express progress. MakerSkillTree is that identical row of the table, executed with better content and a stronger community. It is a *deliberate* refusal rather than an oversight — the README argues for flexible, non-sequential, partial completion as a feature — but the consequence is the same. A user with a coloured-in Cooking poster cannot be told what level they are or what to do next. That is the product this PRD proposes to build.

**Their milestone corpus is strong evidence for F2 and against nothing.** ~76 trees × 73 tiles ≈ 5,500 hand-authored, peer-reviewed, achievement-phrased milestones, produced largely by volunteers who are subject experts rather than tooling experts. Before this, the "concrete and testable" standard (**F2**, **F43**) was a design assertion supported by CDDA — a game with paid designers. It now has a volunteer-authored, real-world corpus behind it. The hardest content assumption in the PRD is the best-evidenced one.

**The differentiating layer is precisely the layer they have refused to build.** Levels, prerequisites, completion rules, machine-readable data, cross-skill rollup. Not one of these is a "we haven't got to it yet"; each is either an explicit design position (levels, completion) or a stated non-priority (machine-readable). There is no version of MakerSkillTree's roadmap that closes this gap by accident.

### Risks this analysis surfaces

**Content-breadth competition is unwinnable and should not be attempted.** ~76 expert-authored, twice-reviewed trees against a launch target of three. The PRD's "content quality over content volume" trade-off is correct and this is the evidence for it. Differentiation must remain *levels, placement, and machine-readability* — never tree count.

**They are moving toward this project's territory on two fronts.** *Life Quest* (2026) covers cooking, self care, life admin and travel — the Home, People and Work & Money domains. And *Skill Seeker* already computes a Maker XP score and a skill-level dashboard, meaning the level layer exists in their book product and is simply absent from the repository. The distance between the two projects is smaller in their commercial line than in their open-source one.

**The MakerSkillTree + Skill Quest pair is a closer competitor than either alone.** PRD §2 lists Skill Quest as an "empty container; no pre-built content," which is true of the software but misleading in practice: it imports generator SVGs, so its de facto content library is the MakerSkillTree corpus. "Free printable posters plus a free open-source tracker that reads them" is the comparison a reader will raise. It still fails the test — importing a poster yields 73 undifferentiated checkboxes with no level, no ordering, and no next action — but the PRD should say so explicitly rather than leave the two rows disconnected.

---

## 6. Licensing

MakerSkillTree is **CC BY-NC-SA 4.0**. The README adds a maintainer overlay that appears in two places with different scope:

> *"If you wish to use the skill trees project to build skill tracking software, apps or systems, you'll need a commercial licence by sponsoring this project."*

> *"Want to build your own skill tracking software? If it's for commercial purposes, check out the sponsors page… **If it's open source, you're welcome to build and experiment as you please.**"*

The second is the operative statement for this project, which is open-source with no monetization (**NG13**). Building is explicitly welcomed.

**The real hazard is ShareAlike, not NonCommercial.** Any tree in this project that is a derivative of a MakerSkillTree tree must itself be released under CC BY-NC-SA 4.0. Because content lives in one repository under one licence, a single derived tree risks NC-encumbering the content directory and binding every future contributor to terms they did not choose. NC also forecloses options a permissively licensed corpus would retain — commercial reuse by makerspaces, inclusion in paid curricula, downstream forks with different funding models.

**Recommendation: treat MakerSkillTree as validation and inspiration, never as a content source.** Do not import tiles, do not adapt trees, do not wire up the SVG↔YAML converter as an ingestion path. Three concrete follow-ups:

1. **Landed as F45.** F44 directs authors to adapt existing curricula and graded frameworks; F45 carves out copyleft sources, distinguishing safe adaptation (structure and sequencing, cited but not reproduced) from ShareAlike content whose licence would propagate to the whole library.
2. **Landed in F45.** Contributor-checklist question: *was any part of this tree derived from a CC BY-SA or CC BY-NC-SA source?* An affirmative answer is a review-stage rejection even if CI passes.
3. **Opened as D26.** The content licence must be chosen and stated before the first external contribution, since it cannot be changed afterwards without every contributor's consent. F45 rules out inheriting one by accident; it does not choose one.

---

## 7. Transferable findings

### 7.1 A fixed milestone budget is proven authorable — bears on D9

**F8** requires a schema-enforced range on milestones per level; **D9** leaves the range unset; **C4** names authoring cost as the genuine bottleneck. MakerSkillTree supplies the missing evidence: a **hard total of 73 tiles**, held across ~76 trees spanning cooking, Kubernetes, roller derby and astronomy, with no per-tree negotiation. The 40-tile Mini template validates a second, smaller budget point.

Two lessons. First, a fixed budget is achievable across wildly different subject matter — the constraint does not break on any domain they have tried. Second, a ceiling gives a contributor a finish line, which an open-ended range does not; "you owe 73 tiles" is a bounded, estimable task in a way "between 3 and 8 per level, use your judgment" is not.

**Adopted.** F8 now reads 4–8 per level, 40–80 total, bracketing both of their validated formats. Whether the range should vary by tier is left open against the first three authored trees rather than guessed at.

### 7.2 Two-round peer review with a public status table — bears on F42, S2

Their README carries a per-tree grid: `Skill Area | Completed | Peer Review 1 | Peer Review 2 | Language`. Zero infrastructure, no bot, no project board. It makes review state visible to contributors and converts "is my tree merged yet?" into a link. Directly serves **F42** (human review before merge) and **S2** (an outside contributor gets a tree merged). **Adopted into F42**, along with their two-rounds-by-separate-reviewers structure.

### 7.3 Tier calibration: teaching and selling are not level-9 content — bears on F43

Their open issue **#47** is a contributor's objection:

> *"I see a lot of Skill Trees here that have 'Teach a Class' as a single Tile at the very top. The most Advanced, I guess. But I'm thinking every Tile is a small task that could (should?) be taught too. I'm thinking 'Teaching' should not be Advanced, it should be Basic and common."*

The Cooking tree confirms the pattern — its two topmost tiles are "Publish a recipe you've created" and "Teach a cooking class," with "Sell something you've cooked" one row below.

**The error is conflating professionalization with skill mastery.** Selling, teaching and publishing are modes of engagement available at any level; a level-2 cook can teach a friend to boil an egg, and selling at a bake sale is not evidence of mastery. Placing them at the ceiling both misgrades them and implies that the point of a skill is to commercialize it.

This project would inherit the bug by default, since a contributor pattern-matching on existing trees will reproduce it. **Adopted into F43** as an explicit rubric clause, with the distinction carried by **facet tags** (**F19**), orthogonal to level, rather than by tier position. A CI lint was considered and rejected: the rule is contextual, and a regex on *teach* / *sell* / *publish* would false-positive on legitimately advanced milestones such as "teach a certification course."

### 7.4 A third confirmation of the GUI-editor gravity — bears on F13, NG11

`docs/RESEARCH.md` §3 argues that hand-authored graphical content pulls inexorably toward a GUI editor, citing roadmap.sh's retreat from PR-authored nodes and FTB Quests' dependence on an in-game editor. MakerSkillTree is a third instance and a cleaner one: authored coordinates in SVG produced *two* independent third-party tools — a drag-and-drop generator and an SVG↔YAML converter with a review-diff feature.

The corroborating detail is `python/input.yml`. Their machine-readable prototype is a **row-indexed list of tile labels with no coordinates** — semantic position, derived layout. Arrived at independently, it is the same model as **F14**.

### 7.5 A "not for me" milestone state — adopted as F46

MakerSkillTree ships a colouring convention letting a user distinguish completed tiles from ones they intend to do and ones they have no interest in. This project currently has two states: complete and incomplete.

The gap matters specifically for `n_of` requirement groups (**F9**). A user who has chosen their electives has no way to dismiss the remainder, so a satisfied level continues to display unchosen milestones indefinitely. A third state is monotonic-safe under **N12** — it removes nothing from any score — and small in scope. **Adopted as F46**, with dismissal defined as presentation-only: a dismissed milestone scores identically to an incomplete one, so no arithmetic depends on it.

### 7.6 Skill-candidate gaps — bears on SKILL-CANDIDATES.md, F17

Cross-checking their 121 planned trees against the 164 candidates found these with no entry:

Civics & Community · Empathy Building · Tone of Voice · Facial Expressions · Leadership · Digital Minimalism · Comic Art · Molding & Casting · Laser Cutting · CNC & CAM · Embedded Systems · Kubernetes / DevOps · Tabletop RPG · Roller Derby

Most slot into an existing domain without argument. **One does not: Civics & Community.** Voting, local government, volunteering, community organizing, mutual aid. It is not People (interpersonal capability), not Work & Money (career and finance), not Play. The Wheel of Life cited in PRD Appendix A carries "Community/Contribution" as a standard segment, so this is not a fringe case. Handling it silently was the weakest of the available options.

**Resolved: folded into People.** F17's People row now reads *"conversation, conflict, teaching, parenting, languages, community and civic participation."* A ninth domain was rejected on distribution grounds — roughly four candidate skills would put it far below the 9% floor the other eight clear, and PRD Appendix A's whole argument for eight rests on that distribution holding. People is also currently the thinnest of the eight and absorbs the weight without distortion.

Two secondary observations. Their Classic-versus-Tech split lands near the Objects-versus-Systems subregion boundary, which is mild independent support for **F24**. And their near-total absence of Mind coverage means the Mind domain has no prior art to pattern-match against — worth knowing before commissioning the first Mind tree, since it is also the domain where "concrete and testable" is hardest to satisfy.

### 7.7 User-authored milestone slots — opened as D27

Their issue **#34** proposes arranging blank "set your own goal" tiles along one axis; several published trees already reserve such tiles. It composes interestingly with `n_of` electives — a user-defined milestone satisfying an elective slot — but collides with the closed, reviewed content model and with **F2**'s enforceability, since nothing validates a user-written milestone against the house standard. **Opened as D27**; not proposed for v1.

---

## 8. Changes made to the PRD

All nine were applied in PRD v1.2 on 2026-08-04.

| # | Change | Landed as |
|---|---|---|
| 1 | MakerSkillTree added to the competitive landscape | §2 table + "closest prior art" note |
| 2 | Skill Quest row corrected to note it is MakerSkillTree's companion tracker | §2 table |
| 3 | Prior-art paragraph covering the F2 evidence base | Appendix A |
| 4 | Copyleft carve-out plus contributor-checklist item | **F45** (new) |
| 5 | **D9** resolved: 4–8 milestones per level, 40–80 per tree | **F8**; D9 marked resolved, gap retained |
| 6 | Professionalization ≠ mastery; carried by facet tags | **F43** clause |
| 7 | Civic and community participation folded into People | **F17** "Covers" column |
| 8 | Third milestone state, `dismissed` | **F46** (new) |
| 9 | Two rounds by separate reviewers, public status table | **F42** |

Two new deferred decisions were opened in the same revision: **D26** (content licence, which F45 constrains but does not choose) and **D27** (user-authored milestone slots, from their issue #34). PRD v1.2 also freezes requirement and decision identifiers, because this document cites them.

---

## Sources

- [sjpiper145/MakerSkillTree](https://github.com/sjpiper145/MakerSkillTree) — README, `Poster_schema.json`, `python/input.yml`, `Cooking Skill Tree/MakerSkillTree - cooking.svg`, repository metadata via GitHub API
- [Issue #17 — machine-readable versions](https://github.com/sjpiper145/MakerSkillTree/issues/17)
- [Issue #34 — axis of blank goal spaces](https://github.com/sjpiper145/MakerSkillTree/issues/34)
- [Issue #47 — "Teach a Class" could be more than a single tile](https://github.com/sjpiper145/MakerSkillTree/issues/47)
- [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- [MakerSkillTree Generator (schme16)](https://schme16.github.io/MakerSkillTree-Generator/)
- [Skill Tree Tool — SVG↔YAML (josephlewis42)](https://josephlewis42.github.io/skilltreetool/)
- [Skill Quest (IvanR3D)](https://github.com/IvanR3D/skill-quest)
- [Skill Seeker books](https://www.makerqueen.com.au/skill-seeker-book)
- [Hackaday — Maker Skill Trees Help You Level Up Your Craft](https://hackaday.com/2024/06/11/maker-skill-trees-help-you-level-up-your-craft/)
