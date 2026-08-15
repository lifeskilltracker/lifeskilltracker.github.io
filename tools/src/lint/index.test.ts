import { describe, expect, it } from 'vitest';

import { lintCommand, runLint } from '../../src/lint/index.js';
import type { LintRuleId } from '../../src/lint/report.js';
import type { Milestone, RequirementGroup, Tree } from '../../src/validate/types.js';
import {
  minimalValidTree,
  withTempContentRepo,
  writeTreeFixture,
} from '../testing/fixture-helpers.js';

function rulesFired(tree: Tree, name = 'subject.yaml'): LintRuleId[] {
  let fired: LintRuleId[] = [];
  withTempContentRepo('lint', (repoRoot, treesDir) => {
    writeTreeFixture(treesDir, name, tree);
    const report = runLint({ repoRoot });
    fired = [...new Set(report.findings.map((finding) => finding.rule))].sort();
  });
  return fired;
}

function milestone(tree: Tree, level: number, index: number): Milestone {
  return tree.levels[level - 1].milestones[index];
}

function setRequirements(tree: Tree, level: number, groups: RequirementGroup[]): void {
  tree.levels[level - 1].requirements = groups;
}

/** Every milestone in the tree, in file order. */
function allMilestones(tree: Tree): Milestone[] {
  return tree.levels.flatMap((level) => level.milestones);
}

describe('lst lint — the seven §6.3 rules', () => {
  describe('vague-milestone', () => {
    it('flags effort-quantity phrasing', () => {
      const tree = minimalValidTree({ id: 'vague' });
      milestone(tree, 3, 0).title = 'Practice scales for 30 minutes a day';
      expect(rulesFired(tree)).toContain('vague-milestone');
    });

    it('flags a hedge with no observable completion condition', () => {
      const tree = minimalValidTree({ id: 'hedge' });
      milestone(tree, 2, 1).title = 'Understand the circle of fifths';
      expect(rulesFired(tree)).toContain('vague-milestone');
    });

    it('does not flag an observable achievement', () => {
      const tree = minimalValidTree({ id: 'clean' });
      milestone(tree, 2, 1).title = 'Play a two-octave C major scale hands together';
      expect(rulesFired(tree)).not.toContain('vague-milestone');
    });
  });

  describe('professionalization-tier', () => {
    it('flags teaching at level 10', () => {
      const tree = minimalValidTree({ id: 'prof' });
      milestone(tree, 10, 0).title = 'Teach a certification course';
      expect(rulesFired(tree)).toContain('professionalization-tier');
    });

    it('does not flag "teach a certification course" below level 9 — PRIOR-ART §7.3', () => {
      const tree = minimalValidTree({ id: 'prior-art' });
      milestone(tree, 5, 0).title = 'Teach a certification course';
      expect(rulesFired(tree)).not.toContain('professionalization-tier');
    });
  });

  describe('group-shape-drift', () => {
    const groups: Record<string, RequirementGroup> = {
      all: { rule: 'all', milestones: ['l1-m1', 'l1-m2'] },
      any: { rule: 'any', milestones: ['l2-m1', 'l2-m2'] },
      twoOf: { rule: 'n_of', n: 2, milestones: ['l3-m1', 'l3-m2', 'l3-m3'] },
      threeOf: { rule: 'n_of', n: 3, milestones: ['l4-m1', 'l4-m2', 'l4-m3', 'l4-m4'] },
    };

    it('fires on four distinct shapes', () => {
      const tree = minimalValidTree({ id: 'four-shapes' });
      setRequirements(tree, 1, [groups.all]);
      setRequirements(tree, 2, [groups.any]);
      setRequirements(tree, 3, [groups.twoOf]);
      setRequirements(tree, 4, [groups.threeOf]);
      expect(rulesFired(tree)).toContain('group-shape-drift');
    });

    it('does not fire on three distinct shapes', () => {
      const tree = minimalValidTree({ id: 'three-shapes' });
      setRequirements(tree, 1, [groups.all]);
      setRequirements(tree, 2, [groups.any]);
      setRequirements(tree, 3, [groups.twoOf]);
      expect(rulesFired(tree)).not.toContain('group-shape-drift');
    });
  });

  describe('track-overuse', () => {
    it('fires on five tracks', () => {
      const tree = minimalValidTree({ id: 'five-tracks' });
      tree.tracks = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id.toUpperCase() }));
      expect(rulesFired(tree)).toContain('track-overuse');
    });

    it('does not fire on four tracks', () => {
      const tree = minimalValidTree({ id: 'four-tracks' });
      tree.tracks = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id.toUpperCase() }));
      expect(rulesFired(tree)).not.toContain('track-overuse');
    });
  });

  describe('lonely-track', () => {
    it('fires on a track with two milestones', () => {
      const tree = minimalValidTree({ id: 'lonely' });
      tree.tracks = [
        { id: 'main', title: 'Main' },
        { id: 'side', title: 'Side' },
      ];
      allMilestones(tree)
        .slice(0, 2)
        .forEach((entry) => {
          entry.track = 'side';
        });
      expect(rulesFired(tree)).toContain('lonely-track');
    });

    it('does not fire on a track with three milestones', () => {
      const tree = minimalValidTree({ id: 'company' });
      tree.tracks = [
        { id: 'main', title: 'Main' },
        { id: 'side', title: 'Side' },
      ];
      allMilestones(tree)
        .slice(0, 3)
        .forEach((entry) => {
          entry.track = 'side';
        });
      expect(rulesFired(tree)).not.toContain('lonely-track');
    });
  });

  describe('level-pacing', () => {
    it('fires on a level far out of step with its neighbours', () => {
      const tree = minimalValidTree({ id: 'pacing' });
      const level5 = tree.levels[4];
      while (level5.milestones.length < 8) {
        const index = level5.milestones.length + 1;
        level5.milestones.push({ id: `l5-extra-${index}`, title: `Level 5 extra ${index}` });
      }
      expect(rulesFired(tree)).toContain('level-pacing');
    });

    it('does not fire on an evenly paced tree', () => {
      expect(rulesFired(minimalValidTree({ id: 'even' }))).not.toContain('level-pacing');
    });
  });

  describe('orphan-milestone', () => {
    it('fires on an isolated milestone in a tree that uses prerequisites', () => {
      const tree = minimalValidTree({ id: 'orphan' });
      milestone(tree, 1, 1).requires = ['l1-m1'];
      expect(rulesFired(tree)).toContain('orphan-milestone');
    });

    it('does not fire when every milestone is on the prerequisite graph', () => {
      const tree = minimalValidTree({ id: 'chained' });
      const chain = allMilestones(tree);
      chain.forEach((entry, index) => {
        if (index > 0) {
          entry.requires = [chain[index - 1].id];
        }
      });
      expect(rulesFired(tree)).not.toContain('orphan-milestone');
    });

    it('does not fire in a tree with no prerequisites at all', () => {
      expect(rulesFired(minimalValidTree({ id: 'flat' }))).not.toContain('orphan-milestone');
    });
  });
});

