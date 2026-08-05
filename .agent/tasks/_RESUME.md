# RESUME — v1 task-doc breakdown, wave 2

Handoff written 2026-08-05. Read this, then `_BREAKDOWN.yaml`, then act. Everything
below is already decided — do not re-open it.

## Where things stand

**17 of 27 task docs written and committed** (`71a5962`). 10 remain, all in wave 2.

The breakdown decomposes `docs/ARCHITECTURE.md` §16.4's Phase 0 + Phase 1 into task
documents under `.agent/tasks/`. `_BREAKDOWN.yaml` is the authoritative index and the
cross-session stager: rows whose `status` is not `written` still need their document.

**Do not use the sqz MCP tools.** The user asked for built-in Read/Grep/Bash instead.

## Decisions already made — do not relitigate

- **Clustered subagents**, not one-per-task. Docs that interlock get written together by
  one agent that read the same spec region.
- **Hybrid models.** Opus for reasoning-limited clusters, Sonnet where the spec is
  already tabulated. Both wave-2 clusters are **Sonnet**.
- **Two waves**, manifest updated and committed between them.
- Every agent reads `_TEMPLATE.md` and the **T02 exemplar** first. T02 is the quality bar.
- **T26 stays blocking** (user decision, 2026-08-05). The fifteen spec defects are
  resolved upfront, before T02 and the rest. T26's `blocks:` edges are already wired.

## Step 1 — launch wave 2

Two `general-purpose` subagents, `model: sonnet`, run in parallel (background). The
prompts below are ready to use verbatim apart from the two cluster-specific blocks.

### Shared preamble (use for both)

> You are writing Navigator task documents for the life-skill-tracker project at
> /home/eagle/projects/life-skill-tracker. You write SPECIFICATION DOCUMENTS ONLY — do
> not implement, scaffold, or modify any source code.
>
> Read these first, in order:
> 1. `.agent/tasks/_TEMPLATE.md` — the required document shape. Follow it exactly.
> 2. `.agent/tasks/T02-schema-v1-and-generated-types.md` — the worked exemplar. Match its
>    depth, voice, and specificity. This is the quality bar; anything noticeably thinner
>    is a failure.
> 3. `.agent/tasks/_BREAKDOWN.yaml` — the task index. Your rows supply `blocked_by`,
>    `blocks`, `spec`, and `prd` for each header table. Use them verbatim.
>
> Then read the relevant sections of `docs/ARCHITECTURE.md` (2410 lines; grep `'^### '`
> to locate sections).
>
> IMPORTANT: Do NOT use the sqz MCP tools (sqz_read_file, sqz_grep, sqz_list_dir). Use
> built-in Read and Grep.
>
> Rules:
> - Copy interface contracts and tables VERBATIM from the spec. Downstream tasks are
>   written against those blocks.
> - Every acceptance criterion must be verifiable by running a named command or reading a
>   named file. Never "works correctly" or "is well tested".
> - "Out of scope" must name where the excluded thing actually lives — another task id, or
>   Phase 2.
> - Cite decision records (D-NN) and risks (R-NN) by identifier wherever the spec does.
> - Do NOT edit `_BREAKDOWN.yaml` or `T26-architecture-reconciliation.md`. The
>   orchestrator owns both.
> - **`.agent/tasks/T26-architecture-reconciliation.md` already records fifteen known spec
>   defects.** Read it before flagging anything. If you find a NEW defect, report it for
>   appending to T26 — do not open a new task and do not invent a resolution.

### Cluster A — views (Sonnet)

Write `T08`, `T13`, `T14`, `T19`, `T20`:

- `.agent/tasks/T08-tree-view.md` — TreeView renderer. Spec §9. **F10 is the point: the
  renderer never reads `archetype`.** §14.7 makes that a grep gate and calls it the
  mechanical form of S1. Also §9.2's SVG structure, §9.3's node states, §9.4's interaction
  — including the §11.10 consequence warnings before destructive actions — and §9.6's
  level chrome and mastery panel.
- `.agent/tasks/T13-map-renderer.md` — Map Renderer. Spec §10.5, §10.6, §10.7. Three
  channels: fill (§11.6), recency as **a date, not a fade** (D-20), breadth as a count.
  Never a raw percentage — named bands over the continuous number (F34, §15.3).
