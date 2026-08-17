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
import type { NextStepSources } from '$lib/actions/next-step.js';
import { sidebarCollapse } from '$lib/components/sidebar-collapse.svelte.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { NotWritableError, createUserStateStore } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { CompiledTree, Manifest } from '$lib/types';
import { bundleFixture, manifestFixture } from '$lib/content/fixtures/bundles.js';
import Shell from './Shell.svelte';

const children = createRawSnippet(() => ({ render: () => '<main>the page</main>' }));

const MANIFEST = manifestFixture([{ id: 'cooking', bundle: 'trees/cooking.abc.json' }]) as unknown as Manifest;

/**
 * A taxonomy, which `manifestFixture` leaves empty — §6.1's blocks 2 and 4 are
 * one row per declared domain, so a manifest with no domains renders no blocks.
 */
const TAXONOMY_MANIFEST = {
	...MANIFEST,
	taxonomy: {
		...MANIFEST.taxonomy,
		domains: [
			{ id: 'home', title: 'Home', blurb: '', palette: { light: { base: '#000', accent: '#000' }, dark: { base: '#fff', accent: '#fff' } } },
			{ id: 'mind', title: 'Mind', blurb: '', palette: { light: { base: '#000', accent: '#000' }, dark: { base: '#fff', accent: '#fff' } } }
		]
	}
} as unknown as Manifest;

const COOKING = bundleFixture({ id: 'cooking' }) as unknown as CompiledTree;

const nextStepStub: NextStepSources = {
	loadTree: async () => COOKING,
	progressFor: () => ({ milestones: new Map(), grandfathered: new Map() })
};

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
		recordManifest: async () => undefined,
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
	globalThis.localStorage?.clear();
	sidebarCollapse.set(false);
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
				applyMoves: async () => [],
				recordManifest: async () => undefined
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
			recordManifest: async () => undefined,
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

/**
 * ─── T32: A6's chrome ──────────────────────────────────────────────────────
 *
 * The shell is the only place these can be checked, because they are claims
 * about *composition*: `Sidebar.test.ts` proves the four blocks render, and this
 * proves they render off the manifest and the mirror rather than off props a
 * test invented. The card is the same story — `NextStepCard.test.ts` proves it
 * shows a milestone, and this proves the shell hands it the right one, on the
 * right routes, and remembers a dismissal for exactly one session.
 */

function skillRecord(treeId: string, lastActivityAt: string, attainedLevel = 2) {
	return {
		treeId,
		startedAt: '2026-01-01T00:00:00.000Z',
		attainedLevel,
		lastActivityAt,
		contentVersionSeen: 1,
		grandfathered: {}
	};
}

function shell(props: Record<string, unknown> = {}) {
	return render(Shell, {
		children,
		contentLoader: loaderStub(),
		userStore: storeStub(),
		nextStepSources: nextStepStub,
		...props
	});
}

describe('A6 — the top nav bar is gone', () => {
	it('renders no top chrome band; the sidebar is the primary navigation', async () => {
		const { container } = shell();
		await settled();

		expect(container.querySelector('.shell-chrome')).toBeNull();
		expect(container.querySelector('header')).toBeNull();

		// Exactly two nav landmarks, both inside the sidebar, in §6.1's order.
		const navs = [...container.querySelectorAll('nav')];
		expect(navs.map((nav) => nav.getAttribute('aria-label'))).toEqual(['Primary', 'Domains']);
		expect(navs.every((nav) => nav.closest('[data-sidebar]') !== null)).toBe(true);
	});

	it('leaves `+layout.svelte` with no navigation of its own', async () => {
		// The acceptance criterion is a grep over the file, so this is one: a nav
		// re-grown here would be the top bar coming back with the sidebar still in
		// place, and nothing rendered would look wrong enough to notice.
		const { readFileSync } = await import('node:fs');
		// Off the workspace root rather than `import.meta.url`: under jsdom this
		// module's URL is not a `file:` one.
		const source = readFileSync(`${process.cwd()}/src/routes/+layout.svelte`, 'utf8');

		expect(source).not.toMatch(/<nav\b/);
		expect(source).toMatch(/<Shell\b/);
	});
});

