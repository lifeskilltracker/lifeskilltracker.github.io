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

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, flushSync, render } from './test-harness.svelte.js';
import MapSurface from './MapSurface.svelte';
import { fit, type CameraLevel } from './camera.js';
import type { SearchHighlight } from './search.js';
import type { SkillHexRow } from '$lib/actions/skill-hexes.js';
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
		reducedMotion,
		// Declared here so the reactive props proxy carries it: §6.2's tests set it
		// after mount, and a key absent from the initial object is not reactive.
		highlight: null as SearchHighlight | null
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

describe('U-10 — the threshold is the camera level, not the viewport (§8.1, T31)', () => {
	/**
	 * The table §8.1 states, asserted as a table. The failure it guards is the
	 * one U-10 exists to fix: a phone visitor who never sees the map at all.
	 */
	const ROWS: readonly SkillHexRow[] = [
		{
			treeId: 'cooking',
			title: 'Cooking',
			domain: 'home',
			cell: { q: 0, r: 0 },
			attainedLevel: 3,
			started: true,
			hasMastery: true,
			attainedMax: false,
			tier: 'Apprentice'
		},
		{
			treeId: 'baking',
			title: 'Baking',
			domain: 'home',
			cell: { q: 1, r: 0 },
			attainedLevel: 0,
			started: false,
			hasMastery: false,
			attainedMax: false,
			tier: null
		}
	];

	/**
	 * Both level-1 components are `import()`ed on demand, and a *cold* module
	 * graph takes more turns of the event loop to resolve than a warm one — which
	 * would make these tests pass or fail by their order in the file. Resolving
	 * them once up front removes that, and leaves `at()` waiting only for Svelte
	 * to render an already-resolved promise.
	 */
	beforeAll(async () => {
		await import('./SkillHexLayer.svelte');
		await import('./DomainSkillList.svelte');
	});

	/**
	 * The skill layer and the phone list are both `import()`ed on demand (§17.1 —
	 * they are level-1 only and the first route's JS budget is 52 kB), so they
	 * land a microtask after the render rather than during it. Awaiting here is
	 * what a real browser does too; §5.6 already holds the layer back 120 ms
	 * behind the camera, so the delay is invisible in use.
	 */
	async function at(level: CameraLevel, viewport: 'map' | 'list') {
		const mounted = render(MapSurface, {
			manifest: MANIFEST,
			domainScores: SCORES,
			level,
			viewport,
			skills: ROWS,
			reducedMotion: true
		});
		// Macrotasks, not microtasks: the module graph has to resolve before the
		// `{#await}` can render its `then` branch, and a cold chunk takes more than
		// one turn. Flushing after each is what turns the resolution into DOM.
		for (let i = 0; i < 5; i += 1) {
			await new Promise((resolve) => setTimeout(resolve, 0));
			flushSync();
		}
		return mounted;
	}

	it('draws the map at level 0 on a phone, where it used to draw a list', async () => {
		const { container } = await at({ level: 0 }, 'list');
		expect(container.querySelector('svg.world-map')).not.toBeNull();
		expect(container.querySelector('[data-skill-list]')).toBeNull();
	});

	it('draws the map at level 0 on a desktop', async () => {
		const { container } = await at({ level: 0 }, 'map');
		expect(container.querySelector('svg.world-map')).not.toBeNull();
	});

	it('substitutes the skill list at level 1 on a phone', async () => {
		const { container } = await at({ level: 1, domain: 'home' }, 'list');
		expect(container.querySelector('svg.world-map')).toBeNull();
		expect(container.querySelector('[data-skill-list]')).not.toBeNull();
	});

	it('draws hexes at level 1 on a desktop', async () => {
		const { container } = await at({ level: 1, domain: 'home' }, 'map');
		expect(container.querySelector('[data-skill-layer]')).not.toBeNull();
		expect(container.querySelectorAll('[data-skill]')).toHaveLength(2);
	});

	it('draws no hexes at level 0, whatever rows it is handed', async () => {
		// The level gates the layer, not the rows: this is what bounds the
		// labelled-hex count as the library grows to 500 (§5.1).
		const { container } = await at({ level: 0 }, 'map');
		expect(container.querySelector('[data-skill-layer]')).toBeNull();
	});

	it('carries the same skills in the same order in both presentations (A5)', async () => {
		const names = (root: HTMLElement) =>
			[...root.querySelectorAll('[data-skill]')].map((el) => el.getAttribute('data-skill'));

		const hexes = await at({ level: 1, domain: 'home' }, 'map');
		const order = names(hexes.container);
		expect(order).toEqual(['cooking', 'baking']);
		cleanup();

		const list = await at({ level: 1, domain: 'home' }, 'list');
		expect(names(list.container)).toEqual(order);
	});

	it('says the same things about a skill in both presentations (A5)', async () => {
		const labelOf = (root: HTMLElement, id: string) =>
			root.querySelector(`[data-skill="${id}"]`)?.getAttribute('aria-label');

		const hexes = await at({ level: 1, domain: 'home' }, 'map');
		const hexLabel = labelOf(hexes.container, 'cooking');
		cleanup();

		// The same builder feeds both, which is the only way the claim stays true.
		const list = await at({ level: 1, domain: 'home' }, 'list');
		expect(labelOf(list.container, 'cooking')).toBe(hexLabel);
		expect(hexLabel).toContain('Level 3 of 10.');
	});
});

