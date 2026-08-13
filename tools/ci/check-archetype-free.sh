#!/usr/bin/env bash
#
# §14.7 / S1 — the renderer, the layout engine, and the scoring engine must not
# know a skill's shape.
#
# D-07 resolves D3 with one component and no per-archetype shells: by the time
# data reaches the renderer, a linear skill, a branching skill, and a
# choice-based skill are the same shape of data with different values (§9.1).
# That is a claim about the code, and this is the one line that keeps it true.
#
# Reviewers: the letter of this check is not its spirit. Reading the field into
# a variable named `mode` and branching on that passes here and still reopens
# D3. Look for behavioural branching on shape, not only for the literal string.
#
# Usage: check-archetype-free.sh [repo-root]
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

directories=(
  "app/src/lib/layout"
  "app/src/lib/scoring"
  "app/src/lib/components"
)

targets=()
for directory in "${directories[@]}"; do
  targets+=("${root}/${directory}")
done

# `grep -r` exits 1 when it finds nothing, which is the passing case here.
if matches=$(grep -rn "archetype" "${targets[@]}"); then
  echo "S1 violated (§9.1, §14.7): the shape field appears in the renderer or an engine." >&2
  echo "${matches}" >&2
  exit 1
fi

echo "S1 holds: no shape branch under $(printf '%s ' "${directories[@]}")"
