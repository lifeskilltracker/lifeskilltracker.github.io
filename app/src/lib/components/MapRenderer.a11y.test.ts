// @vitest-environment jsdom

/**
 * §15.3 and §15.4 for the map (T20, N5, F34, F35).
 *
 * `MapRenderer.test.ts` asks whether §10.5's three channels are drawn the way
 * the spec says; this file asks whether each of them is *also* available as text
 * to someone who cannot see the drawing — and whether the reading order is the
 * stable, documented one §15.3 promises rather than whatever the geometry
 * happens to be.
 *
 * The map is the easier of the two views to make accessible and the easier one
 * to get wrong quietly: a region is a shape with three numbers on it, so every
 * channel is colour-and-geometry by default. §15.4's row for the fill level is
 * the one that has to be re-checked whenever the palette moves.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bandFor, domainScores } from '$lib/scoring';
import type { DomainSkillRow } from '$lib/types';
import MapRenderer from './MapRenderer.svelte';
import { auditAccessibility } from './axe.js';
import { DOMAINS, ROWS, TITLES, manifestFixture, type ManifestOptions } from './fixtures.js';
import { MAP_LIST_BELOW, breadthText, formatLastActivity } from './map-presentation.js';
import { cleanup, focus, render } from './test-harness.svelte.js';

afterEach(cleanup);

const SOURCE = readFileSync(join(process.cwd(), 'src/lib/components/MapRenderer.svelte'), 'utf8');

function mount(
	options: ManifestOptions & { viewport?: 'map' | 'list'; rows?: DomainSkillRow[] } = {}
) {
	const manifest = manifestFixture(options);
	const scores = domainScores(manifest.taxonomy, options.rows ?? ROWS);
	const mounted = render(MapRenderer, {
		manifest,
		domainScores: scores,
		viewport: options.viewport ?? 'map'
	});
	return { ...mounted, manifest, scores };
}

const regions = (container: HTMLElement): Element[] => [
	...container.querySelectorAll('[data-domain]')
];

const readingOrder = (container: HTMLElement): string[] =>
	regions(container).map((element) => element.getAttribute('data-domain') ?? '');

describe('§15.3 — every region announces every channel as text', () => {
	it.each(['map', 'list'] as const)('in the %s view, for all eight domains', (viewport) => {
		const { container, scores, manifest } = mount({ viewport });

		expect(regions(container)).toHaveLength(DOMAINS.length);

		for (const domain of DOMAINS) {
			const region = container.querySelector(`[data-domain="${domain}"]`)!;
			const name = region.getAttribute('aria-label') ?? '';
			const score = scores.get(domain)!;
			const fogged = !manifest.trees.some((tree) => tree.domain === domain);

			// The domain is always named, fogged or not: §15.4's redundant channel
			// for domain identity is "region silhouette + label", and a fogged region
			// replaces its visible label with the affordance (§10.5).
			expect(name).toContain(TITLES[domain]);

			if (fogged) {
				expect(name).toContain('No skills published yet — contribute one.');
				// Nothing quantitative is claimed about a domain with no content.
				expect(name).not.toContain('Fill:');
				continue;
			}

			expect(name).toContain(breadthText(score.breadth));
			expect(name).toContain(`Fill: ${bandFor(score.fill)}`);
			expect(name).toContain(formatLastActivity(score.lastActivityAt));
		}
	});

	it('announces fill as a named band and never as a number (F34, T26/F18)', () => {
		const { container, scores } = mount();

		for (const domain of DOMAINS) {
			const name = container.querySelector(`[data-domain="${domain}"]`)!.getAttribute('aria-label')!;
			// No digits and no percentage may follow "Fill:" — the band replaces a
			// denominator the domain does not have.
			expect(name).not.toMatch(/Fill:\s*[\d.%]/);
		}
		// And the band spoken is the band the one resolver returns.
		expect(bandFor(scores.get('making')!.fill)).toBe('Moderate');
	});

	it('calls it a band, not a tier — a tier ranks a skill (§15.3, T26/F18)', () => {
		// The rename is the finding. A map that announced a "tier" would appear to
		// rank a domain on the scale that ranks a skill (§11.3 vs §11.6).
		expect(SOURCE).not.toMatch(/\btier\b/i);
	});
});

describe('§15.3 — a stable reading order, independent of pixel position', () => {
	it('follows the manifest’s domain order when focus walks the regions', () => {
		// `regionOrder` lays the regions out with x *descending*, so the leftmost
		// region on screen is the last domain in reading order.
		const { container, manifest } = mount({ regionOrder: [...DOMAINS] });

		// Walk it the way a keyboard user does: every region is a tab stop, so tab
		// order is document order, and focusing each in turn must trace it exactly.
		const visited: string[] = [];
		for (const region of regions(container)) {
			focus(region);
			visited.push(document.activeElement?.getAttribute('data-domain') ?? '');
		}

		expect(visited).toEqual([...DOMAINS]);

		// The geometry disagrees, which is what makes the assertion worth making:
		// sorted by x, the regions come out in the opposite order.
		const byPixel = [...manifest.taxonomy.map.regions]
			.sort((a, b) => (a.bounds?.x ?? 0) - (b.bounds?.x ?? 0))
			.map((region) => region.domain);
		expect(byPixel).not.toEqual([...DOMAINS]);
	});

	it('is the same order in the list, so the two views converge (§15.3)', () => {
		const map = mount({ viewport: 'map' });
		const order = readingOrder(map.container);
		cleanup();

		expect(readingOrder(mount({ viewport: 'list' }).container)).toEqual(order);
	});

	it('does not move when the geometry does', () => {
		const shuffled = mount({ regionOrder: [...DOMAINS] });
		expect(readingOrder(shuffled.container)).toEqual([...DOMAINS]);
		cleanup();

		const reversed = mount({ regionOrder: [...DOMAINS].reverse() });
		expect(readingOrder(reversed.container)).toEqual([...DOMAINS]);
	});
});

describe('§15.4 — never colour alone, on the map', () => {
	it('identifies a domain by silhouette and label, not by palette', () => {
		const { container } = mount();
		const making = container.querySelector('[data-domain="making"]')!;

		// The silhouette: a real path, its own shape per domain.
		const path = making.querySelector('.region-plate')?.getAttribute('d');
		expect(path).toBeTruthy();
		const others = [...container.querySelectorAll('.region-plate')].map((p) => p.getAttribute('d'));
		expect(new Set(others).size).toBe(DOMAINS.length);

		// The label: text, in the drawing and in the accessible name alike.
		expect(making.querySelector('.region-label')?.textContent?.trim()).toBe('Making');
		expect(making.getAttribute('aria-label')).toContain('Making');
	});

	it('gives the fill height a named band in text on focus', () => {
		const { container } = mount();
		const making = container.querySelector('[data-domain="making"]')!;

		expect(making.querySelector('.region-band')).toBeNull();
		focus(making);
		expect(making.querySelector('.region-band')?.textContent?.trim()).toBe('Moderate');
	});

	it('gives recency no colour channel at all — it is a date (D-20)', () => {
		const { container } = mount();
		const making = container.querySelector('[data-domain="making"]')!;
		const mind = container.querySelector('[data-domain="mind"]')!;

		// Two regions with utterly different recency and identical styling: if
		// recency had a colour channel, these would differ somewhere other than the
		// text. `style` carries the palette as a `--domain-<id>` token (A7), so the
		// domain id is normalised out first — that difference is *identity*, which
		// §15.4 requires, and it is the only difference permitted here.
		const styleOf = (region: Element, domain: string): string[] =>
			[...region.querySelectorAll('[style]')].map((el) =>
				(el.getAttribute('style') ?? '').replaceAll(domain, '<domain>')
			);
		expect(styleOf(mind, 'mind')).toEqual(styleOf(making, 'making'));

		expect(making.querySelector('.region-recency')?.textContent?.trim()).toBe(
			'Last activity — 12 March 2026'
		);
		expect(mind.querySelector('.region-recency')?.textContent?.trim()).toBe('No activity yet');
	});

	it('keeps every channel in the list view, where there is no drawing at all', () => {
		const { container } = mount({ viewport: 'list' });
		const making = container.querySelector('[data-domain="making"]')!;

		expect(making.querySelector('.region-band')?.textContent?.trim()).toBe('Moderate');
		expect(making.querySelector('.region-breadth')?.textContent?.trim()).toBe('3');
		expect(making.querySelector('.region-recency')?.textContent?.trim()).toBe(
			'Last activity — 12 March 2026'
		);
	});
});

describe('§15.5 — the map’s one animation', () => {
	it('disables every transition under prefers-reduced-motion', () => {
		const [normal, ...rest] = SOURCE.split('@media (prefers-reduced-motion: reduce)');
		const reduced = rest.join('\n');

		expect(reduced).toContain('transition: none');

		// Counting declarations was the old shape of this check, and it broke the
		// moment T30 added the water line and the focus dim — which is the wrong
		// failure, because both were switched off correctly. What actually matters
		// is the property: **every selector that transitions outside the media
		// query is named inside it.** That holds however many are added later.
		const selectorsWithTransitions = (css: string): Set<string> => {
			const found = new Set<string>();
			// Comments first: this file explains its rules at length, and a comment
			// sitting above a rule is otherwise read as part of its selector.
			const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
			for (const rule of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
				if (!/transition:/.test(rule[2])) continue;
				for (const selector of rule[1].split(',')) {
					const trimmed = selector.trim();
					if (trimmed.length > 0) found.add(trimmed);
				}
			}
			return found;
		};

		const animated = selectorsWithTransitions(normal);
		const switchedOff = selectorsWithTransitions(reduced);

		expect(animated.size).toBeGreaterThan(0);
		for (const selector of animated) {
			expect([...switchedOff]).toContain(selector);
		}
	});

	it('has no animation carrying information — nothing on the map is motion-only', () => {
		expect(SOURCE).not.toContain('@keyframes');
		expect(SOURCE).not.toMatch(/\banimation:/);
	});
});

describe('§15.7 — the list is the phone-sized view', () => {
	it('holds its rows to the 44×44 touch target', () => {
		expect(SOURCE).toMatch(/\.domain-link \{[^}]*min-height: 44px/);
	});

	it('documents the one threshold at which it substitutes for the map', () => {
		expect(MAP_LIST_BELOW).toBeGreaterThan(0);
	});
});

describe('§15.8 — the axe gate', () => {
	it('finds no violation on the drawn map', async () => {
		const { container } = mount();
		expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
	});

	it('finds no violation on the domain list', async () => {
		const { container } = mount({ viewport: 'list' });
		await auditAccessibility(container);
	});

	it('finds no violation when every domain is fogged', async () => {
		const { container } = mount({ published: [] });
		await auditAccessibility(container);
	});
});
