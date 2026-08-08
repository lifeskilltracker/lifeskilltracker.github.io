import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runIds } from '../../src/ids/index.js';
import { runValidate } from '../../src/validate/index.js';
import { generateCrockfordUid, isValidUid } from '../../src/ids/crockford.js';
import {
  fixturePath,
  minimalValidTree,
  writeTreeFixture,
} from '../testing/fixture-helpers.js';

function withTempRepo(run: (repoRoot: string, treesDir: string) => void): void {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'lst-ids-'));
  const taxonomyDir = path.join(repoRoot, 'content/taxonomy');
  const treesDir = path.join(repoRoot, 'content/trees');
  mkdirSync(taxonomyDir, { recursive: true });
  mkdirSync(treesDir, { recursive: true });
  copyFileSync(
    fixturePath('content/taxonomy/domains.yaml'),
    path.join(taxonomyDir, 'domains.yaml'),
  );
  copyFileSync(
    fixturePath('content/taxonomy/facets.yaml'),
    path.join(taxonomyDir, 'facets.yaml'),
  );
  copyFileSync(
    fixturePath('content/taxonomy/map.yaml'),
    path.join(taxonomyDir, 'map.yaml'),
  );
  try {
    run(repoRoot, treesDir);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe('lst ids', () => {
  it('fills every missing uid with 8-character Crockford values', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'draft' });
      for (const level of tree.levels) {
        for (const milestone of level.milestones) {
          delete milestone.uid;
        }
      }
      const treePath = writeTreeFixture(treesDir, 'draft-no-uids.yaml', tree);
      runIds({ repoRoot, files: [treePath] });
      const text = readFileSync(treePath, 'utf8');
      expect(text).toMatch(/uid: [0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{8}/);
      const report = runValidate({ repoRoot, files: [treePath] });
      expect(report.exitIssues.filter((issue) => issue.rule === 'rule 16')).toEqual([]);
    });
  });

  it('is idempotent on a second run', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'draft' });
      for (const level of tree.levels) {
        for (const milestone of level.milestones) {
          delete milestone.uid;
        }
      }
      const treePath = writeTreeFixture(treesDir, 'draft-no-uids.yaml', tree);
      runIds({ repoRoot, files: [treePath] });
      const afterFirst = readFileSync(treePath, 'utf8');
      runIds({ repoRoot, files: [treePath] });
      const afterSecond = readFileSync(treePath, 'utf8');
      expect(afterSecond).toBe(afterFirst);
    });
  });

  it('never overwrites an existing uid', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'partial' });
      delete tree.levels[0].milestones[1].uid;
      const treePath = writeTreeFixture(treesDir, 'partial.yaml', tree);
      const keep = tree.levels[0].milestones[0].uid!;
      runIds({ repoRoot, files: [treePath] });
      const text = readFileSync(treePath, 'utf8');
      expect(text).toContain(`uid: ${keep}`);
    });
  });

  it('generates repository-unique uids', () => {
    withTempRepo((repoRoot, treesDir) => {
      const existing = minimalValidTree({ id: 'existing' });
      writeTreeFixture(treesDir, 'existing.yaml', existing);
      const existingUids = new Set<string>();
      for (const level of existing.levels) {
        for (const milestone of level.milestones) {
          if (milestone.uid) {
            existingUids.add(milestone.uid);
          }
        }
      }
      for (const entry of existing.mastery ?? []) {
        if (entry.uid) {
          existingUids.add(entry.uid);
        }
      }

      const draft = minimalValidTree({ id: 'draft' });
      for (const level of draft.levels) {
        for (const milestone of level.milestones) {
          delete milestone.uid;
        }
      }
      const draftPath = writeTreeFixture(treesDir, 'draft.yaml', draft);
      runIds({ repoRoot, files: [draftPath] });
      const text = readFileSync(draftPath, 'utf8');
      const matches = [...text.matchAll(/uid: ([0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{8})/g)].map((m) => m[1]);
      expect(new Set(matches).size).toBe(matches.length);
      for (const uid of matches) {
        expect(isValidUid(uid)).toBe(true);
        expect(existingUids.has(uid)).toBe(false);
      }
    });
  });
});

describe('crockford uid generator', () => {
  it('generates valid unique ids', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const uid = generateCrockfordUid(seen);
      expect(isValidUid(uid)).toBe(true);
      seen.add(uid);
    }
  });
});
