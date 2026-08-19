/**
 * The map camera (§10.7, UI-SPEC §5.1, §5.2 — A1, T30). Pure: no DOM, no clock,
 * no framework.
 *
 * **Two levels, both of them routes.** There is no free camera and no continuous
 * zoom, and that is a structural decision rather than a missing feature. A single
 * global level-of-detail flag works over a 5× zoom range when the map holds 42
 * nodes; this library is projected at 164 and eventually 500, where one flag
 * gives either an unreadable soup of labels or none at all. Scoping level 1 to
 * **one domain** bounds the labelled-hex count by the largest single domain
 * however large the library grows (§5.1).
 *
 * Nothing here reads a route. `fit` takes a `CameraLevel` and geometry and
 * returns a box; the shell decides which level the URL means, because §14.1 keeps
 * routing out of anything this pure and §5.1's "every camera state is a URL" is a
 * claim about the *shell*, not about this module.
 *
 * **The label sizes are derived, not chosen.** If they were hand-tuned the
 * level-of-detail argument in §5.1 would stop being structural and stop holding
 * at 500 nodes, so they are computed from the authored world's extent and the
 * hex geometry below, and `camera.test.ts` asserts both that they land in §5.2's
 * pixel bands and that the world constants still match the shipped manifest.
 * Editing `map.yaml` fails that test on purpose: the sizes are a function of the
 * world, and a changed world needs them recomputed rather than re-guessed.
 */

import type { DomainId } from '$lib/types';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One region's extent. Structural, so this module names no compiled type. */
export interface WorldRegion {
  readonly domain: DomainId;
  readonly bounds: Box;
}

export interface WorldGeometry {
  readonly regions: readonly WorldRegion[];
}

export type CameraLevel =
  | { readonly level: 0 }
  | { readonly level: 1; readonly domain: DomainId };

/** §5.6 — the camera fly, both directions. */
export const FLY_MS = 420;

/**
 * §5.6's other three durations, kept beside the fly so the table in the spec has
 * one home in the code. The water line's 200 ms is pre-existing (§10.5).
 */
export const WATER_LINE_MS = 200;
export const FOCUS_DIM_MS = 140;

/**
 * Breathing room around a region at level 1, as a fraction of its larger extent.
 * A region fitted edge-to-edge has its outline cropped by the viewport's own
 * rounding, and its label sits against the frame.
 */
export const LEVEL_1_PADDING = 0.08;

/* ── The authored world ──────────────────────────────────────────────────────
 *
 * These describe `content/taxonomy/map.yaml` as authored, and they are inputs to
 * the label sizes below rather than decoration. `camera.test.ts` asserts each
 * against the shipped manifest, so editing the map fails the build rather than
 * silently invalidating §5.2's bands.
 */

/** The union of all eight region extents (§10.4's emitted bounds). */
export const WORLD_WIDTH = 692.82;
export const WORLD_HEIGHT = 500;

/** `map.yaml`'s `hexSize`, which the manifest does not carry (it ships paths). */
export const HEX_SIZE = 40;

/** §5.3, Q2 — settled at 4, globally, with no per-region override. */
export const CELL_DIVISOR = 4;

/** One skill cell, in world units. The unit a skill label has to sit inside. */
export const CELL_SIZE = HEX_SIZE / CELL_DIVISOR;

/**
 * The map's viewport on the reference laptop: 1280 CSS px less §6.1's 15rem
 * sidebar. §5.2's bands are screen-pixel claims, so turning them into world
 * units needs one stated screen; this is it, and it is the narrowest display
 * the map is designed to be read on rather than a typical one.
 */
export const REFERENCE_MAP_WIDTH_PX = 1040;
export const REFERENCE_MAP_HEIGHT_PX = 800;

/** Screen pixels per world unit with the whole world in frame. */
const LEVEL_0_SCALE = REFERENCE_MAP_WIDTH_PX / WORLD_WIDTH;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * §5.2 — 22–28 px at level 0, taken at the midpoint so both bounds have equal
 * headroom against a narrower or wider frame than the reference one.
 *
 * The screen size is exported as well as spent: §5.7's reveal opens the
 * lettering at *5 px* of tracking and settles it at *0.14em*, and converting
 * between those two units needs the label's own pixel size. Reading it from
 * here keeps that conversion a division rather than a hand-tuned em value that
 * would silently stop meaning 5 px the next time this band moves.
 */
