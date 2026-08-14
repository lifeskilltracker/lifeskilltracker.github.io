/**
 * The manifest × `SKILL` join (T26/F4) and what it does with a row the manifest
 * has never heard of (T26/F22, §16.3).
 *
 * The second is the one worth a test. A started skill whose tree has left the
 * library must vanish from every score and every breadth count **and from
 * nothing else** — and "dropped from the join" and "deleted" are the same thing
 * from anywhere except `/data`, which is why `unmatched` exists at all.
 */

import { describe, expect, it } from 'vitest';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import type { SkillRecord } from '$lib/state/types.js';
import type { Manifest } from '$lib/types';
import { joinDomainRows, standings, worldScores } from './domain-scores.js';

const TAXONOMY = {
	domains: [
		{ id: 'home', title: 'Home', blurb: '', palette: { base: '#000', accent: '#fff' } },
		{ id: 'body', title: 'Body', blurb: '', palette: { base: '#000', accent: '#fff' } }
	],
	facets: [],
	map: { regions: [] }
};

function manifest(ids: string[], domain = 'home'): Manifest {
	const base = manifestFixture(ids.map((id) => ({ id, bundle: `trees/${id}.abc.json` })));
	(base as { taxonomy: unknown }).taxonomy = TAXONOMY;
	for (const tree of (base as { trees: { domain: string }[] }).trees) tree.domain = domain;
	return base as unknown as Manifest;
}

function skill(treeId: string, attainedLevel: number, at = '2026-08-14T10:00:00.000Z'): SkillRecord {
	return {
		treeId,
		startedAt: at,
		attainedLevel,
		lastActivityAt: at,
		contentVersionSeen: 1,
		grandfathered: {}
	};
}

const byId = (...records: SkillRecord[]): Record<string, SkillRecord> =>
	Object.fromEntries(records.map((record) => [record.treeId, record]));

describe('the join', () => {
	it('pairs a SKILL row with its manifest entry’s domain', () => {
		const { rows, unmatched } = joinDomainRows(manifest(['cooking']), byId(skill('cooking', 4)));

		expect(rows).toEqual([
			{
				treeId: 'cooking',
				domain: 'home',
				attainedLevel: 4,
				lastActivityAt: '2026-08-14T10:00:00.000Z'
			}
		]);
		expect(unmatched).toEqual([]);
	});

	it('drops a row with no manifest entry — and keeps the record (T26/F22)', () => {
		const skills = byId(skill('cooking', 4), skill('forged-in-a-fork', 7));
		const { rows, unmatched } = joinDomainRows(manifest(['cooking']), skills);

		expect(rows.map((row) => row.treeId)).toEqual(['cooking']);
		expect(unmatched.map((record) => record.treeId)).toEqual(['forged-in-a-fork']);
		// The record itself is untouched, which is what /data lists.
		expect(unmatched[0].attainedLevel).toBe(7);
	});

	it('excludes an unmatched row from the score and the breadth count', () => {
		const withOrphan = worldScores(
			manifest(['cooking']),
			byId(skill('cooking', 4), skill('gone', 10))
		);
		const withoutOrphan = worldScores(manifest(['cooking']), byId(skill('cooking', 4)));

		expect(withOrphan.scores.get('home')).toEqual(withoutOrphan.scores.get('home'));
		expect(withOrphan.scores.get('home')?.breadth).toBe(1);
	});

	it('is total over the taxonomy, so the renderer never sees undefined', () => {
		const { scores } = worldScores(manifest(['cooking']), {});

		expect([...scores.keys()].sort()).toEqual(['body', 'home']);
		expect(scores.get('body')).toEqual({
			domain: 'body',
			score: 0,
			fill: 0,
			breadth: 0,
			lastActivityAt: null
		});
	});

	it('counts a started but unranked skill in breadth and not in score (F35)', () => {
		const { scores } = worldScores(manifest(['cooking']), byId(skill('cooking', 0)));

		expect(scores.get('home')?.breadth).toBe(1);
		expect(scores.get('home')?.score).toBe(0);
	});
});

describe('standings', () => {
	it('carries the tier that goes with the stored level', () => {
		expect(standings(byId(skill('cooking', 4))).get('cooking')).toEqual({
			attainedLevel: 4,
			tier: 'Apprentice'
		});
	});

	it('leaves level 0 unranked rather than calling it Novice (§11.3)', () => {
		expect(standings(byId(skill('cooking', 0))).get('cooking')?.tier).toBeNull();
	});

	it('has no entry for a skill that was never started', () => {
		expect(standings({}).get('cooking')).toBeUndefined();
	});
});
