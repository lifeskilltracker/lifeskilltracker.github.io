// @vitest-environment jsdom

/**
 * §10.5–§10.7's map, tested through a real mount (T13).
 *
 * The scores come from the real `domainScores` over real rows, the way the
 * shell assembles them (§14.4) — a test that hand-wrote a `DomainScore` could
 * assert a fill no engine produces, and every one of these channels is only
 * meaningful as the number T11b computed.
 *
 * The one place a `DomainScore` *is* hand-built is the fog test, and that is
 * the point of it: F22's case is a domain with user progress and no published
 * trees, and fog has to win anyway.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BANDS, bandFor, domainScores } from '$lib/scoring';
import type { DomainScore, DomainSkillRow } from '$lib/types';
import MapRenderer from './MapRenderer.svelte';
import {
  FOG_AFFORDANCE,
  MAP_LIST_BELOW,
  breadthText,
  fillRect,
  formatLastActivity,
  mapViewBox,
  regionAccessibleName,
} from './map-presentation.js';
import { cleanup, click, focus, press, render } from './test-harness.svelte.js';
import {
  DOMAINS,
  ROWS,
  manifestFixture,
  squarePath,
  type ManifestOptions,
} from './fixtures.js';

afterEach(cleanup);

/**
 * Read a source file as text. `import.meta.url` is not a `file:` URL under the
 * jsdom environment, so the two grep gates below resolve from the workspace
 * root instead — vitest runs with `app/` as its cwd.
 */
const source = (name: string): string =>
  readFileSync(join(process.cwd(), 'src/lib/components', name), 'utf8');

/**
 * Source with its comments removed. The gates below forbid a *mechanism*, and
 * the prose in these files names the rejected mechanisms on purpose — D-20's
 * whole value is in the paragraph explaining why there is no shimmer and no
 * decay, and a gate that made writing that sentence impossible would delete the
 * one thing stopping a later maintainer from re-adding the channel.
 */
const codeOf = (text: string): string =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');

function mount(options: ManifestOptions & { viewport?: 'map' | 'list'; rows?: DomainSkillRow[] } = {}) {
  const manifest = manifestFixture(options);
  const scores = domainScores(manifest.taxonomy, options.rows ?? ROWS);
  const onselect = vi.fn();
  const mounted = render(MapRenderer, {
    manifest,
    domainScores: scores,
    viewport: options.viewport ?? 'map',
    onselect,
  });
  return { ...mounted, manifest, scores, onselect };
}

const regionOf = (container: HTMLElement, domain: string): Element => {
  const found = container.querySelector(`[data-domain="${domain}"]`);
  if (found === null) throw new Error(`no rendered region for "${domain}"`);
  return found;
};

const readingOrder = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-domain]')].map(
    (element) => element.getAttribute('data-domain') ?? '',
  );

