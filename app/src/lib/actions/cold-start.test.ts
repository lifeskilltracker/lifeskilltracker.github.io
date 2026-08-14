/**
 * §13.3's cold-start sequence and the §16.3 rows it decides (T14).
 *
 * Every case here is driven through a **real** `ContentLoader` over the loader's
 * own fake fetch and Cache Storage, rather than a stubbed `loadManifest`. The
 * three manifest branches are distinguished by what the *loader* does with a
 * cache it may or may not have, and a stub asserting "resolved / rejected" would
 * pass identically against a loader that had lost the cache path entirely.
 *
 * The store half is stubbed, because the one thing that has to be exercised —
 * a transient IndexedDB failure — is otherwise unreachable, and it guards the
 * only irreplaceable data in the system (§16.5, R-15).
 */

import { describe, expect, it, vi } from 'vitest';
import { createContentLoader } from '$lib/content';
import {
  COOKING_BUNDLE,
  MANIFEST_URL,
  environment,
  happyRoutes,
} from '$lib/content/fixtures/environment.js';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import { NotImplementedHereError } from '$lib/state/store.js';
import type { MigrationReport } from '$lib/types';
import { coldStart, type ColdStartStore } from './cold-start.js';

// ------------------------------------------------------------------ the store

interface StubOptions {
  hydrate?: () => Promise<void>;
  applyMoves?: (moved: Record<string, string>) => Promise<readonly MigrationReport[]>;
}

function stubStore(options: StubOptions = {}) {
  let hydrated = false;
  const calls: string[] = [];

  const store: ColdStartStore & { calls: string[] } = {
    get hydrated() {
      return hydrated;
    },
    calls,
    async recordManifest() {
      // T16: what an export copies from the manifest. Recorded, never read back
      // by the start sequence itself.
      calls.push('recordManifest');
    },
    async hydrate() {
      calls.push('hydrate');
      if (options.hydrate !== undefined) {
        await options.hydrate();
      }
      hydrated = true;
    },
    async applyMoves(moved) {
      calls.push('applyMoves');
      if (options.applyMoves !== undefined) return options.applyMoves(moved);
      return [];
    },
  };
  return store;
}

const report = (treeId: string): MigrationReport => ({
  treeId,
  fromVersion: 1,
  toVersion: 2,
  changed: true,
  entries: [{ uid: 'U0100000', title: 'a milestone', op: 'moved', outcome: 'rewritten', became: [] }],
  partialMerge: false,
  attainedLevel: { before: 1, after: 1 },
});

describe('§13.3 — both halves resolve', () => {
  it('renders from a fresh manifest, online, hydrated', async () => {
    const { env } = environment(happyRoutes());
    const result = await coldStart(createContentLoader(env), stubStore());

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.offline).toBe(false);
    expect(result.hydrated).toBe(true);
    expect(result.manifest.trees.map((tree) => tree.id)).toEqual(['cooking']);
  });

  it('applies the manifest’s moved index before the caller derives anything', async () => {
    const routes = happyRoutes();
    const manifest = manifestFixture([{ id: 'cooking', bundle: COOKING_BUNDLE }]);
    (manifest as { moved: Record<string, string> }).moved = { U0100000: 'baking' };
    routes[MANIFEST_URL] = { body: manifest };

    const seen: Record<string, string>[] = [];
    const store = stubStore({
      applyMoves: async (moved) => {
        seen.push(moved);
        return [report('cooking')];
      },
    });

    const { env } = environment(routes);
    const result = await coldStart(createContentLoader(env), store);

    expect(seen).toEqual([{ U0100000: 'baking' }]);
    expect(result.kind === 'ready' && result.migrations).toHaveLength(1);
  });

  it('survives an applyMoves that T17 has not implemented yet', async () => {
    const { env } = environment(happyRoutes());
    const store = stubStore({
      applyMoves: () => Promise.reject(new NotImplementedHereError('applyMoves', 'T17')),
    });

    const result = await coldStart(createContentLoader(env), store);

    expect(result.kind).toBe('ready');
    expect(result.kind === 'ready' && result.migrations).toEqual([]);
    expect(result.kind === 'ready' && result.movesError).toBeUndefined();
  });

  it('reports — and survives — an applyMoves that genuinely failed', async () => {
    const { env } = environment(happyRoutes());
    const store = stubStore({
      applyMoves: () => Promise.reject(new Error('transaction aborted')),
    });

    const result = await coldStart(createContentLoader(env), store);

    expect(result.kind).toBe('ready');
    expect(result.kind === 'ready' && result.movesError).toContain('transaction aborted');
  });
});

