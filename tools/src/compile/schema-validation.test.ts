import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileTreeBundle } from './bundle.js';
import { compileCommand, runCompile } from './index.js';
import { validateCompiledTree, validateManifest } from './validate-output.js';
import { EXIT_VALIDATION_FAILED } from '../shared/exit-codes.js';
import { readYamlFile } from '../shared/yaml-source.js';
import type { Tree } from '../validate/types.js';
import { fixtureRoot, makeRepoFromFixtures } from '../../test/fixtures/compile/helpers.js';
import { minimalValidTree, writeTreeFixture } from '../testing/fixture-helpers.js';

describe('compile/schema-validation', () => {
  it('fails compile when a bundle violates compiled-tree.schema.json', () => {
    const tree = readYamlFile<Tree>(path.join(fixtureRoot, 'content/trees/stable-a.yaml')).data;
    const bundle = compileTreeBundle(tree);
    const broken = structuredClone(bundle) as { milestones: Array<{ uid?: string }> };
    delete broken.milestones[0]?.uid;

    expect(validateCompiledTree(broken, 'tree "stable-a"').length).toBeGreaterThan(0);
  });

  it('fails compile when manifest violates manifest.schema.json', () => {
    const repoRoot = makeRepoFromFixtures();
    const result = runCompile({ repoRoot, write: false });
    const brokenManifest = structuredClone(result.manifest) as unknown as Record<string, unknown>;
    delete brokenManifest.moved;

    expect(validateManifest(brokenManifest).length).toBeGreaterThan(0);
  });

  it('returns non-zero from compileCommand when compiled output fails schema validation', () => {
    const repoRoot = makeRepoFromFixtures();
    mkdirSync(path.join(repoRoot, 'content/trees'), { recursive: true });

    const invalidTree = minimalValidTree({ id: 'invalid-output' });
    delete invalidTree.levels[0].milestones[0].uid;
    writeTreeFixture(path.join(repoRoot, 'content/trees'), 'invalid-output.yaml', invalidTree);

    expect(compileCommand(repoRoot)).toBe(EXIT_VALIDATION_FAILED);
  });
});
