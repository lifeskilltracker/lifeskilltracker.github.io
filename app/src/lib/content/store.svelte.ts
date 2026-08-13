/**
 * §13.2's content store — the manifest and the loaded bundles, populated by the
 * Loader and read by routes.
 *
 * Everything derivable is deliberately absent. Domain scores, per-level
 * progress, availability, and node states are pure functions of
 * `(content, progress)`, and the moment they are cached in reactive state they
 * can disagree with their inputs (§13.2).
 */

import type { CompiledTree, Manifest } from '$lib/types';

class ContentStore {
  manifest = $state<Manifest | null>(null);
  /** Bundles that have loaded this session, by tree id. */
  trees = $state<Record<string, CompiledTree>>({});
  /** True while serving a cached manifest we could not revalidate (§7.4). */
  offline = $state(false);

  setManifest(manifest: Manifest, offline: boolean): void {
    this.manifest = manifest;
    this.offline = offline;
  }

  setTree(tree: CompiledTree): void {
    this.trees = { ...this.trees, [tree.id]: tree };
  }
}

export const content = new ContentStore();
