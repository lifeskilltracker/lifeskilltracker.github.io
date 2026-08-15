/**
 * §7.4's fetch and cache behaviour, §7.5's shape assertion, and the §16.3 rows
 * this subsystem owns.
 *
 * Nothing here mocks a module. The loader is handed a real `Response`, a fetch
 * that routes URLs to bodies, and a Cache Storage implemented over Maps — so
 * every assertion is about the loader's own control flow rather than about a
 * mock's call log.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createContentLoader } from './index.js';
import { PINNED_CACHE, RUNTIME_CACHE } from './buckets.js';
import { assertBundleShape, ShapeAssertionError } from './assert-shape.js';
import { PinFailedError, TreeUnavailableError } from './bundle.js';
import {
  FUTURE_SCHEMA_BUNDLE,
  NINE_LEVEL_BUNDLE,
  PRIOR_SCHEMA_BUNDLE,
  TRUNCATED_BUNDLE_TEXT,
  VALID_BUNDLE,
  manifestFixture,
} from './fixtures/bundles.js';

import {
  CONTENT_BASE,
  COOKING_BUNDLE,
  COOKING_URL,
  MANIFEST_URL,
  environment,
  fakeCacheStorage,
  happyRoutes,
  type Route,
} from './fixtures/environment.js';


// ------------------------------------------------------------------- the §7.5 assertion

describe('§7.5 — the shape assertion is exactly two checks', () => {
  it('accepts a valid bundle', () => {
    expect(assertBundleShape(VALID_BUNDLE, 'cooking').id).toBe('cooking');
  });

  it('accepts a bundle at the prior schema version', () => {
    expect(assertBundleShape(PRIOR_SCHEMA_BUNDLE, 'prior').id).toBe('prior');
  });

  it('rejects a bundle from a newer app', () => {
    expect(() => assertBundleShape(FUTURE_SCHEMA_BUNDLE, 'future')).toThrow(ShapeAssertionError);
  });

  it('rejects a nine-level bundle', () => {
    expect(() => assertBundleShape(NINE_LEVEL_BUNDLE, 'nine')).toThrow(ShapeAssertionError);
  });

  it('rejects a non-object', () => {
    expect(() => assertBundleShape(null, 'x')).toThrow(ShapeAssertionError);
  });
});

// -------------------------------------------------------------------- loadTree

describe('§14.2 — loadTree is memoized on object identity', () => {
  it('returns the same object for a second call', async () => {
    const { env } = environment(happyRoutes());
    const loader = createContentLoader(env);

    const first = await loader.loadTree('cooking');
    const second = await loader.loadTree('cooking');

    // Reference equality, not deep equality: §8.6 keys the layout memo on it.
    expect(second).toBe(first);
  });

  it('issues one fetch for two concurrent calls and resolves both to the same object', async () => {
    const { env, net } = environment(happyRoutes());
    const loader = createContentLoader(env);

    const [a, b] = await Promise.all([loader.loadTree('cooking'), loader.loadTree('cooking')]);

    expect(a).toBe(b);
    expect(net.countFor(COOKING_URL)).toBe(1);
  });

  it('takes the URL from the manifest bundle field, never from the tree id', async () => {
    const { env, net } = environment(happyRoutes());
    const loader = createContentLoader(env);

    await loader.loadTree('cooking');

    expect(net.calls).toContain(COOKING_URL);
    // The content hash is not derivable, so no id-shaped URL is ever requested.
    expect(net.calls).not.toContain(`${CONTENT_BASE}/trees/cooking.json`);
  });

  it('serves a later session from Cache Storage without touching the network', async () => {
    const caches = fakeCacheStorage();
    const first = environment(happyRoutes(), caches);
    await createContentLoader(first.env).loadTree('cooking');
    expect(first.net.countFor(COOKING_URL)).toBe(1);

    // A fresh loader over the same Cache Storage: CacheFirst, so no bundle fetch.
    const second = environment(happyRoutes(), caches);
    const tree = await createContentLoader(second.env).loadTree('cooking');

    expect(tree.id).toBe('cooking');
    expect(second.net.countFor(COOKING_URL)).toBe(0);
  });
});

describe('§16.3 — bundle failures', () => {
  it('deletes a cached bundle that fails the shape assertion, and re-fetches next time', async () => {
    const caches = fakeCacheStorage();
    // Seed the cache with a stale bundle from before a schema migration.
    const runtime = await caches.storage.open(RUNTIME_CACHE);
    await runtime.put(COOKING_URL, new Response(JSON.stringify(NINE_LEVEL_BUNDLE)));

    const { env, net } = environment(happyRoutes(), caches);
    const loader = createContentLoader(env);

    await expect(loader.loadTree('cooking')).rejects.toThrow(TreeUnavailableError);
    expect(await (await caches.storage.open(RUNTIME_CACHE)).match(COOKING_URL)).toBeUndefined();
    expect(net.countFor(COOKING_URL)).toBe(0);

    // The stale entry self-healed: the retry goes to the network and succeeds.
    const tree = await loader.loadTree('cooking');
    expect(tree.id).toBe('cooking');
    expect(net.countFor(COOKING_URL)).toBe(1);
  });

  it('treats a truncated response as unavailable rather than throwing a parse error', async () => {
    const routes = happyRoutes();
    routes[COOKING_URL] = { text: TRUNCATED_BUNDLE_TEXT };
    const { env } = environment(routes);

    await expect(createContentLoader(env).loadTree('cooking')).rejects.toThrow(
      TreeUnavailableError,
    );
  });

  it('never caches a bundle that failed the assertion', async () => {
    const routes = happyRoutes();
    routes[COOKING_URL] = { body: NINE_LEVEL_BUNDLE };
    const { env, caches } = environment(routes);

    await expect(createContentLoader(env).loadTree('cooking')).rejects.toThrow(
      TreeUnavailableError,
    );
    expect(await (await caches.storage.open(RUNTIME_CACHE)).match(COOKING_URL)).toBeUndefined();
  });

  it('isolates one failing tree from the others and from the manifest', async () => {
    const routes: Record<string, Route> = {
      [MANIFEST_URL]: {
        body: manifestFixture([
          { id: 'cooking', bundle: COOKING_BUNDLE },
          { id: 'broken', bundle: 'trees/broken.deadbeef.json' },
        ]),
      },
      [COOKING_URL]: { body: VALID_BUNDLE },
      [`${CONTENT_BASE}/trees/broken.deadbeef.json`]: { networkError: true },
    };
    const { env } = environment(routes);
    const loader = createContentLoader(env);

    await expect(loader.loadTree('broken')).rejects.toThrow(TreeUnavailableError);

    // The map and every other tree keep working.
    expect((await loader.loadTree('cooking')).id).toBe('cooking');
    expect((await loader.loadManifest()).trees).toHaveLength(2);
  });

  it('reports a tree absent from the manifest as unavailable, not as a crash', async () => {
    const { env } = environment(happyRoutes());
    await expect(createContentLoader(env).loadTree('nope')).rejects.toThrow(TreeUnavailableError);
  });
});

// ------------------------------------------------------------------- manifest

describe('§7.4 — manifest, stale-while-revalidate, and honest offline state', () => {
  it('is not offline after a successful revalidation', async () => {
    const caches = fakeCacheStorage();
    await createContentLoader(environment(happyRoutes(), caches).env).loadManifest();

    const second = createContentLoader(environment(happyRoutes(), caches).env);
    await second.loadManifest();
    await second.whenIdle();

    expect(second.isOffline()).toBe(false);
  });

  it('is offline after a failed revalidation with a cached manifest present', async () => {
    const caches = fakeCacheStorage();
    await createContentLoader(environment(happyRoutes(), caches).env).loadManifest();

    // Same cache, no network.
    const offlineLoader = createContentLoader(environment({}, caches).env);
    const manifest = await offlineLoader.loadManifest();
    await offlineLoader.whenIdle();

    // Served from cache, and honest about it.
    expect(manifest.trees).toHaveLength(1);
    expect(offlineLoader.isOffline()).toBe(true);
  });

  it('rejects on a cold start with no cache and no network, rather than resolving empty', async () => {
    const { env } = environment({});
    // §16.3: the cold-start failure is a rejection the shell renders. An empty
    // manifest would read as "there are no skills", not "we could not load".
    await expect(createContentLoader(env).loadManifest()).rejects.toThrow();
  });

  it('fetches the manifest once for concurrent callers', async () => {
    const { env, net } = environment(happyRoutes());
    const loader = createContentLoader(env);

    await Promise.all([loader.loadManifest(), loader.loadManifest(), loader.loadTree('cooking')]);

    expect(net.countFor(MANIFEST_URL)).toBe(1);
  });

  it('revalidates the manifest with the server, and only the manifest (§4.4, T25)', async () => {
    const { env, net } = environment(happyRoutes());
    const loader = createContentLoader(env);

    await loader.loadTree('cooking');

    // GitHub Pages serves fixed cache headers, so §7.3's "the manifest is the
    // exception to aggressive caching" has to be asserted from the client side.
    expect(net.initsFor(MANIFEST_URL)).toEqual([{ cache: 'no-cache' }]);
    // The bundle URL carries a content hash, so revalidating it would be pure
    // latency for an answer that cannot change.
    expect(net.initsFor(COOKING_URL)).toEqual([undefined]);
  });
});

// ------------------------------------------------------------------ pinning

describe('§7.4 — pinning is best-effort and separate from browsing', () => {
  let caches: ReturnType<typeof fakeCacheStorage>;

  beforeEach(() => {
    caches = fakeCacheStorage();
  });

  it('does not pin a tree that was merely browsed', async () => {
    const { env } = environment(happyRoutes(), caches);
    await createContentLoader(env).loadTree('cooking');

    const pinned = await caches.storage.open(PINNED_CACHE);
    expect(await pinned.match(COOKING_URL)).toBeUndefined();
  });

  it('writes into a bucket that clearing the runtime cache does not touch', async () => {
    const { env } = environment(happyRoutes(), caches);
    const loader = createContentLoader(env);

    await loader.loadTree('cooking');
    await loader.pin('cooking');

    expect(await (await caches.storage.open(PINNED_CACHE)).match(COOKING_URL)).toBeDefined();

    // Ordinary eviction of browsed trees.
    caches.bucket(RUNTIME_CACHE).clear();

    const pinned = await (await caches.storage.open(PINNED_CACHE)).match(COOKING_URL);
    expect(pinned).toBeDefined();
    expect(((await pinned!.json()) as { id: string }).id).toBe('cooking');
  });

  it('serves a pinned bundle with the runtime cache empty and no network', async () => {
    const first = environment(happyRoutes(), caches);
    const loader = createContentLoader(first.env);
    await loader.loadTree('cooking');
    await loader.pin('cooking');
    caches.bucket(RUNTIME_CACHE).delete(COOKING_URL);

    const second = environment(happyRoutes(), caches);
    const offlineLoader = createContentLoader(second.env);

    expect((await offlineLoader.loadTree('cooking')).id).toBe('cooking');
    expect(second.net.countFor(COOKING_URL)).toBe(0);
  });

  it('rejects cleanly under quota pressure instead of failing the start', async () => {
    const { env } = environment(happyRoutes(), caches);
    const loader = createContentLoader(env);
    await loader.loadTree('cooking');

    // Cache Storage writes fail under quota pressure (§12.7).
    const original = caches.storage.open.bind(caches.storage);
    caches.storage.open = async (name: string) => {
      const cache = await original(name);
      if (name === PINNED_CACHE) {
        return {
          ...cache,
          match: cache.match.bind(cache),
          delete: cache.delete.bind(cache),
          put: async () => {
            throw new DOMException('QuotaExceededError');
          },
        } as unknown as Cache;
      }
      return cache;
    };

    await expect(loader.pin('cooking')).rejects.toBeInstanceOf(PinFailedError);
    // The tree itself is unaffected — the skill is started, just not guaranteed offline.
    expect((await loader.loadTree('cooking')).id).toBe('cooking');
  });
});
