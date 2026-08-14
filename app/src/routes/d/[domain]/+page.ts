/**
 * §13.1: one prerendered page per domain.
 *
 * `entries()` is what makes "one per domain" true rather than aspirational — a
 * parameterised route with no entry list prerenders nothing, and the eight
 * listings would silently become client-only pages served through the `404.html`
 * fallback. The ids come from `lib/content/domains.ts`, which is checked against
 * the compiled taxonomy by its own test (§5.9, F20).
 *
 * There is no `load`: the listing reads the manifest from §13.2's store, which
 * the shell's cold start populates. A `load` fetching it here would be a second
 * fetch path for the same file and a second set of failure branches (§7.4).
 */

import { DOMAIN_IDS } from '$lib/content/domains.js';
import type { EntryGenerator } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => DOMAIN_IDS.map((domain) => ({ domain }));
