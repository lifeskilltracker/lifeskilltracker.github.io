# Schema review — Phase 0 gate

**Task**: T10 · **Date**: 2026-08-13 · **Verdict**: **schema v1 stands. No breaking bump.**
One optional field added (`milestone.label`), which §5.10 classes as a non-breaking change.

R-14 said to expect at least one breaking bump here and to take it while the corpus is one
tree. It did not arrive. What did arrive is one field the renderer could not do without, and
five defects that had nothing to do with the schema at all — which is itself the useful
result, because four of the five were invisible to a green test suite and only appeared once
a real tree was on a real screen.

## What was actually exercised

`content/trees/cooking.yaml` — 52 milestones over ten levels, one track, six mastery entries —
travelled the whole pipeline: authored by hand, `lst ids`, `lst validate`, `lst compile` to a
content-hashed bundle, fetched by the loader, positioned by the Layout Engine, scored by the
tree-local engine, rendered as SVG, completed, reloaded, un-completed, reloaded.

The pass was driven in **headless Chromium against the production build** (`npm run build` +
`vite preview`) rather than in a test environment, because three of the six defects below are
invisible to jsdom: two are about how wide text is, and one is a browser request nothing in
the app makes. The driving script is not committed — it is a scratch harness, and the
criteria it checks are all restated as committed tests except the two that are inherently
geometric.

| Phase 0 exit criterion | Result |
|---|---|
| `lst validate` on a uid-less tree, then `lst ids`, then validate again | see finding 2 |
| `lst compile` emits `manifest.json` and a hashed bundle | pass — `cooking.dee91fe4.json` |
| `/s/cooking` renders as SVG | pass — 52 nodes, 10 level bands |
| Positions identical across two consecutive loads | pass — byte-identical transforms |
| Positions identical after a completion | pass |
| Completing updates the render, and survives a reload | pass — **after finding 4** |
| Un-completing removes it, and survives a reload | pass |
| No console error at any point | pass — **after finding 6** |

## Findings

### 1. A milestone's `title` cannot serve the node box — **fix, no bump**

**What phase 0 proved.** The node is 100 × 44 layout units and its label area holds roughly
forty characters at three clamped lines. The 52 authored titles have a **median length of 57
characters and a maximum of 70**; 51 of 52 exceed forty. So the primary view — the one §9
exists to draw — clipped almost every node.

Clipping alone would be a tuning problem. What made it a schema problem is that the titles
that clip are not distinguishable once clipped. Five level-9 and level-10 nodes rendered as
`Cook a full…`, `Cook a full…`, `Cook a planned…`, `Cook and serve…`, `Cook a single…`. A
user cannot tell those apart, and the tree is a picture whose whole job is to be read at a
glance.

**Why not retune §8.1 instead.** F27 makes the unit constants tunable data, and widening
`SLOT_WIDTH` was the obvious cheaper answer. It does not work: the SVG is scaled to the
viewport through its `viewBox`, so a wider node at a fixed screen width renders the same text
proportionally *smaller*. More characters per node buys no legibility. The constraint is the
viewport, not the constant, and no value of the constant escapes it.

**Resolution.** `milestone.label` — optional, `minLength: 1`, `maxLength: 36` — in
`tree.schema.json` and `compiled-tree.schema.json`, carried through `lst compile`, and read by
`TreeView` as `label ?? title`. §5.10's table puts a new optional field at "no bump, no cost",
and that is exactly what this is: every existing tree stays valid, and a tree with no labels
renders as it did before.

`title` keeps its job unchanged — it is the full statement of the achievement, and it is what
the milestone panel, the prerequisite lists, the mastery panel, and every §12 record show.
Only the box that cannot fit it uses the short form.

The cap is enforced in layer 1, not by convention: a 57-character label fails
`lst validate` with `must NOT have more than 36 characters`. Without that, the field would
silently drift back to full sentences and the finding would recur with an extra field to show
for it.

All 52 cooking milestones now carry a label. That is the migration, and it is the whole
migration — the corpus is one tree, which is precisely the window R-14 said to use.

