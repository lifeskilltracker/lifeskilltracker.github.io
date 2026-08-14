/**
 * The eight locked domain ids (§5.9, F20).
 *
 * §13.1 prerenders **one `/d/<domainId>` page per domain**, and a prerender
 * entry list has to exist at build time — before any manifest is fetched and
 * without reading one, since the app must build from a checkout whose
 * `static/content` was produced by a separate `lst compile` step (§16.4).
 *
 * That is only safe because the ids are *locked*: F20 fixes them in
 * `common.schema.json` so that a domain id can never be renamed, which is the
 * same property §12.3's denormalized rows and every stored `SKILL` row depend
 * on. `domains.test.ts` checks this list against the compiled manifest, so a
 * ninth domain cannot be added to the taxonomy without this list failing.
 *
 * The type annotation is the other half of the check: `ContentDomainId` is
 * generated from the schema, so a rename there stops this file compiling.
 */

import type { ContentDomainId } from '$lib/types';

export const DOMAIN_IDS = [
	'mind',
	'body',
	'making',
	'home',
	'people',
	'work-money',
	'play',
	'outdoors-nature'
] as const satisfies readonly ContentDomainId[];

/**
 * Exhaustiveness in the other direction. `satisfies` above proves every listed
 * id is a real domain; this proves every real domain is listed, and it fails at
 * compile time rather than at prerender time — a missing entry would otherwise
 * surface as a 404 on a route nobody noticed was gone.
 */
type AssertNever<T extends never> = T;
export type _EveryDomainListed = AssertNever<
	Exclude<ContentDomainId, (typeof DOMAIN_IDS)[number]>
>;

export function isDomainId(value: string): value is ContentDomainId {
	return (DOMAIN_IDS as readonly string[]).includes(value);
}
