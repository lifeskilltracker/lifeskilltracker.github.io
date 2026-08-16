# T35 — "The Survey" reveal, and accessibility verification

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 2 |
| **Cluster** | views |
| **Blocked by** | T30, T31, T32, T33, T34 |
| **Blocks** | — |
| **Spec** | UI-SPEC §5.7, §8.2; ARCHITECTURE §15.3, §15.4, §15.5, §15.8 |
| **PRD** | D25, N5, S2 |

## Goal

A first-time visitor sees the map drawn the way a real one is made — linework, then the
colour plates, then the type — once, ever, in 1200 ms, ending on the resting frame. Every
later load paints straight to that frame. And the whole interface built in T27–T34 is
verified as one surface: a `prefers-reduced-motion` audit across all of it, a
`forced-colors` check, and `a11y:manual` re-run against the finished app. After this task
the interface work is done and provably has not cost the accessibility guarantees §15
already held.

## Why this shape

The two audiences pull in opposite directions and the reveal is where that is resolved:
**make the first load a moment, and every load after it fast.** The Player opens the app a
few times a week and spectacle they cannot skip is a tax paid every visit, so the reveal is
gated on a local flag and plays once ever. A constraint eliminated most candidates: **on a
true first load every domain score is zero**, so the reveal renders eight open plates, no
water lines anywhere, and whichever regions the manifest reports as fogged. Any reveal
built on progress animating into place shows a first-timer nothing at all. Fog —
manifest-derived, not user-derived — is the only real state present on a cold visit. The
accessibility verification is bundled here rather than spread across T30–T34 because
`prefers-reduced-motion` and `forced-colors` are properties of the *composed* surface: five
tasks each honouring them individually can still compose into a page that does not.

## Scope

**In scope — the reveal (§5.7)**

- Three overlapping phases, staggered per region by distance from the world centre (`t` is
  that distance normalized to `[0,1]`), easing `cubic-bezier(.16, .84, .44, 1)` throughout:

  | Phase | Window | Behaviour |
  |---|---|---|
  | **Linework** | 0 → 460 ms, delay `t × 60` | each region's outline draws along its own path via `stroke-dashoffset`, from its full `getTotalLength()` to zero |
  | **Plates** | 300 → 800 ms, delay `t × 80` | plate opacity 0 → `--plate-open`; hachure rises to 0.55 on fogged regions only |
  | **Lettering** | 640 → 1100 ms, delay `t × 90` | label opacity 0 → 1, letter-spacing settling 5px → 0.14em |

- **Camera settle**: a 1.06 → 1.00 pull-back over the full 1200 ms, eased out, about the
  world centre — a modifier layered onto the sequence, not part of it.
- **Three load-bearing properties**: it plays **once ever**, gated on a local flag; it ends
  on the **resting frame** so D25's welcome dialog opens over a finished picture with
  nothing still in motion; and under `prefers-reduced-motion: reduce` it **does not play at
  all** — the map paints directly to that same final frame. Not a shortened version;
  skipped.

**In scope — verification**

- A `prefers-reduced-motion: reduce` audit across everything T30–T34 built: the camera fly,
  the skill-layer fade, the water-line animation, the tree's level camera glide, the focus
  dim, and the reveal. §15.5's rule must hold throughout — nothing conveys information only
  through motion, so removing all of it loses nothing.
- A `forced-colors: active` check over the map, the hexes, the chrome and the tree: every
  glyph a real `<use>`, every state distinguishable, nothing carried by fill alone.
- `npm run a11y:manual --workspace app` re-run against the finished build.
- `npm run check:budget` against the composed app, including the reveal's own code and
  T27's font row (A4's 82 kB).

**Out of scope**

- **D25's welcome dialog itself**, and UI-SPEC §12 Q4 — how a Curious Browser reaches a
  compelling *tree* without starting one. The reveal ends where the dialog would begin; the
  dialog is unowned and must not be invented here.
