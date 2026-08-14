/**
 * `/library`'s filter (§13.1) — domain, subregion, and facet over manifest
 * entries.
 *
 * A pure function over the manifest's `trees[]` and nothing else. §7.1's whole
 * reason for putting `domain`, `subregion` and `facets` in the *manifest* rather
 * than only in the bundles is that the library must be filterable without
 * fetching 164 bundles (§17.2), and that property is only preserved if the
 * filter never reaches for one.
 *
 * The three criteria are **conjunctive and independently optional** — an unset
 * criterion matches everything rather than nothing, which is the difference
 * between an empty library on first paint and a full one.
 */

import type { Manifest } from '$lib/types';

export type TreeEntry = Manifest['trees'][number];

export interface SkillFilter {
	readonly domain?: string;
	readonly subregion?: string;
	readonly facet?: string;
}

export function filterTrees(
	trees: readonly TreeEntry[],
	filter: SkillFilter
): readonly TreeEntry[] {
	return trees.filter((tree) => {
		if (filter.domain !== undefined && tree.domain !== filter.domain) return false;
		if (filter.subregion !== undefined && tree.subregion !== filter.subregion) return false;
		if (filter.facet !== undefined && !(tree.facets ?? []).includes(filter.facet)) return false;
		return true;
	});
}

/**
 * The subregions actually offered, given the rest of the filter. Only Making
 * has any (§5.9), so an unconditional subregion control would be dead for seven
 * domains out of eight.
 */
export function subregionsOf(manifest: Manifest, domain: string | undefined): string[] {
	const domains = manifest.taxonomy.domains.filter(
		(entry) => domain === undefined || entry.id === domain
	);
	const ids = new Set<string>();
	for (const entry of domains) {
		for (const subregion of entry.subregions ?? []) ids.add(subregion.id);
	}
	return [...ids];
}
