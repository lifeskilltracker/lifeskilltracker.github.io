// @vitest-environment jsdom

/**
 * §12.7's prompt where it actually lives (T18).
 *
 * The component and the decision are tested apart from the app; this file is
 * about the two joins that make them a feature — the prompt appearing **inline
 * in §13.4's notice host** rather than over the page, and `/data` telling the
 * truth about storage through the same panel §16.5 specifies.
 *
 * The acceptance criterion behind the first one is unusual in being about
 * layout: §12.7's "non-modal, dismissible, never blocking" is only true if the
 * prompt renders in the flow of the shell's notices, beside the offline banner
 * and the degraded-session banner, and above the page rather than across it.
 */

import 'fake-indexeddb/auto';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, click, flushSync, render } from '$lib/components/test-harness.svelte.js';
import type { ColdStartContent, ColdStartStore } from '$lib/actions/cold-start.js';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import { content } from '$lib/content/store.svelte.js';
import { DB_NAME } from '$lib/state/db.js';
import { durability } from '$lib/state/durability.js';
import { exportPrompt } from '$lib/state/export-prompt.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import type { MilestoneRecord } from '$lib/state/types.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { Manifest } from '$lib/types';
import DataPage from './data/+page.svelte';
import Shell from './Shell.svelte';

const children = createRawSnippet(() => ({ render: () => '<main>the page</main>' }));

const MANIFEST = manifestFixture([
	{ id: 'cooking', bundle: 'trees/cooking.abc.json' }
]) as unknown as Manifest;

const loaderStub = (): ColdStartContent => ({
	loadManifest: async () => {
		content.setManifest(MANIFEST, false);
		return MANIFEST;
	},
	isOffline: () => false
});

const storeStub = (): ColdStartStore => ({
	get hydrated() {
		return progress.hydrated;
	},
	recordManifest: async () => undefined,
	hydrate: async () => {
		progress.hydrated = true;
	},
	applyMoves: async () => []
});

function completions(count: number): Record<string, MilestoneRecord> {
	const rows: Record<string, MilestoneRecord> = {};
	for (let index = 0; index < count; index += 1) {
		const uid = `uid${index}`;
		rows[uid] = {
			uid,
			treeId: 'cooking',
			slug: `m${index}`,
			title: `Milestone ${index}`,
			state: 'complete',
			at: '2026-08-01T00:00:00.000Z',
			contentVersion: 1
		};
	}
	return rows;
}

/**
 * The shell starts its work in an effect, and §12.7's refresh adds an
 * IndexedDB read on top of the cold start — so "settled" here means "the shell
 * has stopped changing", not "one macrotask has passed".
 */
async function settled(): Promise<void> {
	for (let tick = 0; tick < 10; tick += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	flushSync();
}

/**
 * jsdom implements no Storage API, which is `durability`'s degraded path
 * (zeroes) rather than a browser reporting figures. Trigger 3 and §16.5's panel
 * both need real numbers to say anything about.
 */
function stubStorageEstimate(usage: number, quota: number): void {
	Object.defineProperty(globalThis.navigator, 'storage', {
		value: { estimate: async () => ({ usage, quota }) },
		configurable: true
	});
}

beforeEach(async () => {
	progress.reset();
	progress.writable = true;
	progress.hydrated = true;
	ui.reset();
	content.reset();
	exportPrompt.reset();
	durability.reset();
	Reflect.deleteProperty(globalThis.navigator, 'storage');

	// The shell and `/data` both reach for the singleton store, so these cases
	// share one database — and `META` is where both `lastExportAt` and F15's
	// dismissals live. Without dropping it, one test's dismissal silences the
	// next test's trigger, which is the feature working and the suite lying.
	await store.close();
	await new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase(DB_NAME);
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
});

afterEach(cleanup);

describe('the prompt in §13.4’s notice host', () => {
	it('renders inline among the notices, not over the page', () => {
		exportPrompt.show('never-exported');

		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub(),
			userStore: storeStub()
		});

		const prompt = container.querySelector('[data-export-prompt]');
		expect(prompt).not.toBeNull();
		// Inside the host, beside the offline and degraded banners.
		expect(container.querySelector('[data-notices] [data-export-prompt]')).not.toBeNull();
		// And the page is still rendered and still reachable underneath it.
		expect(container.querySelector('main')).not.toBeNull();
	});

	it('is absent when nothing has raised it', () => {
		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub(),
			userStore: storeStub()
		});

		expect(container.querySelector('[data-export-prompt]')).toBeNull();
	});

	it('goes away when dismissed and does not come back this session', async () => {
		progress.milestones = completions(10);

		const { container } = render(Shell, {
			children,
			contentLoader: loaderStub(),
			userStore: storeStub()
		});
		await vi.waitFor(() => {
			flushSync();
			// §12.7's trigger 1, evaluated as part of the cold start.
			expect(container.querySelector('[data-export-prompt]')).not.toBeNull();
		});

		click(container.querySelector('[data-action="dismiss-export-prompt"]')!);
		await settled();

		expect(container.querySelector('[data-export-prompt]')).toBeNull();
		// And the dismissal was not recorded as a backup (§12.7).
		expect((await store.storageStatus()).lastExportAt).toBeUndefined();
	});

	it('evaluates the triggers at session start rather than waiting for a write', async () => {
		progress.milestones = completions(10);

		render(Shell, { children, contentLoader: loaderStub(), userStore: storeStub() });

		await vi.waitFor(() => {
			expect(exportPrompt.reason).toBe('never-exported');
		});
		// §12.7's session-start poll happened too.
		expect(durability.lastEstimate).not.toBeNull();
	});
});

describe('`/data`’s storage panel (§16.5)', () => {
	beforeEach(() => {
		content.setManifest(MANIFEST, false);
	});

	it('presents the figures as estimates rather than as exact numbers', async () => {
		stubStorageEstimate(5 * 1024 * 1024, 500 * 1024 * 1024);
		const { container } = render(DataPage, {});

		await vi.waitFor(() => {
			expect(container.querySelector('[data-storage]')?.textContent).toContain('MB');
		});
		const text = container.querySelector('[data-storage]')!.textContent!.toLowerCase();
		expect(text).toContain('estimate');
		// §12.7's imprecision, said out loud rather than implied by a rounded number.
		expect(text).toContain('roughly');
	});

	it('says so plainly when the browser reports no figures at all', async () => {
		const { container } = render(DataPage, {});

		await vi.waitFor(() => {
			expect(container.querySelector('[data-storage]')).not.toBeNull();
		});
		expect(container.querySelector('[data-storage]')?.textContent?.toLowerCase()).toContain(
			'could not tell'
		);
	});

	it('clears the prompt once an export has actually been taken', async () => {
		progress.milestones = completions(10);
		exportPrompt.show('never-exported');

		const { container } = render(DataPage, {});
		click(container.querySelector('[data-action="export"]')!);

		await vi.waitFor(() => {
			expect(exportPrompt.visible).toBe(false);
		});
		expect((await store.storageStatus()).lastExportAt).toBeDefined();
	});
});
