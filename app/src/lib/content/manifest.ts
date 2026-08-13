/**
 * Manifest fetch, stale-while-revalidate, and the offline flag (§7.4).
 *
 * §7.1's split — a small mutable index pointing at large immutable chunks —
 * means **the manifest is the only file that can go stale**. That is why it gets
 * the only revalidation logic in the subsystem, and why there is no cache-header
 * negotiation to get right on GitHub Pages (§4.4).
 */

import type { Manifest } from '$lib/types';
import { RUNTIME_CACHE } from './buckets.js';
import type { LoaderEnvironment } from './environment.js';

export class ManifestUnavailableError extends Error {
  constructor(cause: string) {
    super(`manifest unavailable: ${cause}`);
    this.name = 'ManifestUnavailableError';
  }
}

export interface ManifestReader {
  load(): Promise<Manifest>;
  isOffline(): boolean;
  /** Test seam: resolves once any background revalidation has settled. */
  whenIdle(): Promise<void>;
}

export function createManifestReader(env: LoaderEnvironment): ManifestReader {
  const url = `${env.contentBase}/manifest.json`;

  let manifest: Manifest | null = null;
  let offline = false;
  let inFlight: Promise<Manifest> | null = null;
  let revalidation: Promise<void> = Promise.resolve();

  async function fetchFresh(): Promise<Manifest> {
    const response = await env.fetch(url);
    if (!response.ok) throw new ManifestUnavailableError(`HTTP ${response.status}`);
    // Read from a clone so the original body is still available to cache.
    const body = (await response.clone().json()) as Manifest;
    const cache = await env.caches.open(RUNTIME_CACHE);
    await cache.put(url, response);
    manifest = body;
    offline = false;
    env.onManifest?.(body, offline);
    return body;
  }

  async function load(): Promise<Manifest> {
    const cache = await env.caches.open(RUNTIME_CACHE);
    const cached = await cache.match(url);

    if (cached !== undefined) {
      // Serve the cached copy immediately, revalidate behind it. Until that
      // settles we are, honestly, not yet known to be online.
      manifest = (await cached.json()) as Manifest;
      offline = true;
      env.onManifest?.(manifest, offline);
      revalidation = fetchFresh().then(
        () => undefined,
        // §7.4: when serving a cached manifest without revalidation, say so.
        () => {
          offline = true;
          env.onManifest?.(manifest as Manifest, offline);
        },
      );
      return manifest;
    }

    // No cached copy: a failure here is §16.3's cold-start failure, and it is a
    // rejection the shell renders — never a silently empty manifest, which
    // would render as "there are no skills" rather than "we could not load".
    return fetchFresh();
  }

  return {
    load() {
      if (manifest !== null) return Promise.resolve(manifest);
      if (inFlight !== null) return inFlight;
      inFlight = load().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    isOffline: () => offline,
    whenIdle: () => revalidation,
  };
}
