// @vitest-environment jsdom

/**
 * "The Survey" — the first-load reveal's timing (UI-SPEC §5.7, T35).
 *
 * The module under test is pure, and that is the whole reason it exists as a
 * module: the three properties §5.7 calls load-bearing — it plays once ever, it
 * ends on the resting frame, and under `prefers-reduced-motion` it does not play
 * at all — are all assertions about *timing values*, not about pixels. Asserting
 * them here rather than through a mounted map is what lets them be asserted
 * exactly, at every `t`, instead of at whichever frame a test happened to catch.
 *
 * The resting-frame assertions are checked against `tokens.css` rather than
 * against literals repeated from it. A reveal that ends one hundredth away from
 * the resting plate opacity pops on the last frame, and a literal would let that
 * ship the first time someone retunes §4.2.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DOMAIN_LABEL_SCREEN_PX } from './camera.js';
import { HACHURE_LINE_OPACITY } from './map-presentation.js';
import {
  CAMERA_SCALE_START,
  DISPLAY_TRACKING_EM,
  LETTER_SPACING_START_EM,
  PLATE_OPEN,
  REVEAL_FLAG,
  REVEAL_MS,
  frameAt,
  markRevealed,
  revealStagger,
  shouldReveal,
} from './reveal.js';

const tokens = (): string =>
  readFileSync(join(process.cwd(), 'src/lib/styles/tokens.css'), 'utf8');

/** Every `t` a region can have, sampled densely enough that no phase hides. */
const TS = Array.from({ length: 21 }, (_, i) => i / 20);

describe('the resting frame', () => {
  it('is reached at REVEAL_MS for every region, however far from the centre', () => {
    for (const t of TS) {
      const frame = frameAt(REVEAL_MS, t);
      expect(frame).toEqual({
        dashOffset: 0,
        plateOpacity: PLATE_OPEN,
        hachureOpacity: HACHURE_LINE_OPACITY,
        labelOpacity: 1,
        letterSpacingEm: DISPLAY_TRACKING_EM,
        cameraScale: 1,
      });
    }
  });

  it('holds after REVEAL_MS rather than continuing past it', () => {
    expect(frameAt(REVEAL_MS * 3, 1)).toEqual(frameAt(REVEAL_MS, 1));
  });

  it('rests at the plate opacity tokens.css actually declares', () => {
    expect(tokens()).toContain(`--plate-open: ${PLATE_OPEN};`);
  });

  it('rests at the display tracking tokens.css actually declares', () => {
    expect(tokens()).toContain(`--display-tracking: ${DISPLAY_TRACKING_EM}em;`);
  });
});

describe('the opening frame', () => {
  it('draws nothing: no linework, no plate, no lettering', () => {
    const frame = frameAt(0, 0);
    expect(frame.dashOffset).toBe(1);
    expect(frame.plateOpacity).toBe(0);
    expect(frame.hachureOpacity).toBe(0);
    expect(frame.labelOpacity).toBe(0);
  });

  it('starts the camera pulled in at 1.06', () => {
    expect(frameAt(0, 0).cameraScale).toBe(CAMERA_SCALE_START);
  });

  /**
   * §5.7 states the start as 5px and the end as 0.14em, which are not the same
   * unit. The label is 25 screen px at level 0 (`camera.ts`), so the conversion
   * is a division rather than a taste, and it moves if §5.2's band ever does.
   */
  it('opens the lettering at 5px of tracking, expressed against the label size', () => {
    expect(LETTER_SPACING_START_EM).toBeCloseTo(5 / DOMAIN_LABEL_SCREEN_PX, 5);
    expect(frameAt(0, 0).letterSpacingEm).toBe(LETTER_SPACING_START_EM);
  });
});

