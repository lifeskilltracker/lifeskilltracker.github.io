import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { baselineCommand, runBaseline } from '../../src/baseline/index.js';
import { BaselineUnavailableError } from '../../src/baseline/diff.js';
import type { LineageEntry, Tree } from '../../src/validate/types.js';
import { minimalValidTree, uidFor, writeTreeFixture } from '../testing/fixture-helpers.js';

function git(repoRoot: string, ...args: string[]): string {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

interface Fixture {
  repoRoot: string;
  treesDir: string;
  write(tree: Tree): string;
  commit(message: string): string;
}

/**
 * A real git repository, because every check here is a claim about history and
 * a mocked `git show` would only ever confirm what the mock was told to say.
 */
function withGitRepo(prefix: string, run: (fixture: Fixture) => void): void {
  const repoRoot = mkdtempSync(path.join(tmpdir(), `lst-${prefix}-`));
  const treesDir = path.join(repoRoot, 'content/trees');
  mkdirSync(treesDir, { recursive: true });
  git(repoRoot, 'init', '--quiet', '-b', 'main');
  git(repoRoot, 'config', 'user.email', 'fixture@example.invalid');
  git(repoRoot, 'config', 'user.name', 'Fixture');
  try {
    run({
      repoRoot,
      treesDir,
      write: (tree) => writeTreeFixture(treesDir, `${tree.id}.yaml`, tree),
      commit: (message) => {
        git(repoRoot, 'add', '-A');
        git(repoRoot, 'commit', '--quiet', '-m', message);
        return git(repoRoot, 'rev-parse', 'HEAD');
      },
    });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

function checksFired(result: { findings: Array<{ check: number }> }): number[] {
  return [...new Set(result.findings.map((finding) => finding.check))].sort((a, b) => a - b);
}

/** Baseline `subject`, then hand the caller the head to mutate in place. */
function withMergedTree(
  prefix: string,
  baseline: Tree,
  run: (fixture: Fixture, baselineRef: string) => void,
): void {
  withGitRepo(prefix, (fixture) => {
    fixture.write(baseline);
    fixture.commit('baseline');
    run(fixture, 'main');
  });
}

function subject(): Tree {
  return minimalValidTree({ id: 'subject' });
}

describe('lst baseline — a clean PR', () => {
  it('reports nothing when the head matches the baseline', () => {
    withMergedTree('base-clean', subject(), (fixture) => {
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
      expect(baselineCommand({ repoRoot: fixture.repoRoot, against: 'main' })).toBe(0);
    });
  });

  it('passes trivially on a tree that has never been merged', () => {
    withMergedTree('base-new-tree', subject(), (fixture) => {
      fixture.write(minimalValidTree({ id: 'brand-new' }));
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });
});

describe('lst baseline — check 1: a published uid never just vanishes', () => {
  it('fails when a milestone is dropped with no lineage entry', () => {
    withMergedTree('base-c1-fail', subject(), (fixture) => {
      const head = subject();
      head.levels[0].milestones.pop();
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        1,
      );
    });
  });

  it('passes when the same removal carries a disposition', () => {
    withMergedTree('base-c1-pass', subject(), (fixture) => {
      const head = subject();
      const dropped = head.levels[0].milestones.pop()!;
      head.lineage = [{ uid: dropped.uid!, op: 'retired', note: 'folded into l1-m1' }];
      head.contentVersion = 2;
      fixture.write(head);
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });
});

describe('lst baseline — check 2: a uid is never reattached to another milestone', () => {
  it('passes a uid whose slug, title, and level all change under revision (D-05)', () => {
    withMergedTree('base-c2-pass', subject(), (fixture) => {
      const head = subject();
      const revised = head.levels[0].milestones[0];
      revised.id = 'renamed-entirely';
      revised.title = 'A completely rewritten achievement';
      revised.aliases = ['l1-m1'];
      head.levels[0].milestones.shift();
      head.levels[2].milestones.push(revised);
      head.contentVersion = 2;
      fixture.write(head);
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });

  it('fails when two uids swap the milestones they name', () => {
    withMergedTree('base-c2-fail', subject(), (fixture) => {
      const head = subject();
      const [first, second] = head.levels[0].milestones;
      [first.uid, second.uid] = [second.uid, first.uid];
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        2,
      );
    });
  });
});

describe('lst baseline — check 3: a retired slug is never reused', () => {
  it('fails when a new uid takes over a retired slug', () => {
    withMergedTree('base-c3', subject(), (fixture) => {
      const head = subject();
      const retired = head.levels[0].milestones[0];
      head.lineage = [{ uid: retired.uid!, op: 'retired' }];
      retired.uid = uidFor(900);
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        3,
      );
    });
  });

  it('passes when the retired slug is simply left alone', () => {
    withMergedTree('base-c3-pass', subject(), (fixture) => {
      const head = subject();
      const retired = head.levels[0].milestones.pop()!;
      head.lineage = [{ uid: retired.uid!, op: 'retired' }];
      head.contentVersion = 2;
      fixture.write(head);
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });
});

describe('lst baseline — the gate', () => {
  it('exits nonzero on an unfixed violation and 0 when all eight checks pass', () => {
    withMergedTree('base-exit', subject(), (fixture) => {
      const head = subject();
      head.levels[0].milestones.pop();
      fixture.write(head);
      expect(baselineCommand({ repoRoot: fixture.repoRoot, against: 'main' })).not.toBe(0);

      fixture.write(subject());
      expect(baselineCommand({ repoRoot: fixture.repoRoot, against: 'main' })).toBe(0);
    });
  });
});

describe('lst baseline — check 4: a changed slug keeps its old value as an alias', () => {
  it('fails a rename with no aliases entry', () => {
    withMergedTree('base-c4-fail', subject(), (fixture) => {
      const head = subject();
      head.levels[0].milestones[0].id = 'renamed';
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        4,
      );
    });
  });

  it('passes the same rename with the old slug recorded', () => {
    withMergedTree('base-c4-pass', subject(), (fixture) => {
      const head = subject();
      head.levels[0].milestones[0].id = 'renamed';
      head.levels[0].milestones[0].aliases = ['l1-m1'];
      head.contentVersion = 2;
      fixture.write(head);
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });

  it('--fix writes the missing alias into the tree file, and a rerun is clean', () => {
    withMergedTree('base-c4-fix', subject(), (fixture) => {
      const head = subject();
      head.levels[0].milestones[0].id = 'renamed';
      head.contentVersion = 2;
      const treePath = fixture.write(head);

      expect(baselineCommand({ repoRoot: fixture.repoRoot, against: 'main' })).not.toBe(0);

      const fixed = runBaseline({ repoRoot: fixture.repoRoot, against: 'main', fix: true });
      expect(fixed.fixed).toContain(treePath);
      expect(readFileSync(treePath, 'utf8')).toContain('l1-m1');
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });
});

describe('lst baseline — check 5: compiled output moves, contentVersion moves', () => {
  it('fails when compiled output changed and the version did not', () => {
    withMergedTree('base-c5-fail', subject(), (fixture) => {
      const head = subject();
      head.levels[0].milestones[0].title = 'A different achievement entirely';
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        5,
      );
    });
  });

  it('passes when the version is bumped alongside', () => {
    withMergedTree('base-c5-pass', subject(), (fixture) => {
      const head = subject();
      head.levels[0].milestones[0].title = 'A different achievement entirely';
      head.contentVersion = 2;
      fixture.write(head);
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });

  it('ignores a bump with no compiled change', () => {
    withMergedTree('base-c5-noop', subject(), (fixture) => {
      const head = subject();
      head.contentVersion = 7;
      fixture.write(head);
      expect(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings).toEqual([]);
    });
  });

  it('compares against origin/main’s tip, not the merge-base (F6)', () => {
    withGitRepo('base-c5-tip', (fixture) => {
      fixture.write(subject());
      const mergeBase = fixture.commit('branch point');

      // `main` advances: someone else's PR bumps the same tree to 2.
      const advanced = subject();
      advanced.levels[0].milestones[1].title = 'Their change';
      advanced.contentVersion = 2;
      fixture.write(advanced);
      fixture.commit('their PR');

      // Our PR bumps to 2 as well — sound against the merge-base, wrong
      // against the tip, and the tip is what ships.
      const ours = subject();
      ours.levels[0].milestones[2].title = 'Our change';
      ours.contentVersion = 2;
      fixture.write(ours);

      expect(
        checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' })),
      ).toContain(5);
      expect(
        checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: mergeBase })),
      ).not.toContain(5);
    });
  });
});

describe('lst baseline — check 6: the ledger is append-only', () => {
  const first: LineageEntry = { uid: uidFor(1), op: 'retired', note: 'first' };
  const second: LineageEntry = { uid: uidFor(2), op: 'retired', note: 'second' };

  function baselineWithLedger(): Tree {
    const tree = subject();
    // Both dispositioned milestones stay in the file, so only the ledger's
    // shape is under test here.
    tree.lineage = [first, second];
    return tree;
  }

  it('passes an appended entry', () => {
    withMergedTree('base-c6-pass', baselineWithLedger(), (fixture) => {
      const head = baselineWithLedger();
      head.lineage = [first, second, { uid: uidFor(3), op: 'retired', note: 'third' }];
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).not.toContain(
        6,
      );
    });
  });

  it('fails an entry inserted in the middle', () => {
    withMergedTree('base-c6-insert', baselineWithLedger(), (fixture) => {
      const head = baselineWithLedger();
      head.lineage = [first, { uid: uidFor(3), op: 'retired', note: 'wedged in' }, second];
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        6,
      );
    });
  });

  it('fails a reorder', () => {
    withMergedTree('base-c6-reorder', baselineWithLedger(), (fixture) => {
      const head = baselineWithLedger();
      head.lineage = [second, first];
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        6,
      );
    });
  });

  it('fails an edit to an existing entry, naming the position', () => {
    withMergedTree('base-c6-edit', baselineWithLedger(), (fixture) => {
      const head = baselineWithLedger();
      head.lineage = [first, { ...second, op: 'merged', into: [uidFor(1)] }];
      fixture.write(head);
      const finding = runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings.find(
        (candidate) => candidate.check === 6,
      );
      expect(finding).toBeDefined();
      expect(finding?.message).toContain('1');
    });
  });
});

describe('lst baseline — check 7: appended entries dispose of published uids', () => {
  it('fails an appended entry naming a uid that was never published', () => {
    withMergedTree('base-c7-fail', subject(), (fixture) => {
      const head = subject();
      head.lineage = [{ uid: uidFor(999), op: 'retired', note: 'typo' }];
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        7,
      );
    });
  });

  it('leaves an old ledger entry alone once its uid has aged out of the baseline (F7)', () => {
    const baseline = subject();
    const aged = baseline.levels[0].milestones.pop()!;
    baseline.lineage = [{ uid: aged.uid!, op: 'retired', note: 'three releases ago' }];

    withMergedTree('base-c7-timebomb', baseline, (fixture) => {
      const head = structuredClone(baseline);
      head.levels[1].milestones[0].title = 'Some unrelated edit';
      head.contentVersion = 2;
      fixture.write(head);
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).not.toContain(
        7,
      );
    });
  });
});

describe('lst baseline — check 8: trees are never removed or renamed', () => {
  it('fails a deleted tree, naming the missing id', () => {
    withMergedTree('base-c8-delete', subject(), (fixture) => {
      unlinkSync(path.join(fixture.treesDir, 'subject.yaml'));
      const finding = runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }).findings.find(
        (candidate) => candidate.check === 8,
      );
      expect(finding).toBeDefined();
      expect(finding?.message).toContain('subject');
    });
  });

  it('fails a renamed tree', () => {
    withMergedTree('base-c8-rename', subject(), (fixture) => {
      unlinkSync(path.join(fixture.treesDir, 'subject.yaml'));
      fixture.write(minimalValidTree({ id: 'subject-renamed' }));
      expect(checksFired(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }))).toContain(
        8,
      );
    });
  });
});

