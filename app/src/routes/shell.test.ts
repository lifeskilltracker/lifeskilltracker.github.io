// @vitest-environment jsdom

/**
 * The rendered shell — §13.3's four cold-start branches on screen (T14).
 *
 * This supersedes T10's `layout-bootstrap.test.ts`, which proved only that
 * *something* called `hydrate()`. That was the Phase 0 question. The question
 * now is which of four branches the user is looking at, and the failure mode
 * this file exists to catch is the quiet one: a degraded session that renders
 * identically to a healthy one.
 *
 * The shell's dependencies are injected, so all four branches are reachable
 * without a network or an IndexedDB failure to arrange.
 */

import 'fake-indexeddb/auto';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, click, flushSync, render } from '$lib/components/test-harness.svelte.js';
import type { ColdStartContent, ColdStartStore } from '$lib/actions/cold-start.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { NotWritableError, createUserStateStore } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { Manifest } from '$lib/types';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import Shell from './Shell.svelte';

const children = createRawSnippet(() => ({ render: () => '<main>the page</main>' }));

const MANIFEST = manifestFixture([{ id: 'cooking', bundle: 'trees/cooking.abc.json' }]) as unknown as Manifest;

function loaderStub(options: { offline?: boolean; fail?: boolean } = {}): ColdStartContent {
	return {
		loadManifest: async () => {
			if (options.fail === true) throw new Error('manifest unavailable: HTTP 503');
			content.setManifest(MANIFEST, options.offline ?? false);
			return MANIFEST;
		},
		isOffline: () => options.offline ?? false
	};
}

function storeStub(options: { fail?: boolean } = {}): ColdStartStore {
	return {
		get hydrated() {
			return progress.hydrated;
		},
		hydrate: async () => {
			if (options.fail === true) {
				progress.hydrated = false;
				progress.writable = false;
				throw new Error('IndexedDB is unavailable');
			}
			progress.hydrated = true;
		},
		applyMoves: async () => []
	};
}

/**
 * The shell starts its work in an effect, so every branch lands a macrotask
 * later. `flushSync` afterwards is what turns the resulting state change into
 * DOM, the same way mounting does.
 */
async function settled(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
	flushSync();
}

beforeEach(() => {
	progress.reset();
	progress.writable = true;
	ui.reset();
	content.reset();
});

afterEach(cleanup);

describe('§13.3 step 1 — chrome first, no full-page spinner', () => {
	it('renders the nav and the page before either promise settles', () => {
		const { container } = render(Shell, {
			children,
			contentLoader: {
				loadManifest: () => new Promise<Manifest>(() => {}),
				isOffline: () => false
			},
			userStore: {
				hydrated: false,
				hydrate: () => new Promise<void>(() => {}),
				applyMoves: async () => []
			}
		});

		expect(container.querySelector('nav')).not.toBeNull();
		expect(container.querySelector('main')).not.toBeNull();
		// The whole of §13.3 step 1: nothing covers the page while it waits.
		expect(container.querySelector('[data-cold-start-failure]')).toBeNull();
		expect(container.textContent).toContain('the page');
	});
});

describe('§13.3 step 3 — both halves resolve', () => {
	it('renders the page with no notices at all', async () => {
		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub(),
			userStore: storeStub()
		});
		await settled();

		expect(container.querySelector('[data-degraded]')).toBeNull();
		expect(container.querySelector('[data-offline]')).toBeNull();
		expect(container.querySelector('[data-cold-start-failure]')).toBeNull();
		expect(container.textContent).toContain('the page');
	});
});

describe('§16.3 row 1 — manifest fails, cache present', () => {
	it('renders the page and says it is offline', async () => {
		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub({ offline: true }),
			userStore: storeStub()
		});
		await settled();

		expect(container.querySelector('[data-offline]')).not.toBeNull();
		expect(container.textContent).toContain('the page');
		expect(container.querySelector('[data-cold-start-failure]')).toBeNull();
	});
});

