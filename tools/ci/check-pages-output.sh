#!/usr/bin/env bash
#
# §4.4's GitHub Pages constraints, checked against the build output rather than
# against `svelte.config.js`.
#
# T01 configured `adapter-static` and `paths.base`; this is not a re-audit of
# that file. It is the difference between "the config says so" and "the artifact
# we are about to publish has it", which for two of these four is a difference
# with teeth:
#
#   - **`.nojekyll`** — Jekyll strips `_`-prefixed directories, and every Vite
#     build puts its JavaScript in `_app/`. Without this file the deployed site
#     is a working HTML shell that 404s on every script it asks for. Nothing
#     upstream fails; it just breaks in production.
#   - **`404.html`** — no server, so a deep link is a 404 by definition. The
#     adapter's fallback is what turns that into the app.
#
# The other two §4.4 rows are not checkable here: `kit.paths.base` is asserted
# by the deploy workflow (which is what sets it), and asset caching is a client
# concern, asserted by `lib/content`'s manifest revalidation test.
#
# Usage: check-pages-output.sh [build-dir]
set -euo pipefail

build="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/app/build}"

if [[ ! -d "$build" ]]; then
  echo "§4.4: no build directory at ${build} — run \`npm run build\` first." >&2
  exit 1
fi

failed=0

require() {
  local path="$1" why="$2"
  if [[ ! -f "${build}/${path}" ]]; then
    echo "§4.4: missing ${path} in ${build} — ${why}" >&2
    failed=1
  fi
}

require ".nojekyll" "Jekyll would strip _app/ and the deployed site would 404 on every script."
require "404.html" "adapter-static's fallback is what makes deep links work without a server."
require "index.html" "the map route is prerendered; without it there is no entry point to serve."

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "§4.4 holds: .nojekyll, 404.html and index.html are present in ${build}"
