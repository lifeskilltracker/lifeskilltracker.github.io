/**
 * §8.6 memoization.
 *
 * Layout depends only on `(tree.id, tree.contentVersion, viewport)` — and on
 * nothing else. `contentVersion` is that tree's own (§5.3), so a release
 * touching one tree evicts one tree's entry.
 *
 * It does **not** depend on user state, which is why completing a milestone
 * never triggers a re-layout — only a class change on already-positioned nodes
 * (§9.3). Keeping user state out of the key is the same decision as keeping it
 * out of the signature (§14.1).
 *
 * **The cache is unbounded, deliberately.** §8.6 says nothing about eviction,
 * and §17.5's scale thresholds put the entry count in the low hundreds at worst
 * — two viewports per opened tree, each a few hundred small objects. Stating
 * that here rather than leaving it silent: if §17.5's thresholds move, this is
 * the line to revisit.
 */

import type { Viewport } from './index.js';

const cache = new Map<string, unknown>();

export function memoKey(id: string, contentVersion: number, viewport: Viewport): string {
  return `${id}::${contentVersion}::${viewport}`;
}

export function memoized<T>(key: string, compute: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) return hit as T;
  const value = compute();
  cache.set(key, value);
  return value;
}

/** Test seam. Nothing in the running app clears the cache. */
export function clearLayoutCache(): void {
  cache.clear();
}
