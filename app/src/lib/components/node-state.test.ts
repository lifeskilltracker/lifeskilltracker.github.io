/**
 * §4.6's state → visual mapping, as its own contract (T34).
 *
 * `visualFor` is the **single producer** of that mapping. The tree consumes it
 * through `presentationFor`, and T31's skill hexes will consume it directly, so
 * a second copy of the table anywhere is a drift waiting to happen — these tests
 * exist mostly to make the derivation, rather than the duplication, the cheap
 * path.
 */

import { describe, expect, it } from 'vitest';
import type { NodeState } from '$lib/types';
import {
  MILESTONE_VISUAL,
  hitRect,
  levelFill,
  presentationFor,
  visualFor,
  type MilestoneVisual,
} from './node-state.js';

const STATES: NodeState[] = ['complete', 'bonus', 'available', 'locked', 'dismissed'];

describe('§4.6 — the five states, restated in Survey terms', () => {
  /** UI-SPEC §4.6's table, copied verbatim so a drift in either direction fails. */
  const TABLE: Record<NodeState, MilestoneVisual> = {
    complete: { glyph: '✓', plate: 'full', border: 'solid-1.3' },
    bonus: { glyph: '✓', plate: 'bonus', border: 'solid-1.3' },
    available: { glyph: '○', plate: 'open', border: 'solid-2.2' },
    locked: { glyph: '‧', plate: 'open', border: 'dashed' },
    dismissed: { glyph: '✕', plate: 'open', border: 'dotted' },
  };

  it.each(STATES)('maps %s exactly as §4.6 states it', (state) => {
    expect(visualFor(state)).toEqual(TABLE[state]);
  });

  it('exposes the same table as data, for a consumer that wants to iterate it', () => {
    expect(MILESTONE_VISUAL).toEqual(TABLE);
  });

  it('leaves glyph and border carrying the state without fill (N5, §15.4)', () => {
    // Throw the plate away entirely: the remaining two channels must still tell
    // five states apart. `complete` and `bonus` share a border and are separated
    // by nothing but the plate — which is why the *rendered* glyph differs (see
    // `presentationFor` below), and why this pair is the one §9.3 calls out.
    const withoutPlate = STATES.map((state) => {
      const { glyph, border } = visualFor(state);
      return `${glyph}|${border}`;
    });
    expect(new Set(withoutPlate).size).toBe(4);

    const rendered = STATES.map((state) => {
      const look = presentationFor(state);
      return `${look.glyph}|${look.dash}|${look.strokeWidth}`;
    });
    expect(new Set(rendered).size).toBe(5);
  });
});

describe('presentationFor is derived from visualFor, not written twice', () => {
  it.each(STATES)('gives %s a real <use> target and its §4.6 border', (state) => {
    const look = presentationFor(state);
    const visual = visualFor(state);

    expect(look.glyph).toBe(`#glyph-${state}`);
    expect(look.className).toBe(`is-${state}`);
    expect(look.plate).toBe(visual.plate);

    if (visual.border === 'solid-1.3') expect([look.dash, look.strokeWidth]).toEqual(['none', 1.3]);
    if (visual.border === 'solid-2.2') expect([look.dash, look.strokeWidth]).toEqual(['none', 2.2]);
    if (visual.border === 'dashed') expect(look.dash).not.toBe('none');
    if (visual.border === 'dotted') expect(look.dash).not.toBe('none');
  });

  it('treats an unstated node as locked (§11.4)', () => {
    expect(presentationFor(undefined)).toEqual(presentationFor('locked'));
  });
});

describe('§4.3 — the level water line', () => {
  it('is 0 for a level with nothing done and 1 for a satisfied one', () => {
    expect(levelFill([{ completed: 0, n: 2 }])).toBe(0);
    expect(levelFill([{ completed: 2, n: 2 }])).toBe(1);
  });

  it('averages the groups rather than picking one, since §9.6 reports both', () => {
    expect(levelFill([{ completed: 2, n: 2 }, { completed: 0, n: 1 }])).toBe(0.5);
  });

  it('never exceeds 1, however far past its threshold a group ran (F11 bonus)', () => {
    expect(levelFill([{ completed: 9, n: 2 }])).toBe(1);
  });

  it('is 0 for a level with no groups at all, rather than NaN', () => {
    expect(levelFill([])).toBe(0);
    expect(levelFill(undefined)).toBe(0);
  });

  it('ignores a group whose threshold is zero, which would divide by it', () => {
    expect(levelFill([{ completed: 0, n: 0 }])).toBe(0);
  });
});

describe('§15.7 — the hit rectangle is unchanged by the restyle', () => {
  it('never shrinks below 44 on either axis', () => {
    expect(hitRect(100, 44)).toEqual({ x: 0, y: 0, width: 100, height: 44 });
    expect(hitRect(20, 20)).toEqual({ x: -12, y: -12, width: 44, height: 44 });
  });
});
