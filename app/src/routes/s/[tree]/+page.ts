/**
 * §13.1: skill routes are resolved from the manifest at runtime, never
 * prerendered. Prerendering 164 and eventually 500 tree shells would grow build
 * time linearly in content while adding nothing — the shell is identical and the
 * content arrives from the manifest anyway.
 *
 * A tree id absent from the manifest is a **tree-unavailable state, never a
 * 404** (§13.1, §16.3), so this load function resolves either way and the page
 * renders the difference.
 */

import type { PageLoad } from './$types';
import type { CompiledTree } from '$lib/types';
import type { ContentLoader } from '$lib/content';
import { loader } from '$lib/content';

export const prerender = false;

/** The loader reaches for Cache Storage, which exists only in the browser. */
export const ssr = false;

/**
 * §16.3 has **two** rows for an unavailable tree, and they are different
 * failures with different sentences (T26/F22):
 *
 * - `missing` — the manifest has no entry. The lookup misses *before* any
 *   fetch, so it is not a network problem at all; it is a library that no longer
 *   contains this skill. If the user has a `SKILL` row for it their progress is
 *   intact, and the page has to say so.
 * - `unreachable` — the manifest knows the tree and the bundle would not load.
 *   That tree only is unavailable; the map and every other tree are unaffected.
 */
export type UnavailableReason = 'missing' | 'unreachable';

export interface SkillPageData {
  treeId: string;
  tree: CompiledTree | null;
  unavailable: string | null;
  reason: UnavailableReason | null;
  offline: boolean;
}

/**
 * Split out from `load` so it is testable without a browser: `loader()` binds to
 * `globalThis.caches`, which exists only there.
 */
export async function resolveSkillPage(
  content: Pick<ContentLoader, 'loadTree' | 'loadManifest' | 'isOffline'>,
  treeId: string,
): Promise<SkillPageData> {
  try {
    const tree = await content.loadTree(treeId);
    return { treeId, tree, unavailable: null, reason: null, offline: content.isOffline() };
  } catch (error) {
    // Asked of the loader rather than inferred from the error message, and free:
    // `loadManifest` is memoized, so this is a read of something already in hand.
    // A manifest that itself failed leaves us unable to say the tree is missing,
    // and `unreachable` is the honest answer then.
    const known = await content.loadManifest().then(
      (manifest) => manifest.trees.some((entry) => entry.id === treeId),
      () => true,
    );

    // Per-tree failure isolation (§7.4): one tree is unavailable, the app is not.
    return {
      treeId,
      tree: null,
      unavailable: error instanceof Error ? error.message : String(error),
      reason: known ? 'unreachable' : 'missing',
      offline: content.isOffline(),
    };
  }
}

export const load: PageLoad<SkillPageData> = async ({ params }) => {
  return resolveSkillPage(loader(), params.tree);
};
