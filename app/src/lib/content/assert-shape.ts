/**
 * The §7.5 shape assertion — exactly two checks, and it must not grow.
 *
 * It is **not** a security control. §7.5 says so plainly: content and manifest
 * come from the same origin over HTTPS, there is no user-supplied content, and
 * there is no threat model in which an attacker who controls the origin is
 * stopped by a hash the origin also serves. Subresource Integrity, signature
 * checks, and client-side hash recomputation are all rejected there by name as
 * "ceremony for the same non-guarantee".
 *
 * Nor is it validation against `schema/compiled-tree.schema.json`. That schema
 * is enforced in `lst compile` and in type generation (§7.3), so a bundle
 * reaching the client has already been checked by the only party who could act
 * on a failure. Shipping ajv to the client would spend a real share of §17.1's
 * 70 kB budget re-proving it.
 *
 * What it does catch is the realistic failure: a stale Cache Storage entry
 * serving a bundle from before a schema migration. It routes that to §16.3's
 * error handling instead of to a stack trace inside the Layout Engine.
 */

import type { CompiledTree } from '$lib/types';

export const CURRENT_SCHEMA_VERSION = 1;

/** §5.10: the app reads the current version and one prior. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [
  CURRENT_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION - 1,
];

const LEVELS_PER_TREE = 10;

export class ShapeAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShapeAssertionError';
  }
}

export function assertBundleShape(value: unknown, treeId: string): CompiledTree {
  if (value === null || typeof value !== 'object') {
    throw new ShapeAssertionError(`bundle for "${treeId}" is not an object`);
  }
  const candidate = value as Partial<CompiledTree>;

  // 1. The schemaVersion is one the app understands.
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(candidate.schemaVersion as number)) {
    throw new ShapeAssertionError(
      `bundle for "${treeId}" has schemaVersion ${String(candidate.schemaVersion)}; ` +
        `this app reads ${SUPPORTED_SCHEMA_VERSIONS.join(' and ')}`,
    );
  }

  // 2. The tree has ten levels.
  if (!Array.isArray(candidate.levels) || candidate.levels.length !== LEVELS_PER_TREE) {
    throw new ShapeAssertionError(
      `bundle for "${treeId}" has ${
        Array.isArray(candidate.levels) ? candidate.levels.length : 'no'
      } levels; ${LEVELS_PER_TREE} required`,
    );
  }

  return value as CompiledTree;
}
