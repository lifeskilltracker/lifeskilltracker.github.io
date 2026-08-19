/**
 * "The Survey" — the first-load reveal (UI-SPEC §5.7, T35). Pure: no DOM, no
 * clock, no framework. `MapRenderer` runs the frames; this decides what a frame
 * *is*.
 *
 * The map is drawn in the order a real one is made — the engraver's linework,
 * then the colour plates, then the type. That is the visual direction's own
 * manufacturing process used as its reveal, and it survived a constraint that
 * eliminated most of the alternatives: **on a true first load every domain score
 * is zero**. Any reveal built on progress animating into place shows a
 * first-time visitor nothing at all, because they have none. Eight open plates,
 * no water lines anywhere, and manifest-derived fog is the whole picture the
 * reveal has to be beautiful with.
 *
 * Three properties are load-bearing and each one is a test below:
 *
 * - **It plays once ever.** `shouldReveal` is the gate, and it is deliberately
 *   conservative — a store it cannot write is a store that cannot remember, and
 *   §5.7's rule is that the Player never pays for the spectacle twice. So a
 *   blocked store means no reveal rather than a reveal on every visit.
 * - **It ends on the resting frame.** `frameAt(REVEAL_MS, t)` is the map as it
 *   paints on every later load, for *every* `t`, which is why the mixes below
 *   are written `a * (1 - p) + b * p` rather than `a + (b - a) * p`: the second
 *   form lands a float's width away from `b` and the last frame pops.
 * - **Under reduced motion it does not play at all.** Not a shortened version;
 *   skipped (§15.5). A 100 ms reveal is still a reveal.
 */

import { DOMAIN_LABEL_SCREEN_PX, type Box } from './camera.js';
import { HACHURE_LINE_OPACITY } from './map-presentation.js';

export const REVEAL_MS = 1200;

/** Local, per-device, and therefore losable — a cleared profile replays it once
 *  more. A server-side memory is not available and would not be wanted (D-12). */
export const REVEAL_FLAG = 'lst.reveal.seen';

/**
 * The two resting values the reveal has to land on exactly. They mirror
 * `tokens.css`, the way `HACHURE_PLATE_OPACITY` already mirrors `--plate-fog`,
 * and `reveal.test.ts` greps that file so the pair cannot drift apart silently.
 */
export const PLATE_OPEN = 0.52;
export const DISPLAY_TRACKING_EM = 0.14;

/**
 * §5.7 opens the lettering at 5 px of tracking and settles it at 0.14em — two
 * units. The domain label is `DOMAIN_LABEL_SCREEN_PX` on screen at level 0, so
 * the conversion is a division and moves if §5.2's band ever does.
 */
export const LETTER_SPACING_START_EM = 5 / DOMAIN_LABEL_SCREEN_PX;

/** The camera settle: a pull-back, not a zoom-out establishing shot (§5.7). */
export const CAMERA_SCALE_START = 1.06;

export interface RevealFrame {
  /**
   * Linework, as a **fraction of the region's own path length** rather than a
   * user-space length: this module never touches the DOM and only the component
   * has measured `getTotalLength()`. It multiplies.
   */
  readonly dashOffset: number;
  readonly plateOpacity: number;
  readonly hachureOpacity: number;
  readonly labelOpacity: number;
  readonly letterSpacingEm: number;
  readonly cameraScale: number;
}

interface Phase {
  readonly start: number;
  readonly span: number;
  readonly stagger: number;
}

/** §5.7's table, verbatim. The windows overlap on purpose. */
const LINEWORK: Phase = { start: 0, span: 460, stagger: 60 };
const PLATES: Phase = { start: 300, span: 500, stagger: 80 };
const LETTERING: Phase = { start: 640, span: 460, stagger: 90 };

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

const mix = (a: number, b: number, p: number): number => a * (1 - p) + b * p;

/** One axis of `cubic-bezier(.16, .84, .44, 1)`, with P0 = 0 and P3 = 1. */
const bezier = (t: number, a: number, b: number): number => {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};

/**
 * §5.7's easing, throughout. Bisection rather than Newton: twenty halvings put
 * the parameter inside 1e-6 — far finer than a frame — in a handful of lines,
 * and the derivative Newton needs is more code than the iterations it saves on
 * a curve this shallow. First-route bytes are the binding constraint (§17.1).
 */
function ease(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 20; i += 1) {
    if (bezier(t, 0.16, 0.44) < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return bezier(t, 0.84, 1);
}

const progress = (ms: number, t: number, phase: Phase): number =>
  ease(clamp01((ms - phase.start - phase.stagger * t) / phase.span));

/** `t`: region distance from the world centre, normalized `[0, 1]`. */
export function frameAt(ms: number, t: number): RevealFrame {
  const line = progress(ms, t, LINEWORK);
  const plate = progress(ms, t, PLATES);
  const letter = progress(ms, t, LETTERING);
  // The camera is a modifier layered over the whole sequence, so it takes the
  // full window and takes no stagger: a per-region camera is not a camera.
  const settle = ease(clamp01(ms / REVEAL_MS));

  return {
    dashOffset: mix(1, 0, line),
    plateOpacity: mix(0, PLATE_OPEN, plate),
    hachureOpacity: mix(0, HACHURE_LINE_OPACITY, plate),
    labelOpacity: mix(0, 1, letter),
    letterSpacingEm: mix(LETTER_SPACING_START_EM, DISPLAY_TRACKING_EM, letter),
    cameraScale: mix(CAMERA_SCALE_START, 1, settle),
  };
}

/**
 * Each region's `t`, from the centre of the union outwards. Distance rather
 * than authored order: the reveal reads as one sheet being printed, and an
 * order derived from `map.yaml` would make it read as eight regions taking
 * turns.
 */
export function revealStagger(bounds: readonly Box[]): number[] {
  if (bounds.length === 0) return [];
  const x0 = Math.min(...bounds.map((b) => b.x));
  const y0 = Math.min(...bounds.map((b) => b.y));
  const x1 = Math.max(...bounds.map((b) => b.x + b.width));
  const y1 = Math.max(...bounds.map((b) => b.y + b.height));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  const distances = bounds.map((b) =>
    Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy)
  );
  const furthest = Math.max(...distances);
  // A single region — or eight concentric ones — has no outward direction to
  // stagger along, and dividing by the zero would hand every phase a `NaN`.
  return furthest === 0 ? distances.map(() => 0) : distances.map((d) => d / furthest);
}

/**
 * False on every load after the first, and always under reduced motion.
 *
 * `reducedMotion` is injected only by tests and by the component that already
 * resolved the query; jsdom has no real media query and "does not play at all"
 * is precisely the behaviour worth asserting.
 */
export function shouldReveal(reducedMotion?: boolean): boolean {
  const reduce =
    reducedMotion ??
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce) return false;
  try {
    const store = globalThis.localStorage;
    if (!store) return false;
    return store.getItem(REVEAL_FLAG) !== '1';
  } catch {
    return false;
  }
}

/** Called as the reveal *starts*, not as it ends: a visitor who navigates away
 *  mid-reveal has seen it, and replaying it on their next visit is the failure
 *  §5.7 names. */
export function markRevealed(): void {
  try {
    globalThis.localStorage?.setItem(REVEAL_FLAG, '1');
  } catch {
    // A blocked store costs the flag, and `shouldReveal` already refuses to
    // reveal without one, so nothing further is owed here.
  }
}
