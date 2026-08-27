/**
 * `/s/<treeId>/preview` — §7.1's guided look at a skill (PRD D25, §12 Q4).
 *
 * The loader is the skill page's, verbatim. This route differs from
 * `/s/<treeId>` in exactly one way — whether the tour runs — which is the same
 * relationship `/s/<treeId>/m/<slug>` already has with it, and the reason both
 * share one page component.
 *
 * **A route rather than a `?preview=1` query.** §5.1 makes every camera state a
 * URL because Back is the breadcrumb, and that argument applies to a scripted
 * camera at least as strongly as to the map's. It also keeps the page component
 * free of `$app/state`: the route says which mode it is, so `SkillPage` stays
 * mountable outside a router and the tour stays assertable.
 */

import type { PageLoad } from './$types';
import { loader } from '$lib/content';
import { resolveSkillPage, type SkillPageData } from '../+page.js';

export const prerender = false;
export const ssr = false;

export const load: PageLoad<SkillPageData> = async ({ params }) => {
  return resolveSkillPage(loader(), params.tree);
};