describe('lst lint — advisory, never gating (D-15)', () => {
  function allSevenTree(): Tree {
    const tree = minimalValidTree({ id: 'all-seven' });
    // vague-milestone + professionalization-tier
    milestone(tree, 1, 0).title = 'Practice for 30 minutes';
    milestone(tree, 10, 0).title = 'Publish a book on the subject';
    // group-shape-drift
    setRequirements(tree, 1, [{ rule: 'all', milestones: ['l1-m1'] }]);
    setRequirements(tree, 2, [{ rule: 'any', milestones: ['l2-m1'] }]);
    setRequirements(tree, 3, [{ rule: 'n_of', n: 2, milestones: ['l3-m1', 'l3-m2'] }]);
    setRequirements(tree, 4, [{ rule: 'n_of', n: 3, milestones: ['l4-m1', 'l4-m2', 'l4-m3'] }]);
    // track-overuse + lonely-track
    tree.tracks = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id.toUpperCase() }));
    milestone(tree, 1, 1).track = 'b';
    // level-pacing
    const level5 = tree.levels[4];
    while (level5.milestones.length < 8) {
      const index = level5.milestones.length + 1;
      level5.milestones.push({ id: `l5-extra-${index}`, title: `Level 5 extra ${index}` });
    }
    // orphan-milestone
    milestone(tree, 2, 1).requires = ['l2-m1'];
    return tree;
  }

  it('trips all seven rules at once', () => {
    expect(rulesFired(allSevenTree())).toEqual([
      'group-shape-drift',
      'level-pacing',
      'lonely-track',
      'orphan-milestone',
      'professionalization-tier',
      'track-overuse',
      'vague-milestone',
    ]);
  });

  it('still exits 0 with every rule tripped', () => {
    withTempContentRepo('lint-exit', (repoRoot, treesDir) => {
      writeTreeFixture(treesDir, 'all-seven.yaml', allSevenTree());
      expect(lintCommand([], repoRoot)).toBe(0);
    });
  });

  it('exits 0 on a clean corpus too', () => {
    withTempContentRepo('lint-clean', (repoRoot, treesDir) => {
      writeTreeFixture(treesDir, 'clean.yaml', minimalValidTree({ id: 'clean' }));
      expect(lintCommand([], repoRoot)).toBe(0);
    });
  });
});

describe('lst lint — finding shape', () => {
  it('reports rule, file, and the line of the offending milestone', () => {
    withTempContentRepo('lint-shape', (repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'located' });
      milestone(tree, 4, 2).title = 'Study the repertoire';
      const treePath = writeTreeFixture(treesDir, 'located.yaml', tree);

      const finding = runLint({ repoRoot }).findings.find(
        (candidate) => candidate.rule === 'vague-milestone',
      );

      expect(finding).toBeDefined();
      expect(finding?.file).toBe(treePath);
      expect(finding?.line).toBeGreaterThan(1);
      expect(finding?.message).toContain('l4-m3');
    });
  });

  it('scopes reporting to the files named on the command line', () => {
    withTempContentRepo('lint-scope', (repoRoot, treesDir) => {
      const noisy = minimalValidTree({ id: 'noisy' });
      milestone(noisy, 1, 0).title = 'Practice for an hour';
      writeTreeFixture(treesDir, 'noisy.yaml', noisy);
      const quietPath = writeTreeFixture(
        treesDir,
        'quiet.yaml',
        minimalValidTree({ id: 'quiet' }),
      );

      const report = runLint({ repoRoot, files: [quietPath] });
      expect(report.findings).toEqual([]);
    });
  });
});
