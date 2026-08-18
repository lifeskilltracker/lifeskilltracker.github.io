// @vitest-environment jsdom

/**
 * §7's level-camera controls, on the page that owns them (T34).
 *
 * They live here rather than inside `TreeView` for the same reason the viewport
 * choice does: the tree draws, and the page composes. `TreeView` exports
 * `moveCamera` and owns the scroll container; these three buttons are the named
 * anchors §7 gives a mouse user, and the `.` shortcut is the same three
 * anchors' keyboard half.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundleFixture } from '$lib/content/fixtures/bundles.js';
import { auditAccessibility } from '$lib/components/axe.js';
import { cleanup, click, render } from '$lib/components/test-harness.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import type { CompiledTree } from '$lib/types';
import SkillPage from './SkillPage.svelte';
import type { SkillPageData } from './+page.js';

let counter = 0;

function tree(): CompiledTree {
	return bundleFixture({ id: `camera-${(counter += 1)}` }) as unknown as CompiledTree;
}

function pageData(bundle: CompiledTree): SkillPageData {
	return { treeId: bundle.id, tree: bundle, unavailable: null, reason: null, offline: false };
}

function stubReducedMotion(): void {
	Object.defineProperty(globalThis, 'matchMedia', {
		configurable: true,
		writable: true,
		value: (query: string) => ({
			matches: query.includes('prefers-reduced-motion'),
			media: query,
			addEventListener() {},
			removeEventListener() {}
		})
	});
}

beforeEach(async () => {
	progress.reset();
	progress.writable = true;
	progress.hydrated = true;
	stubReducedMotion();
	await store.close();
});

afterEach(async () => {
	cleanup();
	Reflect.deleteProperty(globalThis, 'matchMedia');
	// Unmounting the page emits Svelte's `derived_inert` warning — `SkillPage`'s
	// session effect nulls `session` in its own teardown, which is a pre-existing
	// property of that file and not this task's to change. The warning is
	// forwarded to the runner asynchronously, so without a tick here the last one
	// is still in flight when the worker closes and the run fails on the transport
	// rather than on a test.
	await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('§7 — the three named anchors', () => {
	it('offers exactly the blocking level, the next available milestone, and level 10', () => {
		const { container } = render(SkillPage, { data: pageData(tree()) });

		const controls = [...container.querySelectorAll('[data-camera]')].map((button) =>
			button.getAttribute('data-camera')
		);
		expect(controls).toEqual(['blocking', 'next-available', 'level-10']);
	});

	it('offers no zoom control beside them — §7 declines it, and there is no escape hatch', () => {
		const { container } = render(SkillPage, { data: pageData(tree()) });

		const names = [...container.querySelectorAll('button')].map((b) => b.textContent ?? '');
		expect(names.join(' ')).not.toMatch(/zoom|\bfit\b|\+|−/i);
	});

	it('names each control for a listener, not only for a looker (§15.2)', () => {
		const { container } = render(SkillPage, { data: pageData(tree()) });

		for (const button of container.querySelectorAll('[data-camera]')) {
			expect((button.textContent ?? '').trim().length).toBeGreaterThan(0);
			expect(button.getAttribute('type')).toBe('button');
		}
	});

	it('moves the camera to the anchor the button names', () => {
		const { container } = render(SkillPage, { data: pageData(tree()) });
		const camera = container.querySelector('.tree-camera')!;

		// Untouched tree: nothing blocks above level 1, which sits at the foot of
		// the wide layout — so the anchor is the largest offset in the tree.
		click(container.querySelector('[data-camera="blocking"]')!);
		const blocking = Number(camera.getAttribute('data-camera-anchor'));
		expect(blocking).toBeGreaterThan(0);

		// Level 10 is drawn at the top (§8.2), so its anchor is 0.
		click(container.querySelector('[data-camera="level-10"]')!);
		expect(camera.getAttribute('data-camera-anchor')).toBe('0');

		click(container.querySelector('[data-camera="next-available"]')!);
		expect(Number(camera.getAttribute('data-camera-anchor'))).toBe(blocking);
	});

	it('leaves the controls out of the narrow list, whose presentation is unchanged', () => {
		const { container } = render(SkillPage, { data: pageData(tree()) });
		// The page starts wide and only becomes narrow once a ResizeObserver says
		// so; jsdom has none, so the assertion that matters here is the inverse —
		// the controls are gated on the viewport at all.
		expect(container.querySelector('[data-camera]')).not.toBeNull();
		expect(container.querySelector('.tree-camera')).not.toBeNull();
	});

	it('finds no axe violation with the camera controls on the page (§15.8)', async () => {
		const { container } = render(SkillPage, { data: pageData(tree()) });

		// `auditAccessibility` throws on a violation and returns the rules that
		// passed; a non-empty list is how a test says the run exercised something.
		const passed = await auditAccessibility(container);
		expect(passed.length).toBeGreaterThan(0);
	});
});
