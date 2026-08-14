// @vitest-environment jsdom

/**
 * §16.3's three tree-unavailable rows, from the route rather than the loader
 * (T14).
 *
 * `loader.test.ts` proves the loader rejects and evicts. This proves the
 * consequence the user actually meets: **one tree is unavailable and nothing
 * else is**. Isolation is a claim about the rest of the app, so it cannot be
 * asserted from inside the thing that failed — the map has to still be there,
 * the sibling tree has to still load, and the record has to still be listed.
 *
 * Everything runs through a real `ContentLoader` over the loader's own fakes,
 * so the eviction asserted below is the eviction the browser would perform.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, flushSync, render } from '$lib/components/test-harness.svelte.js';
import { createContentLoader, RUNTIME_CACHE } from '$lib/content';
import {
	CONTENT_BASE,
	MANIFEST_URL,
	environment,
	fakeCacheStorage,
	type Route
} from '$lib/content/fixtures/environment.js';
import {
	NINE_LEVEL_BUNDLE,
	VALID_BUNDLE,
	bundleFixture,
	manifestFixture
} from '$lib/content/fixtures/bundles.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { SkillRecord } from '$lib/state/types.js';
import SkillPage from './s/[tree]/+page.svelte';
import { resolveSkillPage } from './s/[tree]/+page.js';

const COOKING = 'trees/cooking.aaa.json';
const BROKEN = 'trees/broken.bbb.json';
const STALE = 'trees/stale.ccc.json';

const MANIFEST = manifestFixture([
	{ id: 'cooking', bundle: COOKING },
	{ id: 'broken', bundle: BROKEN },
	{ id: 'stale', bundle: STALE }
]);

const routes = (): Record<string, Route> => ({
	[MANIFEST_URL]: { body: MANIFEST },
	[`${CONTENT_BASE}/${COOKING}`]: { body: VALID_BUNDLE },
	// The realistic bundle failure: the manifest lists it, the file will not come.
	[`${CONTENT_BASE}/${BROKEN}`]: { networkError: true },
	// §7.5's assertion failure: a nine-level bundle from a stale cache.
	[`${CONTENT_BASE}/${STALE}`]: { body: NINE_LEVEL_BUNDLE }
});

const skill = (treeId: string): SkillRecord => ({
	treeId,
	startedAt: '2026-08-14T10:00:00.000Z',
	attainedLevel: 3,
	lastActivityAt: '2026-08-14T10:00:00.000Z',
	contentVersionSeen: 1,
	grandfathered: {}
});

beforeEach(() => {
	progress.reset();
	progress.hydrated = true;
	content.reset();
	ui.reset();
});

afterEach(cleanup);

describe('§16.3 row 3 — a tree bundle fetch fails', () => {
	it('leaves the manifest, the map data, and every other tree intact', async () => {
		const { env } = environment(routes());
		const loader = createContentLoader(env);

		const broken = await resolveSkillPage(loader, 'broken');
		const cooking = await resolveSkillPage(loader, 'cooking');

		expect(broken.tree).toBeNull();
		expect(broken.reason).toBe('unreachable');

		// The isolation claim, which is about everything except `broken`.
		expect(cooking.tree?.id).toBe('cooking');
		expect((await loader.loadManifest()).trees.map((entry) => entry.id)).toEqual([
			'cooking',
			'broken',
			'stale'
		]);
	});

	it('renders the failure on the page instead of a blank tree', async () => {
		const { env } = environment(routes());
		const data = await resolveSkillPage(createContentLoader(env), 'broken');

		const { container } = render(SkillPage, { data });

		expect(container.textContent).toContain('Skill unavailable');
		expect(container.textContent).toContain('Other skills are unaffected');
		expect(container.querySelector('.node[data-uid]')).toBeNull();
	});
});

describe('§16.3 row 4 — a bundle fails the §7.5 shape assertion', () => {
	it('treats it as unavailable and clears the cached entry so a retry self-heals', async () => {
		const caches = fakeCacheStorage();
		const { env } = environment(routes(), caches);
		const url = `${CONTENT_BASE}/${STALE}`;

		// A stale entry, exactly as a previous release would have left it.
		const runtime = await caches.storage.open(RUNTIME_CACHE);
		await runtime.put(url, new Response(JSON.stringify(NINE_LEVEL_BUNDLE)));
		expect(caches.bucket(RUNTIME_CACHE).has(url)).toBe(true);

		const data = await resolveSkillPage(createContentLoader(env), 'stale');

		expect(data.tree).toBeNull();
		expect(data.unavailable).toMatch(/9 levels; 10 required/);
		// The cache-clear is the whole of row 4: without it the same bad bytes
		// come back forever and the failure never heals.
		expect(caches.bucket(RUNTIME_CACHE).has(url)).toBe(false);
	});
});

describe('§16.3 — /s/<treeId> names a tree the manifest does not have (T26/F22)', () => {
	it('is a tree-unavailable state, never a 404', async () => {
		const { env } = environment(routes());
		const data = await resolveSkillPage(createContentLoader(env), 'atlantis');

		expect(data.tree).toBeNull();
		// A lookup miss before any fetch — a different branch from row 3.
		expect(data.reason).toBe('missing');
	});

	it('says the progress is intact and links to /data when a SKILL row exists', async () => {
		const { env } = environment(routes());
		const data = await resolveSkillPage(createContentLoader(env), 'atlantis');

		progress.skills = { atlantis: skill('atlantis') };
		const { container } = render(SkillPage, { data });
		flushSync();

		const intact = container.querySelector('[data-progress-intact]');
		expect(intact).not.toBeNull();
		expect(intact?.querySelector('a')?.getAttribute('href')).toBe('/data');
	});

	it('does not claim progress is intact when there is none', async () => {
		const { env } = environment(routes());
		const data = await resolveSkillPage(createContentLoader(env), 'atlantis');

		const { container } = render(SkillPage, { data });

		expect(container.textContent).toContain('not in this skill library');
		expect(container.querySelector('[data-progress-intact]')).toBeNull();
	});
});

describe('the tree route’s own loader wiring', () => {
	it('memoizes, so opening a tree twice fetches its bundle once (§14.2)', async () => {
		const { env, net } = environment(routes());
		const loader = createContentLoader(env);

		await resolveSkillPage(loader, 'cooking');
		await resolveSkillPage(loader, 'cooking');

		expect(net.countFor(`${CONTENT_BASE}/${COOKING}`)).toBe(1);
	});

	it('keeps a second tree loadable after the first failed', async () => {
		const extra = routes();
		extra[`${CONTENT_BASE}/${STALE}`] = { body: bundleFixture({ id: 'stale' }) };
		const { env } = environment(extra);
		const loader = createContentLoader(env);

		await resolveSkillPage(loader, 'broken');
		const stale = await resolveSkillPage(loader, 'stale');

		expect(stale.tree?.id).toBe('stale');
	});
});
