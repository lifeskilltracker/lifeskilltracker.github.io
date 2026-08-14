/**
 * `/s/<treeId>/m/<slug>` — a tree view with one milestone panel open (§13.1).
 *
 * **The link is by slug, not uid, and that is a deliberate cost.** A URL is a
 * human-facing artifact and `…/m/forge-a-leaf` is worth having, but slugs are
 * mutable (§5.3) while uids are not — so this route has to do the resolution the
 * uid would have made unnecessary: current slugs first, then the `aliases` list
 * §5.4 keeps for exactly this (T14).
 *
 * **An unresolvable slug opens the tree with a notice, never a 404.** The
 * milestone may have been renamed before `aliases` existed, or the link may have
 * been mistyped, or the tree may have been revised past it — in every one of
 * those the user asked for a skill that exists, and answering "not found"
 * discards the part of the request that was valid.
 */

import type { CompiledTree } from '$lib/types';
import { loader } from '$lib/content';
import { resolveSkillPage, type SkillPageData } from '../../+page.js';
import type { PageLoad } from './$types';

export const prerender = false;

/** The loader reaches for Cache Storage, which exists only in the browser. */
export const ssr = false;

export interface MilestonePageData {
	/** Exactly what `/s/<treeId>` would have resolved — same page, same failures. */
	page: SkillPageData;
	slug: string;
	/** `null` when the slug resolves to nothing; the page says so (§13.1). */
	uid: string | null;
}

/**
 * Current slug first. An alias that collides with a live slug must lose:
 * `aliases` is a record of what a milestone *used* to be called, and a tree
 * where one milestone's old name is another's current name is one where the
 * current name is the answer the user meant (§5.4).
 */
export function resolveMilestoneUid(tree: CompiledTree, slug: string): string | null {
	const current = tree.milestones.find((milestone) => milestone.id === slug);
	if (current !== undefined) return current.uid;

	const renamed = tree.milestones.find((milestone) => (milestone.aliases ?? []).includes(slug));
	return renamed?.uid ?? null;
}

export const load: PageLoad<MilestonePageData> = async ({ params }) => {
	const page = await resolveSkillPage(loader(), params.tree);
	return {
		page,
		slug: params.slug,
		uid: page.tree === null ? null : resolveMilestoneUid(page.tree, params.slug)
	};
};
