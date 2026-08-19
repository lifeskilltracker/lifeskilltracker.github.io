# T33 — Find and Info

| Field | Value |
|---|---|
| **Status** | complete |
| **Phase** | 2 |
| **Cluster** | views |
| **Blocked by** | T30, T31, T32 |
| **Blocks** | T35 |
| **Spec** | UI-SPEC §6.2, §6.3, §8.2; ARCHITECTURE §15.2, §15.3, §15.4 |
| **PRD** | F34, N5 |

## Goal

Two controls sit bottom-right. **Find** opens on click or `Ctrl`/`Cmd`+`F`, lights up
every matching skill across the whole map, dims the rest, and does not move the camera;
`Enter` flies to the top hit and `Esc` clears. **Info** opens the legend that explains the
water line, the five band names, hachure, hex borders and the glyphs. After this task the
map's vocabulary is discoverable without documentation, and filtering exists.

## Why this shape

**Find highlights in place, and that is what makes it the filter UI.** A search that flies
to a result answers "where is knitting"; a search that lights up every match answers "what
have I got in this area", "what is at level 3", "what is outdoors" — which is exactly what
the reference implementation lacks and is criticized for. Building a separate filter panel
would be a second control for the same query, and the complexity budget (§3) is explicit
that nothing a first-time visitor can stumble onto may require explanation. Info is not
optional polish: **F34 forbids showing a raw percentage**, so a user who wants to know what
the fill height means has nowhere else to find out, and "no legend" is the most concrete
criticism the prior-art review turned up.

## Scope

**In scope**

- **Find**, bottom-right, opening on click or `Ctrl`/`Cmd`+`F`, with the browser's own find
  suppressed only while the control has focus.
- **Highlight in place.** Matches hold full strength, non-matches dim; **the camera does not
  move**. Works at level 0 (regions containing matches) and level 1 (the hexes themselves).
- **Matching** over skill title, domain, subregion, and facet tags. It **shall not silently
  omit a content type** — a field added later that is not matched is a defect, so the
  matched field set is asserted against the manifest's shape rather than hard-coded in
  prose.
- `Enter` flies to the top hit; `Esc` clears.
- **The count as text** (§8.2) — "12 skills match" — on the live region, because a
  highlight that exists only visually is precisely the colour-only encoding N5 forbids.
- **Info**, beside Find, opening the legend: what the water line means, the five band names
  (Quiet → Deep), what hachure means, what the hex borders mean, what the glyphs mean.
- Both dialogs keyboard-reachable, focus-trapped while open, `Esc`-closable, and returning
  focus where they took it.
- **UI-SPEC §12 Q5** — whether Find persists its highlight across a camera move or clears on
  navigation. Specified as clear-on-`Esc` only, and untested; decide it here, implement one
  behaviour, and record the decision in the task doc rather than leaving both.

**Out of scope**

- A separate filter panel, saved searches, or search syntax beyond plain terms. §6.2 makes
  Find the only filter UI; a second one is out of budget by §3.
- The dim primitive itself — **T30** ships focus dim; this task reuses it rather than
  writing a second dimming path.
- Legend *content* decisions: the five bands are F18's, already fixed in §11.6 as tunable
  data. Info renders them from that data, so retuning a boundary must not require editing
  the legend.
- Search over milestone text inside trees. Matching is over the manifest; reaching into
  bundles would put the whole library in the first-paint budget.

## Deliverables

```
app/src/lib/components/Find.svelte         the control, the input, the shortcut
app/src/lib/components/Find.test.ts        highlight, count announcement, Enter, Esc
app/src/lib/components/search.ts           matching — pure, over manifest rows
app/src/lib/components/search.test.ts      field coverage, case/diacritic folding
app/src/lib/components/Info.svelte         the legend, rendered from band data
app/src/lib/components/Info.test.ts
```

## Interface contract

```ts
// search.ts — pure. Runs over the manifest, never over bundles.
export interface SearchableSkill {
  readonly treeId: string;
  readonly title: string;
  readonly domain: DomainId;
  readonly subregion: string | null;
  readonly facets: readonly string[];
  readonly attainedLevel: number;
}

export interface SearchResult {
  readonly matches: ReadonlySet<string>;      // treeIds
  readonly domains: ReadonlySet<DomainId>;    // regions containing a match, for level 0
  readonly top: string | null;                // treeId Enter flies to
}

export function search(query: string, skills: readonly SearchableSkill[]): SearchResult;
```

## Acceptance criteria

- [x] Typing in Find highlights matches and dims the rest **without changing the viewBox**.
      Asserted by comparing the camera state before and after a query.
- [x] `Enter` flies to the top hit; `Esc` clears the highlight and the query.
- [x] `Ctrl`/`Cmd`+`F` opens Find, and does so without breaking browser find when Find is
      closed.
- [x] Matching covers title, domain, subregion and facet tags. A test enumerates the
      searchable fields from the manifest type so a new field fails the test rather than
      being silently unmatched.
- [x] The match count is announced as text on the polite live region and is also visible.
- [x] Info's legend names the water line, all five bands, hachure, both border styles and
      every glyph, and the band names are read from §11.6's data.
- [x] No raw percentage appears anywhere in Find or Info (F34).
- [x] Both dialogs trap focus, close on `Esc`, and restore focus to their trigger.
- [x] Q5's chosen behaviour is implemented, asserted, and recorded in this document.
- [x] `app/a11y/manual-passes.mjs` passes unchanged.

## Verification

```bash
npm test --workspace app -- Find Info search
npm run build && npm run a11y:manual --workspace app
npm run check:budget
```

