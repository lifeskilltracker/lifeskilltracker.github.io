# T01 — Repository scaffold and toolchain substrate

| Field | Value |
|---|---|
| **Status** | **complete** — 2026-08-07 |
| **Phase** | 0 |
| **Cluster** | substrate-schema |
| **Blocked by** | — |
| **Blocks** | T02 |
| **Spec** | ARCHITECTURE §4.1, §4.2, §4.5 |
| **PRD** | D17, N10 |

## Goal

The repository has the §4.2 directory layout, two npm workspaces (`tools/` and `app/`)
that build and test independently, TypeScript in `strict` mode across both, Vitest
running an empty-but-real suite, and a `CLAUDE.md` carrying the Svelte 5 rune rules. A
developer who clones the repo can run `npm ci && npm test && npm run build` and get three
successes with nothing implemented yet. No content, no schema, no application logic — a
skeleton whose joints are proven.

## Why this shape

Three properties of §4.2's layout are load-bearing and are the reason this is its own
task rather than a side effect of the first real one. **`tools/` declares no direct
application dependencies** — no Svelte, SvelteKit, Vite, or packages from `app/` — so a
Tree Author runs `npm ci --workspace tools` and never installs the renderer stack; Vitest
may still pull Vite transitively as a test-runner internal, which is allowed. This is how
N6 and F40 are satisfied concretely rather than aspirationally.
**`schema/` is the only directory both workspaces import**, which is what stops the
validator and the renderer drifting apart. **`content/` contains no code and imports
nothing**, which is what would make splitting it into its own repository a mechanical
move rather than a rewrite. A scaffold that gets the dependency direction wrong here is
expensive to correct once twenty files exist.

## Scope

**In scope**

- Root `package.json`: workspaces, scripts only, no runtime dependencies; root `lint`
  runs ESLint.
- `tools/` workspace — direct deps limited to `yaml`, `ajv`, `commander` (plus test/tooling
  devDependencies such as Vitest and TypeScript). The `lst` bin entry wired but
  implementing nothing. No direct Svelte, SvelteKit, Vite, or `app/` dependency; Vitest's
  transitive Vite is test-runner internals only.
- `app/` workspace — SvelteKit 2 with `adapter-static`, Svelte 5 (runes), Vite 8.
- The full §4.2 directory tree, with `.gitkeep` where a directory is empty.
- `tsconfig` with `strict: true`, shared base extended by both workspaces.
- Vitest configured in both workspaces, each with one passing placeholder test.
- `svelte-check` runnable in `app/`.
- ESLint with `no-restricted-imports` scaffolded but rules empty — §14.1's forbidden
  edges get their real entries when the modules they govern exist. **T06** and **T11a**
  add disjoint rule slices to this same root file; agents editing it must serialize.
- Node version pinned in `engines` and in `.nvmrc`.
- `CLAUDE.md` at the repository root.
- `.gitignore` additions: `app/build/`, `app/.svelte-kit/`, `node_modules/`,
  `app/static/content/`, and `tools/dist/` — compiled JSON and CLI build output are build
  artifacts and §4.3 says compiled JSON is not committed.

**Out of scope**

- Every schema file and the type generation script — T02.
- Any `lst` subcommand implementation — T03 onward.
- GitHub Actions workflows. A minimal typecheck-and-test workflow is tempting here, but
  the job graph is specified as a whole in §6.5 and belongs to T25; adding a partial one
  now means writing it twice.
- The bundle-budget check of §17.1 — T25.
- Taxonomy content — T02 seeds domains and facets; T12 owns `map.yaml`.

## Deliverables

```
package.json                 workspace root; scripts only, no runtime deps
tsconfig.base.json           strict: true, shared
.nvmrc                       Node 20 LTS or newer
CLAUDE.md                    Svelte 5 rune rules, llms.txt reference, layout notes
tools/package.json           deps: yaml, ajv, commander — and nothing from app/
tools/src/cli.ts             the `lst` entry point; subcommands stubbed
tools/vitest.config.ts
app/package.json
app/svelte.config.js         adapter-static, paths.base from env, fallback: '404.html'
app/vite.config.ts           Vite 8 / Oxc — see hazards
app/src/app.html
app/src/routes/+layout.ts       prerender flag owner
app/src/routes/+layout.svelte
app/src/routes/+page.svelte  placeholder
app/static/.nojekyll         empty file; omitting it silently breaks the build
app/vitest.config.ts
eslint.config.js             flat config; no-restricted-imports present, rules empty
content/trees/.gitkeep  content/taxonomy/.gitkeep  schema/.gitkeep  docs/  .github/workflows/.gitkeep
```

## Interface contract

The workspace boundary is the contract this task establishes, and it is enforced by
dependency declaration rather than by convention:

```
tools/  →  schema/          allowed
app/    →  schema/          allowed
tools/  →  app/             FORBIDDEN — tools declares no application dependencies
app/    →  tools/           FORBIDDEN
content/ →  anything        FORBIDDEN — content imports nothing
```

