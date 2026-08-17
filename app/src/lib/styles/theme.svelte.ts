/**
 * Theme resolution (UI-SPEC §4.1, §4.2) and domain-plate injection (§5.9, A7).
 *
 * Two jobs, together here because they share one trigger: the resolved theme decides
 * which half of every domain's palette is live, so a theme change and a palette
 * change are the same event.
 *
 * §4.1's claim that the direction "survives both themes as a token swap" is only
 * true if nothing but tokens changes. So this module writes custom properties and
 * never anything else — no class per theme, no component branch. `theme.test.ts`
 * asserts that markup is byte-identical across a toggle, which is what keeps the
 * claim honest as surfaces are added.
 */

import type { CompiledDomain } from '$lib/types';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'lst.theme';
const MEDIA = '(prefers-color-scheme: dark)';

/** The three states are not two. `system` stamps no attribute and lets CSS decide. */
function isChoice(value: unknown): value is ThemeChoice {
	return value === 'light' || value === 'dark' || value === 'system';
}

function readStored(): ThemeChoice {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		return isChoice(raw) ? raw : 'system';
	} catch {
		// Private mode and blocked storage both throw. A theme is not worth failing a
		// start over; `system` is the correct fallback because it is what an
		// unconfigured browser already wanted.
		return 'system';
	}
}

let choice = $state<ThemeChoice>('system');
let systemDark = $state(false);

/**
 * Resolution is derived, never stored. Storing it would let the persisted value and
 * the media query disagree after the OS switches, and the stale one would win.
 */
export const theme = {
	get choice(): ThemeChoice {
		return choice;
	},
	get resolved(): ResolvedTheme {
		if (choice === 'system') return systemDark ? 'dark' : 'light';
		return choice;
	}
};

export function resolvedTheme(): ResolvedTheme {
	return theme.resolved;
}

export function setTheme(next: ThemeChoice): void {
	choice = next;
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, next);
	} catch {
		// See readStored: a blocked store costs persistence, not the session.
	}
	applyAttribute();
}

/**
 * `system` REMOVES the attribute rather than setting it to "system". The stylesheet's
 * dark block is guarded as `:root:not([data-theme='light'])`, so an explicit light
 * choice beats a dark OS; leaving a `data-theme="system"` behind would satisfy that
 * guard and quietly pin the page to the media query's answer even after a choice.
 */
function applyAttribute(): void {
	const root = globalThis.document?.documentElement;
	if (!root) return;
	if (choice === 'system') root.removeAttribute('data-theme');
	else root.setAttribute('data-theme', choice);
}

/**
 * Domain plates as `--domain-<id>` and `--domain-<id>-accent`, resolved for the live
 * theme. Palettes are content (D-03) and unknown at build time, so this is the seam
 * between a content file and the stylesheet.
 */
export function applyDomainPalettes(
	domains: readonly CompiledDomain[],
	resolved: ResolvedTheme
): void {
	const root = globalThis.document?.documentElement;
	if (!root) return;
	for (const domain of domains) {
		const pair = domain.palette[resolved];
		root.style.setProperty(`--domain-${domain.id}`, pair.base);
		root.style.setProperty(`--domain-${domain.id}-accent`, pair.accent);
	}
}

/**
 * Called once from the shell. Returns a teardown so a test can unsubscribe; the
 * media listener would otherwise outlive the component and keep writing to a
 * document the test has replaced.
 */
export function initTheme(): () => void {
	choice = readStored();
	const query = globalThis.matchMedia?.(MEDIA);
	systemDark = query?.matches ?? false;
	applyAttribute();

	if (!query) return () => {};
	const onChange = (event: MediaQueryListEvent) => {
		systemDark = event.matches;
	};
	query.addEventListener('change', onChange);
	return () => query.removeEventListener('change', onChange);
}

/**
 * The inline script for `app.html`, exported as a string so the test can assert the
 * two stay in step rather than trusting a copy.
 *
 * It runs before first paint and duplicates `applyAttribute`'s rule deliberately:
 * without it the document paints the light palette and then corrects itself once the
 * bundle hydrates, which is the flash of wrong theme §4.1 forbids. It cannot import
 * this module — a module graph is exactly the thing that has not loaded yet.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var c=localStorage.getItem('${STORAGE_KEY}');if(c==='light'||c==='dark'){document.documentElement.setAttribute('data-theme',c);}}catch(e){}})();`;
