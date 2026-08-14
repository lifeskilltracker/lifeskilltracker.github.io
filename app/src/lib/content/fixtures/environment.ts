/**
 * The loader's test environment — a Cache Storage over Maps, a fetch that routes
 * URLs to bodies, and the two-tree manifest most cases start from.
 *
 * Extracted from `loader.test.ts` by T14, because the §16.3 rows the *routes*
 * own are the same rows the loader owns seen from one layer up: "that tree only
 * is unavailable" is a statement about the page, and asserting it against a
 * second, differently-shaped set of fakes would be asserting it about a
 * different loader.
 *
 * Nothing here mocks a module. The loader is handed a real `Response` and real
 * control flow, so every assertion is about its own behaviour rather than about
 * a mock's call log.
 */

import type { LoaderEnvironment } from '../environment.js';
import { VALID_BUNDLE, manifestFixture } from './bundles.js';

export const CONTENT_BASE = '/content';
export const MANIFEST_URL = `${CONTENT_BASE}/manifest.json`;
export const COOKING_BUNDLE = 'trees/cooking.dee91fe4.json';
export const COOKING_URL = `${CONTENT_BASE}/${COOKING_BUNDLE}`;

// ---------------------------------------------------------------- fake caches

export function fakeCacheStorage() {
  const buckets = new Map<string, Map<string, Response>>();

  const bucket = (name: string) => {
    const existing = buckets.get(name);
    if (existing !== undefined) return existing;
    const created = new Map<string, Response>();
    buckets.set(name, created);
    return created;
  };

  const keyOf = (request: RequestInfo | URL) => String(request);

  const storage = {
    open: async (name: string) => {
      const entries = bucket(name);
      return {
        // Cache Storage stores a copy; a Response body is read-once.
        put: async (request: RequestInfo | URL, response: Response) => {
          entries.set(keyOf(request), response.clone());
        },
        match: async (request: RequestInfo | URL) => {
          const hit = entries.get(keyOf(request));
          return hit === undefined ? undefined : hit.clone();
        },
        delete: async (request: RequestInfo | URL) => entries.delete(keyOf(request)),
      } as unknown as Cache;
    },
  } as unknown as CacheStorage;

  return { storage, buckets, bucket };
}

// ----------------------------------------------------------------- fake fetch

export interface Route {
  body?: unknown;
  text?: string;
  status?: number;
  /** Throws, as a network failure does, rather than resolving non-ok. */
  networkError?: boolean;
}

export function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const route = routes[url];
    if (route === undefined || route.networkError === true) {
      throw new TypeError(`network failure for ${url}`);
    }
    const body = route.text ?? JSON.stringify(route.body);
    return new Response(body, {
      status: route.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof globalThis.fetch;

  return {
    fetch: fetcher,
    calls,
    countFor: (url: string) => calls.filter((c) => c === url).length,
    routes,
  };
}

export function environment(
  routes: Record<string, Route>,
  caches = fakeCacheStorage(),
): { env: LoaderEnvironment; net: ReturnType<typeof fakeFetch>; caches: ReturnType<typeof fakeCacheStorage> } {
  const net = fakeFetch(routes);
  return {
    env: { fetch: net.fetch, caches: caches.storage, contentBase: CONTENT_BASE },
    net,
    caches,
  };
}

export const happyRoutes = (): Record<string, Route> => ({
  [MANIFEST_URL]: { body: manifestFixture([{ id: 'cooking', bundle: COOKING_BUNDLE }]) },
  [COOKING_URL]: { body: VALID_BUNDLE },
});
