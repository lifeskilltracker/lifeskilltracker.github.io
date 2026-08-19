/**
 * §6.2's projection — one searchable row per published tree (T33).
 *
 * **This is `lib/actions` for the same reason `skill-hexes.ts` is.** A row needs
 * the manifest (title, domain, subregion, facets) and the `SKILL` mirror
 * (attained level, for §6.2's "level 3") at once, and §14.1 gives exactly one
 * layer permission to hold both. `search.ts` stays pure over the result, and
 * `Find.svelte` imports neither the loader nor `lib/state`.
 *
 * **It covers the whole map, not one domain.** Find highlights matches "across
 * the whole map" and works at level 0 as well as level 1, so scoping this to the
 * focused domain would make the level-0 half of §6.2 impossible.
 *
 * **The field classification below is load-bearing.** §6.2 promises Find "shall
 * not silently omit a content type"; `searchable-skills.test.ts` asserts these
 * two collections against `schema/manifest.schema.json`, so a field added to the
 * manifest fails the build until someone decides whether Find should match it.
 * That is the enforcement — the sentence in the spec is not.
 */

import type { SkillRecord } from '$lib/state/types.js';
import type { SearchableSkill } from '$lib/components/search.js';
import type { Manifest } from '$lib/types';

/** The four content types §6.2 names, as they appear on a manifest tree entry. */
export const SEARCHED_TREE_FIELDS: readonly string[] = ['title', 'domain', 'subregion', 'facets'];

/**
 * Everything else on a tree entry, with why Find does not match it. A reason is
 * required rather than encouraged: the test asserts each is non-empty, so
 * "because nobody got round to it" has to be written down as such.
 */
export const UNSEARCHED_TREE_FIELDS: Readonly<Record<string, string>> = {
  id: 'The identity, not a content type. It is what a match returns, and it duplicates the title in slug form — matching it would light up skills whose visible name does not contain the term.',
  contentVersion: 'A number the reader never sees.',
  summary:
    'Prose the map does not draw. A highlight cannot say why a skill matched, so a hit on invisible text reads as a bug rather than as a result.',
  secondaryDomains:
    'The map draws a skill in its primary region only (§11.6), so a match here would have nowhere to light up.',
  archetype: 'An authoring shape, not a user-facing content type (S1 keeps it out of the UI).',
  milestoneCount: 'A count, and §6.2 gives Find no numeric range syntax.',
  authors: 'Attribution, surfaced by the detail panel (F6). Searching people is a different feature.',
  bundle: 'A URL.',
  hasMastery: 'A boolean glyph channel (§5.4); nothing to type.',
  cell: 'Lattice coordinates (§5.3).',
};

/**
 * The `SKILL` mirror as this function takes it, named here so a component can
 * type the prop without importing `lib/state` — which §14.1 forbids it, and
 * rightly: the point of the rule is that progress *arrives as a prop*, not that
 * the prop is nameless. `lib/actions` is the layer allowed to hold both.
 */
export type SkillMirror = Record<string, SkillRecord>;

export function searchableSkills(
  manifest: Manifest,
  skills: SkillMirror,
): SearchableSkill[] {
  // Both the id and the title, so "textile" and "Textiles" each find the skill:
  // the tag a user remembers is whichever one they last saw.
  const facetTitles = new Map(manifest.taxonomy.facets.map((facet) => [facet.id, facet.title]));

  return manifest.trees.map((tree) => ({
    treeId: tree.id,
    title: tree.title,
    domain: tree.domain,
    subregion: tree.subregion ?? null,
    facets: (tree.facets ?? []).flatMap((id) => {
      const title = facetTitles.get(id);
      return title === undefined || title === id ? [id] : [id, title];
    }),
    attainedLevel: skills[tree.id]?.attainedLevel ?? 0,
  }));
}
