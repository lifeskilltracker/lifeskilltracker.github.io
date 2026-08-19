/**
 * §6.2's projection, and the enforcement of "it shall not silently omit a
 * content type" (T33).
 *
 * **The field enumeration is the point of this file.** §6.2's promise is prose,
 * and prose cannot enforce itself: the failure it describes is a field added to
 * the manifest years from now that nobody thinks to match, which no test written
 * against today's fields would ever catch. So the searchable set is asserted
 * against `schema/manifest.schema.json` — the authority on what a tree entry
 * carries — and every property has to be classified as searched or deliberately
 * not. A new field fails this test until someone decides which it is.
 *
 * It reads the schema rather than a TypeScript type because the optional fields
 * (`subregion`, `secondaryDomains`, `archetype`) are absent from any given
 * instance, so enumerating an object would silently under-report exactly the
 * fields most likely to be forgotten.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { manifestFixture } from '$lib/components/fixtures.js';
import type { Manifest } from '$lib/types';
import { SEARCHED_TREE_FIELDS, UNSEARCHED_TREE_FIELDS, searchableSkills } from './searchable-skills.js';

const SCHEMA = JSON.parse(
  readFileSync(new URL('../../../../schema/manifest.schema.json', import.meta.url), 'utf8'),
) as { $defs: { treeEntry: { properties: Record<string, unknown> } } };

describe('§6.2 — no content type is silently omitted', () => {
  it('classifies every property the schema puts on a tree entry', () => {
    const onSchema = Object.keys(SCHEMA.$defs.treeEntry.properties).sort();
    const classified = [...SEARCHED_TREE_FIELDS, ...Object.keys(UNSEARCHED_TREE_FIELDS)].sort();

    expect(classified).toEqual(onSchema);
  });

  it('classifies each property exactly once', () => {
    for (const field of SEARCHED_TREE_FIELDS) {
      expect(UNSEARCHED_TREE_FIELDS).not.toHaveProperty(field);
    }
  });

  it('searches the four types §6.2 names', () => {
    expect([...SEARCHED_TREE_FIELDS].sort()).toEqual(['domain', 'facets', 'subregion', 'title']);
  });

  it('states a reason for every property it does not search', () => {
    for (const [field, reason] of Object.entries(UNSEARCHED_TREE_FIELDS)) {
      expect(reason, field).not.toBe('');
    }
  });
});

/** A manifest whose facets carry titles distinct from their ids, and one tree with a subregion. */
function manifest(): Manifest {
  const base = manifestFixture();
  return {
    ...base,
    taxonomy: {
      ...base.taxonomy,
      facets: [
        { id: 'textile', title: 'Textiles' },
        { id: 'metal', title: 'Metalwork' },
      ],
    },
    trees: base.trees.map((tree) =>
      tree.domain === 'making'
        ? { ...tree, subregion: 'objects' as const, facets: ['textile'] }
        : tree,
    ),
  };
}

describe('the projection', () => {
  it('covers every published tree, not just one domain — Find is map-wide', () => {
    const rows = searchableSkills(manifest(), {});

    expect(rows.length).toBe(manifest().trees.length);
  });

  it('carries the subregion, and null where a domain has none', () => {
    const rows = searchableSkills(manifest(), {});

    expect(rows.find((row) => row.domain === 'making')?.subregion).toBe('objects');
    expect(rows.find((row) => row.domain === 'mind')?.subregion).toBeNull();
  });

  it('carries both the facet id and its title, so either finds the skill', () => {
    const rows = searchableSkills(manifest(), {});

    expect(rows.find((row) => row.domain === 'making')?.facets).toEqual(['textile', 'Textiles']);
  });

  it('carries the attained level from the mirror, and 0 for an unstarted skill', () => {
    const rows = searchableSkills(manifest(), {
      'making-tree': { treeId: 'making-tree', attainedLevel: 4 },
    } as never);

    expect(rows.find((row) => row.treeId === 'making-tree')?.attainedLevel).toBe(4);
    expect(rows.find((row) => row.treeId === 'mind-tree')?.attainedLevel).toBe(0);
  });
});
