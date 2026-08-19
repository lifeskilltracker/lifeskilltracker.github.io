// @vitest-environment jsdom

/**
 * "The Survey" wired into the map (UI-SPEC §5.7, T35).
 *
 * `reveal.test.ts` owns the timing; this file owns the three things only a
 * mount can answer — that the reveal *starts* at all, that it starts once, and
 * that when it is over the map is holding the same frame it would have painted
 * with no reveal at all.
 *
 * Frames are driven by hand rather than by a clock. "Ends on the resting frame"
 * and "does not play at all under reduce" are both claims about a specific
 * frame, and a test that waited on a real `requestAnimationFrame` would be
 * asserting them at whichever frame jsdom happened to deliver.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { domainScores } from '$lib/scoring';
import MapRenderer from './MapRenderer.svelte';
import { HACHURE_LINE_OPACITY, regionBounds } from './map-presentation.js';
import { REVEAL_FLAG, REVEAL_MS } from './reveal.js';
import { cleanup, render } from './test-harness.svelte.js';
import { DOMAINS, ROWS, manifestFixture } from './fixtures.js';

const PATH_LENGTH = 120;
let getTotalLength: ReturnType<typeof vi.fn>;

beforeEach(() => {
  globalThis.localStorage.clear();
  // jsdom's SVG elements are all bare `SVGElement`, so this is where a real
  // browser's `SVGPathElement.getTotalLength` has to be stood up. It counts,
  // because "measure all eight once after first paint" is an acceptance
  // criterion and not a preference — measuring inside the animation setup
  // forces layout once per region, every region.
  getTotalLength = vi.fn(() => PATH_LENGTH);
  (SVGElement.prototype as unknown as Record<string, unknown>).getTotalLength = getTotalLength;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (SVGElement.prototype as unknown as Record<string, unknown>).getTotalLength;
});

/** A hand-cranked frame source: nothing runs until a test says a frame arrived. */
function frames() {
  const queue: FrameRequestCallback[] = [];
  let requested = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    requested += 1;
    queue.push(callback);
    return requested;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return {
    get requested(): number {
      return requested;
    },
    at(ms: number): void {
      for (const callback of queue.splice(0)) callback(ms);
      flushSync();
    },
  };
}

function mount(options: { reducedMotion?: boolean; rows?: typeof ROWS } = {}) {
  const manifest = manifestFixture();
  return {
    manifest,
    ...render(MapRenderer, {
      manifest,
      domainScores: domainScores(manifest.taxonomy, options.rows ?? ROWS),
      viewport: 'map' as const,
      reducedMotion: options.reducedMotion ?? false,
    }),
  };
}

const styleOf = (container: HTMLElement, domain: string): string =>
  container.querySelector(`[data-domain="${domain}"]`)?.getAttribute('style') ?? '';

const custom = (style: string, property: string): number =>
  Number(new RegExp(`${property}:\\s*([\\d.]+)`).exec(style)?.[1] ?? NaN);

describe('the once-ever gate, through a mount', () => {
  it('reveals on a first load', () => {
    frames();
    const { container } = mount();
    expect(container.querySelector('[data-revealing]')).not.toBeNull();
  });

  it('does not reveal on the load after it', () => {
    frames();
    mount().destroy();
    const { container } = mount();
    expect(container.querySelector('[data-revealing]')).toBeNull();
  });

  it('records the flag as the reveal starts, not as it finishes', () => {
    frames();
    mount();
    expect(globalThis.localStorage.getItem(REVEAL_FLAG)).toBe('1');
  });
});

describe('the opening frame', () => {
  it('paints the plates and the lettering at nothing', () => {
    const clock = frames();
    const { container } = mount();
    clock.at(0);

    const style = styleOf(container, DOMAINS[0]);
    expect(custom(style, '--reveal-plate')).toBe(0);
    expect(custom(style, '--reveal-label')).toBe(0);
  });

  it('holds each region’s outline back by its own full path length', () => {
    const clock = frames();
    const { container } = mount();
    clock.at(0);

    const style = styleOf(container, DOMAINS[0]);
    expect(custom(style, '--reveal-len')).toBe(PATH_LENGTH);
    expect(custom(style, '--reveal-line')).toBe(PATH_LENGTH);
  });

  it('pulls the camera in about the world centre', () => {
    const clock = frames();
    const { container } = mount();
    clock.at(0);

    const transform = container.querySelector('.reveal-camera')?.getAttribute('transform') ?? '';
    expect(transform).toMatch(/scale\(1\.06\)/);
  });
});

