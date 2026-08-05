Recommendation up front

A — yes, but only mildly. A skill at level L contributes L^1.25 (shipped as a ten-entry integer table, not a live pow() call). This is the most super-linearity the display curve in B can absorb without breaking B's own "first level must move the region" requirement — see C. Triangular and L^1.5 are both too steep and are rejected on a numeric, not aesthetic, ground.

B — rational saturation, fill = s/(s+8). Not 1−exp(−s/k), which is not really non-saturating; not log-with-a-cap, which saturates by construction.

C — they interact, badly, and there is a closed-form constraint that binds them. This is the real finding of the report.

Composed formula:

contribution(L) = L^1.25          # table: 1, 2.38, 3.95, 5.66, 7.48, 9.39, 11.39, 13.45, 15.59, 17.78
score(domain)   = Σ contribution(L_i)     # L_i = attained level, unstarted skills contribute 0
fill(domain)    = s / (s + 8)             # s = score; ∈ [0,1), never reaches 1

Single-skill composed fill is therefore a Hill function L^1.25 / (L^1.25 + 8).

The constraint linking A and B. With f(L)=L^p and g(s)=s/(s+k), the requirement that a lone skill's first level be its largest visual jump (φ(2)−φ(1) ≤ φ(1)) reduces exactly to:

p ≤ log₂( 2k / (k−1) )

┌───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┐
│   k   │   4   │   5   │   6   │   8   │  10   │  12   │  20   │  → ∞  │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ max p │ 1.415 │ 1.322 │ 1.263 │ 1.193 │ 1.152 │ 1.126 │ 1.074 │ 1.000 │
└───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘

Read that table as the answer to Question C. The more top-end headroom you buy with a large k, the less super-linearity you can afford at the bottom. As the display curve flattens toward linear, the permitted contribution exponent collapses to 1. You cannot pick A and B independently; only the composition is observable to a user, and the composition is what has to be tuned.

The same derivation for g(s)=1−exp(−s/k) at the same anchor gives max p ≈ 1.10 — the exponential display permits materially less depth weighting than the rational one. That is an independent reason to prefer s/(s+k) beyond the saturation argument.

p=1.25 at k=8 sits 5% over the strict boundary (1.193). In fill terms the violation is Δ(0→1)=0.111 vs Δ(1→2)=0.118 — a 0.7-percentage-point difference in region fill, below perceptual threshold on a map region. If you want strict concavity by construction, ship p=1.19 (or p=1.2, within rounding) and lose about 1.5 points of depth premium. I'd take 1.25.

---
Worked numeric table

s = domain score. Linear column uses the same k=8 so φ(one skill at L1)=0.111 in both — the two schemes are anchored identically and every difference below is attributable to the exponent alone.

┌───────────────────────────────┬────────────┬──────────────┬────────────┬──────────────┬───────────────────────────────────────────────┐
│         Domain state          │ s (linear) │ fill, linear │ s (L^1.25) │ fill, L^1.25 │                   who wins                    │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ nothing started               │ 0          │ 0.0%         │ 0          │ 0.0%         │ —                                             │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 skill started, no level yet │ 0          │ 0.0%         │ 0          │ 0.0%         │ N12 holds                                     │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L1                        │ 1          │ 11.1%        │ 1.00       │ 11.1%        │ first level is the biggest single jump        │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L2                        │ 2          │ 20.0%        │ 2.38       │ 22.9%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L3                        │ 3          │ 27.3%        │ 3.95       │ 33.0%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L5                        │ 5          │ 38.5%        │ 7.48       │ 48.3%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L7                        │ 7          │ 46.7%        │ 11.39      │ 58.7%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L10                       │ 10         │ 55.6%        │ 17.78      │ 69.0%        │ one mastered skill ≈ 2/3 of a region          │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 2 × L1                        │ 2          │ 20.0%        │ 2.00       │ 20.0%        │ breadth uncosted at the floor                 │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 3 × L1                        │ 3          │ 27.3%        │ 3.00       │ 27.3%        │ identical to linear — no breadth penalty here │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 3 × L3                        │ 9          │ 52.9%        │ 11.85      │ 59.7%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 5 × L2                        │ 10         │ 55.6%        │ 11.89      │ 59.8%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 10 × L2                       │ 20         │ 71.4%        │ 23.78      │ 74.8%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L9                        │ 9          │ 52.9%        │ 15.59      │ 66.1%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 1 × L10 + 5 × L2              │ 20         │ 71.4%        │ 29.68      │ 78.8%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 2 × L5                        │ 10         │ 55.6%        │ 14.95      │ 65.1%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 5 × L5                        │ 25         │ 75.8%        │ 37.38      │ 82.4%        │                                               │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 8 × L6                        │ 48         │ 85.7%        │ 75.12      │ 90.4%        │ a serious domain                              │
├───────────────────────────────┼────────────┼──────────────┼────────────┼──────────────┼───────────────────────────────────────────────┤
│ 8 × L10                       │ 80         │ 90.9%        │ 142.26     │ 94.7%        │ still not full                                │
└───────────────────────────────┴────────────┴──────────────┴────────────┴──────────────┴───────────────────────────────────────────────┘