describe('the three phases, in order', () => {
  it('draws the linework before any plate appears', () => {
    const frame = frameAt(200, 0);
    expect(frame.dashOffset).toBeLessThan(1);
    expect(frame.plateOpacity).toBe(0);
  });

  it('lays the plates before any lettering appears', () => {
    const frame = frameAt(600, 0);
    expect(frame.plateOpacity).toBeGreaterThan(0);
    expect(frame.labelOpacity).toBe(0);
  });

  it('finishes the linework while the plates are still going', () => {
    expect(frameAt(460, 0).dashOffset).toBe(0);
    expect(frameAt(460, 0).plateOpacity).toBeLessThan(PLATE_OPEN);
  });

  it('never runs a channel backwards', () => {
    let previous = frameAt(0, 0.5);
    for (let ms = 10; ms <= REVEAL_MS; ms += 10) {
      const frame = frameAt(ms, 0.5);
      expect(frame.dashOffset).toBeLessThanOrEqual(previous.dashOffset);
      expect(frame.plateOpacity).toBeGreaterThanOrEqual(previous.plateOpacity);
      expect(frame.labelOpacity).toBeGreaterThanOrEqual(previous.labelOpacity);
      expect(frame.letterSpacingEm).toBeLessThanOrEqual(previous.letterSpacingEm);
      expect(frame.cameraScale).toBeLessThanOrEqual(previous.cameraScale);
      previous = frame;
    }
  });
});

describe('the stagger', () => {
  it('holds an outer region behind an inner one at the same instant', () => {
    expect(frameAt(100, 1).dashOffset).toBeGreaterThan(frameAt(100, 0).dashOffset);
    expect(frameAt(400, 1).plateOpacity).toBeLessThan(frameAt(400, 0).plateOpacity);
    expect(frameAt(700, 1).labelOpacity).toBeLessThanOrEqual(frameAt(700, 0).labelOpacity);
  });

  /** The camera is a modifier over the whole sequence, so it does not stagger. */
  it('does not stagger the camera settle', () => {
    expect(frameAt(400, 1).cameraScale).toBe(frameAt(400, 0).cameraScale);
  });
});

describe('revealStagger', () => {
  const box = (x: number, y: number) => ({ x, y, width: 10, height: 10 });

  it('normalizes distance from the world centre into [0, 1]', () => {
    const ts = revealStagger([box(0, 0), box(90, 0), box(45, 0)]);
    expect(Math.min(...ts)).toBe(0);
    expect(Math.max(...ts)).toBe(1);
    // The middle region sits at the centre of the union, so it leads.
    expect(ts[2]).toBe(0);
  });

  it('gives a lone region a stagger of zero rather than a division by zero', () => {
    expect(revealStagger([box(0, 0)])).toEqual([0]);
  });

  it('returns nothing for no regions', () => {
    expect(revealStagger([])).toEqual([]);
  });
});

describe('the once-ever gate', () => {
  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it('reveals on a first load and not on the next one', () => {
    expect(shouldReveal()).toBe(true);
    markRevealed();
    // A reload re-runs the module's callers against the same store; the flag is
    // the only thing that survives, so reading it again IS the second load.
    expect(shouldReveal()).toBe(false);
    expect(globalThis.localStorage.getItem(REVEAL_FLAG)).toBe('1');
  });

  it('does not reveal under reduced motion', () => {
    expect(shouldReveal(true)).toBe(false);
  });

  /**
   * And it does not burn the flag doing so. A visitor who browses with reduce on
   * and later turns it off has still never seen the map drawn.
   */
  it('leaves the flag unset when reduced motion suppressed it', () => {
    shouldReveal(true);
    expect(globalThis.localStorage.getItem(REVEAL_FLAG)).toBe(null);
  });

  /**
   * Blocked storage means the flag cannot be remembered, and §5.7's rule is that
   * the Player never pays twice. A reveal that cannot be recorded must therefore
   * not play at all — the failure is one missed first load, not a spectacle on
   * every visit.
   */
  it('does not reveal when the store is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    try {
      expect(shouldReveal()).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });
});
