/**
 * §16.1's app semver — "human-facing; recorded in exports for support and
 * archaeology" (T16).
 *
 * A plain constant rather than a build-time inject: the value has exactly one
 * consumer, and a `define` in `vite.config.ts` would make it invisible to
 * `vitest` and to anyone reading the source. `version.test.ts` asserts it agrees
 * with `app/package.json`, so the two cannot drift.
 *
 * **Nothing branches on it.** §12.6 gates only on `schemaVersion`; an import
 * that read `appVersion` would be inventing a second version axis for a file
 * whose consumer the project can never update (§14.6).
 */
export const APP_VERSION = '0.1.0';
