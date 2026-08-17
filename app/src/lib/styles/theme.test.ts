// @vitest-environment jsdom

/**
 * §4.1's two claims, asserted rather than trusted.
 *
 * 1. The direction "survives both themes as a token swap" — so a theme change
 *    must alter custom properties and nothing else.
 * 2. No flash of the wrong theme — so the pre-paint script in `app.html` must
 *    agree with the module that takes over after hydration.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { CompiledDomain } from '$lib/types';
import { NO_FLASH_SCRIPT, applyDomainPalettes, initTheme, setTheme, theme } from './theme.svelte.js';

function stubMatchMedia(dark: boolean): { fire: (next: boolean) => void } {
	const listeners = new Set<(event: MediaQueryListEvent) => void>();
	let matches = dark;
	Object.defineProperty(globalThis, 'matchMedia', {
		configurable: true,
		writable: true,
		value: () => ({
			get matches() {
				return matches;
			},
			addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => {
				listeners.add(fn);
			},
			removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => {
				listeners.delete(fn);
			}
		})
	});
	return {
		fire(next: boolean) {
			matches = next;
			for (const fn of listeners) fn({ matches: next } as MediaQueryListEvent);
		}
	};
}

beforeEach(() => {
	localStorage.clear();
	document.documentElement.removeAttribute('data-theme');
	document.documentElement.removeAttribute('style');
});

describe('theme resolution (§4.1)', () => {
	it('defaults to system and stamps no attribute, so CSS decides', () => {
		stubMatchMedia(false);
		const stop = initTheme();
		expect(theme.choice).toBe('system');
		expect(theme.resolved).toBe('light');
		expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
		stop();
	});

	it('follows prefers-color-scheme while the choice is system', () => {
		const media = stubMatchMedia(false);
		const stop = initTheme();
		expect(theme.resolved).toBe('light');
		media.fire(true);
		expect(theme.resolved).toBe('dark');
		// Still no attribute: `system` is a deferral, not a value.
		expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
		stop();
	});

	it('lets an explicit light choice beat a dark OS', () => {
		stubMatchMedia(true);
		const stop = initTheme();
		expect(theme.resolved).toBe('dark');
		setTheme('light');
		expect(theme.resolved).toBe('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		stop();
	});

	it('persists the choice and restores it', () => {
		stubMatchMedia(false);
		let stop = initTheme();
		setTheme('dark');
		stop();
		stop = initTheme();
		expect(theme.choice).toBe('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		stop();
	});

	/**
	 * The regression this exists for: writing `data-theme="system"` would satisfy
	 * the stylesheet's `:not([data-theme='light'])` guard and pin the page to the
	 * media query even after the user has chosen.
	 */
	it('removes the attribute when returning to system rather than writing "system"', () => {
		stubMatchMedia(false);
		const stop = initTheme();
		setTheme('dark');
		setTheme('system');
		expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
		stop();
	});

	it('resolution is derived, so a stale stored value cannot outvote the OS', () => {
		const media = stubMatchMedia(false);
		const stop = initTheme();
		setTheme('system');
		media.fire(true);
		expect(theme.resolved).toBe('dark');
		stop();
	});

	it('survives blocked storage rather than failing the start', () => {
		stubMatchMedia(false);
		const getItem = Storage.prototype.getItem;
		Storage.prototype.getItem = () => {
			throw new DOMException('blocked');
		};
		try {
			const stop = initTheme();
			expect(theme.choice).toBe('system');
			stop();
		} finally {
			Storage.prototype.getItem = getItem;
		}
	});
});

describe('domain plates (§5.9, A7)', () => {
	const domains = [
		{
			id: 'mind',
			title: 'Mind',
			blurb: '',
			palette: {
				light: { base: '#24505F', accent: '#7C969B' },
				dark: { base: '#57A0B8', accent: '#355E6C' }
			}
		}
	] as unknown as CompiledDomain[];

	it('injects the resolved theme’s pair as --domain-<id>', () => {
		applyDomainPalettes(domains, 'light');
		const root = document.documentElement;
		expect(root.style.getPropertyValue('--domain-mind')).toBe('#24505F');
		expect(root.style.getPropertyValue('--domain-mind-accent')).toBe('#7C969B');

		applyDomainPalettes(domains, 'dark');
		expect(root.style.getPropertyValue('--domain-mind')).toBe('#57A0B8');
	});

	/**
	 * §4.1's token-swap claim, made falsifiable: a theme change may alter custom
	 * property values and must not alter anything else about the element.
	 */
	it('changes only custom property values across a theme swap', () => {
		const root = document.documentElement;
		applyDomainPalettes(domains, 'light');
		const before = root.cloneNode(false) as HTMLElement;
		before.removeAttribute('style');

		applyDomainPalettes(domains, 'dark');
		const after = root.cloneNode(false) as HTMLElement;
		after.removeAttribute('style');

		expect(after.outerHTML).toBe(before.outerHTML);
	});
});

describe('no flash of the wrong theme (§4.1)', () => {
	/**
	 * `app.html` cannot import the module — the module graph is what has not
	 * loaded yet — so the rule is written twice. This is what stops the copies
	 * drifting, which would show up only as a flash on a real device.
	 */
	it('app.html carries the same pre-paint rule as the module exports', () => {
		// Resolved from the workspace root rather than `import.meta.url`: under the
		// jsdom environment this module's URL is not a `file:` URL.
		const html = readFileSync(resolve('src/app.html'), 'utf8');
		const normalise = (value: string): string => value.replace(/\s+/g, '');
		const body = NO_FLASH_SCRIPT.replace(/^\(function\(\)\{/, '').replace(/\}\)\(\);$/, '');
		expect(normalise(html)).toContain(normalise(body));
	});

	it('the pre-paint rule sets nothing when there is no explicit choice', () => {
		const root = document.documentElement;
		eval(NO_FLASH_SCRIPT);
		expect(root.hasAttribute('data-theme')).toBe(false);
	});

	it('the pre-paint rule applies an explicit choice before hydration', () => {
		localStorage.setItem('lst.theme', 'dark');
		eval(NO_FLASH_SCRIPT);
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
	});
});
