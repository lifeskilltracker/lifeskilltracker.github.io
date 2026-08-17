// @vitest-environment jsdom

/**
 * The map surface — the camera, and the two claims that make it a camera rather
 * than two pages (A1/A6, T30).
 *
 * **It does not remount.** Changing the level changes a `viewBox`, not a set of
 * DOM nodes. That is asserted by node *identity*, because it is the only form of
 * the claim that a re-render cannot accidentally satisfy: if the surface were
 * rebuilt, every assertion about what it draws would still pass and the
 * transition would still be a page load.
 *
 * **Under reduced motion it arrives, it does not hurry.** §15.5's requirement is
 * "instant", not "shorter", and the difference is testable: the box is at the
 * destination on the very next flush, with no frame ever requested.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, flushSync, render } from './test-harness.svelte.js';
import MapSurface from './MapSurface.svelte';
import { fit, type CameraLevel } from './camera.js';
import type { DomainId, DomainScore, Manifest } from '$lib/types';

const palette = { light: { base: '#123456', accent: '#abcdef' }, dark: { base: '#123456', accent: '#abcdef' } };

const MANIFEST = {
	taxonomy: {
		domains: [
			{ id: 'home', title: 'Home', blurb: 'home', palette },
			{ id: 'body', title: 'Body', blurb: 'body', palette }
		],
		facets: [],
		map: {
			regions: [
				{ domain: 'home', path: 'M 0,0 L 100,0 L 100,100 L 0,100 Z' },
				{ domain: 'body', path: 'M 200,0 L 300,0 L 300,100 L 200,100 Z' }
			]
		}
	},
	trees: [
		{ id: 'cooking', domain: 'home' },
		{ id: 'baking', domain: 'home' }
	]
} as unknown as Manifest;

const score = (fill: number, breadth: number): DomainScore =>
	({ fill, breadth, lastActivityAt: null }) as DomainScore;

const SCORES: ReadonlyMap<DomainId, DomainScore> = new Map([
	['home', score(0.45, 2)],
	['body', score(0, 0)]
]);

function mount(level: CameraLevel = { level: 0 }, reducedMotion = true) {
	return render(MapSurface, {
		manifest: MANIFEST,
		domainScores: SCORES,
		level,
		viewport: 'map' as const,
		reducedMotion
	});
}

const viewBoxOf = (container: HTMLElement): string =>
	container.querySelector('svg')?.getAttribute('viewBox') ?? '';

afterEach(cleanup);

describe('the resting frame (§5.7, T35)', () => {
	it('paints level 0 with no animation on first load', () => {
		const { container } = mount();
		// The union of both regions, exactly. Nothing flew here.
		expect(viewBoxOf(container)).toBe('0 0 300 100');
	});

	it('paints level 1 directly when the URL arrives there cold', () => {
		// A cold arrival at a domain URL paints that domain's frame (§13.1). It
		// does not paint the world and then fly, which a returning bookmark user
		// would see as the app losing its place.
		const { container } = mount({ level: 1, domain: 'home' });
		const expected = fit({ level: 1, domain: 'home' }, {
			regions: [
				{ domain: 'home', bounds: { x: 0, y: 0, width: 100, height: 100 } },
				{ domain: 'body', bounds: { x: 200, y: 0, width: 100, height: 100 } }
			]
		});
		expect(viewBoxOf(container)).toBe(`${expected.x} ${expected.y} ${expected.w} ${expected.h}`);
	});
});

describe('the level change does not remount the surface', () => {
	it('keeps the very same region path nodes across the transition', () => {
		const mounted = mount();
		const before = [...mounted.container.querySelectorAll('.region-plate')];
		expect(before.length).toBe(2);

		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();

		const after = [...mounted.container.querySelectorAll('.region-plate')];
		expect(after.length).toBe(2);
		// Identity, not equality. This is the whole claim of A6.
		for (const [i, node] of after.entries()) expect(node).toBe(before[i]);
	});

	it('moves the camera and nothing else', () => {
		const mounted = mount();
		const worldBox = viewBoxOf(mounted.container);

		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();

		expect(viewBoxOf(mounted.container)).not.toBe(worldBox);
		expect(mounted.container.querySelector('[data-map-surface]')?.getAttribute('data-level')).toBe('1');
	});

	it('returns to the world box when the level goes back to 0 (Back is the breadcrumb)', () => {
		const mounted = mount();
		const worldBox = viewBoxOf(mounted.container);

		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();
		mounted.props.level = { level: 0 };
		flushSync();

		expect(viewBoxOf(mounted.container)).toBe(worldBox);
	});

	it('has no breadcrumb widget anywhere in the markup (§5.1)', () => {
		const mounted = mount({ level: 1, domain: 'home' });
		const markup = mounted.container.innerHTML;

		expect(markup).not.toMatch(/breadcrumb/i);
		expect(mounted.container.querySelector('[aria-label*="readcrumb"]')).toBeNull();
		// Browser Back is the breadcrumb, and it needs no markup at all.
		expect(mounted.container.querySelector('nav')).toBeNull();
	});
});

describe('§15.5 — reduced motion makes the change instant, not shorter', () => {
	it('never requests a frame', () => {
		const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
		const mounted = mount({ level: 0 }, true);

		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();

		expect(raf).not.toHaveBeenCalled();
		raf.mockRestore();
	});

	it('is already at the destination on the next flush', () => {
		const mounted = mount({ level: 0 }, true);
		mounted.props.level = { level: 1, domain: 'body' };
		flushSync();

		const expected = fit({ level: 1, domain: 'body' }, {
			regions: [
				{ domain: 'home', bounds: { x: 0, y: 0, width: 100, height: 100 } },
				{ domain: 'body', bounds: { x: 200, y: 0, width: 100, height: 100 } }
			]
		});
		expect(viewBoxOf(mounted.container)).toBe(`${expected.x} ${expected.y} ${expected.w} ${expected.h}`);
	});

	it('animates when motion is allowed — the box is not the destination yet', () => {
		const frames: FrameRequestCallback[] = [];
		const raf = vi
			.spyOn(globalThis, 'requestAnimationFrame')
			.mockImplementation((cb: FrameRequestCallback) => {
				frames.push(cb);
				return frames.length;
			});

		const mounted = mount({ level: 0 }, false);
		const worldBox = viewBoxOf(mounted.container);

		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();

		// A frame was asked for, and the camera has not jumped.
		expect(raf).toHaveBeenCalled();
		expect(viewBoxOf(mounted.container)).toBe(worldBox);
		raf.mockRestore();
	});
});

describe('§8.2 — the camera transition is announced, not only animated', () => {
	const announcement = (container: HTMLElement): string =>
		container.querySelector('[data-map-announcement]')?.textContent?.trim() ?? '';

	it('is silent at level 0', () => {
		const { container } = mount();
		expect(announcement(container)).toBe('');
	});

	it('names the region, its band, its breadth and its published skill count', () => {
		const mounted = mount();
		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();

		const said = announcement(mounted.container);
		expect(said).toContain('Home');
		expect(said).toContain('2 skills started');
		expect(said).toContain('2 skills published');
		// F34 — fill is a band, never a number, here as everywhere else.
		expect(said).toMatch(/Fill: [A-Z]/);
		expect(said).not.toMatch(/Fill:\s*[\d.]/);
		expect(said).not.toContain('%');
	});

	it('is polite, and is not the tree’s region (§15.2)', () => {
		const mounted = mount({ level: 1, domain: 'home' });
		const region = mounted.container.querySelector('[data-map-announcement]')!;

		expect(region.getAttribute('role')).toBe('status');

		// §15.2 forbids the app an interrupting region of its own, so every live
		// region on this surface must be the polite one. Written as a value check
		// rather than as a selector on purpose: `TreeView.a11y.test.ts` greps the
		// whole source tree for the interrupting value, and a test asserting its
		// absence would otherwise be the thing that trips that gate.
		const live = [...mounted.container.querySelectorAll('[aria-live]')].map((el) =>
			el.getAttribute('aria-live')
		);
		expect(live).toEqual(['polite']);
	});

	it('says a fogged domain is unpublished rather than empty (F22)', () => {
		const mounted = mount();
		mounted.props.level = { level: 1, domain: 'body' };
		flushSync();

		expect(announcement(mounted.container)).toBe(
			'Body. No skills published yet — contribute one.'
		);
	});
});

describe('§5.2 — the outline steps with the level', () => {
	it('is thinner at level 1, so it holds constant screen weight', () => {
		const mounted = mount();
		const svg = mounted.container.querySelector('svg')!;
		const widthAt = () => (svg.getAttribute('style') ?? '').match(/--outline-width:\s*([\d.]+)/)?.[1];

		expect(widthAt()).toBe('1.3');

		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();
		expect(widthAt()).toBe('0.9');
	});
});
