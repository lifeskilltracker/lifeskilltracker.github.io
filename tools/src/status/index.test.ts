import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  renderReviewStatus,
  reviewStatusPath,
  runStatus,
  statusCommand,
} from '../../src/status/index.js';
import type { Tree } from '../../src/validate/types.js';
import {
  minimalValidTree,
  withTempContentRepo,
  writeTreeFixture,
} from '../testing/fixture-helpers.js';

function reviewedTree(id: string): Tree {
  const tree = minimalValidTree({ id });
  tree.provenance = {
    authors: [
      { name: 'A. Contributor', github: 'acontributor' },
      { name: 'B. Later', github: 'blater', role: 'reviser', since: '2027-04-11' },
    ],
    reviews: [
      { round: 1, reviewer: 'R. One', date: '2026-09-02' },
      { round: 2, reviewer: 'R. Two', date: '2026-09-14' },
    ],
    copyleftDerived: false,
  };
  return tree;
}

function halfReviewedTree(id: string): Tree {
  const tree = minimalValidTree({ id });
  tree.provenance = {
    authors: [{ name: 'C. Solo' }],
    reviews: [{ round: 1, reviewer: 'R. One', date: '2026-10-01' }],
    copyleftDerived: false,
  };
  return tree;
}

function unreviewedTree(id: string): Tree {
  const tree = minimalValidTree({ id });
  tree.provenance = { authors: [{ name: 'D. Draft' }], copyleftDerived: false };
  return tree;
}

/** Writes a corpus, then leaves the caller holding a synced repository. */
function withCorpus(
  prefix: string,
  trees: Tree[],
  run: (repoRoot: string, statusPath: string) => void,
): void {
  withTempContentRepo(prefix, (repoRoot, treesDir) => {
    for (const tree of trees) {
      writeTreeFixture(treesDir, `${tree.id}.yaml`, tree);
    }
    run(repoRoot, reviewStatusPath(repoRoot));
  });
}

describe('lst status — the generated table (§6.6)', () => {
  it('emits one row per tree with authored / review 1 / review 2 columns', () => {
    withCorpus(
      'status',
      [reviewedTree('bravo'), halfReviewedTree('alpha'), unreviewedTree('charlie')],
      (repoRoot, statusPath) => {
        runStatus({ repoRoot });
        const rows = readFileSync(statusPath, 'utf8')
          .split('\n')
          .filter((line) => line.startsWith('| ') && !line.startsWith('| Tree'));

        expect(rows).toHaveLength(3);
        expect(rows[0]).toContain('alpha');
        expect(rows[1]).toContain('bravo');
        expect(rows[2]).toContain('charlie');

        expect(rows[1]).toContain('A. Contributor');
        expect(rows[1]).toContain('B. Later');
        expect(rows[1]).toContain('R. One');
        expect(rows[1]).toContain('2026-09-02');
        expect(rows[1]).toContain('R. Two');
        expect(rows[1]).toContain('2026-09-14');

        // alpha has round 1 only; charlie has neither.
        expect(rows[0]).toContain('2026-10-01');
        expect(rows[0].split('|')[4].trim()).toBe('—');
        expect(rows[2].split('|')[3].trim()).toBe('—');
        expect(rows[2].split('|')[4].trim()).toBe('—');
      },
    );
  });

  it('is stable — regenerating an already-current table changes nothing', () => {
    withCorpus('status-stable', [reviewedTree('bravo')], (repoRoot, statusPath) => {
      runStatus({ repoRoot });
      const first = readFileSync(statusPath, 'utf8');
      runStatus({ repoRoot });
      expect(readFileSync(statusPath, 'utf8')).toBe(first);
    });
  });

  it('orders rows by tree id regardless of file discovery order', () => {
    withCorpus(
      'status-order',
      [unreviewedTree('zulu'), unreviewedTree('alpha')],
      (repoRoot) => {
        const content = renderReviewStatus(runStatus({ repoRoot }).trees);
        expect(content.indexOf('alpha')).toBeLessThan(content.indexOf('zulu'));
      },
    );
  });
});

describe('lst status — gates on drift and only on drift (D-16)', () => {
  it('exits 0 when the committed table matches', () => {
    withCorpus('status-clean', [reviewedTree('bravo')], (repoRoot) => {
      runStatus({ repoRoot });
      expect(statusCommand(repoRoot)).toBe(0);
    });
  });

  it('exits nonzero when the committed table differs', () => {
    withCorpus('status-drift', [reviewedTree('bravo')], (repoRoot, statusPath) => {
      runStatus({ repoRoot });
      writeFileSync(statusPath, '# Review status\n\nhand-edited nonsense\n', 'utf8');
      expect(statusCommand(repoRoot)).not.toBe(0);
    });
  });

  it('exits nonzero when the table is missing entirely', () => {
    withCorpus('status-absent', [reviewedTree('bravo')], (repoRoot) => {
      expect(statusCommand(repoRoot)).not.toBe(0);
    });
  });

  it('rewrites the drifted file so the author has the fix in hand', () => {
    withCorpus('status-rewrite', [reviewedTree('bravo')], (repoRoot, statusPath) => {
      writeFileSync(statusPath, 'stale\n', 'utf8');
      statusCommand(repoRoot);
      expect(readFileSync(statusPath, 'utf8')).toContain('R. Two');
      expect(statusCommand(repoRoot)).toBe(0);
    });
  });

  it('exits 0 on a corpus with no reviews recorded anywhere', () => {
    withCorpus(
      'status-unreviewed',
      [unreviewedTree('alpha'), unreviewedTree('bravo')],
      (repoRoot) => {
        runStatus({ repoRoot });
        expect(statusCommand(repoRoot)).toBe(0);
      },
    );
  });
});

describe('lst status — location', () => {
  it('writes content/REVIEW-STATUS.md', () => {
    withCorpus('status-path', [unreviewedTree('alpha')], (repoRoot, statusPath) => {
      expect(statusPath).toBe(path.join(repoRoot, 'content', 'REVIEW-STATUS.md'));
      runStatus({ repoRoot });
      expect(readFileSync(statusPath, 'utf8')).toContain('| Tree |');
    });
  });
});
