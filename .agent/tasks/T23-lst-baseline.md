# T23 — `lst baseline` — breaking-change detection

| Field | Value |
|---|---|
| **Status** | complete — 2026-08-15 |
| **Phase** | 1 |
| **Cluster** | cli-toolchain |
| **Blocked by** | T03, T04 |
| **Blocks** | T25 |
| **Spec** | ARCHITECTURE §6.4, §5.4 |
| **PRD** | D-05 |

## Goal

`tools/src/baseline/` exists and is wired into the `lst` CLI as `lst baseline`. It checks
out the tree files as they existed at the baseline ref and runs all **eight** §6.4 checks
against the PR merged into it, comparing uids, slugs, `contentVersion`, and `lineage`
entries between the two. After this task, a PR that silently drops a uid, reassigns one to a different
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

- `lst baseline` subcommand implementing all **eight** checks in §6.4's list — 1–4 as
  originally written, 5 (`contentVersion` bump, T26/F8), 6 (ledger prefix, T26/F14), 7
  (appended lineage entries name baseline uids, T26/F7), and 8 (baseline tree ids are a
  subset of head ids — trees never removed or renamed, T26/F22).
- Baseline ref resolution defaulting to the tip of **`origin/main`**, with the head being
  the PR merged into it — **not the merge-base** (T26/F6; see hazards for why that reading
  is unsound). Overridable via a CLI flag so the checks can be exercised locally against an
  arbitrary ref in tests.
- Failing loudly when the baseline ref cannot be resolved. §6.4 requires `fetch-depth: 0`
  because `actions/checkout`'s default depth-1 clone has no `origin/main` at all, at which
  point every check silently passes on nothing. That must be an error, not a skip.
- Check 4's auto-fix: computing the patch that adds a changed slug's old value to
  `aliases`, since §6.4 explicitly calls this the one check "CI can auto-fix by pushing a
  commit to the PR" — the patch-generation logic belongs here even though actually pushing
  it in CI is T25's concern (see hazards).
- The no-baseline-history case: a tree that has never been merged has no prior state to
  diff against, and per §6.4 must pass trivially so an author can "iterate freely across
  review rounds — reordering, renaming, splitting, deleting — with no ledger entries."
- Gate behaviour: nonzero exit when any of checks 1–3 fail on an unfixed violation.

**Out of scope**

- `lst validate`'s semantic rule 15 — T03, and **T26/F7 rewrote the boundary in this task's
  favour, 2026-08-05.** Rule 15 is now the git-free half only (an entry's `into` targets
  resolve to a uid in the head). Everything needing history is here, including the half that
  moved: **check 7**. `lst validate` performs no git operation at all, so there is no
  duplicated comparison machinery and no ownership question left.
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
| `lst baseline` | uid immutability vs. `main` (§6.4) | **yes** |

The checks, copied verbatim from §6.4. Checks 5–8 were added by T26 (F8, F14, F7, F22) and are
reproduced in the hazards below rather than here:

> On every PR it checks out the tree files as of the **baseline** — the tip of
> `origin/main` — and compares the PR **merged into it**:
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
> publishes. Precisely: the tip of `origin/main`, against the PR merged into it — not the
> merge-base, which is unsound for checks 5 and 6 the moment two PRs are in flight. The
> price is one repository requirement: **a branch must be up to date with `main` before it
> merges**. The job must also check out enough history to resolve `origin/main`
> (`fetch-depth: 0`); at depth 1 checks 1–8 do not error, they pass on nothing.
>
> A tree that has never been merged has no baseline uids at all, so an author may iterate
> freely across review rounds — reordering, renaming, splitting, deleting — with no ledger
> entries. Its uids freeze at the moment of merge, which is precisely the moment a user can
> first have progress against them.

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

- [x] Each of the eight checks has a fixture pair (baseline state + head state) that
      violates only that check and fails, and a pair that changes the same thing correctly
      (with a `lineage` disposition or an `aliases` entry, as applicable) and passes.
- [x] Check 1: a uid present in the baseline and absent from the head with no `lineage`
      entry naming it fails; the same removal with a `lineage` entry giving it a
      disposition (`split` / `merged` / `retired` / `moved`) passes.
- [x] Check 2: a uid whose slug, title, and position all change but which still refers to
      "the same" milestone passes (uid stability under revision is the whole point of
      D-05); a uid that reappears attached to a materially different milestone slug with
      no lineage `split`/`moved` entry fails.
- [x] Check 6: a fixture whose head ledger **appends** to the baseline's passes; one that
      inserts an entry in the middle, reorders two entries, or edits an existing entry's
      `op` or `into` fails, naming the position. (T26/F14.)
- [x] Check 7: a fixture whose head **appends** a lineage entry naming a uid that was never
      in the baseline fails. A fixture whose baseline ledger already contains an entry
      naming a uid long since gone from the baseline **passes** — this is the regression
      test for F7's time bomb, and a check that re-evaluates the whole ledger fails it and
      would block every future PR on that tree forever. (T26/F7.)
