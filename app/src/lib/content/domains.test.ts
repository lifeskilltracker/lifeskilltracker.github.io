/**
 * The prerender entry list matches the compiled taxonomy (T14, §13.1).
 *
 * §13.1 promises one prerendered `/d/<domainId>` page per domain, and the only
 * thing making that true is `DOMAIN_IDS`. A ninth domain added to
 * `content/taxonomy/domains.yaml` would otherwise ship as a route with no
 * prerendered page and no error anywhere — a 404 in production, discovered by a
 * user.
 *
 * It reads the **compiled** manifest under `static/content`, because that is
 * what the app actually serves; the authored YAML is `lst compile`'s input and
 * `tools/` already tests the transformation between them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '$lib/types';
import { DOMAIN_IDS, isDomainId } from './domains.js';

const manifest = JSON.parse(
	readFileSync(fileURLToPath(new URL('../../../static/content/manifest.json', import.meta.url)), 'utf8')
) as Manifest;

describe('the locked domain ids', () => {
	it('covers every domain in the compiled taxonomy, in order', () => {
		expect([...DOMAIN_IDS]).toEqual(manifest.taxonomy.domains.map((domain) => domain.id));
	});

	it('covers every domain a compiled tree claims', () => {
		for (const tree of manifest.trees) {
			expect(isDomainId(tree.domain)).toBe(true);
		}
	});

	it('rejects an id the taxonomy does not declare', () => {
		expect(isDomainId('mind')).toBe(true);
		expect(isDomainId('minds')).toBe(false);
		expect(isDomainId('')).toBe(false);
	});
});
