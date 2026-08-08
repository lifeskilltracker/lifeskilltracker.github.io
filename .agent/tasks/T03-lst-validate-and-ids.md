# T03 — `lst validate` and `lst ids`

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | cli-toolchain |
| **Blocked by** | T02 |
| **Blocks** | T04, T05, T12, T22, T23 |
| **Spec** | ARCHITECTURE §6.1, §6.2, §5.4 |
| **PRD** | F40, F41, F45 |

## Goal

`tools/src/validate/` and `tools/src/ids/` exist and are wired into the `lst` CLI
(`tools/src/cli.ts`, stubbed by T01) as `lst validate [files…]` and `lst ids [files…]`.
After this task, a tree YAML file can be checked in one pass against both the JSON Schema
layer (T02's `schema/*.json`, via Ajv) and §6.2's layer 2 — the 16 semantic rules, plus the
five taxonomy rules M1–M5 over `map.yaml` — none of which JSON Schema can express, with
every violation reported with file, line, and column rather than stopping at the first. `lst ids` fills in every missing `uid:` in a drafted tree in place,
generating repository-unique 8-character Crockford base32 values, and fails when a `uid`
is still missing after it runs. This is the first point in the pipeline where content is
actually gated — CI's `content: validate` job (§6.5) becomes real for the first time.

## Why this shape

F40's promise — "know your tree is correct before you open a PR" — is only real if CI
runs the identical binary an author runs locally (§6.1); this task is what makes that
binary exist. The two-layer split is forced by what JSON Schema can and cannot say:
Layer 1 (T02's schema) catches shape, layer 2 catches everything that requires looking
across the file or across the repository — cycles, cross-references, repository-wide
uniqueness. §5.4 (**D-05**) is why `lst ids` is a separate command from `lst validate`
rather than a validate-time autofix: the authoring flow is deliberately draft-first,
uid-last — a contributor writes every prerequisite and requirement group as a slug before
any uid exists, and only runs `lst ids` once the draft is complete. Validating and
id-filling are gated separately (§6.1's table marks both **yes**) because they answer
different questions: is this file well-formed, and does every milestone have the
identifier user state will key on.

## Scope

**In scope**

- `lst validate [files…]`: Layer 1 (Ajv against `schema/*.json`) followed by Layer 2, all
  16 semantic rules in §6.2's table, **and layer 2b's five taxonomy rules M1–M5 over
  `content/taxonomy/map.yaml`** (T26/F17), run in one pass per invocation.
- Error reporting that accumulates every violation found — schema and semantic — into one
  report with file, line, and column, rather than exiting on the first (§6.1).
- Semantic rule 2's repository-wide uid-uniqueness check, which requires reading every
  tree in `content/trees/`, not just the file(s) passed on the command line. §6.2 now
  states the general form of this: **the file list scopes what is reported, not what is
  read** (T26/F17). Scoping M1–M5 to argv would silently run no map checks on the common
  invocation, which is the failure that sentence exists to prevent.
- `lst ids [files…]`: assigns a missing `uid:` to every milestone and mastery entry that
  lacks one, writing the value back into the YAML file in place; 8-character Crockford
  base32, checked for uniqueness against every existing uid in the repository before it is
  written. After F25, **`lst ids` is the fix, not the gate** — rule 16 in `lst validate`
  rejects missing uids; `lst ids` only fills them in place.
- CLI plumbing shared by later subcommands (`lst lint`, `lst status`, `lst baseline`,
  `lst compile` in T22/T23/T04): consistent exit-code convention, consistent
  file-argument handling, consistent error-report shape, so those tasks extend rather than
  reinvent the pattern.

**Out of scope**

- `lst lint`, `lst status`, `lst new` — T22.
- `lst baseline` — T23. In particular, every comparison needing git history belongs there:
  the baseline is the tip of `origin/main` (T26/F6 settled this — not a release tag, and not
  the merge-base), and that includes §6.4 **check 7**, the historical half of what used to be
  rule 15. `lst validate` performs no git operation at all.
- `lst compile` and the YAML→JSON transformations of §7.3 — T04. Validate only checks
  correctness; it emits no compiled artifact.
- The full schema definitions and their generated TypeScript — T02. This task consumes
  `schema/*.json`, it does not author it.
- Applying `lineage` operations to user state at load time — T17 (§12.5). Rule 15 here only
  checks an entry's grammar and that its `into` targets resolve, not how the runtime uses
  them.
- Auto-recording a changed slug into `aliases` — that correction is described in §6.4 as
  something "CI can auto-fix by pushing a commit," which is baseline's job (T23), not
  validate's. `lst validate` may *reject* a missing alias if some future rule requires it,
  but it does not write one.

## Deliverables

```
tools/src/validate/index.ts        orchestrates layer 1 (Ajv) + layer 2 (16 rules) + 2b (M1–M5)
tools/src/validate/schema.ts       Ajv wiring against schema/*.json
tools/src/validate/rules/          one module per §6.2 semantic rule (or logical grouping)
tools/src/validate/map-rules.ts    layer 2b — M1–M5, moved here from T12 by T26/F17
tools/src/validate/report.ts       error accumulation and file:line:column formatting
tools/src/validate/index.test.ts
tools/src/ids/index.ts             uid generation, repo-wide uniqueness check, in-place write
tools/src/ids/crockford.ts         8-char Crockford base32 generator
tools/src/ids/index.test.ts
tools/test/fixtures/validate/      one fixture pair (pass/fail) per semantic and taxonomy rule
```

## Interface contract

The full `lst` command table, copied verbatim from §6.1 — this task owns the first two
gating rows:

| Command | Purpose | Gates? |
|---|---|---|
| `lst validate [files…]` | Schema + semantic rules, trees **and taxonomy** (F41) | **yes** |
| `lst baseline` | uid immutability vs. `main` (§6.4) | **yes** |
| `lst lint [files…]` | Advisory coherence and style warnings | no |
| `lst ids [files…]` | Fill missing `uid` values in place | no (rule 16 gates in validate) |
| `lst status` | Regenerate `content/REVIEW-STATUS.md` | **yes** (drift fails) |
| `lst compile` | YAML → JSON bundles + manifest (§7) | **yes** (build step) |
| `lst new <id>` | Scaffold a tree skeleton from a template | no |

> `lst validate` reports every error it can find in one pass with file, line, and column,
> rather than stopping at the first. A contributor iterating against a validator that
> surfaces one error per run will abandon the PR. (§6.1)

The 16 semantic rules, copied verbatim from §6.2:

| # | Rule | PRD |
|---|---|---|
| 1 | Levels are exactly 1–10, each present once, in order | F7 |
| 2 | Milestone slugs unique within the tree; uids unique across the repository | §5.4 |
| 3 | Every `requires` target resolves to a milestone in the same tree | F41 |
| 4 | No cycles in the `requires` graph | F41 |
| 5 | A prerequisite's level is ≤ its dependent's level | F41 |
| 6 | Requirement groups name only milestones at their own level | §5.6 |
| 7 | `1 ≤ n < len(milestones)` for every `n_of` group | §5.6 |
| 8 | Every milestone appears in ≥1 requirement group at its level | §5.6 |
| 9 | `track` references resolve to declared `tracks[]` entries; `module` is a free-form label with no registry | F41 |
| 10 | `domain` and every `secondaryDomains` entry exists in `domains.yaml`; primary not repeated in secondary | F18, F41 |
| 11 | `subregion` present iff `domain: making`, and valid | F26, F41 |
| 12 | Every facet exists in `facets.yaml` | F19, F41 |
| 13 | `copyleftDerived` is present and answered | F45 |
| 14 | Mastery entries carry no level, track, order, or requirement group | F5, §5.7 |
| 15 | Every `lineage` entry's `into` matches the grammar for its `op` — shape, cardinality, and targets resolving to a uid present in the repository head | §5.4 |

**Layer 2b — taxonomy rules, over `content/taxonomy/`, copied verbatim from §6.2. Added by
T26/F17, 2026-08-05: these are §10.3's five geometry invariants, which that section required
and never assigned an owner.**

| # | Rule | Spec |
|---|---|---|
| M1 | Every domain in `domains.yaml` has a region in `map.yaml` | §10.3 |
| M2 | No tile is claimed twice — over the **multiset of every tile in every region**, not merely across domains | §10.3 |
| M3 | Each region is contiguous under hex adjacency | §10.3 |
| M4 | Subregion tiles partition their parent's tiles exactly — no gap, no overlap, no stray | §10.3 |
| M5 | Subregions appear only under `making` | §10.3, F26 |

> **The file list scopes what is *reported*, not what is *read*.** `lst validate
> content/trees/foo.yaml` still loads `domains.yaml`, `facets.yaml`, `map.yaml`, and every
> other tree — rules 2, 10, 11 and 12 have always required this. (§6.2)

> Rule 13 deserves comment: CI cannot detect a copyleft derivation, only the *absence of
> an answer*. A tree answering `true` passes CI and is rejected at review (F45). The gate
> is there to make the question unskippable, not to adjudicate it. (§6.2)

The identifier table, copied verbatim from §5.4:

| | `id` (slug) | `uid` |
|---|---|---|
| Written by | the author | tooling, once |
| Shape | `^[a-z0-9]+(-[a-z0-9]+)*$` | 8 chars, Crockford base32 |
| Unique within | the tree | **the whole repository** |
| Mutable | yes | **never** |
| Referenced by | `requires:`, requirement groups, URLs | user state, export files |

> **Authoring flow.** The author writes a complete tree with no `uid` lines at all.
> `npx lst ids content/trees/mytree.yaml` fills every blank in place. CI fails a merge if
> any `uid` is missing, printing the values to paste. Because in-file references use
> slugs, the draft is fully writable — including all prerequisites and requirement
> groups — before the tool is ever run. (§5.4)

## Acceptance criteria

- [ ] `lst validate` run against fixtures that violate every one of the 16 semantic
      rules reports each rule in one invocation (across files where mutually incompatible),
      each with file, line, and column.
- [ ] `lst validate` performs no git operation at all — verifiable by
      `grep -rn "child_process\|simple-git\|exec(" tools/src/validate/` returning nothing.
      Everything needing history is `lst baseline`'s (T23, §6.4 check 7).
- [ ] Each of the 16 rules has an independent fixture pair: one file that violates only
      that rule and fails, one clean file that passes.
- [ ] Rule 2's repository-wide uid uniqueness is exercised across **two** fixture tree
      files sharing a duplicate uid — a single-file fixture cannot prove this rule.
- [ ] Rule 15 needs **one failing fixture per row of §5.4's grammar table plus three for
      the constraints that are not resolution** (T26/F21): `split` with one target and with
      `into: []`; `merged` with two targets; `retired` carrying a non-empty `into`; `moved`
      with a bare uid, with a qualified target naming this same tree, with a target naming a
      tree that does not exist, and with a target whose uid differs from the entry's own.
      The last is the one an implementer omits, and the one §12.5 can never surface at
      runtime — it keeps the uid and rewrites only `treeId`, so a typo there changes nothing.
- [ ] Each of M1–M5 has an independent fixture pair against a `map.yaml`. M2's failing
      fixture claims a tile twice **within one region**, not across two — the cross-domain
      case is the easy one and the intra-region case is the silent one (T26/F17).
- [ ] M3's failing fixture is a region in two disconnected pieces; a separate fixture
      shaped as a **ring** passes M3, since a hole is contiguous. Asserting both is what
      proves contiguity was not inferred from a loop count.
- [ ] `lst validate content/trees/one-tree.yaml` — a single tree file, no taxonomy file on
      the command line — still runs M1–M5 and still fails on a broken `map.yaml`. This is
      §6.2's read-versus-report rule, and it is the invocation an implementer is most
      likely to get wrong.
- [ ] Rule 13 is exercised with `copyleftDerived` absent (fails) and with it present as
      `false` (passes) — per the rule's own text, CI does not evaluate `true` vs `false`.
- [ ] `lst validate` against a schema-valid, semantically-clean fixture exits 0.
- [ ] `lst validate` against a fixture with only a Layer 1 (schema) violation and no
      Layer 2 violations still reports it — the two layers run in the same pass, not as
      independently invoked stages a caller must chain.
- [ ] `lst ids` against a tree fixture with every `uid:` line omitted fills all of them,
      each 8 characters, each matching Crockford base32's alphabet, and each unique against
      every other uid already present in `content/trees/` at run time.
- [ ] `lst ids` run twice on the same already-filled file makes no further changes
      (idempotent) and exits 0.
- [ ] `lst validate` against a tree with any milestone or mastery entry missing `uid`
      fails, printing the affected slugs.
- [ ] `lst ids` never overwrites an existing `uid` value.
- [ ] `tools/` installs no application dependency — `npm ls --workspace tools svelte`
      returns empty, matching T01's boundary.

## Verification

```bash
npm run --workspace tools test
npx lst validate tools/test/fixtures/validate/**/*.yaml
npx lst ids tools/test/fixtures/ids/draft-no-uids.yaml && cat tools/test/fixtures/ids/draft-no-uids.yaml
```

Passing looks like: every fixture in the suite landing on its expected verdict, all 16
semantic rules and all five taxonomy rules independently exercised, and a re-run of
`lst ids` on an already-id'd file producing no diff.

## Notes and hazards

- **~~Rule 15 quietly requires git/history awareness.~~ RESOLVED by T26/F7, 2026-08-05, and
  this note's suspicion was correct.** The rule split along the line between "answerable
  from the working tree" and "needs history". What stays here is the git-free half — every
  `into` target resolves to a uid in the repository **head**. The historical half is §6.4
  **check 7** and belongs to T23: every entry *appended since the baseline* names a uid
  present in the baseline. `lst validate` is now git-free by construction, so there is no
  git-diffing machinery to duplicate. Rule 16 (missing uid) was added by T26/F25; the count
  is now **16** semantic rules plus M1–M5.
- **~~The new rule 15 is not implementable until T26/F21 lands.~~ RESOLVED by T26/F21,
  2026-08-05.** §5.4 now carries the grammar table and rule 15 branches on `op`:

  | `op` | `into` | Targets | Target form |
  |---|---|---|---|
  | `split` | required | ≥ 2 | bare uid, **this** tree |
  | `merged` | required | exactly 1 | bare uid, **this** tree |
  | `retired` | absent or `[]` | 0 | — |
  | `moved` | required | exactly 1 | `<treeId>/<uid>`, a **different** tree, uid **equal to the entry's own** |

  Three checks are easy to drop and each is silent if dropped. **Cardinality**: `split` with
  `into: []` passes a resolution-only check while disposing of nothing. **The uid equality on
  `moved`**: §12.5 keeps the uid and rewrites `treeId`, so a mistyped uid in the qualified
  half changes nothing at runtime and is invisible forever. **The same-tree constraint on
  `split`/`merged`**: the fold's working set is per-tree, so a foreign successor produces a
  record invisible in both trees. Only the resolution half needs the whole repository — the
  rest is answerable from the entry alone, which is why F7 could leave this half here.
  This rule is the only gate in front of T04's `manifest.moved` map and T17's re-homing pass,
  neither of which can report a malformed target usefully at runtime.
- **M1–M5 are new here, and M3 is the one with a wrong shortcut.** Contiguity is a
  connectivity pass over tile adjacency. Do **not** infer it from §10.4's loop count: a
  region with a hole and a region in two disconnected pieces both produce two closed loops,
  and §10.4's warning is now explicitly scoped to holes because M3 rejects disconnection
  first (T26/F17). M2's multiset scope matters for the same reason — the intra-region
  duplicate is the silent case, since §10.4 discards both copies of every doubled edge and
  the tile vanishes from the outline with the path still closed.
- **~~T26/F25 is open and lands squarely here.~~ RESOLVED by T26/F25, 2026-08-06.** Rule 16
  gates missing uids in `lst validate`; `lst ids` fills them in place and does not gate CI.
- **D-05, dual identifiers.** `id` is mutable and unique within the tree; `uid` is
  immutable and unique across the whole repository. This task is what makes both halves
  of that guarantee real: schema (T02) cannot express repository-wide uniqueness, so rule
  2 and `lst ids`'s collision check are the only place it is enforced.
- **R-03 — semantic redefinition under a stable uid is explicitly unenforceable by any
  mechanism**, including this one. Do not attempt to detect "this milestone means
  something different now" — the spec is clear this is a review judgment, not a tool's.
- `any` vs `n_of: n: 1` (§5.6) stays as authored spelling through validate — the
  normalization to a single rule kind is T04's compiler's job (§7.3), not this task's.
  Validating an `any` group should treat it exactly like `n_of: n: 1` for rule 7's bound
  check, without rewriting it.


## T26 amendments — 2026-08-06

**F25 — rule 16 is yours, and it settles the check/fix split this doc had inferred.**
§6.2 gains rule 16: every milestone and mastery entry carries a `uid`. `lst validate` is
the gate; `lst ids` **stops gating** (§6.1) and is the fix — a subcommand that rewrites its
input cannot be the gate that rejects it. This is now spec, not an inference from two
sentences.

**It must not be a layer-1 `required` field, and that is the part to get right.** §5.4's
authoring flow has the author write a complete tree with *no `uid` lines at all*, then run
`lst ids`. A schema requiring `uid` would reject that draft before `lst ids` could parse
it. Layer 1 still constrains the shape of a uid that is present. Rule 2 does not cover
this either: repository-wide uniqueness ranges over the uids that exist and is silent
about the ones that do not, so a tree with every uid missing passes rule 2 trivially.

§6.7's authoring flow now leads with `lst ids` for the same reason.