The head-to-head cases, which is what actually matters

┌────────────────────────────────────────────────────┬─────────────────────────────────────────┬──────────────────────────────┬──────────────────────────────────────┐
│                     Comparison                     │                 linear                  │            L^1.25            │               verdict                │
├────────────────────────────────────────────────────┼─────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
│ 1 × L10 vs 5 × L2 (same 10 level-ups)              │ 55.6% vs 55.6% — exact tie              │ 69.0% vs 59.8% — depth +9.2  │ this is the defect; it's fixed       │
├────────────────────────────────────────────────────┼─────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
│ 1 × L9 vs 3 × L3 (same 9 level-ups)                │ 52.9% vs 52.9% — exact tie              │ 66.1% vs 59.7% — depth +6.4  │ fixed                                │
├────────────────────────────────────────────────────┼─────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
│ 1 × L9 vs 10 × L2 (RESEARCH.md §4's case)          │ 52.9% vs 71.4% — breadth +18.5          │ 66.1% vs 74.8% — breadth     │ halved, not inverted                 │
│                                                    │                                         │ +8.7                         │                                      │
├────────────────────────────────────────────────────┼─────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
│ 1 × L10 vs 2 × L5                                  │ 55.6% vs 55.6% — tie                    │ 69.0% vs 65.1% — depth +3.9  │ mild, feels right                    │
├────────────────────────────────────────────────────┼─────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────┤
│ marginal 9→10 vs a new skill's first level (from a │ +2.6 vs +5.9 — new skill worth 2.3× the │ +2.9 vs +3.6 — new skill     │ the fungibility complaint is largely │
│  lone L9 skill)                                    │  mastery step                           │ worth 1.25×                  │  dissolved                           │
└────────────────────────────────────────────────────┴─────────────────────────────────────────┴──────────────────────────────┴──────────────────────────────────────┘

Does it feel right? Three readings:

1. Depth now beats equal-level-count breadth, which is the specific thing linear got wrong. Five skills at L2 no longer exactly equals one at L10.
2. Ten skills at L2 still beats one skill at L9. p=1.25 does not invert that, and nothing that respects the concavity constraint can. To invert it you need p ≳ 1.5, which per the table above requires k ≤ 3 and produces a sigmoidal single-skill curve where level 1 is the weakest jump — flatly incompatible with F34 and Koo & Fishbach. If inverting that specific comparison is the goal, the answer is that it cannot be done inside B's constraints, and you should stop trying. I'd argue it shouldn't be inverted anyway: ten started skills in Body genuinely is a lot of Body, and F35's breadth count is the channel that says so.
3. Breadth is never penalised in absolute terms — every state's fill is ≥ its linear counterpart, and starting a skill is still exactly zero. What changes is relative standing, and only in the 5–9 point range.

Where breadth does get squeezed, honestly: at high s the display curve, not the exponent, does the squeezing. From a domain at s≈100 (fill 92.6%), a brand-new skill's first level moves the region by 0.06 points — invisible. This is true under linear too. F35's breadth count and the recency channel are what have to carry late-game exploration feedback; the fill bar structurally cannot.

---
The honest case against super-linear weighting

I do not think this is a comfortable call. Three arguments, at strength:

