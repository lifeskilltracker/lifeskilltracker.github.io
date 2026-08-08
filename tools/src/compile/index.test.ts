import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compileTreeBundle } from './bundle.js';
import { runCompile } from './index.js';
import { serializeJson } from './json.js';
import { bundleOutputFromCompiled, formatGeneratedTimestamp } from './manifest.js';
import { contentHash } from './hash.js';
import { compareAsciiUtf8 } from './sort.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR, EXIT_VALIDATION_FAILED } from '../shared/exit-codes.js';
import {
  fixtureRoot,
  makeEmptyLibraryRepo,
  makeRepoFromFixtures,
} from '../../test/fixtures/compile/helpers.js';
import { readYamlFile } from '../shared/yaml-source.js';
import type { Tree } from '../validate/types.js';
import { minimalValidTree, writeTreeFixture } from '../testing/fixture-helpers.js';

const toolsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const compiledCliPath = path.join(toolsRoot, 'dist/cli.js');
const fixedNow = () => new Date('2026-08-07T22:00:00.000Z');

function loadFixtureTree(name: string): Tree {
  return readYamlFile<Tree>(path.join(fixtureRoot, 'content/trees', name)).data;
}

function manifestWithoutGenerated(manifest: ReturnType<typeof runCompile>['manifest']) {
  const rest = { ...manifest };
  Reflect.deleteProperty(rest, 'generated');
  return rest;
}

