/**
 * The Content Loader (§7.4, §14.2) — the single module in the application that
 * performs a network fetch for content.
 *
 * §3.2's second rule: no component, route, or engine fetches on its own, so
 * every caching, offline, and failure decision has exactly one place to live and
 * one place to test.
 *
 * It must never import the user-state module. The two I/O owners may not import
 * each other (§14.1) — that is what keeps "the only content reader" and "the
 * only user-data writer" true statements rather than aspirations. The
 * `startSkill → pin` sequence belongs to `lib/actions`, the one module permitted
 * both. §14.7's grep gate is literal, so the forbidden path is not spelled out
 * even in prose here; `eslint.config.js` carries the enforcing rule.
 */

import { base } from '$app/paths';
import type { CompiledTree, Manifest } from '$lib/types';
import { createBundleReader } from './bundle.js';
import type { LoaderEnvironment } from './environment.js';
import { createManifestReader } from './manifest.js';
import { content } from './store.svelte.js';

export interface ContentLoader {
  loadManifest(): Promise<Manifest>;
  loadTree(treeId: string): Promise<CompiledTree>; // memoized
  pin(treeId: string): Promise<void>; // §7.4 offline pinning
  isOffline(): boolean;
}

/** Adds the test seam for the background revalidation §7.4 runs behind a cached manifest. */
export interface TestableContentLoader extends ContentLoader {
  whenIdle(): Promise<void>;
}

export function createContentLoader(env: LoaderEnvironment): TestableContentLoader {
  const manifest = createManifestReader(env);
  const bundles = createBundleReader(env, () => manifest.load());

  return {
    loadManifest: () => manifest.load(),
    loadTree: (treeId) => bundles.load(treeId),
    pin: (treeId) => bundles.pin(treeId),
    isOffline: () => manifest.isOffline(),
    whenIdle: () => manifest.whenIdle(),
  };
}

/**
 * The application's loader. Bound to the real browser capabilities and wired to
 * the §13.2 store; created lazily so that importing this module during a
 * prerender pass does not touch `caches`, which exists only in the browser.
 */
let singleton: TestableContentLoader | null = null;

export function loader(): TestableContentLoader {
  if (singleton === null) {
    singleton = createContentLoader({
      fetch: (...args) => globalThis.fetch(...args),
      caches: globalThis.caches,
      contentBase: `${base}/content`,
      onManifest: (manifest, offline) => content.setManifest(manifest, offline),
      onTree: (tree) => content.setTree(tree),
    });
  }
  return singleton;
}

export { RUNTIME_CACHE, PINNED_CACHE } from './buckets.js';
export { ShapeAssertionError, assertBundleShape } from './assert-shape.js';
export { PinFailedError, TreeUnavailableError } from './bundle.js';
export { ManifestUnavailableError } from './manifest.js';
export type { LoaderEnvironment } from './environment.js';
