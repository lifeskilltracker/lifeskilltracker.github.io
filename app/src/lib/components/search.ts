/**
 * §6.2's matcher (T33). Pure: no DOM, no manifest, no state.
 *
 * **Find is the only filter UI in the application**, which is what makes this
 * function's field coverage a product decision rather than an implementation
 * detail. §6.2's three worked examples — "knitting", "outdoors", "level 3" — are
 * a title, a domain, and an attained level, and each one has to work or the
 * sentence claiming Find doubles as the filter stops being true.
 *
 * **It runs over the manifest's projection, never over bundles.** Reaching into
 * milestone text would put the whole library on the first-paint budget (§17.1),
 * and the projection this takes is built in `lib/actions/searchable-skills.ts`
 * — the one layer §14.1 lets hold a manifest and a `SKILL` row at once.
 *
 * **`top` is total and stable.** `Enter` flies to it (§6.2), so a query that
 * ranked by iteration order would fly to two different skills on two loads of
 * the same data. The tie-break is the tree id, which is immutable after merge.
 */

import type { DomainId } from '$lib/types';

export interface SearchableSkill {
  readonly treeId: string;
  readonly title: string;
  readonly domain: DomainId;
  readonly subregion: string | null;
  readonly facets: readonly string[];
  readonly attainedLevel: number;
}

export interface SearchResult {
  /** Tree ids at full strength; everything else dims (§6.2). */
  readonly matches: ReadonlySet<string>;
  /** Regions containing a match — the level-0 highlight, where hexes are absent. */
  readonly domains: ReadonlySet<DomainId>;
  /** The tree id `Enter` flies to, or `null`. */
  readonly top: string | null;
}

/**
 * What the map needs from a result. `MapRenderer` and `SkillHexLayer` take this
 * rather than the whole `SearchResult`: `top` is `Enter`'s business and belongs
 * to the shell, and a renderer that could see it is a renderer that could be
 * made to fly to it.
 */
export type SearchHighlight = Pick<SearchResult, 'matches' | 'domains'>;

/**
 * Case and diacritics folded together, because they are the same mistake from
 * the user's side: a reader who types "cafe" for "Café" and gets nothing
 * concludes the skill is missing from the library, not that they mistyped.
 */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * A compound domain id reads as two words to a user — nobody types the hyphen in
 * "outdoors-nature". Folding it to a space is what makes "work money" and
 * "outdoors" both find their region.
 */
function haystack(skill: SearchableSkill): string {
  return fold(
    [skill.title, skill.domain.replace(/-/g, ' '), skill.subregion ?? '', ...skill.facets].join(' '),
  );
}

/** `level 3`, `level3` — §6.2's third worked example, and the only structured term. */
const LEVEL_TERM = /level\s*(\d+)/g;

interface Query {
  readonly terms: readonly string[];
  readonly levels: readonly number[];
}

function parse(query: string): Query {
  const folded = fold(query);
  const levels: number[] = [];
  const rest = folded.replace(LEVEL_TERM, (_match, digits: string) => {
    levels.push(Number(digits));
    return ' ';
  });
  return { terms: rest.split(/\s+/).filter((term) => term.length > 0), levels };
}

/**
 * Lower is better. Title matches outrank matches found only in a domain,
 * subregion or facet, because a user who types a skill's name means that skill
 * — and an exact title outranks a title that merely contains the term, so
 * "knitting" flies to Knitting rather than to Machine Knitting Patterns.
 */
function rank(skill: SearchableSkill, query: Query): number {
  const title = fold(skill.title);
  if (query.terms.length > 0 && title === query.terms.join(' ')) return 0;
  if (query.terms.some((term) => title.startsWith(term))) return 1;
  if (query.terms.some((term) => title.includes(term))) return 2;
  return 3;
}

export function search(query: string, skills: readonly SearchableSkill[]): SearchResult {
  const parsed = parse(query);
  if (parsed.terms.length === 0 && parsed.levels.length === 0) {
    return { matches: new Set(), domains: new Set(), top: null };
  }

  // Every term narrows, rather than widening: a filter that ORed its terms would
  // return more results the more precisely the user described what they wanted.
  const matched = skills.filter((skill) => {
    const text = haystack(skill);
    return (
      parsed.terms.every((term) => text.includes(term)) &&
      parsed.levels.every((level) => skill.attainedLevel === level)
    );
  });

  const ordered = [...matched].sort((a, b) => {
    const byRank = rank(a, parsed) - rank(b, parsed);
    return byRank !== 0 ? byRank : a.treeId.localeCompare(b.treeId);
  });

  return {
    matches: new Set(ordered.map((skill) => skill.treeId)),
    domains: new Set(ordered.map((skill) => skill.domain)),
    top: ordered[0]?.treeId ?? null,
  };
}
