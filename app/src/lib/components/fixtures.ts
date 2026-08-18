/**
 * Manifest and progress fixtures for the map's tests (T13, extracted by T20).
 *
 * Extracted when `MapRenderer.a11y.test.ts` needed the same eight-domain
 * manifest that `MapRenderer.test.ts` already had. A second copy would have been
 * a hundred lines of geometry to keep in step, and the *first* thing to rot in
 * a duplicated fixture is the deliberate awkwardness — here, that the region
 * order in `taxonomy.map.regions` disagrees with the domain order on purpose, so
 * a test that read the reading order off the geometry comes out backwards
 * (§10.7, §15.3).
 */

import type { DomainSkillRow, Manifest } from '$lib/types';

export const DOMAINS = [
  'making',
  'mind',
  'body',
  'home',
  'people',
  'work-money',
  'play',
  'outdoors-nature',
] as const;

export const TITLES: Record<string, string> = {
  making: 'Making',
  mind: 'Mind',
  body: 'Body',
  home: 'Home',
  people: 'People',
  'work-money': 'Work & Money',
  play: 'Play',
  'outdoors-nature': 'Outdoors & Nature',
};

/** A square region at `(x, 0)`, 100 × 100 — the shape of the compiler's output, not its geometry. */
export function squarePath(x: number): string {
  return `M ${x},0 L ${x + 100},0 L ${x + 100},100 L ${x},100 Z`;
}

export interface ManifestOptions {
  /** Domains the library has published a tree for. Everything else is fogged (F22). */
  published?: readonly string[];
  /**
   * Region order in `taxonomy.map.regions`, and therefore pixel order — the
   * reading order must not follow it (§10.7).
   */
  regionOrder?: readonly string[];
}

export function manifestFixture(options: ManifestOptions = {}): Manifest {
  const published = options.published ?? DOMAINS.filter((domain) => domain !== 'play');
  const regionOrder = options.regionOrder ?? [...DOMAINS].reverse();

  return {
    schemaVersion: 1,
    generated: '2026-08-13T00:00:00Z',
    moved: {},
    taxonomy: {
      // Reading order is this array's order (§10.7).
      domains: DOMAINS.map((domain) =>
        domain === 'making'
          ? {
              id: 'making' as const,
              title: TITLES[domain],
              blurb: `${TITLES[domain]} blurb`,
              palette: { light: { base: '#ddd', accent: '#333' }, dark: { base: '#ddd', accent: '#333' } },
              subregions: [
                { id: 'expression' as const, title: 'Expression' },
                { id: 'objects' as const, title: 'Objects' },
                { id: 'systems' as const, title: 'Systems' },
              ],
            }
          : {
              id: domain as Exclude<(typeof DOMAINS)[number], 'making'>,
              title: TITLES[domain],
              blurb: `${TITLES[domain]} blurb`,
              palette: { light: { base: '#ddd', accent: '#333' }, dark: { base: '#ddd', accent: '#333' } },
            },
      ),
      facets: [],
      map: {
        regions: regionOrder.map((domain, index) => ({
          domain: domain as (typeof DOMAINS)[number],
          // Descending x against the reading order, so a test that read the tab
          // order off the geometry would come out backwards.
          path: squarePath((regionOrder.length - index) * 120),
          label: { x: (regionOrder.length - index) * 120 + 50, y: 50 },
          bounds: { x: (regionOrder.length - index) * 120, y: 0, width: 100, height: 100 },
          ...(domain === 'making'
            ? {
                subregions: [
                  { id: 'expression' as const, path: squarePath((regionOrder.length - index) * 120) },
                  { id: 'objects' as const, path: squarePath((regionOrder.length - index) * 120) },
                  { id: 'systems' as const, path: squarePath((regionOrder.length - index) * 120) },
                ],
              }
            : {}),
        })),
      },
    },
    trees: published.map((domain, index) => ({
      id: `${domain}-tree`,
      contentVersion: 1,
      title: `${TITLES[domain]} tree`,
      summary: 'fixture',
      domain,
      facets: [],
      milestoneCount: 40,
      authors: ['fixture'],
      bundle: `bundles/${index}.json`,
      // §5.4's glyph fact, on the manifest so the map draws it without fetching
      // a bundle. Alternating, so a fixture map has both marks on it.
      hasMastery: index % 2 === 0,
      // The compiler's committed sub-lattice cell (§5.3). One per tree, distinct;
      // the geometry is not the fixture's business, only that the field is there.
      cell: { q: index * 4, r: 0 },
    })),
  } as Manifest;
}

export function row(
  domain: string,
  treeId: string,
  attainedLevel: number,
  at: string,
): DomainSkillRow {
  return { treeId, domain, attainedLevel, lastActivityAt: at };
}

/**
 * Making: one skill at level 4 and two started but unranked → score 45,
 * fill 45/93 = 0.484 (Moderate), breadth 3, latest activity 12 March 2026.
 * Mind: published, nothing started. Play: started, but nothing published (F22).
 */
export const ROWS: DomainSkillRow[] = [
  row('making', 'making-tree', 4, '2026-03-12T09:00:00.000Z'),
  row('making', 'making-b', 0, '2026-01-04T09:00:00.000Z'),
  row('making', 'making-c', 0, '2026-02-20T09:00:00.000Z'),
  row('play', 'play-tree', 2, '2026-04-01T09:00:00.000Z'),
];