describe('lst baseline — the ref itself', () => {
  it('errors rather than passing vacuously when the baseline cannot be resolved', () => {
    withMergedTree('base-ref', subject(), (fixture) => {
      expect(() => runBaseline({ repoRoot: fixture.repoRoot, against: 'origin/main' })).toThrow(
        BaselineUnavailableError,
      );
      expect(baselineCommand({ repoRoot: fixture.repoRoot, against: 'origin/main' })).not.toBe(0);
    });
  });

  it('defaults to origin/main', () => {
    withMergedTree('base-default-ref', subject(), (fixture) => {
      git(fixture.repoRoot, 'update-ref', 'refs/remotes/origin/main', 'refs/heads/main');
      expect(runBaseline({ repoRoot: fixture.repoRoot }).ref).toBe('origin/main');
    });
  });
});

/**
 * Check 9 — an existing placement never changes.
 *
 * The ledger is what makes N11 true for skill positions, and it is only worth
 * anything if CI refuses the edit. Verified over a real git repository for the
 * same reason as every other check here: a mocked `git show` would confirm only
 * what the mock was told.
 */
describe('lst baseline — check 9, the placement ledger', () => {
  const ledger = (body: string): string =>
    ['schemaVersion: 1', 'cellDivisor: 4', 'placements:', body, ''].join('\n');

  const baselineLedger = ledger(
    [
      '  - { tree: subject, domain: making, cell: { q: 0, r: 0 } }',
      '  - { tree: other, domain: body, cell: { q: -4, r: 8 } }',
    ].join('\n'),
  );

  function withLedgers(
    prefix: string,
    head: string,
    run: (result: ReturnType<typeof runBaseline>) => void,
  ): void {
    withGitRepo(prefix, (fixture) => {
      const taxonomy = path.join(fixture.repoRoot, 'content/taxonomy');
      mkdirSync(taxonomy, { recursive: true });
      fixture.write(subject());
      writeFileSync(path.join(taxonomy, 'placement.yaml'), baselineLedger, 'utf8');
      fixture.commit('baseline');
      writeFileSync(path.join(taxonomy, 'placement.yaml'), head, 'utf8');
      run(runBaseline({ repoRoot: fixture.repoRoot, against: 'main' }));
    });
  }

  it('passes when nothing moved', () => {
    withLedgers('check9-clean', baselineLedger, (result) => {
      expect(checksFired(result)).not.toContain(9);
    });
  });

  it('passes when a line is appended', () => {
    const head = baselineLedger.replace(
      'placements:\n',
      'placements:\n  - { tree: third, domain: mind, cell: { q: 24, r: 4 } }\n',
    );
    withLedgers('check9-append', head, (result) => {
      expect(checksFired(result)).not.toContain(9);
    });
  });

  it('fails when a committed cell is hand-edited', () => {
    const head = baselineLedger.replace('q: 0, r: 0', 'q: 2, r: 1');
    withLedgers('check9-edit', head, (result) => {
      expect(checksFired(result)).toContain(9);
      expect(result.findings.some((f) => f.check === 9 && f.treeId === 'subject')).toBe(true);
    });
  });

  it('permits a domain change, which frees the old cell by design', () => {
    const head = baselineLedger.replace(
      '{ tree: subject, domain: making, cell: { q: 0, r: 0 } }',
      '{ tree: subject, domain: body, cell: { q: -4, r: 9 } }',
    );
    withLedgers('check9-domain', head, (result) => {
      expect(checksFired(result)).not.toContain(9);
    });
  });

  it('permits a retirement, which frees the cell for the next arrival', () => {
    const head = ledger('  - { tree: other, domain: body, cell: { q: -4, r: 8 } }');
    withLedgers('check9-retire', head, (result) => {
      expect(checksFired(result)).not.toContain(9);
    });
  });

  it('fails when the frozen divisor is changed, which renumbers every spiral', () => {
    const head = baselineLedger.replace('cellDivisor: 4', 'cellDivisor: 3');
    withLedgers('check9-divisor', head, (result) => {
      expect(result.findings.some((f) => f.check === 9 && /divisor/i.test(f.message))).toBe(true);
    });
  });
});