- Rewriting `a11y/manual-passes.mjs`. It was written against roles and accessible names
  only, specifically so the UI could be reworked without breaking it. If it fails, that is a
  regression in the code under test.
- The four declined reveal alternatives (§11.1). **Fog burn-off** is the closest contender
  and is explicitly worth reconsidering *if* D25's welcome dialog turns out to need the
  hachure convention taught visually — that is a design decision, not an implementation
  choice, and it belongs to the owner.

## Deliverables

```
app/src/lib/components/reveal.ts          the three phases, stagger, the once-ever gate
app/src/lib/components/reveal.test.ts      phases, ordering, the flag, reduced motion
app/src/lib/components/MapRenderer.svelte  reveal wiring; resting frame unchanged
app/a11y/reduced-motion.mjs                the composed-surface motion audit
app/a11y/forced-colors.mjs                 the composed-surface forced-colors check
docs/RELEASE-CHECKLIST.md                  both new passes added beside a11y:manual
```

## Interface contract

```ts
// reveal.ts — pure timing; the component applies the values.
export interface RevealFrame {
  readonly dashOffset: number;    // linework, per region
  readonly plateOpacity: number;
  readonly hachureOpacity: number;
  readonly labelOpacity: number;
  readonly letterSpacingEm: number;
  readonly cameraScale: number;   // 1.06 → 1.00
}

/** t: region distance from world centre, normalized [0,1]. ms: elapsed. */
export function frameAt(ms: number, t: number): RevealFrame;
export const REVEAL_MS = 1200;

/** False on every load after the first, and always under reduced motion. */
export function shouldReveal(): boolean;
```

## Acceptance criteria

- [ ] The reveal plays on a first load and does not play on the second. Asserted across a
      simulated reload with the flag persisted.
- [ ] `frameAt(REVEAL_MS, t)` equals the resting frame for every `t` — plates at
      `--plate-open`, hachure settled, labels at full opacity and 0.14em, camera at 1.00.
- [ ] With no user data, the reveal renders eight open plates, **no water lines**, and
      hachure on exactly the domains the manifest reports as fogged.
- [ ] Under `prefers-reduced-motion: reduce` the reveal does not run at all and the map's
      first painted frame is the resting frame. Asserted as "no animation started", not as
      "animation completed quickly".
- [ ] `getTotalLength()` is called once per region after first paint and cached; a test
      asserts the call count, since measuring inside the animation setup forces layout
      per region.
- [ ] Every animation across T30–T34 is disabled or made instant under reduced motion, and
      the resulting page carries the same information. Enumerated in the audit script.
- [ ] Under `forced-colors: active`, all five milestone states, both hex border styles, fog,
      and the water line remain distinguishable.
- [ ] `npm run a11y:manual --workspace app` passes **unchanged** against the finished build.
- [ ] `npm run check:budget` passes at the 82 kB first-paint total with the reveal included.
- [ ] `docs/RELEASE-CHECKLIST.md` lists both new passes.

## Verification

```bash
npm test --workspace app -- reveal MapRenderer
npm run build
npm run a11y:manual --workspace app
node app/a11y/reduced-motion.mjs
node app/a11y/forced-colors.mjs
npm run check:budget
```

## Notes and hazards

- **"Skipped, not shortened" is the whole reduced-motion rule here.** A 100 ms version of
  the reveal is still a reveal, and it is exactly what §15.5 forbids.
- **The resting frame is a contract with T30.** If T30's map animates itself into place on
  load, this task has nothing coherent to hand over to and the two will fight.
- **The once-ever flag is local and therefore losable** — a cleared profile replays it. That
  is acceptable; a server-side memory is not, since there is no server (D-12).
- **1200 ms is a ceiling, not a target.** The full zoom-out establishing shot was declined
  because it does not fit alongside the reveal, and because opening on a particular domain
  implies that domain matters.
- **This task is the only place the interface is tested as one surface.** Five individually
  compliant tasks composing into a non-compliant page is the specific failure it exists to
  catch, which is why it is blocked by all five rather than by the last one.
