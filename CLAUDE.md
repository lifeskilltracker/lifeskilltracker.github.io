# CLAUDE.md — Life Skill Tracker

Project instructions for agent-assisted work in this repository.

## Stack

TypeScript (`strict: true`), Svelte 5 (runes), SvelteKit 2, Vite 8, npm workspaces (`app/`, `tools/`). See `docs/ARCHITECTURE.md` for normative design.

## Svelte 5 runes (required)

Use Svelte 5 rune syntax only. Reference: [svelte.dev/docs/svelte/llms.txt](https://svelte.dev/docs/svelte/llms.txt)

| Svelte 4 | Svelte 5 |
|---|---|
| top-level reactive `let x = …` | `let x = $state(…)` |
| `$: derived = expr` | `let derived = $derived(expr)` |
| `$: { … }` (reactive block) | `$effect(() => { … })` |
| `export let prop` | `let { prop } = $props()` |
| `createEventDispatcher()` | callback props (`onchange`, etc.) |
| `on:click={fn}` | `onclick={fn}` |

Do not reassign `{#each}` block variables — illegal under runes. Run `npx svelte-check` in `app/` before finishing UI work.

## Repository layout and module boundaries

```
content/   authored YAML — no code, imports nothing
schema/    JSON Schema contracts — imported by both workspaces
tools/     lst CLI (yaml, ajv, commander) — no app dependencies
app/       SvelteKit static app
docs/      PRD, ARCHITECTURE, contributor docs
```

**Allowed imports:** `tools/` → `schema/`; `app/` → `schema/`.

**Forbidden:** `tools/` ↔ `app/`; `content/` → anything.

**App module graph (§14.1):** Pure engines (`lib/types`, `lib/layout`, `lib/scoring`) have no framework, DOM, or I/O. I/O owners: `lib/content` (only content reader), `lib/state` (only user-data writer) — they must not import each other. Cross-subsystem sequences live in `lib/actions` only. Components must not import `lib/state` directly.

## Root scripts

```bash
npm test          # Vitest in all workspaces
npm run typecheck # tsc/svelte-check per workspace
npm run build     # tools compile, then app build
```

Node ≥ 20.19.0 (see `.nvmrc` and root `engines`). ESLint rules for import boundaries are in root `eslint.config.js` (T06/T11a extend it).
