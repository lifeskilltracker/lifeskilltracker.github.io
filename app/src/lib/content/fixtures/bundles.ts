/**
 * The four bundles §7.5's assertion has to sort between, plus the manifest that
 * points at them.
 *
 * Built rather than checked in as JSON files: a valid bundle is ten levels of
 * four-to-eight milestones, so a literal runs to hundreds of lines and the one
 * detail each fixture exists to demonstrate gets lost in it. The truncated
 * fixture cannot be a `.json` file at all — it is deliberately unparseable.
 */

import { CURRENT_SCHEMA_VERSION } from '../assert-shape.js';

export interface BundleFixtureOptions {
  id?: string;
  contentVersion?: number;
  schemaVersion?: number;
  levelCount?: number;
}

export function bundleFixture(options: BundleFixtureOptions = {}): Record<string, unknown> {
  const {
    id = 'cooking',
    contentVersion = 1,
    schemaVersion = CURRENT_SCHEMA_VERSION,
    levelCount = 10,
  } = options;

  const milestones: {
    id: string;
    uid: string;
    title: string;
    level: number;
    track: string;
    trackIndex: number;
    order: number;
    requires: never[];
  }[] = [];
  for (let level = 1; level <= levelCount; level += 1) {
    for (let i = 0; i < 4; i += 1) {
      milestones.push({
        id: `${id}-${level}-${i}`,
        uid: `U${level}${i}`.padEnd(8, '0'),
        title: `Milestone ${level}.${i}`,
        level,
        track: '',
        trackIndex: 0,
        order: i,
        requires: [],
      });
    }
  }

  const levels = Array.from({ length: levelCount }, (_, i) => {
    const level = i + 1;
    const refs = milestones
      .map((m, index) => ({ m, index }))
      .filter(({ m }) => m.level === level)
      .map(({ m, index }) => ({ index, slug: m.id }));
    return {
      level,
      milestones: refs,
      requirements: [{ rule: 'all', milestones: refs.map((r) => r.slug) }],
    };
  });

  return {
    schemaVersion,
    contentVersion,
    id,
    title: id,
    summary: `${id} fixture`,
    domain: 'home',
    provenance: { authors: [{ name: 'fixture' }], copyleftDerived: false },
    levels,
    milestones,
  };
}

/** Passes both §7.5 checks. */
export const VALID_BUNDLE = bundleFixture();

/** Fails check 2 — the realistic stale-cache failure after a level-count change. */
export const NINE_LEVEL_BUNDLE = bundleFixture({ id: 'nine', levelCount: 9 });

/** Fails check 1 — written by a newer app than the one reading it (§5.10). */
export const FUTURE_SCHEMA_BUNDLE = bundleFixture({
  id: 'future',
  schemaVersion: CURRENT_SCHEMA_VERSION + 1,
});

/** Passes check 1 — §5.10 supports the current version and one prior. */
export const PRIOR_SCHEMA_BUNDLE = bundleFixture({
  id: 'prior',
  schemaVersion: CURRENT_SCHEMA_VERSION - 1,
});

/** A truncated response: valid prefix, no closing brace. */
export const TRUNCATED_BUNDLE_TEXT = JSON.stringify(VALID_BUNDLE).slice(0, 400);

export interface ManifestFixtureEntry {
  id: string;
  bundle: string;
  contentVersion?: number;
}

export function manifestFixture(entries: ManifestFixtureEntry[]): Record<string, unknown> {
  return {
    schemaVersion: 1,
    // A build stamp for humans, explicitly NOT comparable and never a cache key.
    generated: '2026-08-13T00:00:00Z',
    taxonomy: { domains: [], facets: [], map: { regions: [] } },
    moved: {},
    trees: entries.map((entry) => ({
      id: entry.id,
      // Per-tree since T26/F8; the library-wide counter is gone (§5.3).
      contentVersion: entry.contentVersion ?? 1,
      title: entry.id,
      summary: `${entry.id} fixture`,
      domain: 'home',
      facets: [],
      milestoneCount: 40,
      authors: ['fixture'],
      bundle: entry.bundle,
    })),
  };
}
