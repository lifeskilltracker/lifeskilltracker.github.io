/**
 * Bundle fetch, CacheFirst, and pinning (§7.4).
 *
 * The bundle URL carries its own content hash, so it is immutable: a cache hit
 * is always correct and never needs revalidating. That is the whole reason
 * §7.1 splits a small mutable index from large immutable chunks.
 *
 * `loadTree` memoizes on **object identity**, not merely on value. §8.6 keys the
 * Layout Engine's memoization on the tree it was handed, so a loader returning a
 * fresh parse per call would silently defeat the layout cache and with it
 * §17.3's sub-50 ms milestone toggle.
 */

import type { CompiledTree, Manifest } from '$lib/types';
import { assertBundleShape, ShapeAssertionError } from './assert-shape.js';
import { PINNED_CACHE, RUNTIME_CACHE } from './buckets.js';
import type { LoaderEnvironment } from './environment.js';

export class TreeUnavailableError extends Error {
  readonly treeId: string;
  constructor(treeId: string, cause: string) {
    super(`tree "${treeId}" unavailable: ${cause}`);
    this.name = 'TreeUnavailableError';
    this.treeId = treeId;
  }
}

/**
 * Pinning is best-effort (§7.4). A quota failure must never fail the start, so
 * this rejects with its own type and `lib/actions` resolves `pinned: false`.
 */
export class PinFailedError extends Error {
  readonly treeId: string;
  constructor(treeId: string, cause: string) {
    super(`could not pin "${treeId}": ${cause}`);
    this.name = 'PinFailedError';
    this.treeId = treeId;
  }
}

export interface BundleReader {
  load(treeId: string): Promise<CompiledTree>;
  pin(treeId: string): Promise<void>;
}

export function createBundleReader(
  env: LoaderEnvironment,
  loadManifest: () => Promise<Manifest>,
): BundleReader {
  const parsed = new Map<string, CompiledTree>();
  const inFlight = new Map<string, Promise<CompiledTree>>();

  /**
   * The URL comes from the manifest's `bundle` field and is never constructed
   * from the tree id — the content hash is not derivable.
   */
  async function urlFor(treeId: string): Promise<string> {
    const manifest = await loadManifest();
    const entry = manifest.trees.find((tree) => tree.id === treeId);
    if (entry === undefined) throw new TreeUnavailableError(treeId, 'not in the manifest');
    return `${env.contentBase}/${entry.bundle}`;
  }

  async function readFromCaches(url: string): Promise<Response | undefined> {
    const pinned = await env.caches.open(PINNED_CACHE);
    const fromPinned = await pinned.match(url);
    if (fromPinned !== undefined) return fromPinned;
    const runtime = await env.caches.open(RUNTIME_CACHE);
    return runtime.match(url);
  }

  /** A stale entry self-heals: drop it so the next read re-fetches (§16.3). */
  async function evict(url: string): Promise<void> {
    const pinned = await env.caches.open(PINNED_CACHE);
    const runtime = await env.caches.open(RUNTIME_CACHE);
    await Promise.all([pinned.delete(url), runtime.delete(url)]);
  }

  /**
   * A truncated or corrupted response is the other failure the content hash
   * exists to surface (§7.5), and it arrives as a parse error rather than as a
   * shape error. Both route to the same place.
   */
  async function readJson(response: Response, treeId: string): Promise<unknown> {
    try {
      return await response.clone().json();
    } catch {
      throw new ShapeAssertionError(`bundle for "${treeId}" did not parse as JSON`);
    }
  }

  async function load(treeId: string): Promise<CompiledTree> {
    const url = await urlFor(treeId);

    const cached = await readFromCaches(url);
    if (cached !== undefined) {
      try {
        return assertBundleShape(await readJson(cached, treeId), treeId);
      } catch (error) {
        if (!(error instanceof ShapeAssertionError)) throw error;
        await evict(url);
        throw new TreeUnavailableError(treeId, error.message);
      }
    }

    let response: Response;
    try {
      response = await env.fetch(url);
    } catch (error) {
      throw new TreeUnavailableError(treeId, String(error));
    }
    if (!response.ok) throw new TreeUnavailableError(treeId, `HTTP ${response.status}`);

    // Assert before caching, so a malformed bundle is never written down.
    let tree: CompiledTree;
    try {
      tree = assertBundleShape(await readJson(response, treeId), treeId);
    } catch (error) {
      if (!(error instanceof ShapeAssertionError)) throw error;
      throw new TreeUnavailableError(treeId, error.message);
    }

    const runtime = await env.caches.open(RUNTIME_CACHE);
    await runtime.put(url, response);
    return tree;
  }

  return {
    load(treeId) {
      const already = parsed.get(treeId);
      if (already !== undefined) return Promise.resolve(already);

      const pending = inFlight.get(treeId);
      if (pending !== undefined) return pending;

      const promise = load(treeId)
        .then((tree) => {
          parsed.set(treeId, tree);
          env.onTree?.(tree);
          return tree;
        })
        .finally(() => {
          inFlight.delete(treeId);
        });
      inFlight.set(treeId, promise);
      return promise;
    },

    /**
     * Writes the bundle into the pinned bucket, which ordinary eviction of
     * browsed-but-unstarted trees does not touch. Merely calling `load` never
     * pins: §7.4 is explicit that trees merely browsed are not pinned.
     */
    async pin(treeId) {
      let url: string;
      try {
        url = await urlFor(treeId);
      } catch (error) {
        throw new PinFailedError(treeId, String(error));
      }

      try {
        const runtime = await env.caches.open(RUNTIME_CACHE);
        const existing = await runtime.match(url);
        const response = existing ?? (await env.fetch(url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const pinned = await env.caches.open(PINNED_CACHE);
        await pinned.put(url, response.clone());
      } catch (error) {
        // Cache Storage writes fail under quota pressure (§12.7). The skill is
        // still started; the tree is simply not guaranteed offline.
        throw new PinFailedError(treeId, String(error));
      }
    },
  };
}