### 2. `lst validate` rejects a uid-less tree, and T10's own criterion says it should pass — **tolerate; the criterion is stale**

T10's first exit criterion reads "`npx lst validate` **passes** on a tree with no `uid` lines,
then `npx lst ids` fills them, then validation still passes." It does not pass; it fails 52
times with `[rule 16] milestone "…" is missing uid`.

The tool is right and the criterion is out of date. T26/F25 made rule 16 the missing-uid gate
precisely because `lst ids` rewrites its input and therefore cannot be the check that rejects
it, and §6.7 step 4 now orders the authoring commands with **`lst ids` first**. A validator
that passed a uid-less tree would leave §5.4's CI requirement owned by nothing.

**Verdict: tolerate, no schema change.** The behaviour verified instead — validate rejects,
`lst ids` fills, validate passes — is the spec's, and the criterion in `T10-…md` has been
amended to say so. **Risk accepted:** none to the product; the risk was to this document, if
a later reader took the stale criterion for the contract.

### 3. The offline notice is shown on every visit after the first — **not schema; owner T14**

`/s/cooking` renders "Offline — showing content saved on this device" while online, on every
load after the first.

`createManifestReader` sets `offline = true` the moment it serves a cached manifest and clears
it only when the background revalidation resolves (`manifest.ts`, `load()`). That is honest
bookkeeping — until revalidation lands we genuinely do not know we are online — but the route
reads `content.isOffline()` **synchronously, immediately after `loadTree` resolves**, which is
always before revalidation settles. So the flag is read at the one moment it is guaranteed to
be pessimistic.

**Verdict: fix without bump, not here.** The fix is not to await revalidation — that would
throw away stale-while-revalidate's entire point, an instant paint. It is for the notice to
be reactive off the content store's `offline`, which `onManifest` already updates on both
paths. §13.3's notice host is **T14's** deliverable and this belongs with it; a second banner
implementation here would be thrown away.

**Risk accepted until T14:** every returning user is told they are offline when they are not.
It is a false statement in the UI, but it costs no data and no function — nothing branches on
the banner.

### 4. Nothing called `store.hydrate()` — **not schema; fixed here**

The blocking one. Every unit test was green, `hydrate()` was correct and covered, and no code
path in the application called it. A completion was written to IndexedDB, the mirror started
empty on the next load, and the tree rendered as though nothing had ever been done — failing
the Phase 0 exit criterion that the completion survive a reload.