Root scripts that every later task depends on existing:

```json
{
  "test": "npm run test --workspaces",
  "typecheck": "npm run typecheck --workspaces",
  "lint": "eslint .",
  "build": "npm run compile --workspace tools && npm run build --workspace app"
}
```

## Acceptance criteria

- [x] `npm ci` at the root installs both workspaces without error.
- [x] `npm ci --workspace tools` succeeds with **no direct** Svelte, SvelteKit, Vite, or
      `app/` dependency — verify with `npm pkg get dependencies --workspace tools` and
      `npm ls --workspace tools svelte @sveltejs/kit` returning empty.
- [x] `npm test` runs Vitest in both workspaces and passes.
- [x] `npm run typecheck` passes; `tsconfig.base.json` sets `strict: true` and neither
      workspace overrides it to false.
- [x] `npm run build --workspace app` produces `app/build/` containing `.nojekyll`.
- [x] `npx svelte-check` runs in `app/` and reports zero errors.
- [x] `npm run compile --workspace tools` then `npm exec --no lst -- --help` (local project
      binary only — do not use bare `npx lst`, which can fetch an unrelated public package)
      prints usage containing `Life Skill Tracker content toolchain` and exits 0.
- [x] `node --version` satisfies the `engines` field, and `engines` requires >= 20.19.0.
- [x] The §4.2 tree exists in full; no directory from the spec is missing. *(Grok spec-compliance
      review, Session 9.)*
- [x] `app/static/content/` is gitignored. *(Grok spec-compliance review, Session 9.)*
- [x] `CLAUDE.md` states the Svelte 4 → 5 rune mapping explicitly and links
      `svelte.dev/docs/svelte/llms.txt`. *(Grok spec-compliance review, Session 9.)*
- [x] `eslint.config.js` loads and runs clean.

## Verification

```bash
npm ci && npm test && npm run typecheck && npm run lint && npm run build
npm pkg get dependencies --workspace tools   # ajv, commander, yaml only
npm ls --workspace tools svelte @sveltejs/kit # must find nothing
npm run compile --workspace tools
npm exec --no lst -- --help | grep -F 'Life Skill Tracker content toolchain'
```

**Verified 2026-08-07 under Node 20.20.2** (Session 9, worktree
`navigator-task-kickoff`, branch `agent/navigator-task-kickoff`; no commit yet):

| Check | Result |
|---|---|
| `npm ci` | pass — `prepare` built and linked local `lst` |
| `npm test` | pass — app 4/4, tools 2/2 |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run build` | pass — `app/build/` contains `index.html`, `404.html`, `.nojekyll` |
| `npm run check --workspace app` | pass — svelte-check 0 errors, 0 warnings |
| `npm pkg get dependencies --workspace tools` | exactly `ajv`, `commander`, `yaml` |
| `npm ls --workspace tools svelte @sveltejs/kit` | empty |
| `node_modules/.bin/lst` | resolves to `tools/dist/cli.js`; `--help` shows *Life Skill Tracker content toolchain* |
| `git diff --check` | pass |
| Grok T01 review | SPEC COMPLIANCE APPROVED, CODE QUALITY APPROVED |

## Notes and hazards

These are recorded in §4.5 precisely because they cost time when rediscovered:

- **Vite 8 is Rolldown-based.** esbuild is no longer bundled — `minify: 'esbuild'` and
  the `esbuild:` config key both fail. Oxc is the default minifier and the config key is
  `oxc:`. CI must install optional native dependencies correctly.
- **Node 18 and early Node 20 releases are too old** for Vite 8 and ESLint 10. Pin Node
  20.19.0+ (`.nvmrc` uses current 20 LTS) in `engines` and CI.
- **Any Vite recipe dated 2024 or earlier is likely stale** on both points above.
- **SvelteKit 2, not 3.** SvelteKit 3 is in preview; the spec targets 2 through v1 and
  migrates later in a dedicated PR with no content changes in flight. Tracked as **R-01**.
- **R-02 — agent-generated Svelte 4 syntax.** The documented failure mode is top-level
  `let` instead of `$state`, `$:` instead of `$derived`, and reassigning `{#each}` block
  arguments, which is illegal under runes. The mitigation is threefold and cheap, and two
  thirds of it lands in this task: `CLAUDE.md` referencing `llms.txt` and stating the
  mapping, plus `svelte-check` available to run. The third part — making it a hard CI
  gate — is T25.
- `.nojekyll` is not optional. GitHub Pages' Jekyll step strips `_`-prefixed directories,
  which silently breaks every Vite build (§4.4).
- `kit.paths.base` reads from an environment variable so a future custom domain is a
  config change, not a code change.
- **`lst` registry-name collision.** The workspace bin is `@life-skill-tracker/tools`'s
  `lst`; bare `npx lst` may download an unrelated npm package. Always invoke the local
  binary (`npm exec --no lst -- …` after compile, or `node tools/dist/cli.js`).