1. It re-imports effort weighting through the back door, and NG8 may already forbid it. NG8's exact wording is "levels do not encode estimated effort." The only reason to make level 8 worth 13.45 and level 2 worth 2.38 is that level 8 is harder to reach. That is an effort claim. p=1.25 is an effort model — a hard-coded, uniform, unvalidated one, differing from hour-weighting only in that the effort is estimated by fiat rather than measured. NG8 was rejected on principle by the owner; if that principle covers "the contribution function encodes a difficulty gradient," then Question A is closed and the answer is linear. This is an owner decision, not a research finding, and I am flagging it rather than deciding it. The partial defence: F7's five named tiers (Novice→Master) and F8's "difficulty within a level" already assert an ordinal difficulty gradient. The exponent converts that ordinal claim to a cardinal one. That conversion is a real step and NG8 arguably forbids exactly it.

2. It strengthens the comparability claim, and applies a single shape to skills with wildly different shapes. An exponent is a published exchange rate: level 8 is worth 13.45 level-1s, in every skill, uniformly. That asserts all skills escalate at the same rate — which the project's own evidence refutes. ABRSM puts Grade 7→8 at ~374 hours; a knife-skills tree's entire 1–10 might be 30. Linear's claim ("a level-up is a level-up") is thin enough to read as an accounting convention nobody would mistake for a statement about the world. A shaped claim invites the user to check the shape against experience, and it will be wrong in both directions for many skills. NG9 exists to refuse exactly this class of claim.

  The counter I find genuinely persuasive, offered without pretending it's decisive: there is no neutral option. Linear is also an exchange rate, and "exactly equal" is a strong, non-obvious claim — why should five L2s equal one L10 to the decimal? Its virtue is being the unique choice that expresses no preference, which is a real virtue. But note that f(L) is a within-skill statement: "level 8 in piano counts more than level 2 in piano" says nothing about piano vs knife skills, and F12 explicitly permits within-skill ordering ("levels are meaningful relative to their own skill"). Linear's claim is the more cross-comparative of the two — it says a level-up anywhere equals a level-up anywhere.

3. The evidence is against it. Every long-lived additive lifetime aggregate I checked keeps its per-unit contribution flat and normalizes rather than weights. The one that weights got gamed. Detail below. This is the argument that nearly flipped my recommendation.

And the "is it worth it" argument: the proposal does not actually fix the case RESEARCH.md complains about (10×L2 still beats 1×L9). It buys a 5–9 point separation in a few comparisons, in exchange for a cardinal difficulty claim. A reasonable owner could look at that trade and decline it. If you decline, the linear column of the table above is a complete, shippable answer — B and C stand unchanged, fill = s/(s+8), and the only loss is the exact ties at 55.6% and 52.9%.

---
Evidence

Xbox Gamerscore / XR-055 — flat and hard-normalized; the strongest counter-precedent. The certification requirement is a normalization mandate, not a weighting scheme. A base game must ship exactly 1,000 gamerscore with a minimum of 10 achievements; "the title contains more than 1,000 gamerscore configured as base achievements" is a Critical (12) severity failure, as is "a game doesn't support the minimum 10 achievements and 1,000 gamerscore." A single achievement may not exceed 200G. DLC adds at most 1,000G / 100 achievements semi-annually. There is no difficulty or depth weighting anywhere in XR-055 — a 200-hour game and a 3-hour game are both worth exactly 1,000. What cert does police is depth-of-engagement qualitatively, not numerically: "the title allows the user to unlock all achievements after less than half of the game content has been explored" is Critical (12), as is "the title contains a vast number of achievements that don't represent thorough exploration." So Microsoft's answer to "should depth be worth more" is: no — make everything worth the same and enforce that everything requires depth. That is a genuinely different strategy from reweighting, and it maps onto F8's milestone-count bounds, not onto the scoring function.

TrueAchievements — the difficulty weighting exists, but only as a third-party derived layer. TA computes a per-achievement ratio of (gamers with game / gamers with achievement)^0.5 and multiplies base gamerscore by it. Note three things: (a) the market wanted difficulty weighting badly enough to build it; (b) Microsoft never adopted it; (c) it is rarity-derived from population data, which this project structurally cannot have (no telemetry, no population). TA's own community explicitly warns that ratio ≠ difficulty — high ratio often means time-consuming or multiplayer-gated, not hard. Any a-priori exponent is guessing at what TA measures empirically.