describe('MapRenderer — the fill channel (§10.5, F34)', () => {
  it('draws fill as a clip rectangle rising from the region base, never as opacity', () => {
    const { container } = mount();
    const making = regionOf(container, 'making');

    const fill = making.querySelector('.region-fill');
    expect(fill).not.toBeNull();
    const clip = fill!.getAttribute('clip-path');
    expect(clip).toMatch(/^url\(#.+\)$/);

    // Rising from the base: the rect's bottom is the region's bottom, and its
    // height is the fill fraction of the region's own height.
    const rect = container.querySelector(`clipPath[id="${clip!.slice(5, -1)}"] rect`);
    expect(rect).not.toBeNull();
    const y = Number(rect!.getAttribute('y'));
    const height = Number(rect!.getAttribute('height'));
    expect(y + height).toBeCloseTo(100, 6);
    expect(height).toBeCloseTo(100 * (45 / 93), 6);

    // The whole point of a clip rather than an opacity (§10.5).
    expect(making.querySelector('.region-fill[opacity]')).toBeNull();
    expect(making.innerHTML).not.toMatch(/opacity/i);
  });

  it('leaves a partly filled region its full-strength outline and label', () => {
    const { container } = mount();
    const making = regionOf(container, 'making');

    for (const selector of ['.region-outline', '.region-label']) {
      const element = making.querySelector(selector);
      expect(element).not.toBeNull();
      // Neither clipped nor faded: a clip-path here would cut the outline at
      // the fill line, and an opacity would be exactly the encoding §10.5
      // rejects.
      expect(element!.getAttribute('clip-path')).toBeNull();
      expect(element!.getAttribute('opacity')).toBeNull();
      expect(element!.getAttribute('fill-opacity')).toBeNull();
    }
  });

  it('never renders a raw percentage anywhere on the map (F34)', () => {
    const { container } = mount();
    expect(container.innerHTML).not.toContain('%');
  });

  it('exposes fill as a named band in the accessible name and on focus, never a number', () => {
    const { container, scores } = mount();
    const making = regionOf(container, 'making');

    const name = making.getAttribute('aria-label') ?? '';
    expect(name).toContain('Fill: Moderate');
    expect(bandFor(scores.get('making')!.fill)).toBe('Moderate');
    // No number after "Fill:" — F34 forbids the denominator the band replaces.
    expect(name).not.toMatch(/Fill:\s*[\d.]/);

    expect(making.querySelector('.region-band')).toBeNull();
    focus(making);
    expect(making.querySelector('.region-band')?.textContent?.trim()).toBe('Moderate');
  });

  it('carries no band threshold of its own (T26/F18)', () => {
    const component = source('MapRenderer.svelte');
    const presentation = source('map-presentation.ts');

    for (const boundary of BANDS.slice(1).map((band) => String(band.from))) {
      expect(component).not.toContain(boundary);
      expect(presentation).not.toContain(boundary);
    }
  });
});

describe('MapRenderer — recency and breadth (§10.5, D-20, F35)', () => {
  it('renders recency as a literal date, with no elapsed-time computation', () => {
    const { container } = mount();
    const making = regionOf(container, 'making');

    expect(making.querySelector('.region-recency')?.textContent?.trim()).toBe(
      'Last activity — 12 March 2026',
    );
    expect(making.getAttribute('aria-label')).toContain('Last activity — 12 March 2026');
  });

  it('says "No activity yet" rather than inventing a date', () => {
    const { container } = mount();
    const mind = regionOf(container, 'mind');

    expect(mind.querySelector('.region-recency')?.textContent?.trim()).toBe('No activity yet');
    expect(mind.getAttribute('aria-label')).toContain('No activity yet');
  });

  it('renders breadth as a plain integer count of the domain’s started skills', () => {
    const { container } = mount();

    expect(regionOf(container, 'making').querySelector('.region-breadth')?.textContent?.trim()).toBe(
      '3',
    );
    expect(ROWS.filter((skill) => skill.domain === 'making')).toHaveLength(3);
    expect(regionOf(container, 'mind').querySelector('.region-breadth')?.textContent?.trim()).toBe(
      '0',
    );
  });

  it('has no fade, shimmer, or decay constant anywhere in the component (D-20, R-20)', () => {
    const component = codeOf(source('MapRenderer.svelte'));

    for (const forbidden of ['shimmer', 'decay', 'saturate(', 'halfLife', 'Date.now']) {
      expect(component).not.toContain(forbidden);
    }
  });
});

describe('MapRenderer — fog (§10.5, F22)', () => {
  it('fogs a domain with no published trees even when the user has progress there', () => {
    const { container, scores } = mount();

    // The premise: user state says otherwise, and it loses.
    expect(scores.get('play')!.breadth).toBe(1);

    const play = regionOf(container, 'play');
    expect(play.classList.contains('is-fogged')).toBe(true);
    expect(play.querySelector('.region-label')?.textContent?.trim()).toBe(FOG_AFFORDANCE);
    expect(play.getAttribute('aria-label')).toBe('Play. No skills published yet — contribute one.');
    // No quantitative channel on a region the library has nothing for.
    expect(play.querySelector('.region-fill')).toBeNull();
    expect(play.querySelector('.region-breadth')).toBeNull();
  });

  it('does not fog a published domain the user has never touched', () => {
    const { container } = mount();
    const mind = regionOf(container, 'mind');

    expect(mind.classList.contains('is-fogged')).toBe(false);
    expect(mind.querySelector('.region-label')?.textContent?.trim()).toBe('Mind');
  });
});

describe('MapRenderer — subregions (§10.6, F27)', () => {
  it('draws Making’s subregions as interior lines, never as separate fills or outlines', () => {
    const { container } = mount();
    const making = regionOf(container, 'making');
    const subregions = making.querySelector('.subregions');

    expect(subregions).not.toBeNull();
    expect(subregions!.querySelectorAll('.region-fill')).toHaveLength(0);
    expect(subregions!.querySelectorAll('.region-outline')).toHaveLength(0);

    const boundaries = subregions!.querySelectorAll('.subregion-boundary');
    expect(boundaries).toHaveLength(3);
    for (const boundary of boundaries) expect(boundary.getAttribute('fill')).toBe('none');
    expect([...subregions!.querySelectorAll('.subregion-label')].map((l) => l.textContent)).toEqual([
      'Expression',
      'Objects',
      'Systems',
    ]);
  });

  it('gives no other domain subregions at all', () => {
    const { container } = mount();
    expect(regionOf(container, 'mind').querySelector('.subregions')).toBeNull();
  });
});

describe('MapRenderer — navigation (§10.7, F23)', () => {
  it('opens the domain listing on click and on Enter or Space', () => {
    const { container, onselect } = mount();
    const body = regionOf(container, 'body');

    click(body);
    expect(onselect).toHaveBeenCalledWith({ domain: 'body', href: '/d/body' });

    press(body, 'Enter');
    press(body, ' ');
    expect(onselect).toHaveBeenCalledTimes(3);
  });

  it('makes every region focusable and announced, fogged ones included', () => {
    const { container } = mount();

    for (const domain of DOMAINS) {
      const region = regionOf(container, domain);
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(region.getAttribute('role')).toBe('link');
      expect(region.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('follows the manifest’s domain order, not pixel position (§10.7, §15.3)', () => {
    const { container, manifest } = mount();

    expect(readingOrder(container)).toEqual([...DOMAINS]);
    // The geometry disagrees, which is what makes the assertion worth making.
    expect(manifest.taxonomy.map.regions.map((region) => region.domain)).not.toEqual([...DOMAINS]);
  });
});

describe('MapRenderer — below the legibility threshold (§10.7, §15.3)', () => {
  it('substitutes a domain list carrying the same three channels', () => {
    const { container } = mount({ viewport: 'list' });

    expect(container.querySelector('svg.world-map')).toBeNull();
    const making = regionOf(container, 'making');

    expect(making.getAttribute('href')).toBe('/d/making');
    expect(making.querySelector('.region-band')?.textContent?.trim()).toBe('Moderate');
    expect(making.querySelector('.region-breadth')?.textContent?.trim()).toBe('3');
    expect(making.querySelector('.region-recency')?.textContent?.trim()).toBe(
      'Last activity — 12 March 2026',
    );
  });

  it('keeps the map’s reading order, so the two views converge (§15.3)', () => {
    const { container } = mount({ viewport: 'list' });
    expect(readingOrder(container)).toEqual([...DOMAINS]);
  });

  it('carries the fog affordance into the list too', () => {
    const { container } = mount({ viewport: 'list' });
    const play = regionOf(container, 'play');

    expect(play.textContent).toContain(FOG_AFFORDANCE);
    expect(play.querySelector('.region-breadth')).toBeNull();
  });

  it('reports the intent on click, so the shell owns the route (§13.4)', () => {
    const { container, onselect } = mount({ viewport: 'list' });
    click(regionOf(container, 'home'));
    expect(onselect).toHaveBeenCalledWith({ domain: 'home', href: '/d/home' });
  });
});

describe('map presentation helpers', () => {
  it('rises the fill rectangle from the base and clamps to the region', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 200 };

    expect(fillRect(bounds, 0)).toEqual({ x: 10, y: 220, width: 100, height: 0 });
    expect(fillRect(bounds, 0.5)).toEqual({ x: 10, y: 120, width: 100, height: 100 });
    expect(fillRect(bounds, 4)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
  });

  it('unions every region into one viewBox', () => {
    expect(
      mapViewBox([
        { domain: 'making', path: squarePath(0) },
        { domain: 'mind', path: squarePath(200) },
      ]),
    ).toEqual({ x: 0, y: 0, width: 300, height: 100 });
  });

  it('formats a stored stamp in UTC and nothing else', () => {
    expect(formatLastActivity('2026-03-12T23:30:00.000Z')).toBe('Last activity — 12 March 2026');
    expect(formatLastActivity(null)).toBe('No activity yet');
  });

  it('counts skills started in words for the accessible name', () => {
    expect(breadthText(0)).toBe('No skills started');
    expect(breadthText(1)).toBe('1 skill started');
    expect(breadthText(4)).toBe('4 skills started');
  });

  it('builds §15.3’s name from every channel', () => {
    const score: DomainScore = {
      domain: 'making',
      score: 45,
      fill: 45 / 93,
      breadth: 4,
      lastActivityAt: '2026-03-12T09:00:00.000Z',
    };

    expect(regionAccessibleName('Making', score, false)).toBe(
      'Making. 4 skills started. Fill: Moderate. Last activity — 12 March 2026.',
    );
    expect(regionAccessibleName('Play', score, true)).toBe(
      'Play. No skills published yet — contribute one.',
    );
  });

  it('documents one legibility threshold, in one place', () => {
    expect(MAP_LIST_BELOW).toBeGreaterThan(0);
  });
});
