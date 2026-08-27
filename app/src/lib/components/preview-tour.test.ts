/**
 * The guided preview's running order (§7.1). Pure timings, asserted exactly —
 * the alternative is a feature whose correctness can only be judged by watching
 * it, which is how a tour ends up half a second out of step with its own camera.
 */

import { describe, expect, it } from 'vitest';
import type { PreviewAnnotation } from '$lib/actions/preview.js';
import { TOUR_HOLD_MS, tourDurationMs, tourStops } from './preview-tour.js';
import { GLIDE_MS } from './tree-camera.js';

const ANNOTATIONS: readonly PreviewAnnotation[] = [
  { level: 1, title: 'Make instant noodles' },
  { level: 5, title: 'Cook for eight without a recipe' },
  { level: 10, title: 'Teach a cooking class' },
];

describe('tourStops', () => {
  it('starts immediately rather than opening on a pause', () => {
    // A beat of nothing on arrival reads as a page that failed to load.
    expect(tourStops(ANNOTATIONS, false)[0]?.atMs).toBe(0);
  });

  it('leaves a full glide plus a full hold between rungs', () => {
    const stops = tourStops(ANNOTATIONS, false);
    expect(stops.map((stop) => stop.atMs)).toEqual([
      0,
      GLIDE_MS + TOUR_HOLD_MS,
      2 * (GLIDE_MS + TOUR_HOLD_MS),
    ]);
  });

  it('carries each annotation through unchanged', () => {
    const stops = tourStops(ANNOTATIONS, false);
    expect(stops.map((stop) => [stop.level, stop.title])).toEqual([
      [1, 'Make instant noodles'],
      [5, 'Cook for eight without a recipe'],
      [10, 'Teach a cooking class'],
    ]);
  });

  it('is empty under reduced motion', () => {
    // §15.5 — the camera is what is dropped. The annotations themselves are
    // rendered as text either way, so nothing is carried by motion alone.
    expect(tourStops(ANNOTATIONS, true)).toEqual([]);
  });

  it('follows a shortened annotation list rather than assuming three', () => {
    // A sparse tree can leave a level empty, and `previewAnnotations` drops it.
    const short = ANNOTATIONS.slice(0, 2);
    expect(tourStops(short, false)).toHaveLength(2);
  });

  it('has nothing to run for a tree with no annotations at all', () => {
    expect(tourStops([], false)).toEqual([]);
  });
});

describe('tourDurationMs', () => {
  it('runs to the end of the last hold', () => {
    const stops = tourStops(ANNOTATIONS, false);
    expect(tourDurationMs(stops)).toBe(3 * (GLIDE_MS + TOUR_HOLD_MS));
  });

  it('stays inside the ten seconds this visitor gives the product (§3)', () => {
    expect(tourDurationMs(tourStops(ANNOTATIONS, false))).toBeLessThanOrEqual(10_000);
  });

  it('is zero when there is no tour', () => {
    expect(tourDurationMs([])).toBe(0);
  });
});