PlayStation trophies — the one system that really does weight by tier, at 20:1, and the case study in it being gamed. Post-October-2020: Bronze 15, Silver 30, Gold 90, Platinum 300. That is super-linear across grade with a 20× spread from bottom to top. On top of that, the level curve is concave in points — points required per level, by band: 1–99: 60; 100–199: 90; 200–299: 450; 300–399: 900; 400–499: 1,350; 500–599: 1,800; 600–699: 2,250; 700–799: 2,700; 800–899: 3,150; 900–999: 3,600. Level 999 needs 1,631,340 points. Sony's stated rationale on the PlayStation Blog was to make progression "more optimized and rewarding," with faster early levels and more consistent later ones, and to make Platinum "even more valuable" — and the range went 1–100 → 1–999 with icon bands (Bronze 1–299, Silver 300–599, Gold 600–998, Platinum 999).

  Two things transfer directly. First: this is exactly the A-super-linear + B-concave composition, shipped at scale, which is the best evidence that the composition is workable. Second: Sony re-curved the display rather than changing the metric — the fix for "progression feels wrong" was g, not f. Third, and this is the cost: the 300-point platinum is the documented exploit surface. Ratalaika Games ports indie titles with sub-one-hour platinum lists, cross-buy across platforms and regions so a single purchase yields multiple 300-point platinums. The community complaint is precise and is the one this project should worry about: the top weight is set by the content author's grade choice, not by anything intrinsic. In this project, the equivalent risk is a contributor authoring a shallow tree whose L9–L10 are cheap; the 17.78 weight then pays out for nothing. Mitigation is F8's milestone bounds and F42's review, not the scoring function — but it is a genuine new attack surface that linear does not have.

RuneScape — the cleanest natural experiment on this exact question, and it argues for linear. Both aggregates exist simultaneously and measure different things. Per-skill XP is brutally exponential (xp(L) = ⌊¼ Σ ⌊n + 300·2^(n/7)⌋⌋): level 92 is 7,195,629 XP, level 99 is 13,034,431 — so level 92 is 55% of the way to 99, i.e. the last 7 levels cost as much as the first 91. Total level is the sum of levels, dead linear, max 3,232 for members. The decisive number: max total level requires 1,720,370,164 XP, against a maximum total XP of 5,800,000,000 — the linear aggregate saturates at 29.7% of the depth measure. And Jagex's response to that saturation was not to reweight total level but to add virtual levels (total 3,510 members / 2,126 F2P) — extend the top rather than re-curve the middle. That is precisely this project's optional unbounded mastery tier.

  What each incentivizes: total level rewards touching every skill to a mid level and is what the HiScores front page ranks by; total XP rewards single-skill depth and is the tiebreaker that actually separates elite players ("the top ranked players are generally listed in order of experience rather than rank"). Jagex chose the linear breadth measure as the headline and kept the exponential depth measure as a parallel, separately displayed number. That is F33 + F35 exactly — and it is an argument that this project should solve its depth problem the same way (a second displayed number) rather than by bending f.

Steam profile level — concave display over flat additive units. 100 XP per level for levels 1–10, 200 for 11–20, 300 for 21–30, and so on; badges are worth 100 XP each regardless of the game. Same architecture as PSN's level curve: flat units, rising cost. Directly supportive of B; silent on A.

Guild Wars 2 mastery points. Costs do rise across tiers within a track (e.g. Essence of Valor T1 = 1 point; Essence of Resilience T3 = 2, T4 = 3), so there is a mild step-wise super-linearity in what depth costs — roughly 1,1,2,2,3 rather than anything steep. The wiki does not publish a consolidated formula, so treat this as indicative only. The oversupply point ("there are far more mastery points than are needed to acquire all masteries") is already in RESEARCH.md.

