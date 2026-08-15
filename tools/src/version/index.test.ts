import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runBaseline } from '../../src/baseline/index.js';
import { runVersion, versionCommand } from '../../src/version/index.js';
import type { Tree } from '../../src/validate/types.js';
import { minimalValidTree, writeTreeFixture } from '../testing/fixture-helpers.js';

function git(repoRoot: string, ...args: string[]): void {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
}

function withMergedTree(
  prefix: string,
  baseline: Tree,
  run: (repoRoot: string, treesDir: string) => void,
): void {
  const repoRoot = mkdtempSync(path.join(tmpdir(), `lst-${prefix}-`));
  const treesDir = path.join(repoRoot, 'content/trees');
  mkdirSync(treesDir, { recursive: true });
  git(repoRoot, 'init', '--quiet', '-b', 'main');
  git(repoRoot, 'config', 'user.email', 'fixture@example.invalid');
  git(repoRoot, 'config', 'user.name', 'Fixture');
  writeTreeFixture(treesDir, `${baseline.id}.yaml`, baseline);
  git(repoRoot, 'add', '-A');
  git(repoRoot, 'commit', '--quiet', '-m', 'baseline');
  try {
    run(repoRoot, treesDir);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

function subject(): Tree {
  return minimalValidTree({ id: 'subject' });
}

function changed(): Tree {
  const tree = subject();
  tree.levels[0].milestones[0].title = 'A materially different achievement';
  return tree;
}

describe('lst version', () => {
  it('bumps a tree whose compiled output changed', () => {
    withMergedTree('version-bump', subject(), (repoRoot, treesDir) => {
      const treePath = writeTreeFixture(treesDir, 'subject.yaml', changed());
      const result = runVersion({ repoRoot, against: 'main' });

      expect(result.bumped).toEqual([{ treeId: 'subject', from: 1, to: 2 }]);
      expect(readFileSync(treePath, 'utf8')).toContain('contentVersion: 2');
    });
  });

  it('leaves an unchanged tree alone', () => {
    withMergedTree('version-noop', subject(), (repoRoot) => {
      expect(runVersion({ repoRoot, against: 'main' }).bumped).toEqual([]);
    });
  });

  it('is idempotent — a second run bumps nothing', () => {
    withMergedTree('version-idempotent', subject(), (repoRoot, treesDir) => {
      writeTreeFixture(treesDir, 'subject.yaml', changed());
      runVersion({ repoRoot, against: 'main' });
      expect(runVersion({ repoRoot, against: 'main' }).bumped).toEqual([]);
    });
  });

  it('leaves a tree with no baseline alone', () => {
    withMergedTree('version-newtree', subject(), (repoRoot, treesDir) => {
      writeTreeFixture(treesDir, 'brand-new.yaml', minimalValidTree({ id: 'brand-new' }));
      expect(runVersion({ repoRoot, against: 'main' }).bumped).toEqual([]);
    });
  });

  it('clears §6.4 check 5, which is the whole point of it existing', () => {
    withMergedTree('version-clears', subject(), (repoRoot, treesDir) => {
      writeTreeFixture(treesDir, 'subject.yaml', changed());
      expect(
        runBaseline({ repoRoot, against: 'main' }).findings.some((f) => f.check === 5),
      ).toBe(true);

      expect(versionCommand([], { repoRoot, against: 'main' })).toBe(0);

      expect(
        runBaseline({ repoRoot, against: 'main' }).findings.some((f) => f.check === 5),
      ).toBe(false);
    });
  });

  it('preserves the rest of the file byte for byte apart from the bump', () => {
    withMergedTree('version-surgical', subject(), (repoRoot, treesDir) => {
      const treePath = writeTreeFixture(treesDir, 'subject.yaml', changed());
      const before = readFileSync(treePath, 'utf8');
      runVersion({ repoRoot, against: 'main' });
      const after = readFileSync(treePath, 'utf8');
      expect(after.replace('contentVersion: 2', 'contentVersion: 1')).toBe(before);
    });
  });
});
