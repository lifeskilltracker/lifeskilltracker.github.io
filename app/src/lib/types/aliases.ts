import type { Manifest } from './compiled.js';

/** Compiled taxonomy block from the manifest (§14.4). */
export type Taxonomy = Manifest['taxonomy'];

/** Manifest-level moved index: uid → destination tree id (§14.5). */
export type MovedIndex = Manifest['moved'];
