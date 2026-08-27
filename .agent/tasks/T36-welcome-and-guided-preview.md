# T36 — The welcome cartouche and the guided preview (D25)

| Field | Value |
|---|---|
| **Status** | complete |
| **Phase** | 3 |
| **Cluster** | views |
| **Blocked by** | T32, T33, T34, T35 |
| **Blocks** | — |
| **Spec** | UI-SPEC §6.5, §7.1, §11.2, §12 Q4; ARCHITECTURE §14.1, §15.5, §17.1 |
| **PRD** | D25 (closes), §4.4, F2, F13, F43 |

## Goal

Close D25. A Curious Browser — someone who arrives once, intends to track nothing, and is
the top of the contributor funnel — reaches a compelling view of a **tree**, not only of
the map, without starting a skill and without anything being written.

## Why this shape

**The question had to be corrected before it could be answered.** D25's remainder was
recorded as "nothing sells a single skill's ladder", on the assumption that an unstarted
tree is empty. It is not: §4.6 draws every level-1 milestone as *available* and the whole
ladder above it as *locked*, so the difficulty gradient — "even onion dice, pinch grip" at
the bottom, "teach a beginner a dish" at the top — is already on screen. MakerSkillTree
sells 3,407 stars' worth of exactly that, as a static poster with no progress mechanism at
all (`docs/PRIOR-ART.md`). What was missing was not data. It was that nothing walked the
visitor up the ladder.

That correction is what made this cheap. The three designs that assumed missing data — a
tree authored for the demonstration, sample progress ticked over a real tree, a `preview:`
block in the schema — were all declined (§11.2), and each would have put hand-written
content on the one path a first-time visitor is guaranteed to walk, where a later revision
would rot it silently and nothing would fail.

## Scope

**In scope — the cartouche (§6.5)**

- `Welcome.svelte`, `role="dialog"` + `aria-modal`, opened by the shell over the resting
  frame §5.7 ends on: `REVEAL_MS` after the reveal starts, immediately when none plays.
- `welcome.ts` — the gate. Three conditions: the local flag is unset, hydration has landed,
  and the user has no started skills. The flag is written as the dialogue **opens**.
- Reduced motion does **not** suppress it. The reveal is motion; a dialogue is not.
- `featured.ts` — the skill it offers: most milestones, ties broken by tree id. Its own
  module so the map's first paint never carries it (§17.1).
- `focus-trap.ts` — extracted from `Info`, which was the only modal until now.

**In scope — the guided preview (§7.1)**

- Route `/s/<treeId>/preview`, sharing `SkillPage.svelte` the way `/m/<slug>` already does.
- `preview.ts` — annotations derived as `Level N — <first milestone of level N>`, §9.2's
  short form where one exists. No authored copy.
- `preview-tour.ts` — the running order: level 1, 5, 10, each held 2200 ms after a 420 ms
  glide. Under reduced motion it returns nothing and the camera never moves.
- Drives `TreeView.moveCamera` — the same call the three named anchors make. **No fourth
  camera, no zoom.**
- Any deliberate move — scroll, key, tap, camera button — ends the tour.

**Also in scope, and not part of the feature**

- **`touch-action: pan-y pinch-zoom` on `.tree-camera`.** `pan-y` alone made the browser
  discard a two-finger pinch, so the one surface in the app made entirely of text was the
  one that could not be magnified — WCAG 1.4.4, level AA. §7 declines an *application* zoom
  control and that is untouched. The §7 guard forbade the literal string `pinch-zoom` and
  so encoded the bug as a requirement; it now matches event-handler names.
- **A pre-existing race in `refreshExportPrompt`.** An in-flight refresh could resolve after
  a dismissal and put the prompt back. Not authored here — the fix was already written and
  uncommitted in the worktree — but included because the branch cannot be green without it.
- **`testTimeout` raised to 20 s.** The whole-page axe audits take upwards of four seconds
  alone and run in parallel; at vitest's 5 s default they passed in isolation and failed in
  full runs.

**Out of scope**

- Linking the cartouche to §6.3's Info legend. It would pull that chunk onto the
  first-paint path for a §17.1 budget with well under a kilobyte spare.
- Any authored preview content, in any form. See §11.2.

## Verification

- `npm test` — 1200 app / 349 tools, green.
- `npm run typecheck`, `npm run lint`, `npm run check:s1` — clean.
- `npm run check:budget` — first-route JS 53.7 kB / 54.0 kB (from 52.9 kB).
- `npm run a11y:reduced-motion` — **15 of 15**; the tour is enumerated as the seventh
  animation, per that script's own standing instruction.
- `npm run a11y:forced-colors` — 10 of 10. `npm run a11y:manual` — 43 of 43.
- Driven in Chromium against the build: the cartouche appears on a cold visit, offers
  Cooking (73 milestones), navigates to `/s/cooking/preview`, the camera reaches level 5
  with its rung marked, computed `touch-action` is `pan-y pinch-zoom`, and the cartouche
  does not return on a second visit.

## Notes for whoever picks this up next

**§17.1 has 0.3 kB of headroom.** This feature cost 0.8 kB of it. `featured.ts` is split so
only the lazy cartouche chunk carries the picker, and the cartouche is fetched only by
visitors who are actually greeted — but the next first-route addition will need to find
room, and the budget's own docstring notes the per-row check binds a kilobyte before the
total does.

**A native `<dialog showModal>` is the right shape and is not yet available.** jsdom 29
does not implement it, which would have made every keyboard assertion in
`Welcome.test.ts` unreachable. Worth revisiting when jsdom ships it — the platform's focus
trap would let `focus-trap.ts` be deleted.