- [x] A test asserts the baseline resolves to `origin/main`'s **tip**, not the merge-base:
      seed a fixture repo where `main` has advanced past the branch point with a
      `contentVersion` bump on the same tree, and assert check 5 fails. Against the
      merge-base it passes, which is the bug. (T26/F6.)
- [x] A test asserts an unresolvable baseline ref (simulating a depth-1 clone) **errors**
      rather than passing every check vacuously.
- [x] Check 3: a fixture where a retired slug (per a `lineage` `retired` entry) is reused
      by a *different* uid in the head fails.
- [x] Check 4: a fixture where a milestone's `id` changed between baseline and head with
      no corresponding `aliases` entry fails; the same change with the old slug recorded
      in `aliases` passes.
- [x] `lst baseline --fix` (or equivalent) against a check-4-only violation produces a
      patch that adds the missing `aliases` entry, verifiable by inspecting the patched
      file; `lst baseline` without the fix flag still reports the violation and exits
      nonzero.
- [x] A tree fixture with no baseline state at all (simulating a tree that has never been
      merged to `main`) passes trivially with no findings.
- [x] `lst baseline` exits nonzero when any of checks 1–3 fail unfixed, and exits 0 when
      all eight checks pass.
- [x] The baseline ref is overridable via a CLI flag, exercised in tests against a
      constructed git fixture rather than the real `main`.

## Verification

```bash
npm run --workspace tools test
npx lst baseline --against main
```

Passing looks like: all eight checks independently exercised with both a failing and a
passing fixture, the no-baseline-history case passing trivially, and the auto-fix path
producing a verifiable patch without being required to actually land it.

## Notes and hazards

- **T26 F14 (2026-08-05) adds a sixth check: the baseline's `lineage` ledger is a prefix of
  the head's** — same entries, same order, appended to only at the end. §12.5 now folds the
  ledger in file order to compose dispositions across skipped content versions, so an entry
  inserted mid-list, reordered, or edited in place silently changes the migration outcome for
  every user who skipped a version — and checks 1–5 would all pass it. It rides on the
  checkout this job already performs, so it is cheap. It also retroactively secures §12.5's
  `>` comparison, which already assumed prefix-ness without anything guaranteeing it. Like
  check 5, it inherits whatever **F6** settles about which ref the baseline is.

- **The up-to-date-branch requirement is this task's, operationally.** §6.4 now requires
  that a branch be up to date with `main` before it merges — GitHub's "require branches to
  be up to date", or a merge queue. It is the only operational obligation §6 imposes, and it
  exists because checks 5 and 6 are sound against the tip and unsound against the
  merge-base. The repository setting itself is **T25**'s; the reason for it is here.
- **T26 F8 (2026-08-05) adds a fifth check to this job, and a blocker.** §6.4 now also
  requires that every tree whose **compiled output** differs from the baseline has a higher
  `contentVersion`: compile both sides, elide the field, compare the remaining bytes, fail
  if they differ and it did not increase, printing the value to paste. This task therefore
  gains **T04** as a blocker — it needs `lst compile`. The companion writer is the new
  `lst version` subcommand (§6.1), which belongs here rather than with T03's `lst ids`
  because it consumes the same baseline comparison. F6 and F7 have since been **resolved**
  (2026-08-05): the ref is `origin/main`'s tip, and this task owns every comparison needing
  history, including the new check 7.

- **§6.4 names two different things as "the baseline" and does not reconcile them.** The
  section used to open with "it checks out the tree files as of the **last release tag**" and
  closes with "**the baseline is `main`**, because merging deploys… therefore merging
  publishes." These are the same ref only if every merge to `main` is also tagged as a
  release. **RESOLVED by T26/F6, 2026-08-05 — and this note's implementation advice was
  wrong on the second half.** The baseline is `main`: no tagging mechanism appears anywhere
  in the architecture, and a third stray reference (§6.8 forwarding "Release tagging" to
  §16.2) has been removed along with the two this note named. But it is the **tip of
  `origin/main`, compared against the PR merged into it — not the merge-base** this note
  told the implementer to use. Merge-base is unsound the moment two PRs are in flight: two
  branches can each bump one tree's `contentVersion` 4 → 5 and both pass, leaving `main`
  with a version 5 whose compiled output is not the output that shipped as 5, so §12.5's
  `>` guard means every user who already saw 5 never runs the migration for the second
  change — silent, permanent, and undetectable under §16.5's no-telemetry rule. Check 6
  fails identically: two branches each append a ledger entry, both pass, and the merged
  order satisfies neither prefix claim.
- **~~Overlap with T03's validate rule 15.~~ RESOLVED by T26/F7, 2026-08-05.** There is no
  overlap left: `lst validate` is git-free by construction and this task owns every check
  needing history. The historical half of old rule 15 arrived here as **check 7**, and its
  wording matters — it is scoped to entries **appended since the baseline**. Re-evaluating
  the whole ledger looks equivalent and is not: the ledger is append-only and never pruned,
  so a `retired` uid is legitimately absent from the baseline three releases later, and a
  whole-ledger check would fail on that entry forever, permanently blocking every future PR
  on that tree with no author action able to clear it. Check 6's prefix guarantee is what
  makes the appended suffix computable.