- `.agent/tasks/T14-routes-and-cold-start.md` — Spec §13.1–§13.4, §16.3. All routes and
  their prerender flags; §13.3's cold-start branches. The hydration-failure branch matters
  most: the store refuses all writes for the session, because the dangerous failure is
  "read as empty, then wrote". Milestone deep links use slugs resolved through `aliases`.
- `.agent/tasks/T19-dismissed-state.md` — Spec §11.10, §9.3. §11.10 is emphatic and its
  reasoning must survive into the doc: dismissal must never shrink a group's denominator,
  because un-dismissal would then reduce a score and violate N12 in two clicks. §9.4's
  intercept for the level-capping case belongs here.
- `.agent/tasks/T20-accessibility.md` — Spec §15 entire. D-10: the linear list is the
  primary representation for assistive technology and is the same list every mobile user
  sees, so it cannot rot unnoticed. §15.4 never colour alone, §15.5 motion, §15.8
  verification. R-07 is an accepted residual risk — record it, don't try to solve it.

### Cluster B — content-gates (Sonnet)

Write `T05`, `T12`, `T21`, `T24`, `T25`:

- `.agent/tasks/T05-exemplar-tree-1.md` — the first tree, linear and single-track,
  authored by hand. Spec §5.3, §16.4. It is drafted with **no `uid` lines at all** (§5.4);
  `lst ids` fills them after. This tree is what T10's gate is proven against.
- `.agent/tasks/T12-map-geometry.md` — `content/taxonomy/map.yaml`, axial-to-pixel maths,
  and the build-time union into one path per domain. Spec §10.3, §10.4, D-08. R-13: hand
  authoring hex tiles is the least ergonomic task in the project, it happens once, and it
  is maintainer-only — a throwaway grid-painting script is the fallback, never a shipped
  feature.
- `.agent/tasks/T21-exemplar-trees-2-3.md` — branching and modular exemplars. Spec §16.4,
  §5.3. These are what prove **S1**: three progression shapes through one `TreeView` with
  no archetype branch. R-12 (authors dumping everything into one track) is editorial.
- `.agent/tasks/T24-contributor-docs.md` — CONTRIBUTING.md, STYLE-RUBRIC.md,
  AUTHORING-WITH-AI.md. Spec §6.7, §4.2. §6.7's "explicitly not built" list is
  load-bearing — no AI service, no bot, no generation endpoint. The style rubric must
  carry Mozilla's rule verbatim (R-03): a typo or clarity fix keeps the uid, a change of
  meaning requires a new one.
- `.agent/tasks/T25-ci-and-deploy.md` — Spec §6.5, §14.7, §16.1, §16.2, §17.1, §4.4. The
  six gating jobs and the path filter that lets content PRs skip the app jobs. §14.7's
  enforcement is the core: import rules, the `archetype` grep gate, the purity check, type
  generation, property tests. Plus §17.1's bundle budget failing CI on regression and
  §4.4's four GitHub Pages constraints. **Note: §6.4's baseline contradiction is T26's F6 —
  reference it, do not resolve it.**

## Step 2 — after both agents report

1. **Verify their spec findings against `docs/ARCHITECTURE.md` before believing them.**
   Wave 1's agents were right about the substantive ones, but check rather than assume.
2. Append genuinely new defects to T26's scope list as `F16`, `F17`, … and update T26's
   header counts, `Blocks:` row, and acceptance criteria to match.
3. Update `_BREAKDOWN.yaml`: set `status: written` and the `doc:` filename for all ten
   rows, and add T26 to `blocked_by` for any newly-affected task.
4. Commit.

## Step 3 — the coherence pass (not yet done)

Across all 27 docs:
- Contradictions between docs, especially where two tasks touch the same file or store.
- Scope overlaps and gaps — every `Out of scope` item should name a task that exists.
- Cross-references pointing at the right task ids.
- `blocked_by` / `blocks` symmetry in `_BREAKDOWN.yaml`: if A blocks B, B is blocked by A.
- T15's placeholder criteria still say "the chosen rule" — correct only after T00 lands.

## Known open items

- **T15 is deliberately incomplete.** Written rule-agnostic; its criteria naming "the
  chosen rule" must be rewritten once T00 resolves PRD D20.
- **T26 is the front of the critical path** and needs the user's judgment on F1 (the p/k
  tuning) and F2 (grandfathering storage shape) — those are not delegable.
- No implementation has begun. The repository is still docs-only.
