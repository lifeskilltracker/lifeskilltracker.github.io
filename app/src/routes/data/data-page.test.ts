// @vitest-environment jsdom

/**
 * `/data` (T14, §13.1, §16.3).
 *
 * The one thing this page owns outright is **the list of started skills the
 * library no longer contains** (T26/F22). Everywhere else in the app such a row
 * is correctly invisible — it joins to no domain, so it contributes to no score
 * and appears in no listing — and "correctly invisible everywhere" is
 * indistinguishable from "thrown away". This page is the exception that makes
 * the retention observable.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, click, render } from '$lib/components/test-harness.svelte.js';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import type { SkillRecord } from '$lib/state/types.js';
import type { Manifest } from '$lib/types';
import { APP_VERSION } from '$lib/version.js';
import DataPage from './+page.svelte';

const MANIFEST = manifestFixture([
	{ id: 'cooking', bundle: 'trees/cooking.abc.json' }
]) as unknown as Manifest;

const skill = (treeId: string): SkillRecord => ({
	treeId,
	startedAt: '2026-08-01T09:00:00.000Z',
	attainedLevel: 5,
	lastActivityAt: '2026-08-14T10:00:00.000Z',
	contentVersionSeen: 1,
	grandfathered: {}
});

beforeEach(async () => {
	progress.reset();
	progress.hydrated = true;
	content.reset();
	content.setManifest(MANIFEST, false);
	await store.close();
});

afterEach(cleanup);

describe('the data page', () => {
	it('lists a started skill the manifest no longer has (T26/F22)', () => {
		progress.skills = { cooking: skill('cooking'), atlantis: skill('atlantis') };

		const { container } = render(DataPage, {});

		const listed = [...container.querySelectorAll('[data-unmatched-skills] [data-tree]')].map(
			(node) => node.getAttribute('data-tree')
		);
		expect(listed).toEqual(['atlantis']);
		// And it says the record is intact, which is the point of listing it.
		expect(container.textContent?.replace(/\s+/g, ' ')).toContain('Nothing has been deleted');
	});

	it('says nothing at all when every skill is still in the library', () => {
		progress.skills = { cooking: skill('cooking') };

		const { container } = render(DataPage, {});

		expect(container.querySelector('[data-unmatched-skills]')).toBeNull();
	});

	it('reports storage usage once the estimate resolves', async () => {
		const { container } = render(DataPage, {});

		await vi.waitFor(() => {
			expect(container.querySelector('[data-storage]')).not.toBeNull();
		});
		expect(container.querySelector('[data-last-export]')?.textContent).toContain(
			'never exported'
		);
	});

	it('says the storage figures mean nothing when hydration failed', () => {
		progress.hydrated = false;

		const { container } = render(DataPage, {});

		expect(container.querySelector('[data-storage-unknown]')).not.toBeNull();
	});
});

/**
 * T16's half of the page: the export control, the import picker, and the
 * confirmation §12.6 puts in front of "replace all".
 */
describe('export and import (§12.6)', () => {
	async function choose(container: HTMLElement, text: string): Promise<void> {
		const input = container.querySelector<HTMLInputElement>('[data-import-file]')!;
		const file = new File([text], 'progress.json', { type: 'application/json' });
		Object.defineProperty(input, 'files', { value: [file], configurable: true });
		input.dispatchEvent(new Event('change', { bubbles: true }));
		await vi.waitFor(() => {
			expect(container.querySelector('[data-import-actions]')).not.toBeNull();
		});
	}

	const VALID = JSON.stringify({
		format: 'life-xp-skill-tracker/progress',
		schemaVersion: 1,
		exportedAt: '2026-08-04T11:03:00.000Z',
		appVersion: '0.1.0',
		generated: '2026-09-14T00:00:00.000Z',
		skills: [],
		milestones: [],
		orphans: []
	});

	it('does not call import on the first click of "replace everything"', async () => {
		const spy = vi.spyOn(store, 'import');
		const { container } = render(DataPage, {});
		await choose(container, VALID);

		click(container.querySelector('[data-action="import-replace"]')!);

		// The first click opens §12.6's confirmation and nothing else.
		expect(spy).not.toHaveBeenCalled();
		expect(container.querySelector('[data-replace-confirm]')).not.toBeNull();

		click(container.querySelector('[data-action="confirm-replace"]')!);
		await vi.waitFor(() => {
			expect(spy).toHaveBeenCalledWith(expect.anything(), 'replace');
		});
		spy.mockRestore();
	});

	it('merges without a confirmation step', async () => {
		const spy = vi.spyOn(store, 'import');
		const { container } = render(DataPage, {});
		await choose(container, VALID);

		click(container.querySelector('[data-action="import-merge"]')!);

		await vi.waitFor(() => {
			expect(spy).toHaveBeenCalledWith(expect.anything(), 'merge');
		});
		spy.mockRestore();
	});

	it('names the failing field when a file is rejected (§16.3)', async () => {
		const { container } = render(DataPage, {});
		await choose(container, JSON.stringify({ format: 'not-ours' }));

		click(container.querySelector('[data-action="import-merge"]')!);

		await vi.waitFor(() => {
			expect(container.querySelector('[data-import-error]')?.textContent).toContain(
				'$.format'
			);
		});
	});

	it('lists retired achievements without a link to follow (§16.5)', () => {
		progress.orphans = {
			z1y2x3w4: {
				uid: 'z1y2x3w4',
				treeId: 'cooking',
				title: 'Sharpen a chisel on an oilstone',
				state: 'complete',
				at: '2026-05-18T11:00:00.000Z',
				reason: 'retired'
			}
		};

		const { container } = render(DataPage, {});

		const entry = container.querySelector('[data-orphans] [data-uid="z1y2x3w4"]')!;
		expect(entry.textContent).toContain('Sharpen a chisel on an oilstone');
		expect(entry.querySelector('a')).toBeNull();
	});

	it('reports the app version and the library build (T26/F8)', async () => {
		const { container } = render(DataPage, {});
		// T18 moved the versions into §16.5's storage panel, which renders once the
		// estimate resolves.
		await vi.waitFor(() => {
			expect(container.querySelector('[data-versions]')).not.toBeNull();
		});
		const versions = container.querySelector('[data-versions]')!.textContent ?? '';

		expect(versions).toContain(APP_VERSION);
		expect(versions).toContain(MANIFEST.generated);
		// There is no library-wide content counter to show (§7.2, §16.1).
		expect(versions).not.toContain('contentVersion');
	});
});