Fixed with `lib/actions/bootstrap.ts` (§13.3's first step only) called from `+layout.svelte`,
plus two tests: one that hydration works, and one that **something calls it**. The second is
the one that matters; the gap was never in the sequence, it was in nobody invoking it.

The failure branch is carried too, because §13.3's dangerous case is not "cannot read
progress" but "read as empty, then wrote". A hydration failure latches the store unwritable
and the shell now says so rather than looking normal. That banner is a placeholder — T14 owns
the real notice host, same as finding 3.

The rest of §13.3 — `applyMoves`, the version-gated `applyLineage`, the offline branch — is
deliberately **not** here. It is T14's, and none of it is required by a Phase 0 exit
criterion.

### 5. The level readout overprinted the tier name — **not schema; fixed here**

Each row drew `Level N · Tier` at `x=4` and its group readouts at a hardcoded `x=90`.
"Journeyman" and "Apprentice" are wider than 86 units, so levels 3 through 6 rendered as
`Level 6 · Journeyman0 / 5`.

Fixed by making the readouts `tspan`s inside the label's own `<text>`, offset with `dx`. That
removes the guess rather than re-tuning it: `dx` measures from where the text actually ended,
so no tier name can be too long — including any name F18's provisional band vocabulary later
lands on. A test asserts the readouts carry no `x` attribute, which is the property that makes
the defect unreachable.

While there: a one-line node label sat at the top of its box while the state glyph sat at the
vertical centre, so the glyph read as a bullet for a line below it that had no text. The label
is centred against the glyph now.

### 6. No favicon, so every page load logged a 404 — **not schema; fixed here**

`app/static/` held only compiled content, so Chromium's automatic `/favicon.png` probe 404'd
on every load. The only console error in the whole pass, and enough on its own to fail the
"no console error at any point" criterion.

`app/static/favicon.svg` plus a `<link rel="icon">` in `app.html`. Recorded rather than fixed
silently because it is a T01 scaffold gap, not a T10 one, and because a gate criterion that
can be failed by a browser's default behaviour is worth knowing about.

### 7. Edges cross the level row labels — **tolerate; T20**

Same-level and long-range edges route through the left margin and pass over the row labels
("Level 3 · A|pprentice"). §8.4 accepts edge crossings as a stated cost and offers focus
highlighting as the mitigation, but that argument was made about crossings between *edges*,
not about an edge crossing *text*.

**Verdict: tolerate, no schema change.** It is a legibility defect in the layout's left
margin, not a data problem, and the fix — reserving the label strip from routing — is a §8
retune that belongs with the §15/§20 legibility pass. **Risk accepted:** the tier name is
harder to read on rows with heavy cross-level traffic. It is never the only place that
information appears; the level number, the tier, and the per-group counts are all in the
narrow list and in §15's text alternative.

## What v1 got right

Recorded deliberately, because "no bump" is only a useful verdict if it says what was tested.

- **The uid scheme (§5.4, D-05).** Authoring 52 milestones with no `uid` lines and filling
  them afterwards is genuinely pleasant, and in-file references by slug meant the whole
  tree — prerequisites and requirement groups included — was writable before the tool ran
  once. The one place it bit is finding 2, which is a doc bug, not a scheme bug.
- **Requirement groups (§5.6).** One `all` group per level was the right default for a linear
  tree, and §9.6's per-group readout rendered correctly without a special case for the
  one-group shape. `n_of` is untested against real content — tree 2 is where that gets
  falsified, and that is T21.
- **`contentVersion` as an authored per-tree integer (T26/F8).** Nothing about it was awkward
  to hand-author and it survived compile, load, and the store's `contentVersionSeen` write
  unchanged.
- **`detail` as free prose.** The panel had room for every one of them. Splitting `detail`
  into structured fields was considered during authoring and is not needed.
- **Mastery as a separate list (§5.7).** Rendering it as a panel below the tree rather than an
  eleventh row (§9.6) worked exactly as drawn, and no mastery entry wanted a position.
- **`track` and `order` (§5.5).** The exemplar is single-track, so this got the weakest test
  of anything here. It is the field most likely to move under T21's branching tree, and a
  reader of this document should not treat it as confirmed.

## Consequences for the bump-only criteria

T10's criteria conditioned on "if bumped" are satisfied vacuously and deliberately, not
skipped:

- `schemaVersion` is unchanged at 1, in `schema/`, in `content/`, and in `export.schema.json`.
- No `tools/src/migrate/` script exists, because no content needed rewriting. The 52 labels
  were authored, not migrated — there is no algorithm that could have written them.
- §16.2's manual "an export made before the bump imports after it" check does not apply. There
  was no bump, and `export`/`import` are T16's and not yet implemented.
- `npm run gen:types` produces no diff after this change: the generated `label?: string` in
  `authored.d.ts` and `compiled.d.ts` is committed.

## What this gate does not clear

- **`n_of` and multi-track content are untested against a real tree.** T21 authors both. If
  schema v1 breaks anywhere, the odds are strongly on `track`/`order`/`n_of`, and T21 should
  be read as carrying the residue of this review rather than as pure content work.
- **Nothing here exercised §11.5's grandfathering or any domain scoring**; both are Phase 1,
  and §16.4 scopes phase 0 to tree-local scoring on purpose.
- **The map, export, import, and lineage migration have not touched real content.** Their
  schema surfaces (`map.schema.json`, `export.schema.json`) were not reviewed here, because
  phase 0 produced no evidence about them and a review without evidence is the incurious
  review R-14 warns about.
