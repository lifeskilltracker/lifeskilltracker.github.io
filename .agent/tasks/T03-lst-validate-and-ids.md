# T03 — `lst validate` and `lst ids`

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | cli-toolchain |
| **Blocked by** | T02 |
| **Blocks** | T04, T05, T22, T23 |
| **Spec** | ARCHITECTURE §6.1, §6.2, §5.4 |
| **PRD** | F40, F41, F45 |

## Goal

`tools/src/validate/` and `tools/src/ids/` exist and are wired into the `lst` CLI
(`tools/src/cli.ts`, stubbed by T01) as `lst validate [files…]` and `lst ids [files…]`.
After this task, a tree YAML file can be checked in one pass against both the JSON Schema
layer (T02's `schema/*.json`, via Ajv) and the 15 semantic rules of §6.2 that JSON Schema
cannot express, with every violation reported with file, line, and column rather than
stopping at the first. `lst ids` fills in every missing `uid:` in a drafted tree in place,
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
  15 semantic rules in §6.2's table, run in one pass per invocation.
- Error reporting that accumulates every violation found — schema and semantic — into one
  report with file, line, and column, rather than exiting on the first (§6.1).
- Semantic rule 2's repository-wide uid-uniqueness check, which requires reading every
  tree in `content/trees/`, not just the file(s) passed on the command line.
- `lst ids [files…]`: assigns a missing `uid:` to every milestone and mastery entry that
  lacks one, writing the value back into the YAML file in place; 8-character Crockford
  base32, checked for uniqueness against every existing uid in the repository before it is
  written.
- `lst ids`'s gate behaviour: after running, any milestone still without a `uid` (e.g. the
  tool was not run, or was run and then the file was hand-edited to remove a value) is a
  hard failure — §6.1 marks this row "**yes** (missing uid fails)".
- CLI plumbing shared by later subcommands (`lst lint`, `lst status`, `lst baseline`,
  `lst compile` in T22/T23/T04): consistent exit-code convention, consistent
  file-argument handling, consistent error-report shape, so those tasks extend rather than
  reinvent the pattern.

**Out of scope**

- `lst lint`, `lst status`, `lst new` — T22.
- `lst baseline` — T23. In particular, the git-history comparison against the baseline
  (last release tag / `main`, §6.4) that answers "did an existing uid disappear" belongs
  to T23, not to this task.
- `lst compile` and the YAML→JSON transformations of §7.3 — T04. Validate only checks
  correctness; it emits no compiled artifact.
- The full schema definitions and their generated TypeScript — T02. This task consumes
  `schema/*.json`, it does not author it.
- Applying `lineage` operations to user state at load time — T17 (§12.5). Rule 15 here
  only checks that lineage entries are internally well-formed, not how the runtime uses
  them.
- Auto-recording a changed slug into `aliases` — that correction is described in §6.4 as
  something "CI can auto-fix by pushing a commit," which is baseline's job (T23), not
  validate's. `lst validate` may *reject* a missing alias if some future rule requires it,
  but it does not write one.

## Deliverables

```
tools/src/validate/index.ts        orchestrates layer 1 (Ajv) + layer 2 (15 rules)
tools/src/validate/schema.ts       Ajv wiring against schema/*.json
tools/src/validate/rules/          one module per §6.2 semantic rule (or logical grouping)
tools/src/validate/report.ts       error accumulation and file:line:column formatting
tools/src/validate/index.test.ts
tools/src/ids/index.ts             uid generation, repo-wide uniqueness check, in-place write
tools/src/ids/crockford.ts         8-char Crockford base32 generator
tools/src/ids/index.test.ts
tools/test/fixtures/validate/      one fixture pair (pass/fail) per semantic rule
```

## Interface contract

The full `lst` command table, copied verbatim from §6.1 — this task owns the first two
gating rows:

| Command | Purpose | Gates? |
|---|---|---|
| `lst validate [files…]` | Schema + semantic rules (F41) | **yes** |
| `lst baseline` | uid immutability vs. last release tag (§6.4) | **yes** |
| `lst lint [files…]` | Advisory coherence and style warnings | no |
| `lst ids [files…]` | Fill missing `uid` values in place | **yes** (missing uid fails) |
| `lst status` | Regenerate `content/REVIEW-STATUS.md` | **yes** (drift fails) |
| `lst compile` | YAML → JSON bundles + manifest (§7) | **yes** (build step) |
| `lst new <id>` | Scaffold a tree skeleton from a template | no |

> `lst validate` reports every error it can find in one pass with file, line, and column,
> rather than stopping at the first. A contributor iterating against a validator that
> surfaces one error per run will abandon the PR. (§6.1)

The 15 semantic rules, copied verbatim from §6.2:

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
| 9 | `track` and `module` references resolve to declared values | F41 |
| 10 | `domain` and every `secondaryDomains` entry exists in `domains.yaml`; primary not repeated in secondary | F18, F41 |
| 11 | `subregion` present iff `domain: making`, and valid | F26, F41 |
| 12 | Every facet exists in `facets.yaml` | F19, F41 |
| 13 | `copyleftDerived` is present and answered | F45 |
| 14 | Mastery entries carry no level, track, order, or requirement group | F5, §5.7 |
| 15 | Every `lineage` entry references a uid that existed in the published tree | §5.4 |

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

- [ ] `lst validate` run against a fixture that violates every one of the 15 semantic
      rules in a single file reports all 15 violations in one invocation, each with file,
      line, and column.
- [ ] Each of the 15 rules has an independent fixture pair: one file that violates only
      that rule and fails, one clean file that passes.
- [ ] Rule 2's repository-wide uid uniqueness is exercised across **two** fixture tree
      files sharing a duplicate uid — a single-file fixture cannot prove this rule.
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

Passing looks like: every fixture in the suite landing on its expected verdict, all 15
rules independently exercised, and a re-run of `lst ids` on an already-id'd file producing
no diff.

## Notes and hazards

- **Rule 15 quietly requires git/history awareness that the rest of validate does not.**
  "References a uid that existed in the **published tree**" means *the state of the tree
  as previously merged*, which is exactly the kind of baseline comparison §6.4 assigns to
  `lst baseline` (T23). The architecture does not say whether rule 15 is checked against
  git history from within `lst validate` itself, or whether it is really a re-statement of
  one of baseline's four checks placed in the wrong table. Do not duplicate the
  git-diffing machinery between this task and T23's; if `lst validate` needs to answer
  "did this uid exist in the last published tree" it should call into whatever baseline
  comparison T23 builds, not reimplement it. Flagging rather than resolving — this is
  exactly the kind of boundary call an implementer needs to make once T23 exists.
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