- **R-03 remains out of scope everywhere.** These checks are structural bookkeeping —
  uid/slug identity — not a judgment about whether a milestone still means the same thing.
  A milestone that silently changed meaning under a stable uid passes every check here by
  design; that is an accepted, documented limitation (R-03), not a gap this task should
  try to close.
- The check-4 auto-fix commit requires CI push credentials to actually land — that
  workflow wiring belongs to T25. This task's job ends at producing a correct, applicable
  patch.


## T26 amendments — 2026-08-06

**F24.** §6.4 check 5 compiles both sides to compare them. That compile is a **comparison,
not the compile gate** — §6.5's new `content: compile` job is the gate. The redundancy is
deliberate and is recorded in §6.4 because check 5 was briefly the only thing compiling on
a content-only PR: narrowing it to only the trees whose YAML changed is a legitimate
optimisation that must not be able to remove compile coverage as a side effect. If you
narrow it, say so in the PR.

**F22 — new check 8, and it is this task's.** Every tree `id` present in the baseline is
present in the head. Trees are never removed and never renamed (§5.3, §5.4). One set
difference over the two checkouts the job already has.

Three things make this its own check rather than an extension of check 1:

- **The ledger cannot dispose of its own file.** Check 1's escape hatch is "appears in
  `lineage`", and `lineage` is a field of the tree file. Delete the file and there is
  nothing left to read.
- **Checks 1–7 never see a deleted tree.** They are each a diff of one tree against its own
  baseline version, so a tree absent from the head is simply never visited — they do not
  fail, they pass on nothing. Same shape as the `fetch-depth: 1` trap the task already
  guards against, and worth a fixture for the same reason.
- **A rename is the same event with a friendlier trigger** and slips through identically.

State checks 1–7's scope explicitly in the implementation notes: they range over trees
present on both sides; check 8 ranges over the set. The alternative reading — check 1
quantifying over every baseline uid repository-wide — is not merely a different scope but
a wrong one, because a `moved` uid would then satisfy check 1 by existing in its
destination and the `moved` disposition would never be needed at all.

Check 8 is also what makes §6.2 rule 15's "a tree that exists" and the manifest's `moved`
map durable rather than incidental — the map is rebuilt from live tree files every build,
so a deleted source file would silently drop its entries.

Acceptance: a fixture PR deleting a merged tree file fails check 8; a fixture PR renaming
one fails it too; the failure message names the missing id.

## Completion state — 2026-08-15

All twelve acceptance criteria met. `tools/` 264 tests (26 in `baseline/`, 6 in `version/`);
root `npm test`, `npm run typecheck` and `npm run lint` clean.

**`lst version` shipped here too**, per this doc's own F8 hazard note — it consumes the
identical comparison as check 5 (compile both sides, elide the field, diff the bytes) and
would have been a second copy of that machinery anywhere else. It writes; it does not gate.

Deliverables landed as `tools/src/baseline/{index,diff,checks,autofix}.ts` plus
`tools/src/version/index.ts`. The planned `tools/test/fixtures/baseline/` corpus was **not**
created: every fixture pair is built in-test on a real temporary git repository, because each
check is a claim about history and a fixture pair sitting on disk cannot express "the
baseline commit said X". `withGitRepo` does `git init`, commits the baseline, and leaves the
head in the working tree.

Three readings the spec left to the implementer:

- **Check 2 is detectable in exactly one shape**: the uid now carries a slug the baseline
  gave to a *different* uid. The acceptance criterion asks that a uid whose slug, title and
  level all change still pass, and that a uid "attached to a materially different milestone"
  fail — structurally those are the same diff unless the new slug has a prior owner. Anything
  beyond that is **R-03**, which no mechanism can catch and none here tries to.
- **A slug is retired the moment it stops belonging to its uid** — whether the entry was
  removed or renamed with the old value moved to `aliases`. Both are the same event to a deep
  link, which is what §5.4's protobuf `reserved` rule protects.
- **Check 6 compares ledger entries with object keys sorted.** Key order in YAML is not
  meaning, and reformatting `op:` above `uid:` must not read as an edit to a published
  disposition. Array order inside `into` is preserved, since that *is* content.

Two behaviours worth not regressing:

- **The head is the working tree.** In CI that is the merge commit `actions/checkout`
  produces for a PR — the PR *merged into* the baseline, which is what §6.4 asks for, not the
  branch alone. T25 must not switch this to the PR branch ref.
- **An unresolvable ref throws `BaselineUnavailableError` and exits nonzero.** The depth-1
  trap is the reason: at depth 1 every check passes on nothing, and a skipped-looking green
  tick is indistinguishable from a real one at the branch-protection level.

`--fix` applies check 4's patch through the YAML AST and re-runs before deciding the exit
code, so a run that repairs everything it found exits 0. Landing that patch as a commit is
still T25's.
