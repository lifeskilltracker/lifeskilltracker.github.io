# RESUME — T26 spec reconciliation, wave 2

Handoff written 2026-08-05, superseding the wave-2 task-doc handoff (that work is done).
Read this, then `_BREAKDOWN.yaml`, then `T26-architecture-reconciliation.md`.

## Where things stand

**All 27 task docs written** (`5c69e91`). **T26 is the front of the critical path** and is
now 7 of 17 findings resolved.

| Resolved | Open |
|---|---|
| F1, F2 (2026-08-05, earlier session) | F3, F4, F5, F6, F7 |
| F8, F9, F10, F11, F16 (2026-08-05, this session) | F12, F13, F14, F15, F17 |

Resolutions are recorded in `docs/SPEC-FINDINGS.md` and amended into
`docs/ARCHITECTURE.md`. No implementation has begun; the repository is still docs-only.

**Do not use the sqz MCP tools.** The user asked for built-in Read/Grep/Bash instead.

## What this session changed

- **F8** — `contentVersion` is now an **authored per-tree integer**; the library-wide
  counter is deleted. New `lst version` subcommand writes it, §6.4's baseline job enforces
  it. Touched §4.1, §5.2, §5.3, §6.1, §6.4, §6.5, §7.2, §7.3, §8.6, §11.5, §12.2, §12.5,
  §12.6, §16.1, §16.2, D-19. **T11's `>` versus `!=` distinction is a correctness matter,
  not an optimization** — see §12.5.
- **F9** — `schema/compiled-tree.schema.json` and `schema/manifest.schema.json` added.
  Build-time and codegen only; the app ships no validator.
- **F10** — service worker deferred to phase 2; pinning is in-page Cache Storage. Settled
  by N9's "**once loaded**" wording. Gap recorded as **R-26** in §19.3.
- **F11** — new **`lib/actions`** module is the `startSkill` → `pin` seam, with two new
  forbidden edges in §14.1 and §14.7. Pinning is best-effort.
- **F16** — **§11 splits at §11.5.** §11.1–§11.4 (tree-local) ship in Phase 0;
  §11.5–§11.8 (grandfathering + aggregation) in Phase 1. §16.4's "no scoring" became "no
  *domain* scoring".

## Step 1 — the T11 split is the one loose end

`_BREAKDOWN.yaml` now has **T11a** and **T11b** rows, both `status: pending`, and every
edge in the graph is rewired to them. But `T11-scoring-engine.md` still covers all of §11
and carries a `**SUPERSEDED**` header row. Split it into:

- `T11a-scoring-tree-local.md` — §11.1–§11.4, §14.4. Phase 0. Blocked by T02, T26.
  Blocks T08. This is what unblocks the Phase 0 gate, so it is the higher priority.
- `T11b-scoring-aggregation.md` — §11.5–§11.9, §14.4. Phase 1. Blocked by T10, T26.
  Blocks T13, T14, T15, T17, T19.

Nothing in the existing document is wrong — only its phase assignment and blocking edges.
Set both rows to `status: written` when done.

## Step 2 — the remaining ten findings

Suggested grouping, unchanged from this session's analysis:

| Group | Findings | Blocks | Note |
|---|---|---|---|
| **B — engine types** | F3, F4, F5 | T02, T11b, T13, T16, T17 | F3 blocks T02, so it is critical-path. F5 is adjacent to T00's R-24. |
| **C — lineage & import** | F12, F13, F14 | T16, T17 | All §12.5/§12.6 record disposition. F14 is genuinely open; F8 did not close it. |
| **D — CLI & map validation** | F6, F7, F17 | T12, T23 | Cheapest and self-contained. F6/F7 now also touch §6.4's new fifth check. |
| **E — the omission cluster** | F15 | — | Six small items. `MILESTONE.contentVersion` is now defined (F8), so that sub-item is already handled. |

Group B is the natural next one — F3 blocks T02, which blocks nearly everything.

## Working agreements from this session

- **Confidence bars on every option** presented to the user (`[########--] 8/10`).
- **Research before deciding on open calls**, and ask the agent for the case *against* the
  proposal. This session's F8 proposal was overturned by exactly that, and the overturn was
  correct — see `SPEC-FINDINGS.md` F8's "An intermediate proposal, and why it was wrong".
- **Verify agent spec findings against `docs/ARCHITECTURE.md` before acting on them.**
- **Five findings at a time, maximum.** The user is watching usage limits.

## Known open items

- **T15 is deliberately incomplete.** Written rule-agnostic; its criteria naming "the
  chosen rule" must be rewritten once T00 resolves PRD D20.
- **T26's F1 and F2 needed the user's judgment** and got it. F3–F17 are mostly delegable,
  but F6 (which baseline ref) is a maintainer preference, not a derivation.
- **The coherence pass across all 27 docs has not been done.** Contradictions between docs
  that touch the same file or store, `Out of scope` items naming tasks that exist,
  `blocked_by`/`blocks` symmetry. The T11a/T11b rewiring in this session is the kind of
  thing it would catch.
