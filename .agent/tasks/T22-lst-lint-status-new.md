# T22 — `lst lint`, `lst status`, `lst new`

| Field | Value |
|---|---|
| **Status** | complete — 2026-08-15 |
| **Phase** | 1 |
| **Cluster** | cli-toolchain |
| **Blocked by** | T03 |
| **Blocks** | T24, T25 |
| **Spec** | ARCHITECTURE §6.3, §6.6 |
| **PRD** | F42, F43, D14, D16, D-15, D-16, R-04 |

## Goal

`tools/src/lint/`, `tools/src/status/`, and `tools/src/new/` exist and are wired into the
`lst` CLI as `lst lint [files…]`, `lst status`, and `lst new <id>`. After this task,
`lst lint` evaluates all seven §6.3 coherence/style rules against a tree and reports
findings with file and line, but its exit code never reflects those findings — it is
advisory, full stop. `lst status` regenerates `content/REVIEW-STATUS.md` from every
tree's `provenance` block and gates only on drift between the committed file and the
regenerated one, never on the review state itself. `lst new <id>` scaffolds a tree
skeleton matching §5.3's shape so a contributor starts from structure rather than a blank
file.

## Why this shape

**D-15** and **D-16** are both load-bearing and both resolved the same way for the same
reason: `docs/PRIOR-ART.md` §7.3 already worked through a concrete case where a
*teach/sell/publish* regex false-positives on "teach a certification course," a
legitimately advanced milestone — the judgment is contextual, and "a gate that is wrong
even occasionally trains contributors to write around the linter instead of writing well"
(§6.3). That is why `lst lint` must be architecturally incapable of failing CI: **a lint
rule that blocks a merge is a bug in this task**, not a stricter implementation of it.
D-16 makes the same call about the review table for a different, mechanical reason — a
hand-maintained table "drifts within a month," so `lst status` gates only on the generated
file disagreeing with the committed one, never on whose review round is missing. Both
decisions keep human judgment (F42) as the sole arbiter of content quality; this task's
job is to make that judgment better-informed, never to substitute for it.

## Scope

**In scope**

- `lst lint [files…]`: all seven rules in §6.3's table — `vague-milestone`,
  `professionalization-tier`, `group-shape-drift`, `track-overuse`, `lonely-track`,
  `level-pacing`, `orphan-milestone`.
- Findings reported with file and line, structured (rule id, message, location) so a CI
  step can turn them into GitHub review annotations — but the annotation delivery
  mechanism itself is not this task's problem (see hazards).
- `lst lint`'s exit code: **always 0**, regardless of how many findings are reported. This
  is the structural enforcement of D-15 and must be a tested behaviour, not an assumption.
- Rule logic kept separable from the "always advisory" exit-code wiring, so that promoting
  an individual rule to a gate later — which R-04 names as "a one-line change," made "on
  evidence, never a decision made in advance" — does not require rewriting the rule.
- `lst status`: derives `content/REVIEW-STATUS.md` from every tree's `provenance` block,
  one row per tree with authored / review 1 / review 2 columns per §6.6.
- `lst status`'s drift check: comparing the committed `content/REVIEW-STATUS.md` against a
  freshly generated copy and failing (gate) only on a mismatch (§6.1: "**yes** (drift
  fails)").
