// @vitest-environment jsdom

/**
 * The welcome cartouche's gate (UI-SPEC §6.5 — PRD D25, §12 Q4).
 *
 * The dialogue itself is markup; *when it may appear* is the part that has to be
 * right, and it is pure, so it is asserted here rather than through a mounted
 * shell. §6.5 calls three properties load-bearing and each is a way this could
 * render correctly and still be wrong: it appears once ever, it never greets
 * someone who already has progress, and it waits for the reveal to finish.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { REVEAL_MS } from './reveal.js';
import { WELCOME_FLAG, markWelcomed, shouldWelcome, welcomeDelayMs } from './welcome.js';

afterEach(() => localStorage.clear());

/** The state a genuine first-time visitor arrives in. */
const FIRST_VISIT = { hydrated: true, startedSkills: 0 };

describe('shouldWelcome', () => {
  it('greets a hydrated visitor with no progress and no flag', () => {
    expect(shouldWelcome(FIRST_VISIT)).toBe(true);
  });

  it('never greets twice', () => {
    markWelcomed();
    expect(shouldWelcome(FIRST_VISIT)).toBe(false);
  });

  it('does not greet someone who already has progress', () => {
    // The flag is local, so a returning Player on a new device — or one who has
    // just imported an export (§14.5) — arrives with no flag and a full mirror.
    // Greeting them as a stranger is the failure this guards.
    expect(shouldWelcome({ hydrated: true, startedSkills: 3 })).toBe(false);
  });

  it('waits for hydration rather than guessing', () => {
    // An unhydrated mirror reports zero started skills, which is
    // indistinguishable from a real first visit. Deciding on it is §13.3's
    // "read as empty, then wrote" bug wearing a different hat.
    expect(shouldWelcome({ hydrated: false, startedSkills: 0 })).toBe(false);
  });

  it('stays silent when the flag cannot be stored', () => {
    // A blocked or absent store means "seen" can never be recorded, so the
    // dialogue would open on every single visit. Not greeting is the better
    // failure, and it is the same call `shouldReveal` makes.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(shouldWelcome(FIRST_VISIT)).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });

  it('is not suppressed by reduced motion', () => {
    // §5.7's reveal is skipped under `prefers-reduced-motion` because it is
    // motion. The cartouche has none to reduce — it is a dialogue — and
    // withholding it would deny the D25 visitor the whole feature on
    // accessibility grounds, which is backwards.
    expect(shouldWelcome({ ...FIRST_VISIT, reducedMotion: true })).toBe(true);
  });
});

describe('markWelcomed', () => {
  it('writes the flag under its own key, not the reveal’s', () => {
    markWelcomed();
    expect(localStorage.getItem(WELCOME_FLAG)).toBe('1');
    expect(WELCOME_FLAG).not.toBe('lst.reveal.seen');
  });

  it('survives a store that throws on write', () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => markWelcomed()).not.toThrow();
    } finally {
      localStorage.setItem = original;
    }
  });
});

describe('welcomeDelayMs', () => {
  it('waits out the reveal, so it opens over the resting frame (§5.7)', () => {
    // §5.7 ends the reveal on the resting frame *specifically* so this can open
    // over a finished picture with nothing still in motion.
    expect(welcomeDelayMs(true)).toBe(REVEAL_MS);
  });

  it('opens immediately when no reveal is playing', () => {
    // Reduced motion, or a returning visitor whose reveal flag is set: the map
    // paints straight to the final frame, so there is nothing to wait for.
    expect(welcomeDelayMs(false)).toBe(0);
  });
});
