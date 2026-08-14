/**
 * The `/s/<treeId>` route's resolution (§13.1).
 *
 * A tree id absent from the manifest is a **tree-unavailable state, never a
 * 404**, and a failing bundle must not surface as an unhandled rejection.
 */

import { describe, expect, it } from 'vitest';
import type { CompiledTree, Manifest } from '$lib/types';
import { TreeUnavailableError } from '$lib/content';
import { resolveSkillPage } from './+page.js';
import { VALID_BUNDLE, manifestFixture } from '$lib/content/fixtures/bundles.js';

const MANIFEST = manifestFixture([
  { id: 'cooking', bundle: 'trees/cooking.abc.json' },
]) as unknown as Manifest;

const okLoader = {
  loadTree: async () => VALID_BUNDLE as unknown as CompiledTree,
  loadManifest: async () => MANIFEST,
  isOffline: () => false,
};

const failingLoader = {
  loadTree: async (treeId: string) => {
    throw new TreeUnavailableError(treeId, 'not in the manifest');
  },
  loadManifest: async () => MANIFEST,
  isOffline: () => false,
};

describe('/s/[tree]', () => {
  it('resolves a tree from the manifest', async () => {
    const data = await resolveSkillPage(okLoader, 'cooking');

    expect(data.tree?.id).toBe('cooking');
    expect(data.tree?.levels).toHaveLength(10);
    expect(data.unavailable).toBeNull();
  });

  it('resolves — never rejects — for an id absent from the manifest', async () => {
    const data = await resolveSkillPage(failingLoader, 'nope');

    expect(data.tree).toBeNull();
    expect(data.treeId).toBe('nope');
    expect(data.unavailable).toContain('not in the manifest');
    // The manifest has no entry for it, so this is §16.3's `missing` row rather
    // than its bundle-fetch row — two failures with two different sentences.
    expect(data.reason).toBe('missing');
  });

  it('distinguishes a tree the manifest knows but could not deliver', async () => {
    const data = await resolveSkillPage({ ...failingLoader }, 'cooking');

    expect(data.tree).toBeNull();
    expect(data.reason).toBe('unreachable');
  });

  it('passes the offline state through so the page can say so', async () => {
    const data = await resolveSkillPage({ ...okLoader, isOffline: () => true }, 'cooking');
    expect(data.offline).toBe(true);
  });
});
