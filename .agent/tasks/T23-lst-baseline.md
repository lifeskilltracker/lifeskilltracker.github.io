# T23 — `lst baseline` — breaking-change detection

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | cli-toolchain |
| **Blocked by** | T03, T04 |
| **Blocks** | T25 |
| **Spec** | ARCHITECTURE §6.4, §5.4 |
| **PRD** | D-05 |

## Goal

`tools/src/baseline/` exists and is wired into the `lst` CLI as `lst baseline`. It checks
out the tree files as they existed at the baseline ref and runs all four §6.4 checks
against the current working tree, comparing uids, slugs, and `lineage` entries between the
two. After this task, a PR that silently drops a uid, reassigns one to a different
milestone, reuses a retired slug, or renames a slug without recording an alias is
mechanically caught — the identifier guarantees §5.4 describes in prose become an
enforced invariant rather than a convention contributors are trusted to follow.

## Why this shape

This is Buf's `breaking --against '.git#tag=vN'` pattern, applied to content instead of
protobuf, and the architecture explicitly borrows Buf's framing for how to present it to
reviewers: *the tool mechanically identifies breaking changes so the humans can spend
their attention on whether to allow them.* **D-05** is why this job has to exist at all —
milestone identifiers are simultaneously in-file references, user-state keys, and export
keys with no server and no telemetry to detect breakage after the fact (**D-17**), so the
only place stability can be enforced is at the PR boundary, mechanically, before a bad
change ever reaches a user's browser. The baseline is `main` specifically because merging
to `main` **is** publication (§16.1, **D-12**) — there is no staging environment and no
release train, so the moment a uid lands on `main` is the first moment a real user could
have progress keyed against it, and that is precisely the moment this job starts
protecting it.

## Scope

**In scope**

- `lst baseline` subcommand implementing all four checks in §6.4's list, comparing the
  tree files as of the baseline ref against the current working tree.
- Baseline ref resolution defaulting to `main`, overridable via a CLI flag so the checks
  can be exercised locally against an arbitrary ref in tests.
- Check 4's auto-fix: computing the patch that adds a changed slug's old value to
  `aliases`, since §6.4 explicitly calls this the one check "CI can auto-fix by pushing a
  commit to the PR" — the patch-generation logic belongs here even though actually pushing
  it in CI is T25's concern (see hazards).
- The no-baseline-history case: a tree that has never been merged has no prior state to
  diff against, and per §6.4 must pass trivially so an author can "iterate freely across
  review rounds — reordering, renaming, splitting, deleting — with no ledger entries."
- Gate behaviour: nonzero exit when any of checks 1–3 fail on an unfixed violation.

**Out of scope**

- `lst validate`'s semantic rule 15 (a `lineage` entry references a uid that existed in
  the published tree) — T03. That rule checks a single file's internal consistency about
  its own lineage claims; this task's checks 1–3 are the complementary direction, checking
  that nothing the baseline knew about has silently vanished from the head. The two need
  "what was previously published" but should not duplicate the git-comparison machinery —
  see hazards for the ownership question this creates.
- `lst lint`, `lst status`, `lst new` — T22. `lst compile` — T04.
- Actually pushing the check-4 auto-fix commit to the PR branch, and any other CI
  credential or workflow wiring — T25 owns `.github/workflows/` and the job graph of §6.5.
  This task produces the fix; T25 applies it in CI.
- Git tag creation or any release-tagging mechanism — not described anywhere in the
  architecture as a tool this task builds; see the ambiguity flagged below.
- Detecting semantic redefinition under a stable uid — **R-03** is explicit that no
  mechanism can catch this; do not attempt it here or anywhere else.

## Deliverables

```
tools/src/baseline/index.ts       orchestrates the 4 §6.4 checks against a baseline ref
tools/src/baseline/diff.ts        git-based tree-file diffing: baseline ref vs. working tree
tools/src/baseline/checks.ts      the 4 checks
tools/src/baseline/autofix.ts     alias auto-fix patch generation (check 4)
tools/src/baseline/index.test.ts
tools/test/fixtures/baseline/     paired baseline/head fixture corpora, one per check
```

## Interface contract

The `lst` table row this task owns, copied verbatim from §6.1:

| Command | Purpose | Gates? |
|---|---|---|
| `lst baseline` | uid immutability vs. last release tag (§6.4) | **yes** |

The four checks, copied verbatim from §6.4:

> On every PR it checks out the tree files as of the **last release tag**, and compares:
>
> 1. Every `uid` present in the baseline still exists in the head, **or** appears in
>    `lineage` with a disposition.
> 2. No `uid` has been reassigned to a different milestone.
> 3. No retired slug has been reused by a different `uid`.
> 4. Every slug that changed has its old value in `aliases`. This one CI can auto-fix by
>    pushing a commit to the PR.
>
> This is Buf's `breaking --against '.git#tag=vN'` pattern, applied to content rather than
> protobuf. Buf's own framing is the right one to give reviewers: the tool mechanically
> identifies breaking changes so the humans can spend their attention on whether to
> *allow* them.
>
> **The baseline is `main`**, because merging deploys (§16.1) and therefore merging
> publishes. A tree that has never been merged has no baseline uids at all, so an author
> may iterate freely across review rounds — reordering, renaming, splitting, deleting —
> with no ledger entries. Its uids freeze at the moment of merge, which is precisely the
> moment a user can first have progress against them.

