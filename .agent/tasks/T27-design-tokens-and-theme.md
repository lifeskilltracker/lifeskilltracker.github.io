# T27 — Design tokens and theme substrate

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 2 |
| **Cluster** | substrate-schema |
| **Blocked by** | — |
| **Blocks** | T30, T32, T34 |
| **Spec** | UI-SPEC §4.1, §4.2, §4.5, §9 (A4, A7); ARCHITECTURE §5.9, §17.1 |
| **PRD** | D19, F21, N5 |

## Goal

The application has a visual vocabulary where it previously had none. A single token
sheet defines `--paper`, `--ink`, `--rule`, the plate opacities and the eight domain
plate colours in both light and dark, resolved from `content/taxonomy/domains.yaml`
rather than hard-coded in components; a theme resolver honours light, dark and system
with the choice persisted locally; and one subsetted display face is self-hosted and
inside a raised, still-enforced first-paint budget. After this task nothing in the app
names a colour or a font of its own.

## Why this shape

UI-SPEC §4.3 makes hue *identity* and forbids it from ever encoding score, which only
works if hue has exactly one source. `domains.yaml` is already that source — the map
renderer reads its palette today — so the dark variant belongs there (A7) rather than in
a parallel CSS table that would immediately drift. The direction survives both themes as
a token swap (§4.1), which is the property that earned Survey/Ordnance over the rejected
alternatives, and that property is only real if every component consumes tokens and no
component consumes a literal. The display face is affordable only because its glyph set
is closed at roughly forty glyphs (§4.5); the subsetting step is therefore part of this
task, not an optimisation to be done later.

## Scope

**In scope**

- `--paper`, `--ink`, `--rule` and the derived plate opacities (`--plate-open` = 0.52,
  the fog plate at 0.10, the `bonus` plate at 0.42), per §4.2 and §4.6.
- The eight domain plate colours, light and dark, per §4.2's table — including the forced
  hue separations (Mind teal against Work navy, Home blue-green against Outdoors olive).
- **A7** — `domains.yaml`'s `palette` becomes `{ light: { base, accent }, dark: { base,
  accent } }`; `schema/domains.schema.json` updated; the compiler and the manifest carry
  the widened shape through; existing readers migrated.
- Theme resolution: light, dark, `prefers-color-scheme` as the default, an explicit
  choice persisted locally, and no flash of the wrong theme on first paint.
- Display face selection (§12 Q1), subsetting to the closed glyph set, `font-display:
  swap`, and a metric-adjacent fallback stack so the swap does not reflow the map.
- **A4** — `check:budget` gains a font row (~12 kB); the first-paint total rises from
  ≤ 70 kB to ≤ 82 kB and is still enforced by failing.
- The knockout halo primitive (`paint-order: stroke`, 2.8-unit `--paper` stroke) as a
  shared class, since §4.5 makes it the thing that lets type survive the bolder palette.

**Out of scope**

- Applying the tokens to the map, the chrome or the tree — T30, T32, T34 respectively.
  This task ships the vocabulary and proves it renders; it does not restyle a view.
- The `ARCHITECTURE.md` edits for A4 and A7 — **T28** owns every amendment, including
  these two. This task changes code and content; T28 changes the spec.
- Hachure, water lines and milestone-state borders as *drawn geometry* — T30 and T34.
  Only their tokens land here.

## Deliverables

```
app/src/lib/styles/tokens.css          the token sheet, light + dark blocks
app/src/lib/styles/theme.svelte.ts     resolver: light | dark | system, persisted
app/src/lib/styles/theme.test.ts       resolution and persistence
app/static/fonts/                      the subsetted woff2 + its licence
tools/src/ci/budget.ts                 A4: font row, total 70 → 82 kB
content/taxonomy/domains.yaml          A7: light + dark palettes, real colours
schema/domains.schema.json             A7: the widened palette shape
```

## Interface contract

```ts
// content/taxonomy/domains.yaml — the A7 shape, additive over the current { base, accent }
palette: {
  light: { base: string; accent: string };
  dark:  { base: string; accent: string };
}

// app/src/lib/styles/theme.svelte.ts
export type ThemeChoice = 'light' | 'dark' | 'system';
export function resolvedTheme(): 'light' | 'dark';   // reactive; follows the media query under 'system'
export function setTheme(choice: ThemeChoice): void; // persists
```

Token names are normative for T30–T34:

```
--paper --ink --rule --plate-open --plate-fog --plate-bonus
--domain-<id>            per-domain plate colour, theme-resolved
--font-display --font-body --font-data
```

## Acceptance criteria

- [ ] `grep -rn '#[0-9a-fA-F]\{6\}' app/src --include=*.svelte` returns nothing outside
      `tokens.css` — no component names a colour.
- [ ] Every domain in `domains.yaml` has both a `light` and a `dark` palette, and
      `schema/domains.schema.json` rejects a file carrying the old flat shape.
- [ ] Toggling the theme changes only custom-property values; no component re-renders on
      a different code path. Verified by a test asserting identical markup in both themes.
- [ ] The map's existing `MapRenderer.test.ts` and `MapRenderer.a11y.test.ts` pass
      unchanged against the new palette source.
- [ ] `npm run check:budget` passes with the font row present and fails one byte over the
      82 kB total, in the manner T25 already established for the other rows.
- [ ] The subsetted face is ≤ 12 kB Brotli and renders every glyph in the closed set —
      eight domain names, three subregion names, five band names, five tier names, and the
      UI headings — verified by a test that enumerates the set from the content files
      rather than from a hand-written list.
- [ ] No flash of the wrong theme: the resolved theme is applied before first paint.

## Verification

```bash
npm run build
npm run check:budget                       # 82 kB total, font row present
npm test --workspace app -- styles theme
npm run typecheck
```

## Notes and hazards

- **The §4.2 table gives one colour per domain per theme, and `palette` carries two
  fields.** Treat the tabled hex as `base` and derive or re-pick `accent` per theme; do
  not silently reuse the current Chakra accents against the new bases. If a principled
  derivation is not available, this is a question for the owner, not a guess.
- **`accent`'s only consumer must be identified before it is changed.** It predates this
  design and may be load-bearing somewhere the map is not.
- **The budget rise is a one-way door.** §17.1's total exists because S2 depends on it;
  82 kB is the number the design was costed against, and a face that lands over its 12 kB
  spends someone else's row rather than its own.
- **A4 and A7 are spec edits owned by T28.** Landing the code here and the prose there is
  the deliberate split; if T28 slips, this task's `domains.yaml` change is ahead of the
  document that describes it, and that must be recorded rather than tolerated silently.
