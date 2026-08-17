/**
 * The level camera (T34, UI-SPEC §7).
 *
 * No `@vitest-environment jsdom` line, and that is the point: `tree-camera.ts`
 * is arithmetic over the layout the engine already emits, so every one of its
 * answers is checkable in node. The component contributes a scroll offset and a
 * clock; nothing here knows either exists.
 */

import { describe, expect, it } from 'vitest';
import { layoutTree } from '$lib/layout';
import { scoreSkill } from '$lib/scoring';
import { makeScoringTree, progressOf } from '$lib/scoring/fixtures.js';
import type { CompiledTree, MilestoneState } from '$lib/types';
import { GLIDE_MS, anchorFor, glideDuration, glidePosition, smootherstep } from './tree-camera.js';

/** Ten levels, two milestones each, one prerequisite edge — §8's ordinary case. */
function tenLevelTree(): CompiledTree {
  return makeScoringTree({
    id: 'camera-fixture',
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      milestones: [`l${i + 1}-a`, `l${i + 1}-b`],
    })),
    requires: { 'l2-a': ['l1-a'] },
  });
}

function scored(tree: CompiledTree, states: Record<string, MilestoneState>) {
  return scoreSkill(tree, progressOf(tree, states));
}

function completeThrough(level: number): Record<string, MilestoneState> {
  const states: Record<string, MilestoneState> = {};
  for (let l = 1; l <= level; l += 1) {
    states[`l${l}-a`] = 'complete';
    states[`l${l}-b`] = 'complete';
  }
  return states;
}

/**
 * The row offsets the Layout Engine emits for that tree, frozen. Level 1 is at
 * the bottom in wide (§8.2), so the offsets descend as the level rises — a
 * camera that assumed the opposite would glide the wrong way on every jump.
 */
const ROW_Y: Record<number, number> = {
  1: 864,
  2: 768,
  3: 672,
  4: 576,
  5: 480,
  6: 384,
  7: 288,
  8: 192,
  9: 96,
  10: 0,
};

describe('§7 — a named anchor per level', () => {
  it('puts a level band at the top of the view, in the engine’s own units', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');
    const progress = scored(tree, {});

    for (const [level, y] of Object.entries(ROW_Y)) {
      expect(anchorFor({ kind: 'level', level: Number(level) }, layout, progress)).toBe(y);
    }
  });

  it('clamps a level outside the tree rather than gliding into empty space', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');
    const progress = scored(tree, {});

    expect(anchorFor({ kind: 'level', level: 0 }, layout, progress)).toBe(ROW_Y[1]);
    expect(anchorFor({ kind: 'level', level: 99 }, layout, progress)).toBe(ROW_Y[10]);
  });

  it('answers 0 for a layout with no rows at all, rather than throwing', () => {
    const tree = tenLevelTree();
    const progress = scored(tree, {});
    const empty = { ...layoutTree(tree, 'wide'), rows: [] };

    expect(anchorFor({ kind: 'level', level: 3 }, empty, progress)).toBe(0);
    expect(anchorFor({ kind: 'blocking' }, empty, progress)).toBe(0);
    expect(anchorFor({ kind: 'next-available' }, empty, progress)).toBe(0);
  });
});

describe('§7 — the blocking level', () => {
  it('is level 1 on an untouched tree', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');

    expect(anchorFor({ kind: 'blocking' }, layout, scored(tree, {}))).toBe(ROW_Y[1]);
  });

  it('follows the blocker up as levels are cleared', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');
    const progress = scored(tree, completeThrough(3));

    expect(progress.blocker?.level).toBe(4);
    expect(anchorFor({ kind: 'blocking' }, layout, progress)).toBe(ROW_Y[4]);
  });

  it('lands on the deepest level when nothing blocks — a finished tree has no blocker', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');
    const progress = scored(tree, completeThrough(10));

    expect(progress.blocker).toBeUndefined();
    expect(anchorFor({ kind: 'blocking' }, layout, progress)).toBe(ROW_Y[10]);
  });
});

describe('§7, F36 — the next available milestone', () => {
  it('is the first available node in grid order, not the first uid the engine listed', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');

    expect(anchorFor({ kind: 'next-available' }, layout, scored(tree, {}))).toBe(ROW_Y[1]);
  });

  it('moves up with the work', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');
    const progress = scored(tree, completeThrough(1));

    expect(anchorFor({ kind: 'next-available' }, layout, progress)).toBe(ROW_Y[2]);
  });

  it('falls back to the blocking level when nothing is available', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');
    // Everything complete: `available` is empty and there is no blocker either,
    // so the fallback chain has to survive both being absent.
    const finished = scored(tree, completeThrough(10));
    expect(finished.available).toHaveLength(0);
    expect(anchorFor({ kind: 'next-available' }, layout, finished)).toBe(
      anchorFor({ kind: 'blocking' }, layout, finished),
    );
  });

  it('never returns a negative offset', () => {
    const tree = tenLevelTree();
    const layout = layoutTree(tree, 'wide');
    const progress = scored(tree, {});
    const targets = [
      { kind: 'level' as const, level: 10 },
      { kind: 'blocking' as const },
      { kind: 'next-available' as const },
    ];
    for (const target of targets) {
      expect(anchorFor(target, layout, progress)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('§5.6 — the glide, and §15.5’s right to remove it', () => {
  it('runs for the duration UI-SPEC §5.6 gives the camera fly', () => {
    expect(GLIDE_MS).toBe(420);
  });

  it('collapses to nothing under reduce, which is what "moves instantly" means', () => {
    expect(glideDuration(true)).toBe(0);
    expect(glideDuration(false)).toBe(GLIDE_MS);
  });

  it('arrives at the target immediately when the duration is zero', () => {
    expect(glidePosition(1000, 200, 0, 0)).toBe(200);
  });

  it('starts at the start, ends at the end, and never overshoots', () => {
    expect(glidePosition(100, 500, 0, GLIDE_MS)).toBe(100);
    expect(glidePosition(100, 500, GLIDE_MS, GLIDE_MS)).toBe(500);
    expect(glidePosition(100, 500, GLIDE_MS * 2, GLIDE_MS)).toBe(500);
    for (let t = 0; t <= GLIDE_MS; t += 20) {
      const at = glidePosition(100, 500, t, GLIDE_MS);
      expect(at).toBeGreaterThanOrEqual(100);
      expect(at).toBeLessThanOrEqual(500);
    }
  });

  it('eases smootherstep — flat at both ends, so the tree does not jerk', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 10);
    // Flat at the ends is the whole property: a tenth of the way in must have
    // covered far less than a tenth of the distance.
    expect(smootherstep(0.1)).toBeLessThan(0.02);
    expect(smootherstep(0.9)).toBeGreaterThan(0.98);
  });
});
