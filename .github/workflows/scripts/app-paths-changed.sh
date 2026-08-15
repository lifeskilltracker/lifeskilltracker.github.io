#!/usr/bin/env bash
#
# §6.5's path filter, as data for a job-level `if:`.
#
# Prints `app=true` or `app=false` on stdout, for `>> "$GITHUB_OUTPUT"`.
#
# **Why this is not `on.pull_request.paths`.** The two Actions features share
# the name "path filter" and fail in opposite directions. The workflow-level
# form cancels the whole run, so its required checks never report and the PR
# waits in Pending forever. The job-level form reports `skipped`, which is what
# §6.5's graph is drawn against and what branch protection understands.
#
# **What S2 is actually buying.** §6.5 promises a Tree Author a feedback loop of
# validate, baseline, status, compile and the advisory lint, "completing in
# seconds". An outside contributor waiting on `svelte-check` and `vite build` to
# add a YAML file is the friction S2 exists to measure against.
#
# **Erring towards running.** The list below is wider than "app/ and schema/",
# because a false negative here is a broken build merged with a green tick,
# while a false positive is one wasted run. The lockfile, the shared tsconfig,
# the lint config and `tools/` all feed `app: build` — it runs `lst compile`
# before `vite build` — so all of them count as app changes.
set -euo pipefail

# Anything not a pull request (workflow_dispatch, in practice) has no base to
# diff against, and the honest answer there is "run everything".
if [[ -z "${BASE_SHA:-}" || -z "${HEAD_SHA:-}" ]]; then
  echo "no base/head SHA — running the app jobs" >&2
  echo "app=true"
  exit 0
fi

# Fail loudly rather than defaulting. A missing base commit means the checkout
# is shallower than `fetch-depth: 0`, and "no files changed" would then read as
# a content-only PR and skip every app job on an app-only change.
for sha in "$BASE_SHA" "$HEAD_SHA"; do
  if ! git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    echo "commit ${sha} is not in this checkout — is fetch-depth: 0 set?" >&2
    exit 1
  fi
done

changed=$(git diff --name-only "$BASE_SHA" "$HEAD_SHA")
echo "changed files:" >&2
echo "$changed" >&2

app_paths='^(app|schema|tools)/|^\.github/workflows/|^(package\.json|package-lock\.json|tsconfig\.base\.json|eslint\.config\.js|\.nvmrc)$'

if grep -Eq "$app_paths" <<<"$changed"; then
  echo "app=true"
else
  echo "app=false"
fi