describe('lst compile', () => {
  it('normalizes authored any rules to n_of with n: 1', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    const level2 = bundle.levels[1];
    expect(level2.requirements[0]).toMatchObject({ rule: 'n_of', n: 1 });
    expect(JSON.stringify(bundle)).not.toMatch(/"rule"\s*:\s*"any"/);
  });

  it('materializes absent requirements as an explicit all group', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    const level1 = bundle.levels[0];
    expect(level1.requirements).toHaveLength(1);
    expect(level1.requirements[0]?.rule).toBe('all');
    expect(level1.requirements[0]?.milestones).toHaveLength(4);
  });

  it('resolves omitted order by file position within each (level, track) cell', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    const level1 = bundle.milestones.filter((milestone) => milestone.level === 1);
    expect(level1.map((milestone) => milestone.order)).toEqual([0, 1, 2, 3]);
  });

  it('keeps explicit order values while defaulting siblings by file index', () => {
    const tree = loadFixtureTree('transforms.yaml');
    tree.levels[1].milestones = tree.levels[1].milestones.map((milestone, index) => ({
      ...milestone,
      order: [2, 1, 2, 0][index],
    }));
    const bundle = compileTreeBundle(tree);
    const level2 = bundle.milestones.filter((milestone) => milestone.level === 2);
    expect(level2.map((milestone) => [milestone.id, milestone.order])).toEqual([
      ['l2-m1', 2],
      ['l2-m2', 1],
      ['l2-m3', 2],
      ['l2-m4', 0],
    ]);
  });

  it('resolves single-track defaults to explicit empty track and trackIndex 0', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    for (const milestone of bundle.milestones) {
      expect(milestone.track).toBe('');
      expect(milestone.trackIndex).toBe(0);
    }
    expect(bundle.tracks).toBeUndefined();
  });

  it('defaults omitted track to the first declared track and assigns track indices', () => {
    const tree = loadFixtureTree('transforms.yaml');
    tree.tracks = [
      { id: 'forge', title: 'Forge' },
      { id: 'finish', title: 'Finish' },
    ];
    tree.levels[0].milestones = tree.levels[0].milestones.map((milestone, index) => ({
      ...milestone,
      ...(index % 2 === 1 ? { track: 'finish' } : {}),
    }));
    const bundle = compileTreeBundle(tree);
    const level1 = bundle.milestones.filter((milestone) => milestone.level === 1);
    expect(level1.map((milestone) => [milestone.id, milestone.track, milestone.trackIndex])).toEqual([
      ['l1-m1', 'forge', 0],
      ['l1-m2', 'finish', 1],
      ['l1-m3', 'forge', 0],
      ['l1-m4', 'finish', 1],
    ]);
  });

  it('resolves requires and requirement milestones to indices while retaining slugs', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    const dependent = bundle.milestones.find((milestone) => milestone.id === 'l1-m2');
    expect(dependent?.requires).toEqual([{ index: 0, slug: 'l1-m1' }]);
    expect(bundle.levels[1].requirements[0]?.milestones[0]).toEqual({ index: 4, slug: 'l2-m1' });
  });

  it('retains detail prose verbatim', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    expect(bundle.milestones[0]?.detail).toBe('Author prose retained verbatim.');
  });

  it('preserves lineage in authored file order', () => {
    const tree = loadFixtureTree('lineage-order.yaml');
    const bundle = compileTreeBundle(tree);
    expect(bundle.lineage).toEqual(tree.lineage);
  });

  it('retains contentVersion verbatim in the bundle', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    expect(bundle.contentVersion).toBe(3);
  });

  it('builds manifest moved map from moved lineage targets', () => {
    const repoRoot = makeRepoFromFixtures();
    const result = runCompile({ repoRoot, write: false, now: fixedNow });
    expect(result.manifest.moved).toEqual({ aaa94001: 'moved-dest' });
  });

  it('uses an empty moved object when no moved entries exist', () => {
    const repoRoot = makeEmptyLibraryRepo();
    cpSync(
      path.join(fixtureRoot, 'content/trees/stable-a.yaml'),
      path.join(repoRoot, 'content/trees/stable-a.yaml'),
    );
    const result = runCompile({ repoRoot, write: false, now: fixedNow });
    expect(result.manifest.moved).toEqual({});
  });

  it('excludes milestones from manifest tree entries', () => {
    const repoRoot = makeRepoFromFixtures();
    const result = runCompile({ repoRoot, write: false, now: fixedNow });
    expect(result.manifest.trees.every((entry) => !('milestones' in entry))).toBe(true);
  });

  it('produces byte-identical bundles when recompiled unchanged', () => {
    const repoRoot = makeRepoFromFixtures();
    const first = runCompile({ repoRoot, write: true, now: fixedNow });
    const firstBytes = new Map(
      first.bundles.map((bundle) => [
        bundle.treeId,
        readFileSync(path.join(repoRoot, 'app/static/content', bundle.relativePath)),
      ]),
    );
    const second = runCompile({ repoRoot, write: true, now: () => new Date('2026-09-01T00:00:00.000Z') });
    for (const bundle of second.bundles) {
      const pathToBundle = path.join(repoRoot, 'app/static/content', bundle.relativePath);
      expect(readFileSync(pathToBundle)).toEqual(firstBytes.get(bundle.treeId));
    }
  });

  it('changes only the edited tree bundle hash when one source field changes', () => {
    const repoRoot = makeRepoFromFixtures();
    const first = runCompile({ repoRoot, write: false, now: fixedNow });
    const stableAPath = path.join(repoRoot, 'content/trees/stable-a.yaml');
    const text = readFileSync(stableAPath, 'utf8').replace('Stable A', 'Stable A edited');
    writeFileSync(stableAPath, text, 'utf8');
    const second = runCompile({ repoRoot, write: false, now: fixedNow });

    const firstHashes = new Map(first.bundles.map((bundle) => [bundle.treeId, bundle.hash]));
    const secondHashes = new Map(second.bundles.map((bundle) => [bundle.treeId, bundle.hash]));

    expect(secondHashes.get('stable-a')).not.toBe(firstHashes.get('stable-a'));
    expect(secondHashes.get('stable-b')).toBe(firstHashes.get('stable-b'));
    expect(secondHashes.get('compile-transforms')).toBe(firstHashes.get('compile-transforms'));
  });

  it('is independent of tree file discovery order', () => {
    const repoA = makeRepoFromFixtures();
    const repoB = makeRepoFromFixtures();
    const treesB = path.join(repoB, 'content/trees');
    for (const name of readdirSync(treesB)) {
      if (name.endsWith('.yaml')) {
        rmSync(path.join(treesB, name));
      }
    }
    const names = readdirSync(path.join(repoA, 'content/trees')).filter((name) => name.endsWith('.yaml'));
    for (const name of [...names].reverse()) {
      cpSync(path.join(repoA, 'content/trees', name), path.join(treesB, name));
    }

    const resultA = runCompile({ repoRoot: repoA, write: false, now: fixedNow });
    const resultB = runCompile({ repoRoot: repoB, write: false, now: fixedNow });
    expect(manifestWithoutGenerated(resultA.manifest)).toEqual(manifestWithoutGenerated(resultB.manifest));
    expect(resultA.bundles.map((bundle) => [bundle.treeId, bundle.hash]).sort()).toEqual(
      resultB.bundles.map((bundle) => [bundle.treeId, bundle.hash]).sort(),
    );
  });

  it('cleans stale hashed bundle files only after successful compile', () => {
    const repoRoot = makeRepoFromFixtures();
    runCompile({ repoRoot, write: true, now: fixedNow });
    const treesDir = path.join(repoRoot, 'app/static/content/trees');
    writeFileSync(path.join(treesDir, 'stale-tree.deadbeef.json'), '{"stale":true}\n', 'utf8');

    runCompile({ repoRoot, write: true, now: fixedNow });
    expect(existsSync(path.join(treesDir, 'stale-tree.deadbeef.json'))).toBe(false);
  });

  it('does not delete stale bundles when output validation fails', () => {
    const repoRoot = makeRepoFromFixtures();
    runCompile({ repoRoot, write: true, now: fixedNow });
    const treesDir = path.join(repoRoot, 'app/static/content/trees');
    writeFileSync(path.join(treesDir, 'stale-tree.deadbeef.json'), '{"stale":true}\n', 'utf8');

    const invalidTree = minimalValidTree({ id: 'invalid-output' });
    delete invalidTree.levels[0].milestones[0].uid;
    writeTreeFixture(path.join(repoRoot, 'content/trees'), 'invalid-output.yaml', invalidTree);

    const result = runCompile({ repoRoot, write: true, now: fixedNow });
    expect(result.validationIssues.length).toBeGreaterThan(0);
    expect(existsSync(path.join(treesDir, 'stale-tree.deadbeef.json'))).toBe(true);
  });

  it('writes manifest.json and hashed bundles via runCompile', () => {
    const repoRoot = makeRepoFromFixtures();
    const result = runCompile({ repoRoot, write: true, now: fixedNow });
    expect(existsSync(result.manifestPath)).toBe(true);
    for (const bundle of result.bundles) {
      expect(existsSync(path.join(repoRoot, 'app/static/content', bundle.relativePath))).toBe(true);
    }
  });

  it('runs through the CLI compile subcommand', () => {
    const repoRoot = makeRepoFromFixtures();
    const result = spawnSync(process.execPath, [compiledCliPath, 'compile'], {
      encoding: 'utf8',
      env: { ...process.env, LST_REPO_ROOT: repoRoot },
    });
    expect(result.status).toBe(EXIT_OK);
    expect(existsSync(path.join(repoRoot, 'app/static/content/manifest.json'))).toBe(true);
  });

  it('strips YAML comments from compiled JSON output', () => {
    const repoRoot = makeRepoFromFixtures();
    const treePath = path.join(repoRoot, 'content/trees/stable-a.yaml');
    writeFileSync(
      treePath,
      `${readFileSync(treePath, 'utf8')}\n# author-only comment\n`,
      'utf8',
    );
    const result = runCompile({ repoRoot, write: true, now: fixedNow });
    const stableBundle = result.bundles.find((bundle) => bundle.treeId === 'stable-a');
    expect(stableBundle?.json.includes('author-only comment')).toBe(false);
  });

  it('validates compiled output against T02 schemas', () => {
    const repoRoot = makeRepoFromFixtures();
    const result = runCompile({ repoRoot, write: false, now: fixedNow });
    expect(result.validationIssues).toEqual([]);
  });

  it('uses UTF-8 content hash in bundle filenames', () => {
    const tree = loadFixtureTree('stable-a.yaml');
    const bundle = compileTreeBundle(tree);
    const json = serializeJson(bundle);
    const hash = contentHash(json);
    const output = bundleOutputFromCompiled(tree.id, bundle, json, hash);
    expect(output.relativePath).toBe(`trees/stable-a.${hash}.json`);
  });

  it('stamps manifest.generated as ISO-8601 UTC from the compile clock', () => {
    const repoRoot = makeRepoFromFixtures();
    const result = runCompile({ repoRoot, write: false, now: fixedNow });
    expect(result.manifest.generated).toBe(formatGeneratedTimestamp(fixedNow()));
  });

  it('may change only manifest.generated between compiles with identical content', () => {
    const repoRoot = makeRepoFromFixtures();
    const first = runCompile({ repoRoot, write: true, now: fixedNow });
    const later = runCompile({
      repoRoot,
      write: true,
      now: () => new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(manifestWithoutGenerated(first.manifest)).toEqual(manifestWithoutGenerated(later.manifest));
    expect(first.manifest.generated).not.toBe(later.manifest.generated);
    for (const bundle of later.bundles) {
      expect(readFileSync(path.join(repoRoot, 'app/static/content', bundle.relativePath), 'utf8')).toBe(
        first.bundles.find((entry) => entry.treeId === bundle.treeId)?.json,
      );
    }
  });

  it('accepts an existing empty content/trees directory as a valid empty library', () => {
    const repoRoot = makeEmptyLibraryRepo();
    const result = runCompile({ repoRoot, write: true, now: fixedNow });
    expect(result.manifest.trees).toEqual([]);
    expect(result.bundles).toEqual([]);
    expect(result.manifest.moved).toEqual({});
  });

  it('fails when content/trees is missing without deleting existing outputs', () => {
    const repoRoot = makeRepoFromFixtures();
    runCompile({ repoRoot, write: true, now: fixedNow });
    const sentinelPath = path.join(repoRoot, 'app/static/content/trees/sentinel.abc12345.json');
    writeFileSync(sentinelPath, '{"sentinel":true}\n', 'utf8');
    const treesPath = path.join(repoRoot, 'content/trees');
    for (const name of readdirSync(treesPath)) {
      rmSync(path.join(treesPath, name));
    }
    rmdirSync(treesPath);

    expect(() => runCompile({ repoRoot, write: true, now: fixedNow })).toThrow(
      /Missing content trees directory/,
    );
    expect(readFileSync(sentinelPath, 'utf8')).toBe('{"sentinel":true}\n');
  });

  it('sorts tree ids by UTF-8 code-point order', () => {
    expect(compareAsciiUtf8('a-tree', 'b-tree')).toBeLessThan(0);
    expect(compareAsciiUtf8('stable-a', 'stable-b')).toBeLessThan(0);
  });
});