/**
 * §6.2's highlight, applied to the map (T33).
 *
 * **The camera invariant is the acceptance criterion.** "Typing in Find
 * highlights matches and dims the rest without changing the viewBox" is the
 * whole reason highlight-in-place is worth building, and it is exactly the
 * property that would be lost by someone later making Find "helpfully" frame its
 * results. Comparing the `viewBox` across a query is the only assertion that
 * catches that.
 *
 * **Q5, resolved (2026-08-18): the highlight persists across a camera move.** A
 * filter you keep on while you explore is what makes "what have I got in this
 * area" answerable; one that cleared on entering the area would answer it for
 * exactly as long as it took to look.
 */
describe('§6.2 — Find highlights in place', () => {
	it('dims the regions holding no match, and holds the matching ones', () => {
		const mounted = mount({ level: 0 });

		mounted.props.highlight = { domains: new Set(['home']), matches: new Set(['cooking']) };
		flushSync();

		const home = mounted.container.querySelector('.region[data-domain="home"]')!;
		const body = mounted.container.querySelector('.region[data-domain="body"]')!;
		expect(home.classList.contains('is-unmatched')).toBe(false);
		expect(body.classList.contains('is-unmatched')).toBe(true);
	});

	it('dims nothing at all when there is no query', () => {
		const mounted = mount({ level: 0 });

		mounted.props.highlight = null;
		flushSync();

		expect(mounted.container.querySelectorAll('.is-unmatched').length).toBe(0);
	});

	it('does not move the camera when a query arrives', () => {
		const mounted = mount({ level: 0 });
		const before = viewBoxOf(mounted.container);

		mounted.props.highlight = { domains: new Set(['body']), matches: new Set(['x']) };
		flushSync();

		expect(viewBoxOf(mounted.container)).toBe(before);
	});

	it('does not move the camera when the query is cleared either', () => {
		const mounted = mount({ level: 1, domain: 'home' });
		mounted.props.highlight = { domains: new Set(['body']), matches: new Set(['x']) };
		flushSync();
		const before = viewBoxOf(mounted.container);

		mounted.props.highlight = null;
		flushSync();

		expect(viewBoxOf(mounted.container)).toBe(before);
	});

	it('Q5 — survives the camera moving to another level', () => {
		const mounted = mount({ level: 0 });
		mounted.props.highlight = { domains: new Set(['home']), matches: new Set(['cooking']) };
		flushSync();

		mounted.props.level = { level: 1, domain: 'home' };
		flushSync();

		// Still applied after the fly, on whatever the new level draws.
		expect(mounted.container.querySelectorAll('.is-unmatched').length).toBeGreaterThan(0);
	});
});