describe('§16.3 row 2 — manifest fails, no cache', () => {
	it('replaces the page with the failure screen, a retry, and a link to /data', async () => {
		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub({ fail: true }),
			userStore: storeStub()
		});
		await settled();

		const screen = container.querySelector('[data-cold-start-failure]');
		expect(screen).not.toBeNull();
		// Never "no skills found": an empty library and an unreachable one are
		// indistinguishable to a renderer and not at all alike to a user.
		expect(container.textContent).toContain('could not be loaded');
		expect(container.querySelector('[data-reason]')?.textContent).toContain('503');
		expect(container.querySelector('[data-action="retry"]')).not.toBeNull();
		expect(container.querySelector('[data-export-link]')?.getAttribute('href')).toBe('/data');
		expect(container.textContent).not.toContain('the page');
	});

	it('retries, and recovers when the retry succeeds', async () => {
		let fail = true;
		const flaky: ColdStartContent = {
			loadManifest: async () => {
				if (fail) throw new Error('manifest unavailable: HTTP 503');
				content.setManifest(MANIFEST, false);
				return MANIFEST;
			},
			isOffline: () => false
		};

		const { container } = render(Shell, { children, contentLoader: flaky, userStore: storeStub() });
		await settled();
		expect(container.querySelector('[data-cold-start-failure]')).not.toBeNull();

		fail = false;
		click(container.querySelector('[data-action="retry"]')!);
		await settled();

		expect(container.querySelector('[data-cold-start-failure]')).toBeNull();
		expect(container.textContent).toContain('the page');
	});
});

describe('§12.5 — what applyMoves did is said out loud', () => {
	it('reports re-homed records as a notice rather than moving them silently', async () => {
		const store: ColdStartStore = {
			get hydrated() {
				return progress.hydrated;
			},
			hydrate: async () => {
				progress.hydrated = true;
			},
			applyMoves: async () => [
				{
					treeId: 'cooking',
					fromVersion: 1,
					toVersion: 2,
					changed: true,
					entries: [
						{
							uid: 'U0100000',
							title: 'Bake a loaf',
							op: 'moved' as const,
							outcome: 'rewritten' as const,
							became: []
						}
					],
					partialMerge: false,
					attainedLevel: { before: 2, after: 2 }
				}
			]
		};

		const { container } = render(Shell, { children, contentLoader: loaderStub(), userStore: store });
		await settled();

		const notice = container.querySelector('[data-notice]');
		expect(notice?.textContent).toContain('1 completed milestone moved');
	});

	it('says nothing when nothing moved', async () => {
		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub(),
			userStore: storeStub()
		});
		await settled();

		expect(container.querySelector('[data-notice]')).toBeNull();
	});
});

describe('§16.3 row 5 — IndexedDB hydration fails', () => {
	it('renders the content, and says loudly that nothing will be saved', async () => {
		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub(),
			userStore: storeStub({ fail: true })
		});
		await settled();

		// Read-only, not blank: content is re-fetchable and this failure is not
		// about content at all (§13.3).
		expect(container.textContent).toContain('the page');

		const banner = container.querySelector('[data-degraded]');
		expect(banner).not.toBeNull();
		expect(banner?.textContent).toContain('nothing will be saved');
		expect(banner?.textContent).toContain('IndexedDB is unavailable');
	});

	it('refuses every write for the rest of the session', async () => {
		render(Shell, { children, contentLoader: loaderStub(), userStore: storeStub({ fail: true }) });
		await settled();

		expect(progress.writable).toBe(false);

		// The real store, against the same latched mirror: every mutator rejects
		// rather than silently no-opping, which is what "read as empty, then
		// wrote" would look like (§13.3, §14.5).
		const store = createUserStateStore({ databaseName: `shell-${Date.now()}` });
		await expect(store.setMilestoneState('U0100000', 'complete')).rejects.toThrow(
			NotWritableError
		);
		await expect(store.startSkill('cooking', 1)).rejects.toThrow(NotWritableError);
		await expect(store.reconcileAttainedLevel('cooking', 3)).rejects.toThrow(NotWritableError);

		// And it stays refused — there is no path back to writable in a session.
		progress.hydrated = true;
		await expect(store.startSkill('cooking', 1)).rejects.toThrow(NotWritableError);
	});
});
