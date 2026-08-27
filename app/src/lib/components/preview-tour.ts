/**
 * The guided preview's schedule (UI-SPEC §7.1 — PRD D25, §12 Q4).
 *
 * D25's remainder was that nothing sells a single skill's ladder to a visitor
 * who will not tap *start*. The answer is that the level camera §7 already
 * built walks them up a real, unstarted tree while three annotations name what
 * each rung means — so what is needed is a running order, and running orders are
 * the kind of thing that is either asserted exactly or quietly wrong.
 *
 * Pure, therefore, and holding no clock of its own: it says *when* each stop
 * happens and the component owns the timers. §14.1's reasoning for the engines
 * applies unchanged — a schedule that could only be checked by watching it would
 * not be checked.
 */

import type { PreviewAnnotation } from '$lib/actions/preview.js';
import { GLIDE_MS } from './tree-camera.js';

/**
 * How long each rung is held before the camera moves on.
 *
 * Long enough to read a milestone title and look at the band around it, short
 * enough that the whole tour is over in about eight seconds — this visitor gave
 * the product ten (§3), and a tour that outlasts their patience has spent the
 * attention it was supposed to earn.
 */
export const TOUR_HOLD_MS = 2200;

export interface TourStop extends PreviewAnnotation {
  /** Milliseconds after the tour starts at which the camera leaves for this rung. */
  readonly atMs: number;
}

/**
 * The running order.
 *
 * **Empty under reduced motion, and that is the whole of the accommodation.**
 * §15.5's rule is that nothing conveys information only through motion, so the
 * annotations must not *be* the tour — they are rendered as an ordinary list
 * beside the tree either way, and a moving camera is the thing that is dropped.
 * A visitor with `prefers-reduced-motion` set therefore loses nothing but the
 * movement: the same three rungs are named, in the same order, in text.
 *
 * The first stop is at zero. There is no opening pause, because the tree is
 * already on screen behind the map's own transition and a beat of nothing would
 * read as a page that had failed to load.
 */
export function tourStops(
  annotations: readonly PreviewAnnotation[],
  reducedMotion: boolean,
): readonly TourStop[] {
  if (reducedMotion) return [];
  return annotations.map((annotation, index) => ({
    ...annotation,
    atMs: index * (GLIDE_MS + TOUR_HOLD_MS),
  }));
}

/** When the last rung has been held for its full time and the tour is over. */
export function tourDurationMs(stops: readonly TourStop[]): number {
  const last = stops[stops.length - 1];
  return last === undefined ? 0 : last.atMs + GLIDE_MS + TOUR_HOLD_MS;
}