describe('§6.1 — the blocks are assembled from the manifest and the mirror', () => {
	it('fills blocks 2 and 4 from the taxonomy, with band names and counts', async () => {
		const { container } = shell({
			contentLoader: {
				loadManifest: async () => {
					content.setManifest(TAXONOMY_MANIFEST, false);
					return TAXONOMY_MANIFEST;
				},
				isOffline: () => false
			}
		});
		await settled();

		const domains = container.querySelectorAll('[data-block="domains"] [data-domain]');
		expect(domains.length).toBe(2);

		const rows = [...container.querySelectorAll('[data-block="progress"] [data-domain]')];
		expect(rows.map((row) => row.getAttribute('data-domain'))).toEqual(['home', 'mind']);
		// Nothing started: §11.6's first band, and the count as a word (N5, F34).
		expect(rows[0]?.textContent).toContain('Quiet');
		expect(rows[0]?.textContent).toContain('No skills started');
		expect(container.querySelector('[data-block="progress"]')?.textContent).not.toContain('%');
	});

	it('links block 3 straight at a started skill, most recent first', async () => {
		progress.skills = {
			piano: skillRecord('piano', '2026-08-01T00:00:00.000Z'),
			cooking: skillRecord('cooking', '2026-08-14T00:00:00.000Z', 3)
		};

		const { container } = shell();
		await settled();

		const links = [...container.querySelectorAll('[data-block="skills"] a[data-tree]')];
		// `piano` has no manifest entry here, so it is dropped rather than named
		// under an invented title (T26/F22) — `cooking` is the one the shell knows.
		expect(links.map((a) => a.getAttribute('href'))).toEqual(['/s/cooking']);
	});

	it('highlights the active domain when the camera rests at level 1', async () => {
		const { container } = shell({
			pathname: '/d/home',
			contentLoader: {
				loadManifest: async () => {
					content.setManifest(TAXONOMY_MANIFEST, false);
					return TAXONOMY_MANIFEST;
				},
				isOffline: () => false
			}
		});
		await settled();

		const active = container.querySelectorAll('[data-block="domains"] [data-active="true"]');
		expect([...active].map((el) => el.getAttribute('data-domain'))).toEqual(['home']);
	});
});

describe('§6.1 — collapsing does not move the page', () => {
	it('keeps the rendered page mounted across a toggle, so the camera cannot shift', async () => {
		const { container } = shell();
		await settled();

		const before = container.querySelector('main');
		expect(before).not.toBeNull();

		click(container.querySelector('[data-action="toggle-sidebar"]')!);
		flushSync();

		// The same DOM node, not an equal one: a re-created `<main>` would remount
		// the map and reset whatever camera state T30 puts in it.
		expect(container.querySelector('main')).toBe(before);
		expect(container.querySelector('[data-sidebar]')?.getAttribute('data-collapsed')).toBe('true');
	});
});

describe('§6.4 — the card, on the routes that are the map', () => {
	it('names the next available milestone in the most recently active skill', async () => {
		progress.skills = { cooking: skillRecord('cooking', '2026-08-14T00:00:00.000Z') };

		const { container } = shell();
		await settled();
		await settled();

		const link = container.querySelector('[data-next-step-link]');
		expect(link?.getAttribute('href')).toBe('/s/cooking/m/cooking-1-0');
		expect(link?.textContent?.replace(/\s+/g, ' ').trim()).toBe('cooking · Milestone 1.0');
	});

	it('is reachable before the map: it precedes the page in the document', async () => {
		progress.skills = { cooking: skillRecord('cooking', '2026-08-14T00:00:00.000Z') };

		const { container } = shell();
		await settled();
		await settled();

		const card = container.querySelector('[data-next-step]')!;
		const main = container.querySelector('main')!;
		expect(card.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('rides `/d/<domainId>` too, and stays off the tree', async () => {
		progress.skills = { cooking: skillRecord('cooking', '2026-08-14T00:00:00.000Z') };

		const onDomain = shell({ pathname: '/d/home' });
		await settled();
		expect(onDomain.container.querySelector('[data-next-step]')).not.toBeNull();

		const onTree = shell({ pathname: '/s/cooking' });
		await settled();
		// F36's `.` shortcut already answers this question inside a tree, and a
		// second answer two rows away from the one the user is reading is worse
		// than none.
		expect(onTree.container.querySelector('[data-next-step]')).toBeNull();
	});

	it('invites a visitor who has started nothing, rather than showing an empty card', async () => {
		const { container } = shell();
		await settled();
		await settled();

		expect(container.querySelector('[data-next-step-invitation]')).not.toBeNull();
		expect(container.querySelector('[data-next-step-link]')).toBeNull();
	});

	it('stays dismissed for the session, and returns on the next load', async () => {
		progress.skills = { cooking: skillRecord('cooking', '2026-08-14T00:00:00.000Z') };

		const first = shell();
		await settled();
		await settled();
		click(first.container.querySelector('[data-action="dismiss-next-step"]')!);
		flushSync();
		expect(first.container.querySelector('[data-next-step]')).toBeNull();

		// A camera move is a client-side navigation, and the card must not come
		// back through one — that is the interruption §6.4 warns about.
		const second = shell({ pathname: '/d/home' });
		await settled();
		expect(second.container.querySelector('[data-next-step]')).toBeNull();

		// A reload is `ui`'s reset: nothing about the dismissal is persisted, so a
		// user cannot lose the card by accident.
		ui.reset();
		const third = shell();
		await settled();
		await settled();
		expect(third.container.querySelector('[data-next-step]')).not.toBeNull();
	});
});