Golf handicap — a counter-precedent worth taking seriously. Handicap Index is linear in strokes (best 8 of last 20 differentials), and the acknowledged fact that going 5→scratch is far harder than 15→5 is not encoded anywhere in the index. Slope Rating (55–155, standard 113) adjusts for course difficulty, not for skill nonlinearity. The USGA had every incentive and a century of data, and still left the scale linear, letting the nonlinearity live in how hard it is to move the number. Same pattern as Gamerscore and total level.

Elo / FIDE — does not transfer, and the reason is instructive. Elo is defined only through the pairwise expectation E(a,b) = 1/(1+10^((b−a)/400)); ratings are meaningless in isolation and are provably not additive — recent work formalizes both the aggregation problem ("Aggregating Elo Ratings: An Axiomatization," arXiv 2605.08989) and the deeper failure ("On the Limitations of Elo: Real-World Games are Transitive, not Additive," arXiv 2206.12301), which shows a single scalar cannot predict outcomes in non-transitive settings. There is no meaningful "sum of Elos." The one thing that does transfer is FIDE's display architecture, already noted in RESEARCH.md §1: continuous rating underneath, four coarse named titles at fixed thresholds on top. Measure continuously, display coarsely — see the B recommendation.

Skill acquisition literature — supports a nonlinear reality, does not license a specific exponent. The power law of practice (Newell & Rosenbloom) gives T(n) = B·n^(−a) with a typically 0.2–0.3, log-log linear; every version of it describes diminishing returns in performance per trial, i.e. increasing trials per unit of performance. That is consistent with "later levels cost more" but says nothing about how much capability a later level represents, which is the actual question. Heathcote, Brown & Mewhort ("The Power Law repealed: The case for an Exponential Law of Practice," Psychon. Bull. Rev. 2000) argue the power law is an artifact of averaging across subjects and that exponential fits individuals better — so even the shape is contested. The Dreyfus model is explicitly about qualitative shifts, not equal increments: recognition becoming holistic marks competent→proficient, decision becoming intuitive marks proficient→expert. That supports "the steps are not the same size" and even supports tier boundaries mattering more than within-tier steps — but Dreyfus offers no cardinal magnitudes, so it cannot adjudicate 1.25 vs 1.5 vs triangular. Flagging clearly: no literature I found licenses any particular exponent. p=1.25 is derived from the display constraint in C, not from skill-acquisition evidence.

Gamification literature on exploration under super-linear scoring — evidence gap. I could not find an experiment testing whether depth-weighted point structures reduce breadth-seeking. The nearest work (Mekler et al. 2017 on points/levels/leaderboards and need satisfaction; Sailer et al.; the exploration–exploitation intergenerational study) manipulates presence of elements, not the curvature of the score. Everything I say about how p=1.25 will affect exploration behaviour is reasoning from priors plus the Steam/PSN observational cases, not from controlled evidence.

---
Question B in detail

Requirements: never saturates; first level visibly moves the region; monotone; unbounded input.

┌───────────────┬───────┬───────┬───────┬───────┬───────┬────────┬───────────┬─────────┐
│     curve     │  s=1  │   5   │  10   │  20   │  50   │   80   │    200    │ verdict │
├───────────────┼───────┼───────┼───────┼───────┼───────┼────────┼───────────┼─────────┤
│ s/(s+8)       │ 11.1% │ 38.5% │ 55.6% │ 71.4% │ 86.2% │ 90.9%  │ 96.2%     │ adopt   │
├───────────────┼───────┼───────┼───────┼───────┼───────┼────────┼───────────┼─────────┤
│ 1−exp(−s/8.5) │ 11.1% │ 44.5% │ 69.2% │ 90.5% │ 99.7% │ 99.99% │ ~100%     │ reject  │
├───────────────┼───────┼───────┼───────┼───────┼───────┼────────┼───────────┼─────────┤
│ log w/ cap S  │ —     │ —     │ —     │ —     │ —     │ —      │ 100% at S │ reject  │
└───────────────┴───────┴───────┴───────┴───────┴───────┴────────┴───────────┴─────────┘

1−exp(−s/k) has a single scale, so anchoring it to make level 1 visible forces it to be perceptually dead by s≈50 — well inside a realistic domain. Its derivative decays exponentially; the rational curve's decays as k/s². At s=50 the rational form is ~10× more responsive, and the ratio grows without bound. That is a decisive, not aesthetic, difference. Log with a cap saturates by definition and needs an arbitrary S; log without a cap is unbounded and can't drive a 0..1 fill.

