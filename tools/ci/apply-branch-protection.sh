#!/usr/bin/env bash
#
# The half of §6.5 that is a repository setting rather than a file.
#
# `ci.yml` can run the gates. It cannot make them *required*, and an unrequired
# gate is a suggestion: a red check on a PR that anyone can merge anyway. Two
# settings here are load-bearing rather than tidy:
#
#   - **`strict: true`** — "require branches to be up to date before merging".
#     §6.4 checks 5 and 6 are unsound against a stale branch (T26/F6). Two PRs
#     in flight can each bump one tree 4 → 5 and each pass, leaving `main` with
#     a version 5 that is not the 5 that shipped — and §12.5's `>` guard then
#     skips that migration for every user who already saw the first. The failure
#     is a silently-skipped content migration that no later gate can see.
#   - **`content: compile` in the required list.** A *skipped* required check
#     counts as passing. `app: build` skips on a content-only PR by design, so
#     if the compile gate rode on it (as it did before T26/F24) a content PR
#     would be green having compiled nothing.
#
# `content: lint` is deliberately absent. It is advisory (D-15), and requiring
# it would gate a merge on findings that are explicitly not merge-blocking.
#
# Usage:
#   gh auth login                       # once, as the repository owner
#   tools/ci/apply-branch-protection.sh [owner/repo] [--reviews N]
#
# With no repo argument it reads `origin`. `--reviews N` additionally requires N
# approving reviews; leave it off for a solo maintainer, for whom F42's two
# review rounds are recorded in each tree's `provenance` block and checked by
# `lst validate` / `lst status`, not by GitHub's review UI.
set -euo pipefail

repo=""
reviews=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reviews) reviews="$2"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) repo="$1"; shift ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) is required: https://cli.github.com" >&2
  exit 1
fi

if [[ -z "$repo" ]]; then
  repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
fi

# Exactly §6.5's seven gating jobs, by the `name:` each job carries in ci.yml.
# These strings are the check names branch protection matches on; renaming a job
# without renaming it here silently un-requires that gate.
checks=(
  'content: validate'
  'content: baseline'
  'content: status'
  'content: compile'
  'app: typecheck'
  'app: test'
  'app: build'
)

# Node rather than python3 or hand-rolled quoting: the check names contain a
# colon and a space, and this repository already requires Node.
contexts=$(printf '%s\n' "${checks[@]}" | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () =>
    console.log(JSON.stringify(input.split("\n").filter((line) => line.length > 0))),
  );
')

review_block='null'
if [[ "$reviews" -gt 0 ]]; then
  review_block=$(printf '{"required_approving_review_count": %d, "dismiss_stale_reviews": true}' "$reviews")
fi

payload=$(cat <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ${contexts} },
  "enforce_admins": false,
  "required_pull_request_reviews": ${review_block},
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
)

echo "Applying branch protection to ${repo}:main"
echo "$payload" | gh api -X PUT "repos/${repo}/branches/main/protection" --input -

echo
echo "Required checks now:"
printf '  - %s\n' "${checks[@]}"
echo
echo "Not required, and deliberately so: 'content: lint' (advisory, D-15)."
echo "Pages must also be set to 'GitHub Actions' as its source under Settings → Pages."
