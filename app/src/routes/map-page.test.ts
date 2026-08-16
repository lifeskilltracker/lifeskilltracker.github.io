// @vitest-environment jsdom

/**
 * `/` — the world map route (T14, §13.1, §13.3).
 *
 * Two claims, and the second is the one with teeth:
 *
 * **The map appears when the manifest resolves**, with no full-page spinner at
 * any point before that — the chrome and a line of text, not a covered page
 * (§13.3 step 1).
 *
 * **The map is a function of the manifest and the `SKILL` store, and of nothing
 * else.** No bundle is fetched for it (§3.3, §14.4), which is what makes "one
 * tree's bundle failed" a statement about that tree alone (§16.3 row 3). The
 * test for that is negative and easy to lose: with every bundle unreachable, the
 * map still draws all eight regions with the right fills.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditAccessibility } from '$lib/components/axe.js';
import { cleanup, flushSync, render } from '$lib/components/test-harness.svelte.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { Manifest } from '$lib/types';
import type { SkillRecord } from '$lib/state/types.js';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import MapPage from './+page.svelte';

/** Two regions is enough; §10's geometry has its own tests (T12, T13). */
const TAXONOMY = {
	domains: [
		{ id: 'home', title: 'Home', blurb: 'home', palette: { light: { base: '#123456', accent: '#abcdef' }, dark: { base: '#123456', accent: '#abcdef' } } },
		{ id: 'body', title: 'Body', blurb: 'body', palette: { light: { base: '#654321', accent: '#fedcba' }, dark: { base: '#654321', accent: '#fedcba' } } }
	],
	facets: [],
	map: {
		regions: [
			{ domain: 'home', path: 'M 0,0 L 10,0 L 10,10 L 0,10 Z' },
			{ domain: 'body', path: 'M 20,0 L 30,0 L 30,10 L 20,10 Z' }
		]
	}
};

function manifest(): Manifest {
	const base = manifestFixture([{ id: 'cooking', bundle: 'trees/cooking.abc.json' }]);
	(base as { taxonomy: unknown }).taxonomy = TAXONOMY;
	return base as unknown as Manifest;
}

const skill = (treeId: string, attainedLevel: number): SkillRecord => ({
	treeId,
	startedAt: '2026-08-14T10:00:00.000Z',
	attainedLevel,
	lastActivityAt: '2026-08-14T10:00:00.000Z',
	contentVersionSeen: 1,
	grandfathered: {}
});

beforeEach(() => {
	progress.reset();
	content.reset();
	ui.reset();
});

afterEach(cleanup);

describe('the map route', () => {
	it('says it is loading rather than covering the page with a spinner', () => {
		const { container } = render(MapPage, {});

		expect(container.querySelector('[data-map-pending]')).not.toBeNull();
		// "Loading", never "no skills": §16.3 keeps those two apart everywhere.
		expect(container.textContent).not.toMatch(/no skills/i);
		expect(container.querySelector('svg')).toBeNull();
	});

	it('renders the map once the manifest resolves', () => {
		const { container } = render(MapPage, {});
		content.setManifest(manifest(), false);
		flushSync();

		expect(container.querySelector('[data-map-pending]')).toBeNull();
		expect(container.querySelectorAll('[data-domain]').length).toBeGreaterThanOrEqual(2);
	});

	it('draws the regions with no bundle loaded at all (§3.3, §16.3 row 3)', () => {
		content.setManifest(manifest(), false);
		progress.hydrated = true;
		progress.skills = { cooking: skill('cooking', 4) };

		const { container } = render(MapPage, {});

		// `content.trees` is empty: not one bundle was fetched, and the map is
		// complete anyway. That is why a failing bundle cannot dim a region.
		expect(content.trees).toEqual({});
		expect(container.querySelectorAll('[data-domain]').length).toBeGreaterThanOrEqual(2);
	});

	/** §15.8's gate on the composed route, not only on `MapRenderer` (T20). */
	it('passes the axe gate as a whole page (§15.8)', async () => {
		content.setManifest(manifest(), false);
		progress.hydrated = true;
		const { container } = render(MapPage, {});

		expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
	});

	it('passes the axe gate before the manifest resolves', async () => {
		const { container } = render(MapPage, {});
		await auditAccessibility(container);
	});

	it('says the regions do not reflect the user until hydration lands', () => {
		content.setManifest(manifest(), false);

		const { container } = render(MapPage, {});
		expect(container.querySelector('[data-progress-unknown]')).not.toBeNull();

		progress.hydrated = true;
		flushSync();
		expect(container.querySelector('[data-progress-unknown]')).toBeNull();
	});
});