describe('compileTreeBundle YAML → JSON', () => {
  it('emits JSON-serializable bundles without YAML-specific values', () => {
    const tree = loadFixtureTree('transforms.yaml');
    const bundle = compileTreeBundle(tree);
    expect(() => JSON.parse(serializeJson(bundle))).not.toThrow();
  });
});

describe('compileCommand error handling', () => {
  it('returns validation exit code for malformed moved targets at compile time', () => {
    const repoRoot = makeRepoFromFixtures();
    writeFileSync(
      path.join(repoRoot, 'content/trees/broken-moved.yaml'),
      readFileSync(path.join(repoRoot, 'content/trees/moved-source.yaml'), 'utf8').replace(
        'moved-dest/aaa94001',
        'not-a-valid-target',
      ),
      'utf8',
    );
    const result = spawnSync(process.execPath, [compiledCliPath, 'compile'], {
      encoding: 'utf8',
      env: { ...process.env, LST_REPO_ROOT: repoRoot },
    });
    expect(result.status).toBe(EXIT_VALIDATION_FAILED);
    expect(result.stderr).toMatch(/must be <treeId>\/<uid>/);
  });

  it('returns runtime exit code when content/trees is missing', () => {
    const repoRoot = makeRepoFromFixtures();
    const treesPath = path.join(repoRoot, 'content/trees');
    for (const name of readdirSync(treesPath)) {
      rmSync(path.join(treesPath, name));
    }
    rmdirSync(treesPath);

    const result = spawnSync(process.execPath, [compiledCliPath, 'compile'], {
      encoding: 'utf8',
      env: { ...process.env, LST_REPO_ROOT: repoRoot },
    });
    expect(result.status).toBe(EXIT_RUNTIME_ERROR);
    expect(result.stderr).toMatch(/Missing content trees directory/);
  });
});