describe('measurement', () => {
  it('measures every region exactly once, however many frames run', () => {
    const clock = frames();
    mount();
    clock.at(0);
    clock.at(120);
    clock.at(400);
    clock.at(900);

    expect(getTotalLength).toHaveBeenCalledTimes(DOMAINS.length);
  });
});

describe('the resting frame', () => {
  it('drops every reveal value once the window is over', () => {
    const clock = frames();
    const { container } = mount();
    clock.at(0);
    clock.at(REVEAL_MS);

    expect(container.querySelector('[data-revealing]')).toBeNull();
    expect(styleOf(container, DOMAINS[0])).not.toContain('--reveal-');
    expect(container.querySelector('.reveal-camera')?.getAttribute('transform')).toBe(null);
  });

  it('falls back to the resting values, so a map with no reveal is unchanged', () => {
    // The reveal drives custom properties and the stylesheet's *fallbacks* are
    // the resting frame. That is what makes "ends on the resting frame" a
    // structural property rather than a final-frame coincidence: dropping the
    // properties is what lands the map, and there is no second set of numbers.
    const css = readFileSync(join(process.cwd(), 'src/lib/components/MapRenderer.svelte'), 'utf8');
    expect(css).toContain('var(--reveal-plate, var(--plate-open))');
    expect(css).toContain('var(--reveal-hachure, var(--hachure-line))');
    expect(css).toContain('var(--reveal-track, var(--display-tracking))');
  });

  it('rules the hachure at the opacity the reveal settles on, not at full', () => {
    frames();
    const { container } = mount({ rows: [] });
    const svg = container.querySelector('.world-map');
    expect(svg?.getAttribute('style')).toContain(`--hachure-line: ${HACHURE_LINE_OPACITY}`);
  });
});

describe('reduced motion', () => {
  it('starts no animation at all — not a shortened one', () => {
    const clock = frames();
    const { container } = mount({ reducedMotion: true });

    expect(clock.requested).toBe(0);
    expect(container.querySelector('[data-revealing]')).toBeNull();
    expect(styleOf(container, DOMAINS[0])).not.toContain('--reveal-');
  });

  it('leaves the flag unspent, so the reveal survives for a later visit', () => {
    frames();
    mount({ reducedMotion: true });
    expect(globalThis.localStorage.getItem(REVEAL_FLAG)).toBe(null);
  });
});

describe('a cold visit — the picture the reveal actually draws (§5.7)', () => {
  it('draws eight open plates and no visible water line when every score is zero', () => {
    frames();
    const { container, manifest } = mount({ rows: [] });

    const plates = container.querySelectorAll('.region-plate:not(.is-hachured)');
    const fogged = container.querySelectorAll('.region-plate.is-hachured');
    expect(plates.length + fogged.length).toBe(DOMAINS.length);

    // "No water lines" is a claim about the drawing, not about the element: at
    // fill 0 the rule sits exactly on the region's own bottom edge, under the
    // outline, which is what makes a cold map read as eight untouched plates.
    const bounds = new Map<string, ReturnType<typeof regionBounds>>(
      manifest.taxonomy.map.regions.map((region) => [region.domain, regionBounds(region)]),
    );
    for (const line of container.querySelectorAll('.region-waterline')) {
      const domain = line.closest('[data-domain]')?.getAttribute('data-domain') ?? '';
      const box = bounds.get(domain);
      expect(box).toBeDefined();
      expect(Number(line.getAttribute('y1'))).toBeCloseTo(box!.y + box!.height, 6);
    }
  });

  it('rules hachure on exactly the domains the manifest reports as fogged', () => {
    frames();
    const { container, manifest } = mount({ rows: [] });

    const withTrees = new Set(manifest.trees.map((tree) => tree.domain));
    for (const domain of DOMAINS) {
      const region = container.querySelector(`[data-domain="${domain}"]`);
      const hachured = region?.querySelector('.region-hachure') !== null;
      expect(hachured).toBe(!withTrees.has(domain));
    }
  });
});
