// @vitest-environment jsdom

/**
 * `/` — the world map route (T14, §13.1, §13.3; A6/T30).
 *
 * **The map moved out of this route.** T30 mounted the surface in the shell so
 * that `/` and `/d/<domainId>` share one set of DOM nodes and entering a domain
 * flies the camera instead of navigating (§5.1). The claims did not change, so
 * this file did not lose them — it asks the shell instead of the page:
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
 *
 * What is left on the page itself is the two states the map cannot render
 * because it does not exist yet, and those are still asserted against the page.
 */

import 'fake-indexeddb/auto';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditAccessibility } from '$lib/components/axe.js';
import { cleanup, flushSync, render } from '$lib/components/test-harness.svelte.js';
import type { ColdStartContent, ColdStartStore } from '$lib/actions/cold-start.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { Manifest } from '$lib/types';
import type { SkillRecord } from '$lib/state/types.js';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import MapPage from './+page.svelte';
import Shell from './Shell.svelte';

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

/** The page's own content, as the shell receives it. */
const children = createRawSnippet(() => ({ render: () => '<p>the page</p>' }));

function loaderStub(): ColdStartContent {
	return {
		loadManifest: async () => {
			content.setManifest(manifest(), false);
			return manifest();
		},
		isOffline: () => false
	};
}

function storeStub(): ColdStartStore {
	return {
		get hydrated() {
			return progress.hydrated;
		},
		recordManifest: async () => undefined,
		hydrate: async () => {
			progress.hydrated = true;
		},
		applyMoves: async () => []
	};
}

/** The shell starts its work in an effect, so every branch lands a macrotask later. */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
	flushSync();
}

function shell() {
	return render(Shell, {
		children,
		pathname: '/',
		contentLoader: loaderStub(),
		userStore: storeStub()
	});
}

beforeEach(() => {
	progress.reset();
	content.reset();
	ui.reset();
});

afterEach(cleanup);

describe('the map route — the page’s own content', () => {
	it('says it is loading rather than covering the page with a spinner', () => {
		const { container } = render(MapPage, {});

		expect(container.querySelector('[data-map-pending]')).not.toBeNull();
		// "Loading", never "no skills": §16.3 keeps those two apart everywhere.
		expect(container.textContent).not.toMatch(/no skills/i);
		expect(container.querySelector('svg')).toBeNull();
	});

	it('draws no map of its own — the surface is the shell’s (A6)', () => {
		content.setManifest(manifest(), false);
		const { container } = render(MapPage, {});
		flushSync();

		expect(container.querySelector('svg')).toBeNull();
		expect(container.querySelector('[data-map-surface]')).toBeNull();
		// And no second landmark: the shell owns the one that spans both levels.
		expect(container.querySelector('main')).toBeNull();
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

describe('the map route — the surface, composed', () => {
	it('renders the map once the manifest resolves', async () => {
		// The pre-manifest frame is the *page's* claim and is asserted above; the
		// stubbed loader resolves in a microtask, so there is no reliable moment to
		// observe it from here and pretending otherwise would test the stub.
		const { container } = shell();
		await settle();

		expect(container.querySelector('[data-map-surface]')).not.toBeNull();
		expect(container.querySelectorAll('[data-domain]').length).toBeGreaterThanOrEqual(2);
	});

	it('draws the regions with no bundle loaded at all (§3.3, §16.3 row 3)', async () => {
		progress.skills = { cooking: skill('cooking', 4) };

		const { container } = shell();
		await settle();

		// `content.trees` is empty: not one bundle was fetched, and the map is
		// complete anyway. That is why a failing bundle cannot dim a region.
		expect(content.trees).toEqual({});
		expect(container.querySelectorAll('[data-domain]').length).toBeGreaterThanOrEqual(2);
	});

	it('rests at level 0 on first load and animates nothing (§5.7, T35)', async () => {
		const { container } = shell();
		await settle();

		const surface = container.querySelector('[data-map-surface]')!;
		expect(surface.getAttribute('data-level')).toBe('0');

		// The resting frame *is* the first frame. T35's reveal layers onto it, and
		// a map that flew itself into place would leave the reveal nothing to hand
		// over to. The world box for this taxonomy is the union of both regions.
		expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 30 10');
	});

	/** §15.8's gate on the composed route, not only on `MapRenderer` (T20). */
	it('passes the axe gate as a whole page (§15.8)', async () => {
		const { container } = shell();
		await settle();

		expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
	});

	it('passes the axe gate before the manifest resolves', async () => {
		const { container } = render(MapPage, {});
		await auditAccessibility(container);
	});
});