The `lineage` ledger shape checks 1–3 compare against, copied verbatim from §5.4:

```yaml
lineage:
  - uid: q4np8w2r
    op: split
    into: [m3xk90ab, v8t2ncq5]
    note: "separated tapering from bending (2027-03)"
  - uid: b7ldk3fp
    op: merged
    into: [z2vr65jm]
  - uid: h8dq37nc
    op: retired
    note: "duplicated c5fj92tk"
  - uid: c5fj92tk
    op: moved
    into: [bladesmithing/c5fj92tk]
```

## Acceptance criteria

- [ ] Each of the four checks has a fixture pair (baseline state + head state) that
      violates only that check and fails, and a pair that changes the same thing correctly
      (with a `lineage` disposition or an `aliases` entry, as applicable) and passes.
- [ ] Check 1: a uid present in the baseline and absent from the head with no `lineage`
      entry naming it fails; the same removal with a `lineage` entry giving it a
      disposition (`split` / `merged` / `retired` / `moved`) passes.
- [ ] Check 2: a uid whose slug, title, and position all change but which still refers to
      "the same" milestone passes (uid stability under revision is the whole point of
      D-05); a uid that reappears attached to a materially different milestone slug with
      no lineage `split`/`moved` entry fails.
- [ ] Check 3: a fixture where a retired slug (per a `lineage` `retired` entry) is reused
      by a *different* uid in the head fails.
- [ ] Check 4: a fixture where a milestone's `id` changed between baseline and head with
      no corresponding `aliases` entry fails; the same change with the old slug recorded
      in `aliases` passes.
- [ ] `lst baseline --fix` (or equivalent) against a check-4-only violation produces a
      patch that adds the missing `aliases` entry, verifiable by inspecting the patched
      file; `lst baseline` without the fix flag still reports the violation and exits
      nonzero.
- [ ] A tree fixture with no baseline state at all (simulating a tree that has never been
      merged to `main`) passes trivially with no findings.
- [ ] `lst baseline` exits nonzero when any of checks 1–3 fail unfixed, and exits 0 when
      all four checks pass.
- [ ] The baseline ref is overridable via a CLI flag, exercised in tests against a
      constructed git fixture rather than the real `main`.

## Verification

```bash
npm run --workspace tools test
npx lst baseline --against main
```

Passing looks like: all four checks independently exercised with both a failing and a
passing fixture, the no-baseline-history case passing trivially, and the auto-fix path
producing a verifiable patch without being required to actually land it.

## Notes and hazards

- **T26 F8 (2026-08-05) adds a fifth check to this job, and a blocker.** §6.4 now also
  requires that every tree whose **compiled output** differs from the baseline has a higher
  `contentVersion`: compile both sides, elide the field, compare the remaining bytes, fail
  if they differ and it did not increase, printing the value to paste. This task therefore
  gains **T04** as a blocker — it needs `lst compile`. The companion writer is the new
  `lst version` subcommand (§6.1), which belongs here rather than with T03's `lst ids`
  because it consumes the same baseline comparison. Note F6 (which ref the baseline is) and
  F7 (who owns the comparison primitive) are still **open** in T26 — do not resolve them here.

- **§6.4 names two different things as "the baseline" and does not reconcile them.** The
  section opens with "it checks out the tree files as of the **last release tag**" and
  closes with "**the baseline is `main`**, because merging deploys… therefore merging
  publishes." These are the same ref only if every merge to `main` is also tagged as a
  release — and no such tagging mechanism appears anywhere else in the architecture; §16.1
  and §16.2 describe merge-to-`main` as the entire release process, with two version
  counters (`contentVersion`, app semver) but no git tag step. Implement against `main`
  itself (the branch, at the PR's merge-base) as the operative baseline, since that is the
  reading §6.4 gives its own dedicated justification for — but this is a genuine spec gap,
  not a resolved ambiguity, and should be called out explicitly if a real release-tagging
  scheme is introduced later, since it would change what ref this task diffs against.
- **Overlap with T03's validate rule 15.** Both this task and rule 15 need to answer "what
  did the published tree look like." The architecture assigns rule 15 to `lst validate`
  (§6.2) and the four checks here to `lst baseline` (§6.4) without saying whether they
  share an implementation. Do not let this task and T03 each grow an independent
  git-history reader; if T03 is built first, this task should reuse whatever comparison
  primitive it introduced rather than duplicating it.
- **R-03 remains out of scope everywhere.** These four checks are structural bookkeeping —
  uid/slug identity — not a judgment about whether a milestone still means the same thing.
  A milestone that silently changed meaning under a stable uid passes every check here by
  design; that is an accepted, documented limitation (R-03), not a gap this task should
  try to close.
- The check-4 auto-fix commit requires CI push credentials to actually land — that
  workflow wiring belongs to T25. This task's job ends at producing a correct, applicable
  patch.