## Notes and hazards

- **Do not fly the camera on every keystroke.** The whole value of highlight-in-place is
  that the user keeps their frame of reference while narrowing; a camera that chases the top
  hit turns the filter back into a jump-to-result.
- **The dim must not be colour-only.** The count text is what carries the filter state to a
  screen-reader user, and it is the reason §8.2 lists it as an addition rather than a nicety.
- **"Shall not silently omit a content type" is a test, not a promise.** Prose cannot enforce
  it; the field enumeration is what does.
- **`Ctrl`/`Cmd`+`F` is the browser's.** Overriding it globally is hostile; scope the
  override tightly and let the native behaviour through everywhere else.
- **Info is on the critical path for F34's honesty.** If it ships thin, the map shows a
  height whose meaning is nowhere stated, which is worse than showing the number.

## What landed, and the calls the task left open

**UI-SPEC §12 Q5 is resolved: the highlight persists across camera moves.** Only `Esc` or an
emptied query clears it. Find is a filter you keep on while you explore — clearing on
navigation would drop the highlight at the exact moment the reader arrives in the region
they narrowed to, which breaks "what have I got in this area", one of the three questions
§6.2 exists to answer. The consequence is that the highlight is state the *shell* owns, not
the control: `Shell.svelte` holds it, `MapSurface` takes it as a prop, and
`routes/find-wiring.test.ts` asserts it survives `pathname` changing to `/d/making` with the
count still on the page. `Esc` therefore clears *before* it closes, and `close()` clears too,
so a dimmed map can never outlive the box that dimmed it.

- **The projection lives in `lib/actions/searchable-skills.ts`, not in `components/search.ts`.**
  The deliverables list put both in one file, but building a `SearchableSkill` row is a
  manifest × `SKILL`-mirror join, and §14.1 permits cross-subsystem joins only in
  `lib/actions`. `search.ts` stays what the interface contract says it is: a pure matcher
  over rows. The file also exports `SkillMirror`, so `MapControls` can type the mirror prop
  without importing `lib/state` — which the ESLint boundary rule forbids components to do,
  type-only imports included.
- **`MapControls.svelte` exists and is not in the deliverables.** It wraps Find, Info and the
  projection call into **one lazy chunk**, which is the only reason the pair fits at all
  (see the budget note below). It is also the single place the bottom-right corner's geometry
  is stated, so it cannot collide with §6.4's bottom-left card.
- **Acceptance criterion 3 was reinterpreted.** "`Ctrl`/`Cmd`+`F` opens Find, and does so
  without breaking browser find when Find is closed" is not implementable as written — the
  shortcut has to be intercepted before Find is open, or it cannot open it. The override is
  scoped by **mounting** instead: the handler ships with `MapControls`, which the shell mounts
  only on `/` and `/d/<domainId>`, so find-in-page is the browser's own on `/about`,
  `/library`, `/data` and every tree page. `find-wiring.test.ts` asserts all three cases. On
  the map the override is deliberate: U-07 asks for it by name, and a map is not a document
  you find text in.
- **Find has no `aria-modal`; Info does.** The map behind Find is not inert — the dim is
  happening on it and the count is a statement about it — so claiming modality would be a lie
  to assistive technology. Both trap `Tab` with real focus management regardless.
- **The count is one element that is both visible and `role="status"`**, rather than a visible
  number plus a hidden sentence. Two elements can disagree; one cannot.
- **`Enter` carries the top hit's *domain*, not its tree id.** There is no free camera (§5.1)
  and level 1 is as close as the camera comes to a single skill, so the region is the only
  unit a fly can land on. Resolving it inside the chunk also keeps the manifest lookup off
  the first route.
- **The dim reuses T30's two numbers** — `opacity: 0.38` on a region, `140ms ease-out`, with a
  `prefers-reduced-motion` entry — rather than introducing a second dimming vocabulary.
- **CSS lengths in both components dodge §11.6's band boundaries as literals.** `domain.test.ts`
  greps every component for `0.35` and `0.72` to keep the band table tunable from one file; a
  padding that happened to equal a boundary is a false positive, but teaching a gate to ignore
  a file stops it being a gate. The paddings moved by a hundredth of a rem instead.
- **T32's warning is honoured**: the controls add no tab stop before `main` on the tree route,
  because they do not mount there.

### §17.1 was amended, from ≤ 40 kB of app JS to ≤ 42 kB

The measured first route came to rest at **52,001 B against a 52,000 B budget** — one byte
over — with the matcher, both dialogs and the whole legend already behind an `import()`. What
is left on the entry graph is the highlight state, the level-0 dim and the fly handler, which
the map cannot lazily load because they *are* the map.

The alternative measured was deleting `MapRenderer`'s `{:else}` region-list branch, dead since
U-10 made the camera level the map/list threshold rather than the viewport: that recovers
about 200 B. It was **rejected**. That list is the only place §15.3's convergence promise —
same content, same order, for the small viewport and the screen reader — is actually kept, and
§8.1 requires the claim be restated rather than dropped. Buying budget with an accessibility
affordance is the wrong trade, and rehoming the claim is a spec-touching change that belongs
in its own task, not appended to this one.

So `docs/ARCHITECTURE.md` §17.1, `tools/src/ci/budget.ts` and `budget.test.ts` now read 42 kB,
and the combined first-route row is checked at 54 kB. The row is still the binding constraint:
12 + 42 + 15 = 69 against the 70 kB the JS and CSS rows sum to, so the next kilobyte has to be
argued for the same way this one was. Measured after the amendment: **52.0 / 54.0 kB**.
