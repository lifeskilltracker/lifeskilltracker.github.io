/**
 * Cache Storage bucket names (§7.4).
 *
 * Everything §7.4 describes runs **in the page, without a service worker** —
 * the Cache Storage API is available to ordinary window script, and that is the
 * whole of N9's "once loaded". A service worker is phase 2 (§16.4, R-26).
 *
 * These names are deliberately stable and documented, because the phase-2
 * workbox runtime-caching config must **adopt** them rather than shadow them.
 * Two buckets rather than one, so that ordinary eviction of browsed-but-
 * unstarted trees cannot take a started skill's bundle with it.
 */

/** Manifest and every bundle fetched by browsing. Evictable. */
export const RUNTIME_CACHE = 'lst-content-v1';

/** Bundles pinned by `pin()` when a user starts a skill (§7.4, N9). */
export const PINNED_CACHE = 'lst-content-pinned-v1';