describe('§16.3 — the manifest fails', () => {
  it('serves the cached manifest and says it is offline (row 1)', async () => {
    const caches = (await import('$lib/content/fixtures/environment.js')).fakeCacheStorage();

    // First start warms the cache the way a previous visit would have.
    const warm = environment(happyRoutes(), caches);
    await coldStart(createContentLoader(warm.env), stubStore());

    // Second start with the network gone entirely.
    const offline = environment({}, caches);
    const loader = createContentLoader(offline.env);
    const result = await coldStart(loader, stubStore());
    await loader.whenIdle();

    expect(result.kind).toBe('ready');
    expect(result.kind === 'ready' && result.offline).toBe(true);
    expect(result.kind === 'ready' && result.manifest.trees).toHaveLength(1);
  });

  it('fails cold with no cache, rather than rendering an empty library (row 2)', async () => {
    const { env } = environment({});
    const result = await coldStart(createContentLoader(env), stubStore());

    expect(result.kind).toBe('failed');
    // Whatever the cause was, verbatim. A network failure arrives as the
    // platform's own `TypeError` rather than as `ManifestUnavailableError`
    // (§7.4 wraps status codes, not transport), and the screen shows both.
    expect(result.kind === 'failed' && result.reason).toContain('manifest.json');
    // The user's own data is a separate concern and survived: §16.3's row 2
    // links to /data precisely because this can be true.
    expect(result.hydrated).toBe(true);
  });
});

describe('§13.3 — hydration fails', () => {
  it('still renders content, and says hydration failed', async () => {
    const { env } = environment(happyRoutes());
    const store = stubStore({ hydrate: () => Promise.reject(new Error('IDB is gone')) });

    const result = await coldStart(createContentLoader(env), store);

    expect(result.kind).toBe('ready');
    expect(result.hydrated).toBe(false);
    expect(result.hydrationError).toContain('IDB is gone');
  });

  it('skips applyMoves, because §13.3 skips every write', async () => {
    const { env } = environment(happyRoutes());
    const store = stubStore({ hydrate: () => Promise.reject(new Error('IDB is gone')) });

    await coldStart(createContentLoader(env), store);

    expect(store.calls).toEqual(['hydrate']);
  });

  it('is reported even when the manifest failed too', async () => {
    const { env } = environment({});
    const store = stubStore({ hydrate: () => Promise.reject(new Error('IDB is gone')) });

    const result = await coldStart(createContentLoader(env), store);

    expect(result.kind).toBe('failed');
    expect(result.hydrated).toBe(false);
    expect(result.hydrationError).toContain('IDB is gone');
  });

  it('does not let a hydration rejection discard a good manifest', async () => {
    // The `Promise.all` version of this function passes every other test here.
    const { env } = environment(happyRoutes());
    const store = stubStore({ hydrate: () => Promise.reject(new Error('IDB is gone')) });

    const result = await coldStart(createContentLoader(env), store);

    expect(result.kind === 'ready' && result.manifest.trees).toHaveLength(1);
  });

  it('treats a store that resolves without hydrating as not hydrated', async () => {
    const { env } = environment(happyRoutes());
    const store: ColdStartStore = {
      hydrated: false,
      hydrate: () => Promise.resolve(),
      applyMoves: vi.fn(async () => []),
      recordManifest: vi.fn(async () => undefined),
    };

    const result = await coldStart(createContentLoader(env), store);

    expect(result.hydrated).toBe(false);
    expect(store.applyMoves).not.toHaveBeenCalled();
  });
});
