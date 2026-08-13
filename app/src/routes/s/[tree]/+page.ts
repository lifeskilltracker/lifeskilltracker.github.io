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

import type { CompiledTree } from '$lib/types';
import type { ContentLoader } from '$lib/content';
import { loader } from '$lib/content';

export const prerender = false;

/** The loader reaches for Cache Storage, which exists only in the browser. */
export const ssr = false;

export interface SkillPageData {
  treeId: string;
  tree: CompiledTree | null;
  unavailable: string | null;
  offline: boolean;
}

/**
 * Split out from `load` so it is testable without a browser: `loader()` binds to
 * `globalThis.caches`, which exists only there.
 */
export async function resolveSkillPage(
  content: Pick<ContentLoader, 'loadTree' | 'isOffline'>,
  treeId: string,
): Promise<SkillPageData> {
  try {
    const tree = await content.loadTree(treeId);
    return { treeId, tree, unavailable: null, offline: content.isOffline() };
  } catch (error) {
    // Per-tree failure isolation (§7.4): one tree is unavailable, the app is not.
    return {
      treeId,
      tree: null,
      unavailable: error instanceof Error ? error.message : String(error),
      offline: content.isOffline(),
    };
  }
}

export async function load({ params }): Promise<SkillPageData> {
  return resolveSkillPage(loader(), params.tree);
}