- `lst new <id>`: scaffolds a tree file matching §5.3's field reference, with `id` set
  from the argument and no `uid` lines (per §5.4's draft-first authoring flow) — the
  scaffold must itself be a valid starting point for `lst validate` (T03) at the schema
  level, missing only the content an author has to write.

**Out of scope**

- `lst validate`, `lst ids` — T03. `lst lint` does not duplicate any of the 16 semantic
  rules; a rule that is a hard gate belongs in validate, not here, by definition (D-15).
- `lst baseline` — T23.
- `lst compile` and its §7.3 transformations — T04.
- Wiring lint findings into actual GitHub Actions annotation syntax and the rest of the
  CI job graph (§6.5) — T25 owns `.github/workflows/`. This task's output is structured
  findings; turning them into on-PR annotations is CI plumbing, not this task's binary
  behaviour.
- Promoting any lint rule from advisory to gate — an explicit future maintainer decision
  made on evidence (R-04), never performed by this task or its output.
- The `provenance` schema fields themselves (`authors`, `reviews`, `sources`,
  `copyleftDerived`) — defined by T02's `tree.schema.json`; this task only reads them.
- Populating a scaffolded tree's `provenance.authors` or any content — `lst new` produces
  structure, not content; an author fills in everything else by hand.

## Deliverables

```
tools/src/lint/index.ts             orchestrates the seven rules; always exits 0
tools/src/lint/rules/*.ts           one module per §6.3 rule
tools/src/lint/report.ts            structured finding shape: rule, file, line, message
tools/src/lint/index.test.ts
tools/src/status/index.ts           generates content/REVIEW-STATUS.md from provenance
tools/src/status/index.test.ts
tools/src/new/index.ts              lst new <id> scaffolder
tools/src/new/template.ts           the §5.3 skeleton, id substituted, no uid lines
tools/src/new/index.test.ts
content/REVIEW-STATUS.md            OUTPUT — generated, committed, checked for drift
```

## Interface contract

The `lst` table rows this task owns, copied verbatim from §6.1:

| Command | Purpose | Gates? |
|---|---|---|
| `lst lint [files…]` | Advisory coherence and style warnings | no |
| `lst status` | Regenerate `content/REVIEW-STATUS.md` | **yes** (drift fails) |
| `lst new <id>` | Scaffold a tree skeleton from a template | no |

The seven lint rules, copied verbatim from §6.3:

| Rule | Flags |
|---|---|
| `vague-milestone` | Effort-quantity phrasing (*practice*, *spend N hours*, *study*), and hedges (*understand*, *learn about*, *be familiar with*) that have no observable completion condition (F2) |
| `professionalization-tier` | *teach* / *sell* / *publish* / *certify* appearing at levels 9–10 (F43) |
| `group-shape-drift` | More than three distinct requirement-group shapes in one tree — D14's stated worry, that F9's expressiveness lets an author write ten subtly different rules |
| `track-overuse` | More than four tracks, which `docs/RESEARCH.md` §3 identifies as the signal that a skill should be split |
| `lonely-track` | A track with fewer than three milestones, usually a modelling error |
| `level-pacing` | A level whose milestone count deviates sharply from its neighbours' |
| `orphan-milestone` | Reachable but referenced by no other milestone's `requires` in a tree that otherwise uses prerequisites |

> **Decision: the linter annotates the PR and never blocks a merge.** It emits GitHub
> review annotations at the offending line; reviewers read them as prompts and are free to
> dismiss any of them. (§6.3)
>
> If a rule proves to have a near-zero false-positive rate over the first dozen trees,
> promoting it to a gate is a one-line change. Promotion is a maintainer decision made on
> evidence, not in advance. Tracked as **R-04**. (§6.3)

The provenance block `lst status` reads, copied verbatim from §6.6:

```yaml
provenance:
  authors:
    - { name: A. Contributor, github: acontributor }
    - { name: B. Later,       github: blater, role: reviser, since: 2027-04-11 }
  reviews:
    - { round: 1, reviewer: R. One, date: 2026-09-02 }
    - { round: 2, reviewer: R. Two, date: 2026-09-14 }
```

> **The status table** (F42) is **generated**, not hand-maintained. `lst status` derives
> `content/REVIEW-STATUS.md` from the `provenance` blocks of every tree, and CI fails if
> the committed file differs from the generated one. A hand-maintained table drifts within
> a month; a generated one cannot, and it costs about forty lines of code. Columns follow
> the PRD: one row per tree, authored / review 1 / review 2. (§6.6)

## Acceptance criteria

- [x] Each of the seven lint rules has a fixture that trips it and a clean fixture that
      does not.
- [x] `lst lint` against a fixture tripping all seven rules at once still exits **0** —
      the direct D-15 regression test.
- [x] `professionalization-tier` does **not** flag "teach a certification course" phrased
      as a legitimately advanced milestone when it is not the specific pattern the rule
      targets outside levels 9–10 — a test named for the exact `docs/PRIOR-ART.md` §7.3
      case the spec cites, so this specific false positive cannot silently regress.
- [x] `track-overuse` fires on 5 tracks and does not fire on 4.
- [x] `lonely-track` fires on a 2-milestone track and does not fire on a 3-milestone track.
- [x] `group-shape-drift` fires on a tree with 4 distinct requirement-group shapes and
      does not fire on 3.
- [x] `lst status` run against a corpus of tree fixtures with varying `provenance` blocks
      produces a file with one row per tree and authored / review 1 / review 2 columns
      matching each tree's `provenance`.
- [x] `lst status` exits nonzero when `content/REVIEW-STATUS.md` differs from the freshly
      generated content, and exits 0 when they match.
- [x] `lst status`'s exit code is driven **only** by drift — a fixture corpus with zero
      reviews recorded anywhere still exits 0 as long as the committed table matches.
- [x] `lst new demo-skill` produces a file whose `id` is `demo-skill`, contains no `uid:`
      lines, and passes `lst validate`'s Layer 1 schema check (T03) as-is.
- [x] `tools/` remains free of application dependencies after this task, matching T01's
      and T03's boundary.

## Verification

```bash
npm run --workspace tools test
npx lst lint content/trees/*.yaml; echo "exit: $?"     # must print 0 regardless of findings
npx lst status && git diff --exit-code content/REVIEW-STATUS.md
npx lst new demo-skill && npx lst validate content/trees/demo-skill.yaml
```

Passing looks like: every fixture landing on its expected verdict, `lst lint`'s exit code
staying 0 under every finding combination tested, and `lst status`'s exit code tracking
drift and only drift.

## Notes and hazards

- **D-15/D-16 restated as a hazard, not just a decision.** A `lst lint` implementation
  that returns nonzero when findings exist, or a `lst status` implementation that fails
  because a review round is missing rather than because the file drifted, is not a
  stricter reading of this task — it is a bug in it. Any code review of this task's output
  should look specifically for an accidental nonzero exit path in `lint/index.ts`.
- **The GitHub annotation delivery mechanism is not specified.** §6.3 says the linter
  "emits GitHub review annotations at the offending line," but the architecture does not
  say whether that means native GitHub Actions workflow commands (`::warning
  file=…,line=…::…`), a bot posting PR review comments (reviewdog-style), or something
  else — and that choice lives in T25's CI job graph, not here. This task should produce
  structured findings (rule, file, line, message) and leave the on-PR rendering
  unspecified rather than baking one mechanism's syntax into the tool.
- **R-04's promotion path** assumes rule logic and gating are separable. If a rule's
  implementation is written in a way that its verdict and its "never fails the process"
  behaviour are tangled together, promoting it later stops being the one-line change the
  spec expects.
- `lst new`'s scaffold intentionally omits `uid` lines — running `lst ids` (T03) on the
  scaffold's output is the expected next authoring step, not something `lst new` does
  itself.

## Completion state — 2026-08-15

All eleven acceptance criteria met. `tools/` 234 tests; root `npm test`, `npm run
typecheck` and `npm run lint` clean. `content/REVIEW-STATUS.md` is generated and committed.

Five things §6.3 left to the implementer, decided here and worth knowing before anyone
edits a rule:

- **A requirement-group "shape" is `rule` plus, for `n_of`, its `n`** — `all`, `any`,
  `n_of:2`, `n_of:3`. Deliberately *not* the group's size. D14's worry is a reader holding
  several different rules in mind, and `n_of: 2` over three milestones and over five is one
  rule applied twice. Counting size would fire on almost every real tree and say nothing.
- **`level-pacing` fires at a deviation of ≥ 3 from the mean of a level's immediate
  neighbours.** F8 bounds a level at 4–8 milestones, so the widest gap the schema permits is
  4; a threshold of 3 cannot fire on a tree that varies by one or two and always fires on
  the 4-versus-8 jump.
- **An orphan is a milestone off the prerequisite graph in *both* directions** — it requires
  nothing *and* nothing requires it. The literal reading of §6.3 ("referenced by no other
  milestone's `requires`") would flag every level-10 milestone in every tree that uses
  prerequisites at all, since nothing is ever a prerequisite of the top. Mastery `requires`
  counts as a reference.
- **`lst status` writes the regenerated file before it fails.** §6.1 says it gates on drift
  and T22's verification line pipes it into `git diff --exit-code`; writing-then-failing
  satisfies both and gives the author the fix in the working tree, which is the same
  ergonomics as `lst ids` and §6.4 check 5's `lst version`.
- **`vague-milestone` flags the bare word "practice".** §6.3 names it explicitly, so it
  ships as specified — but it is the noisiest of the seven on real content: it fires nine
  times on `mental-health.yaml`, where "practice" is the domain's own vocabulary rather than
  an effort quantity. That is not a bug to fix quietly; it is exactly the false-positive
  evidence **R-04** asks a maintainer to weigh, and it is the reason D-15 made lint
  advisory. Recorded here so the first maintainer to look at R-04 has the case in hand.

Real-corpus behaviour at completion: 17 findings across the three trees, exit code 0.
