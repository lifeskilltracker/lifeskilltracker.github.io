# T34 — Tree restyle and level camera

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 2 |
| **Cluster** | views |
| **Blocked by** | T27 |
| **Blocks** | T35 |
| **Spec** | UI-SPEC §4.5, §4.6, §7; ARCHITECTURE §8, §9.3, §9.5, §9.6, §15.2 |
| **PRD** | F36, N5, N11 |

## Goal

`TreeView` wears the Survey system. Plates, a water line on the level header, engraved
level and tier labels, and the five milestone states restated in Survey terms with their
encoding unchanged. The tree also gains a **level camera**: no free zoom, but a glide
between level bands — jump to the blocking level, to the next available milestone (the
`.` shortcut's visual counterpart), or to level 10. After this task the tree and the map
read as one document, and a long tree is navigable without scrolling blindly.

## Why this shape

§8's layout, §9's node encoding and §15.2's keyboard grid are **unchanged**, and that is
the point: the tree is the part of the product that already works, and restyling it must
not become a rewrite. Free pan and zoom were considered and declined — §15.2's arrow-key
grid and roving `tabindex` both assume stable, readable positions, and scaling milestone
text in and out fights the one thing the tree exists to do, which is let someone read
their next concrete action. A level camera moves the viewport between known anchors
instead, which keeps positions stable and gives the `.` shortcut something to show.
Hachure appears nowhere here: a tree is never fogged.

## Scope

**In scope**

- **The Survey system applied to `TreeView`**: plates at `--plate-open`, a water line on
  the level header, engraved level and tier labels in the display face with the knockout
  halo, `--paper`/`--ink`/`--rule` throughout, and the data stack with `tabular-nums` for
  levels and counts.
- **The five milestone states (§4.6)**, restated and **unchanged in meaning and encoding**:

  | State | Glyph | Plate | Border |
  |---|---|---|---|
  | `complete` | ✓ | domain ink, full | solid 1.3 |
  | `bonus` | ✓ | domain ink, 42% | solid 1.3 |
  | `available` | ○ | open | solid 2.2, emphasized |
  | `locked` | ‧ | open | dashed |
  | `dismissed` | ✕ | open | dotted |

  N5's requirement holds exactly as §15.4 states it: glyph and border style carry the state
  independently of fill, glyphs stay real `<use>` elements so they survive
  `forced-colors: active`, and nothing here introduces a sixth meaning on colour.
- **The level camera**: glide between level bands, with three named targets — the blocking
  level, the next available milestone (F36), and level 10. Disabled to instant movement
  under `prefers-reduced-motion: reduce`.
- **The `.` shortcut's visual counterpart** — `.` already jumps focus to the next available
  milestone; it now also brings the camera to it.
- Mastery content keeps its separate panel below the tree (§9.6); narrow presentation
  (§8.5, §9.5) is unchanged.

**Out of scope**

- **§8's layout.** Node positions, columns, lanes, gutters and edge paths are untouched.
  A restyle that changes a coordinate is a T06 change and does not belong here.
- **§15.2's keyboard grid and roving `tabindex`.** Unchanged. The level camera moves the
  viewport, never the focus order.
- Free pan and zoom, in any form, including a pinch gesture. Declined by name in §7.
- Hachure, fog, and anything map-shaped — a tree is never fogged.
- The map-level next-step card — **T32**.

## Deliverables

```
app/src/lib/components/TreeView.svelte        Survey tokens, restated states, camera hooks
app/src/lib/components/tree-camera.ts         level-band anchors and the glide — pure
app/src/lib/components/tree-camera.test.ts    anchors, targets, reduced motion
app/src/lib/components/node-state.ts          state → glyph/plate/border, per §4.6
app/src/lib/components/TreeView.test.ts       states, camera targets, unchanged layout
app/src/routes/s/[tree]/SkillPage.svelte      the level-camera controls
```

## Interface contract

```ts
// tree-camera.ts — pure, no DOM. Anchors come from the layout the engine already emits.
export type CameraTarget =
  | { readonly kind: 'level'; readonly level: number }   // 1–10
  | { readonly kind: 'blocking' }
  | { readonly kind: 'next-available' };                 // the `.` shortcut's target

export function anchorFor(target: CameraTarget, layout: TreeLayout, progress: SkillProgress): number; // scroll offset
export const GLIDE_MS = 420;
```

The §4.6 state mapping is normative for both this task and T31's hexes:

```ts
export type MilestoneVisual = {
  readonly glyph: '✓' | '○' | '‧' | '✕';
  readonly plate: 'full' | 'bonus' | 'open';
  readonly border: 'solid-1.3' | 'solid-2.2' | 'dashed' | 'dotted';
};
export function visualFor(state: NodeState): MilestoneVisual;
```

## Acceptance criteria

- [ ] Node positions are byte-identical before and after the restyle. Asserted against a
      layout fixture — this is the check that keeps the task a restyle.
- [ ] All five states render their specified glyph, plate and border, and each is
      distinguishable with colour removed. Asserted by a test that strips fill.
- [ ] Glyphs remain `<use>` elements and survive `forced-colors: active`.
- [ ] No colour-only encoding is introduced: the existing §15.4 redundancy assertions pass
      unchanged.
- [ ] `.` moves focus to the next available milestone **and** brings the camera to it.
- [ ] The three camera targets resolve correctly on a ten-level fixture tree, including a
      tree with no available milestone and a tree at level 10.
- [ ] Under `prefers-reduced-motion: reduce` the camera moves instantly and nothing is lost.
- [ ] Arrow-key traversal and roving `tabindex` behave exactly as before. The existing
      `TreeView.test.ts` and `TreeView.a11y.test.ts` keyboard assertions pass unchanged.
- [ ] No colour literal remains in `TreeView.svelte` (T27's tokens only).
- [ ] `app/a11y/manual-passes.mjs` passes unchanged.

## Verification

```bash
npm test --workspace app -- TreeView tree-camera node-state SkillPage
npm run build && npm run a11y:manual --workspace app
npm run check:budget
```

## Notes and hazards

- **The layout fixture check is the guardrail.** Every restyle drifts into a "small" layout
  improvement; §8 is settled (F27 closed its last five silences) and N11 depends on it.
- **`bonus` at 42% is the one place a plate opacity carries meaning**, and it is
  pre-existing — it is not the map's water line and must not be reimplemented as one.
- **A glyph is not a font character.** `<use>` is what survives forced colors; setting the
  glyphs in the display face would lose exactly the users §15.4 is written for.
- **The level camera has no free-zoom escape hatch.** If a tree feels too tall to navigate,
  the answer is another named anchor, not a zoom control.
- **`a11y/manual-passes.mjs` was written against roles and accessible names only, with no
  CSS selector, no pixel and no screenshot, specifically so the UI could be reworked
  without breaking it.** If it fails here, that is a real regression, not test churn.
