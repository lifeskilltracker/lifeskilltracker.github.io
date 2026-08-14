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
import { cleanup, render } from '$lib/components/test-harness.svelte.js';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import type { SkillRecord } from '$lib/state/types.js';
import type { Manifest } from '$lib/types';
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
