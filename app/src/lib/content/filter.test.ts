/**
 * `/library`'s filter (T14, §13.1).
 *
 * The case that matters is the empty one: three conjunctive predicates where an
 * unset criterion has to match *everything*. Getting that backwards renders an
 * empty library on first paint, which is indistinguishable from a library that
 * failed to load (§16.3) — and every other case here would still pass.
 */

import { describe, expect, it } from 'vitest';
import type { Manifest } from '$lib/types';
import { filterTrees, subregionsOf, type TreeEntry } from './filter.js';

const tree = (over: Partial<TreeEntry> & { id: string }): TreeEntry =>
	({
		contentVersion: 1,
		title: over.id,
		summary: '',
		domain: 'home',
		milestoneCount: 40,
		authors: [],
		bundle: `trees/${over.id}.abc.json`,
		...over
	}) as TreeEntry;

const TREES: TreeEntry[] = [
	tree({ id: 'cooking', domain: 'home', facets: ['practical', 'kitchen'] }),
	tree({ id: 'running', domain: 'body', facets: ['practical'] }),
	tree({ id: 'drawing', domain: 'making', subregion: 'expression', facets: ['teaching'] }),
	tree({ id: 'joinery', domain: 'making', subregion: 'objects' })
];

const ids = (entries: readonly TreeEntry[]) => entries.map((entry) => entry.id);

describe('filterTrees', () => {
	it('returns everything when nothing is set', () => {
		expect(ids(filterTrees(TREES, {}))).toEqual(['cooking', 'running', 'drawing', 'joinery']);
	});

	it('filters by domain', () => {
		expect(ids(filterTrees(TREES, { domain: 'making' }))).toEqual(['drawing', 'joinery']);
	});

	it('filters by subregion, and a tree with none never matches one', () => {
		expect(ids(filterTrees(TREES, { subregion: 'objects' }))).toEqual(['joinery']);
		expect(ids(filterTrees(TREES, { subregion: 'systems' }))).toEqual([]);
	});

	it('filters by facet, matching any of a tree’s facets', () => {
		expect(ids(filterTrees(TREES, { facet: 'practical' }))).toEqual(['cooking', 'running']);
		expect(ids(filterTrees(TREES, { facet: 'kitchen' }))).toEqual(['cooking']);
	});

	it('combines criteria conjunctively', () => {
		expect(ids(filterTrees(TREES, { domain: 'making', subregion: 'expression' }))).toEqual([
			'drawing'
		]);
		expect(ids(filterTrees(TREES, { domain: 'home', facet: 'teaching' }))).toEqual([]);
	});
});

describe('subregionsOf', () => {
	const manifest = {
		taxonomy: {
			domains: [
				{ id: 'home', title: 'Home' },
				{
					id: 'making',
					title: 'Making',
					subregions: [
						{ id: 'expression', title: 'Expression' },
						{ id: 'objects', title: 'Objects' }
					]
				}
			],
			facets: [],
			map: { regions: [] }
		},
		trees: []
	} as unknown as Manifest;

	it('offers none for a domain that has none', () => {
		expect(subregionsOf(manifest, 'home')).toEqual([]);
	});

	it('offers a domain’s own when one is selected', () => {
		expect(subregionsOf(manifest, 'making')).toEqual(['expression', 'objects']);
	});

	it('offers every declared subregion when no domain is selected', () => {
		expect(subregionsOf(manifest, undefined)).toEqual(['expression', 'objects']);
	});
});
