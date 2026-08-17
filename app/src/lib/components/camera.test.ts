/**
 * The camera, §5.2's label bands, and the world constants they are derived from.
 *
 * The point of the last group is that it fails when `map.yaml` changes. §5.2's
 * sizes are "computed once at build time from the world extent and `hexSize` and
 * asserted in a test, not hand-tuned", and the only thing that makes that true
 * rather than aspirational is a test that notices when the world moves.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CELL_SIZE,
  DOMAIN_LABEL_WORLD_SIZE,
  FLY_MS,
  HEX_SIZE,
  LEVEL_1_PADDING,
  OUTLINE_WORLD_L0,
  OUTLINE_WORLD_L1,
  REFERENCE_MAP_HEIGHT_PX,
  REFERENCE_MAP_WIDTH_PX,
  SKILL_LABEL_WORLD_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  fit,
  interpolate,
  outlineWidthFor,
  scaleFor,
  smootherstep,
  viewBoxAttr,
  worldBox,
  type WorldGeometry
} from './camera.js';

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../static/content/manifest.json', import.meta.url)), 'utf8')
) as {
  taxonomy: {
    map: { regions: Array<{ domain: string; bounds: { x: number; y: number; width: number; height: number } }> };
  };
};

const REAL: WorldGeometry = {
  regions: manifest.taxonomy.map.regions.map((region) => ({
    domain: region.domain,
    bounds: region.bounds
  }))
};

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const TOY: WorldGeometry = {
  regions: [
    { domain: 'making', bounds: box(0, 0, 100, 50) },
    { domain: 'mind', bounds: box(100, 50, 100, 50) }
  ]
};

describe('fit — level 0', () => {
  it('frames the union of every region', () => {
    expect(fit({ level: 0 }, TOY)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it('is the world box', () => {
    expect(fit({ level: 0 }, REAL)).toEqual(worldBox(REAL));
  });

  it('is empty for an empty world rather than NaN', () => {
    expect(fit({ level: 0 }, { regions: [] })).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('fit — level 1', () => {
  it('frames one region with padding on its larger extent', () => {
    const pad = 100 * LEVEL_1_PADDING;
    expect(fit({ level: 1, domain: 'making' }, TOY)).toEqual({
      x: -pad,
      y: -pad,
      w: 100 + pad * 2,
      h: 50 + pad * 2
    });
  });

  it('is strictly inside the world box for every real domain', () => {
    // The whole claim of level 1 is that it is *closer*. A region that fitted to
    // something larger than the world would be a camera that zoomed out to enter.
    for (const region of REAL.regions) {
      const level1 = fit({ level: 1, domain: region.domain }, REAL);
      expect(level1.w).toBeLessThan(worldBox(REAL).w);
    }
  });

  it('falls back to level 0 for a domain the world does not have (§16.3)', () => {
    // A bookmark to a retired domain is a state, never a crash.
    expect(fit({ level: 1, domain: 'atlantis' }, REAL)).toEqual(worldBox(REAL));
  });
});

describe('smootherstep', () => {
  it('pins both ends', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
  });

  it('is symmetric about its midpoint', () => {
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 10);
    for (const t of [0.1, 0.25, 0.4]) {
      expect(smootherstep(t) + smootherstep(1 - t)).toBeCloseTo(1, 10);
    }
  });

  it('clamps outside [0,1] rather than overshooting', () => {
    expect(smootherstep(-2)).toBe(0);
    expect(smootherstep(9)).toBe(1);
  });

  it('leaves and arrives flat — the property that makes it not a jolt', () => {
    // Second-order ease: the first 5% of time moves well under 1% of the way.
    expect(smootherstep(0.05)).toBeLessThan(0.01);
    expect(1 - smootherstep(0.95)).toBeLessThan(0.01);
  });
});

describe('interpolate', () => {
  const from = { x: 0, y: 0, w: 100, h: 100 };
  const to = { x: 50, y: 20, w: 10, h: 10 };

  it('is the endpoints at 0 and 1', () => {
    expect(interpolate(from, to, 0)).toEqual(from);
    expect(interpolate(from, to, 1)).toEqual(to);
  });

  it('eases rather than moving linearly', () => {
    // A linear camera would be at x = 12.5 a quarter of the way through.
    expect(interpolate(from, to, 0.25).x).toBeLessThan(12.5);
  });

  it('reaches the destination exactly when a reduced-motion caller jumps to 1', () => {
    // §15.5's requirement is "instant", not "faster", so the same function has to
    // land on the resting box with no animation run at all.
    expect(interpolate(from, to, 1)).toEqual(to);
  });
});

describe('viewBoxAttr', () => {
  it('writes the four numbers in SVG order', () => {
    expect(viewBoxAttr({ x: 1, y: 2, w: 3, h: 4 })).toBe('1 2 3 4');
  });
});

describe('§5.2 — stroke stepping', () => {
  it('is thinner at level 1, so outlines hold constant screen weight', () => {
    expect(outlineWidthFor({ level: 0 })).toBe(OUTLINE_WORLD_L0);
    expect(outlineWidthFor({ level: 1, domain: 'making' })).toBe(OUTLINE_WORLD_L1);
    expect(OUTLINE_WORLD_L1).toBeLessThan(OUTLINE_WORLD_L0);
  });

  it('steps by roughly the factor the camera zooms by', () => {
    // Not an exact inverse — one number cannot invert eight different level-1
    // scales — but it must move in the right direction and by the right order.
    const zoom = scaleFor(fit({ level: 1, domain: 'making' }, REAL)) / scaleFor(fit({ level: 0 }, REAL));
    expect(zoom).toBeGreaterThan(1.5);
    expect(OUTLINE_WORLD_L0 / OUTLINE_WORLD_L1).toBeGreaterThan(1.2);
  });
});

describe('the authored world these sizes are derived from', () => {
  // This is the group that fails when someone edits `map.yaml`. That is its job:
  // §5.2's sizes are a function of the world, so a changed world needs them
  // recomputed rather than re-guessed.
  it('still matches the shipped manifest', () => {
    const world = worldBox(REAL);
    expect(world.w).toBeCloseTo(WORLD_WIDTH, 2);
    expect(world.h).toBeCloseTo(WORLD_HEIGHT, 2);
  });

  it('has the eight regions §10.4 unions', () => {
    expect(REAL.regions).toHaveLength(8);
  });

  it('derives the cell from hexSize and §5.3’s settled divisor', () => {
    expect(CELL_SIZE).toBe(HEX_SIZE / 4);
    expect(CELL_SIZE).toBe(10);
  });
});

describe('§5.2 — label tiers resolve into their pixel bands', () => {
  const level0 = fit({ level: 0 }, REAL);
  const px = (worldSize: number, view: ReturnType<typeof fit>) => worldSize * scaleFor(view);

  it('sets a domain label at 22–28 px at level 0', () => {
    const size = px(DOMAIN_LABEL_WORLD_SIZE, level0);
    expect(size).toBeGreaterThanOrEqual(22);
    expect(size).toBeLessThanOrEqual(28);
  });

  it('keeps a domain label legible at level 1 for every domain', () => {
    for (const region of REAL.regions) {
      const size = px(DOMAIN_LABEL_WORLD_SIZE, fit({ level: 1, domain: region.domain }, REAL));
      expect(size).toBeGreaterThan(28);
    }
  });

  it('sets a skill label below 9 px at level 0 — illegible, therefore absent', () => {
    expect(px(SKILL_LABEL_WORLD_SIZE, level0)).toBeLessThan(9);
  });

  it('sets a skill label into 14–18 px at level 1 for a compact region', () => {
    // Level 1 fits each region to its own extent (§5.3 — "Play and Outdoors zoom
    // least"), so the scale is not one number and this band cannot hold for all
    // eight. It holds for the compact majority; the exception is asserted below
    // rather than hidden, because it is a real limit on §5.2's claim.
    const size = px(SKILL_LABEL_WORLD_SIZE, fit({ level: 1, domain: 'making' }, REAL));
    expect(size).toBeGreaterThanOrEqual(14);
    expect(size).toBeLessThanOrEqual(18);
  });

  it('records which regions fall outside the band, and by how much', () => {
    const sizes = REAL.regions.map((region) => ({
      domain: region.domain,
      px: px(SKILL_LABEL_WORLD_SIZE, fit({ level: 1, domain: region.domain }, REAL))
    }));
    const outside = sizes.filter((entry) => entry.px < 14 || entry.px > 18);

    // The two extreme-aspect regions fit by their long axis and so zoom least of
    // all — `play` is tall (208×260) and `outdoors-nature` is wide (381×140).
    // These are precisely the two §5.3 names when it says "Play and Outdoors zoom
    // least and set the floor", so the spread is known rather than a surprise;
    // what §5.2 does not account for is that it puts them under its own 14 px
    // floor. They land at 12–13 px: smaller than specified, still legible, and
    // nowhere near level 0's "absent". T31 draws the skill labels and is the task
    // that has to decide whether to widen the band or fit level 1 to a constant
    // box. Recorded here so that decision is made deliberately.
    expect(outside.map((entry) => entry.domain).sort()).toEqual(['outdoors-nature', 'play']);
    for (const entry of outside) {
      expect(entry.px).toBeGreaterThan(10);
      expect(entry.px).toBeLessThan(14);
    }
  });
});

describe('§5.6 — the durations the spec tabulates', () => {
  it('flies for 420 ms', () => {
    expect(FLY_MS).toBe(420);
  });

  it('states the reference frame the bands were taken on', () => {
    expect(REFERENCE_MAP_WIDTH_PX).toBe(1040);
    expect(REFERENCE_MAP_HEIGHT_PX).toBe(800);
  });
});
