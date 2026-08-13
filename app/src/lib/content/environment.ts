/**
 * The two browser capabilities this subsystem is allowed to touch, passed in
 * rather than reached for.
 *
 * §3.2's second rule makes `lib/content` the only reader of content, so the
 * whole application's network and cache surface is these two fields. Injecting
 * them keeps the tests honest — they exercise the real control flow against a
 * real `Response`, with no module mocking and nothing stubbed inside the code
 * under test.
 */

import type { Manifest } from '$lib/types';
import type { CompiledTree } from '$lib/types';

export interface LoaderEnvironment {
  fetch: typeof globalThis.fetch;
  caches: CacheStorage;
  /** Where `lst compile` writes, served under the app's base path (§4.4). */
  contentBase: string;
  /** Populates the §13.2 rune store. Not part of the §14.2 contract. */
  onManifest?: (manifest: Manifest, offline: boolean) => void;
  /** Populates the §13.2 rune store. Not part of the §14.2 contract. */
  onTree?: (tree: CompiledTree) => void;
}