Constant. k=8. It is set by the anchor "one skill at level 1 fills 11%" — a region going from empty to one-ninth filled is unambiguously a state change, and it leaves 1×L10 at 69% so a single mastered skill does not eat the region. Defensible range is k ∈ [6,10]; smaller k gives a louder first level and permits a steeper p (see the C table) at the cost of top-end headroom; larger k does the reverse. Do not tune k without re-checking p against p ≤ log₂(2k/(k−1)).

Discrete named tiers as the fill itself: reject. It makes most level-ups invisible on the map (only band crossings move anything) and reintroduces the cliff-edge the project removed elsewhere. But adopt the FIDE/PSN/Steam split: continuous fill plus a discrete named band label over the same underlying number. That is what PSN's Bronze/Silver/Gold/Platinum profile icons are and what FIDE's CM/FM/IM/GM thresholds are — measure continuously, display coarsely, and let the label carry the legibility the continuous bar can't.

Terminology correction worth making in RESEARCH.md: §4 says "optionally mild per-skill concavity so later levels are worth slightly more." Later levels being worth more is convexity, not concavity. The concavity is on the display side (F34). The document currently names both halves of the composition "concave," which is exactly the confusion Question C is asking about.

---
Implementation notes

- Ship f as a ten-integer table, not Math.pow. [1, 2.38, 3.95, 5.66, 7.48, 9.39, 11.39, 13.45, 15.59, 17.78], or ×2 and round to integers [2,5,8,11,15,19,23,27,31,36] with k=16 for an identical curve in integer arithmetic. A table is auditable, tunable without a code change, testable, and — the real reason — it lets the project ship [1,2,3,4,5,6,7,8,9,10] as a config flag if the owner decides NG8 forecloses Question A. This is also what PSN, CEFR and ABRSM actually do: publish a table, not a formula.
- Monotonicity (N12) is not a discriminator here. Any increasing f with f(0)=0 composed with any increasing g is monotone, and unstarted skills contribute 0 under all candidates. All options in the brief pass N12; do not use it to choose between them.
- D23 (domain reassignment) gets worse under p>1, not better. Moving a level-8 skill out of a domain now removes 13.45 instead of 8. Whatever resolution D23 gets — frozen contribution, dual counting, display-only override — it must be decided against the weighted number.
- Property test to add: for every pair of domain states differing by one completed level, fill strictly increases; and Δfill(0→1) ≥ Δfill(L→L+1) for all L ≥ 1 on a lone skill. The second test is the C constraint made executable, and it will fail loudly if anyone retunes k or p in isolation.

---
Sources

- XR-055 Achievements and Gamerscore — Microsoft Game Development Kit
- Xbox Requirements for Xbox Console Games — Microsoft Learn
- Upcoming Trophy levelling changes detailed — PlayStation.Blog
- Here Is How PlayStation's New Trophy System Formula Works — PlayStation Universe
- Ratalaika Games, Trophy Bait, and Storefront Gatekeeping — Breaking Arrows
- Total level — The RuneScape Wiki
- Experience — The RuneScape Wiki
- What is my TA score, and how is it calculated? — TrueAchievements
- Components of ratio — It's not all about difficulty! — TrueAchievements
- Steam Level — Steam Trading Cards Wiki
- Mastery — Guild Wars 2 Wiki · Property:Has mastery point cost
- Course Rating vs. Slope Rating — USGA · Slope rating — Wikipedia
- On the Limitations of Elo: Real-World Games are Transitive, not Additive — arXiv 2206.12301
- Aggregating Elo Ratings: An Axiomatization — arXiv 2605.08989
- Newell & Rosenbloom, Mechanisms of Skill Acquisition and the Law of Practice · Power law of practice — Wikipedia
- Heathcote, Brown & Mewhort, The Power Law repealed: The case for an Exponential Law of Practice
- Dreyfus model of skill acquisition — Wikipedia · MedEdMentor summary
- Mekler et al., How gamification motivates — Computers in Human Behavior
- Gamification is Working, but Which One Exactly? — Int. J. Human–Computer Interaction
