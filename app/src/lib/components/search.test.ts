/**
 * §6.2's matcher (T33).
 *
 * Find is **the only filter UI in the application**, so what this function
 * matches on is the whole of what a user can filter by. The three claims worth
 * a test each:
 *
 * - **Every content type is reachable.** "It shall not silently omit a content
 *   type" is prose, and prose cannot enforce itself; the enumeration test lives
 *   beside the builder in `lib/actions`, and these tests pin that each field the
 *   projection carries actually matches once it is there.
 * - **Folding is the difference between a filter and a trick.** A user typing
 *   "cafe" for "Café" and getting nothing concludes the skill is not in the
 *   library, not that they mistyped.
 * - **`top` is deterministic.** `Enter` flies to it, so an unstable ordering
 *   makes the same query fly two different places on two loads.
 */

import { describe, expect, it } from 'vitest';
import { search, type SearchableSkill } from './search.js';

function skill(over: Partial<SearchableSkill> & { treeId: string }): SearchableSkill {
  return {
    title: over.treeId,
    domain: 'making',
    subregion: null,
    facets: [],
    attainedLevel: 0,
    ...over,
  } as SearchableSkill;
}

const SKILLS: SearchableSkill[] = [
  skill({ treeId: 'knitting', title: 'Knitting', domain: 'making', subregion: 'objects', facets: ['textile', 'Textiles'], attainedLevel: 3 }),
  skill({ treeId: 'blacksmithing', title: 'Blacksmithing', domain: 'making', subregion: 'objects', facets: ['metal', 'Metalwork'], attainedLevel: 6 }),
  skill({ treeId: 'foraging', title: 'Foraging', domain: 'outdoors-nature', subregion: null, facets: ['food', 'Food'], attainedLevel: 3 }),
  skill({ treeId: 'cafe-brewing', title: 'Café brewing', domain: 'home', subregion: null, facets: [], attainedLevel: 1 }),
  skill({ treeId: 'budgeting', title: 'Budgeting', domain: 'work-money', subregion: null, facets: [], attainedLevel: 0 }),
];

const ids = (query: string): string[] => [...search(query, SKILLS).matches].sort();

describe('§6.2 — an empty query is not a filter', () => {
  it('matches nothing and names no top hit for an empty query', () => {
    const result = search('', SKILLS);

    expect(result.matches.size).toBe(0);
    expect(result.domains.size).toBe(0);
    expect(result.top).toBeNull();
  });

  it('treats whitespace as empty rather than matching everything', () => {
    expect(search('   ', SKILLS).matches.size).toBe(0);
  });
});

describe('§6.2 — the four content types', () => {
  it('matches skill title, case-insensitively', () => {
    expect(ids('KNIT')).toEqual(['knitting']);
  });

  it('matches domain, folding the hyphen in a compound id', () => {
    expect(ids('outdoors')).toEqual(['foraging']);
    expect(ids('work money')).toEqual(['budgeting']);
  });

  it('matches subregion', () => {
    expect(ids('objects')).toEqual(['blacksmithing', 'knitting']);
  });

  it('matches facet tags', () => {
    expect(ids('metalwork')).toEqual(['blacksmithing']);
  });
});

describe('§6.2 — "level 3" is a query a user will type', () => {
  it('matches attained level, not a substring of some title', () => {
    expect(ids('level 3')).toEqual(['foraging', 'knitting']);
  });

  it('accepts the level term with no space', () => {
    expect(ids('level6')).toEqual(['blacksmithing']);
  });

  it('combines a level term with a text term', () => {
    expect(ids('level 3 making')).toEqual(['knitting']);
  });

  it('does not match level 0 skills on a bare number appearing nowhere', () => {
    expect(ids('level 9')).toEqual([]);
  });
});

describe('§6.2 — folding', () => {
  it('matches across diacritics in both directions', () => {
    expect(ids('cafe')).toEqual(['cafe-brewing']);
    expect(ids('café')).toEqual(['cafe-brewing']);
  });
});

describe('§6.2 — multiple terms narrow', () => {
  it('requires every term to match, rather than any', () => {
    expect(ids('making objects')).toEqual(['blacksmithing', 'knitting']);
    expect(ids('making outdoors')).toEqual([]);
  });
});

describe('level 0 — the regions a match sits in', () => {
  it('reports the domains containing a match, for the level-0 highlight', () => {
    const result = search('objects', SKILLS);

    expect([...result.domains]).toEqual(['making']);
  });

  it('reports every distinct domain when matches straddle regions', () => {
    const result = search('level 3', SKILLS);

    expect([...result.domains].sort()).toEqual(['making', 'outdoors-nature']);
  });
});

describe('`Enter` flies to the top hit, so the top hit is deterministic', () => {
  it('prefers an exact title match over a longer title containing the term', () => {
    expect(search('knitting', SKILLS).top).toBe('knitting');
  });

  it('prefers a title prefix over a mid-title or non-title match', () => {
    // "for" is a prefix of Foraging, and appears mid-word nowhere else.
    expect(search('for', SKILLS).top).toBe('foraging');
  });

  it('prefers a title match over a match found only in a facet', () => {
    expect(search('metal', SKILLS).top).toBe('blacksmithing');
  });

  it('breaks ties by tree id, so the same query always flies to one place', () => {
    const result = search('objects', SKILLS);

    expect(result.top).toBe('blacksmithing');
  });

  it('names no top hit when nothing matches', () => {
    expect(search('zzz', SKILLS).top).toBeNull();
  });
});
