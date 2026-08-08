import { describe, expect, it } from 'vitest';

import type { Manifest, MovedIndex, Taxonomy } from './index.js';

describe('type aliases (T02)', () => {
  it('defines Taxonomy and MovedIndex as Manifest projections', () => {
    const taxonomy: Taxonomy = {
      domains: [],
      facets: [],
      map: { regions: [] },
    };
    const moved: MovedIndex = {};

    expect(taxonomy.domains).toEqual([]);
    expect(moved).toEqual({});
  });

  it('keeps aliases aligned with generated Manifest fields', () => {
    type TaxonomyExtends = Taxonomy extends Manifest['taxonomy'] ? true : never;
    type MovedExtends = MovedIndex extends Manifest['moved'] ? true : never;
    type TaxonomyExact = Manifest['taxonomy'] extends Taxonomy ? true : never;
    type MovedExact = Manifest['moved'] extends MovedIndex ? true : never;

    const checks: [TaxonomyExtends, MovedExtends, TaxonomyExact, MovedExact] = [
      true,
      true,
      true,
      true,
    ];
    expect(checks.every(Boolean)).toBe(true);
  });
});
