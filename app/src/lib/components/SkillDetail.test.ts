// @vitest-environment jsdom

/**
 * §5.5's panel, and the two-half load behind it (T31).
 *
 * The failure this file exists to catch is the quiet one: a panel that looks
 * the same while it is loading, after a load that failed, and for a skill that
 * genuinely has no blocker left. Those are three different things to a reader
 * and only one of them means "nothing more to do here".
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, click, render } from './test-harness.svelte.js';
import SkillDetail from './SkillDetail.svelte';
import { loadSkillDetail, skillDetailHeader } from '$lib/actions/skill-detail.js';
import type { SkillHexRow } from '$lib/actions/skill-hexes.js';
import { bundleFixture } from '$lib/content/fixtures/bundles.js';
import type { CompiledTree, Manifest } from '$lib/types';

const MANIFEST = {
	trees: [
		{
			id: 'cooking',
			title: 'Cooking',
			domain: 'home',
			cell: { q: 0, r: 0 },
			hasMastery: true,
			authors: ['Ada', 'Grace']
		}
	]
} as unknown as Manifest;

const COOKING = bundleFixture({ id: 'cooking' }) as unknown as CompiledTree;

/**
 * Built literally rather than through `skillHexRows`, which would need
 * `SkillRecord` — a `lib/state` type a component test may not import (§14.1).
 * The join has its own test; this file is about the panel.
 */
const rowFor = (overrides: Partial<SkillHexRow> = {}): SkillHexRow => ({
	treeId: 'cooking',
	title: 'Cooking',
	domain: 'home',
	cell: { q: 0, r: 0 },
	attainedLevel: 0,
	started: false,
	hasMastery: true,
	attainedMax: false,
	tier: null,
	...overrides
});

const sources = {
	loadTree: async () => COOKING,
	progressFor: () => ({ milestones: new Map(), grandfathered: new Map() })
};

afterEach(cleanup);

describe('the manifest half is on screen immediately', () => {
	it('names the skill and its authors before any bundle has landed (F6)', () => {
		const detail = skillDetailHeader(MANIFEST, rowFor());
		const { container } = render(SkillDetail, { detail });

		expect(container.querySelector('h2')?.textContent?.trim()).toBe('Cooking');
		expect(container.querySelector('[data-authors]')?.textContent).toContain('Ada, Grace');
		// And says so, rather than showing an empty panel that looks broken.
		expect(container.querySelector('[data-detail-pending]')).not.toBeNull();
	});

	it('gives the level as n of 10, never as a percentage (F34)', () => {
		const detail = skillDetailHeader(MANIFEST, rowFor({ started: true, attainedLevel: 4, tier: 'Apprentice' }));
		const { container } = render(SkillDetail, { detail });

		expect(container.querySelector('[data-level]')?.textContent?.trim()).toBe('4 of 10');
		expect(container.querySelector('[data-tier]')?.textContent?.trim()).toBe('Apprentice');
		expect(container.textContent).not.toContain('%');
	});

	it('says not started rather than showing a zero', () => {
		const { container } = render(SkillDetail, { detail: skillDetailHeader(MANIFEST, rowFor()) });
		expect(container.querySelector('[data-level]')?.textContent?.trim()).toBe('Not started');
		expect(container.querySelector('[data-tier]')).toBeNull();
	});
});

describe('the bundle half', () => {
	it('names the next available milestone once the tree has loaded', async () => {
		const detail = await loadSkillDetail(sources, MANIFEST, rowFor());
		const { container } = render(SkillDetail, { detail });

		expect(container.querySelector('[data-detail-pending]')).toBeNull();
		const next = container.querySelector('[data-next-milestone]');
		expect(next).not.toBeNull();
		expect(next!.getAttribute('href')).toMatch(/^\/s\/cooking\/m\//);
	});

	it('degrades rather than disappearing when the bundle cannot be read', async () => {
		const detail = await loadSkillDetail(
			{ ...sources, loadTree: async () => { throw new Error('HTTP 503'); } },
			MANIFEST,
			rowFor(),
		);
		const { container } = render(SkillDetail, { detail });

		// The header half is still true, and failing one bundle is not a reason to
		// refuse to name the skill.
		expect(container.querySelector('h2')?.textContent?.trim()).toBe('Cooking');
		expect(container.querySelector('[data-detail-unavailable]')).not.toBeNull();
		expect(container.querySelector('[data-detail-pending]')).toBeNull();
	});

	it('distinguishes “still loading” from “loaded, nothing blocking”', async () => {
		const pending = skillDetailHeader(MANIFEST, rowFor());
		const loaded = await loadSkillDetail(sources, MANIFEST, rowFor());

		expect(pending.resolved).toBe(false);
		expect(loaded.resolved).toBe(true);
		// Both have `progress: null` for a skill with nothing scored, which is
		// exactly why `resolved` is a separate flag and not derived from it.
		expect(loaded.unavailable).toBe(false);
	});
});

describe('§5.5 — Open tree is the only thing that navigates', () => {
	it('links to the tree route', () => {
		const { container } = render(SkillDetail, { detail: skillDetailHeader(MANIFEST, rowFor()) });
		expect(container.querySelector('[data-action="open-tree"]')?.getAttribute('href')).toBe(
			'/s/cooking',
		);
	});

	it('closes on request without navigating anywhere', () => {
		const onclose = vi.fn();
		const { container } = render(SkillDetail, {
			detail: skillDetailHeader(MANIFEST, rowFor()),
			onclose,
		});
		click(container.querySelector('[data-action="close-skill-detail"]')!);
		expect(onclose).toHaveBeenCalled();
	});
});