export const DOMAIN_LABEL_SCREEN_PX = 25;
export const DOMAIN_LABEL_WORLD_SIZE = round2(DOMAIN_LABEL_SCREEN_PX / LEVEL_0_SCALE);

/**
 * §5.2 — below 9 px at level 0 (illegible, therefore visually absent) and
 * 14–18 px at level 1. Expressed against the **cell**, not against the world:
 * a skill label belongs to a cell, the cell is a constant 10 world units
 * everywhere, and sizing it off the world extent would make it drift the next
 * time a region is added.
 *
 * There is no fade threshold and there must never be one. Geometric scaling
 * alone is what makes this tier absent at level 0 — a threshold is exactly the
 * per-zoom rule §5.2 exists to avoid.
 */
export const SKILL_LABEL_WORLD_SIZE = round2(CELL_SIZE * 0.46);

/**
 * §5.2's stroke stepping. Region outlines hold constant *screen* weight instead
 * of thickening with the camera, which is why level 1 is the thinner number.
 * The values live in `tokens.css` as `--rule-outline-l0` / `-l1` (T27); these
 * are the same two numbers for the code that has to pick between them.
 */
export const OUTLINE_WORLD_L0 = 1.3;
export const OUTLINE_WORLD_L1 = 0.9;

export function outlineWidthFor(level: CameraLevel): number {
  return level.level === 0 ? OUTLINE_WORLD_L0 : OUTLINE_WORLD_L1;
}

/** The union of every region's box — level 0's frame (§10.5). */
export function worldBox(world: WorldGeometry): ViewBox {
  if (world.regions.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const boxes = world.regions.map((region) => region.bounds);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * The camera's resting box for a level.
 *
 * An unknown domain falls back to level 0 rather than throwing. The domain comes
 * from a URL segment, so an unknown one is a bookmark to a retired domain — and
 * §16.3's rule is that a miss degrades to a state, never to a crash. The route
 * still says what happened; the camera just has somewhere to be meanwhile.
 */
export function fit(level: CameraLevel, world: WorldGeometry): ViewBox {
  if (level.level === 0) return worldBox(world);

  const region = world.regions.find((entry) => entry.domain === level.domain);
  if (region === undefined) return worldBox(world);

  const { x, y, width, height } = region.bounds;
  const pad = Math.max(width, height) * LEVEL_1_PADDING;
  return { x: x - pad, y: y - pad, w: width + pad * 2, h: height + pad * 2 };
}

/**
 * Smootherstep — Perlin's second-order ease, `6t⁵ − 15t⁴ + 10t³`. Zero first
 * *and* second derivative at both ends, which is what §5.6 asks for by name: a
 * camera that starts and stops with visible acceleration reads as a jolt at the
 * 420 ms this runs for.
 */
export function smootherstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * The fly, as a pure function of progress. `t` is linear time in `[0, 1]`; the
 * easing is applied here so a caller cannot forget it and so a reduced-motion
 * caller can simply jump to `t = 1` (§15.5) rather than running a shorter
 * animation — "instant" is the requirement, not "faster".
 */
export function interpolate(from: ViewBox, to: ViewBox, t: number): ViewBox {
  const e = smootherstep(t);
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
    w: from.w + (to.w - from.w) * e,
    h: from.h + (to.h - from.h) * e,
  };
}

/** `viewBox` attribute form. One place, so no caller re-orders the four numbers. */
export function viewBoxAttr(box: ViewBox): string {
  return `${box.x} ${box.y} ${box.w} ${box.h}`;
}

/**
 * Screen pixels per world unit for a box in the reference frame — the function
 * §5.2's bands are asserted through. `contain`, matching the SVG's
 * `xMidYMid meet`: the camera shows the whole box, so the binding axis is
 * whichever needs the most shrinking.
 */
export function scaleFor(
  box: ViewBox,
  viewportWidthPx = REFERENCE_MAP_WIDTH_PX,
  viewportHeightPx = REFERENCE_MAP_HEIGHT_PX,
): number {
  if (box.w === 0 || box.h === 0) return 0;
  return Math.min(viewportWidthPx / box.w, viewportHeightPx / box.h);
}
