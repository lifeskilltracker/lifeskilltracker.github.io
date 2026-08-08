import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateCommand, runValidate } from '../../src/validate/index.js';
import { EXIT_VALIDATION_FAILED } from '../../src/shared/exit-codes.js';
import {
  fixturePath,
  minimalValidTree,
  uidFor,
  writeTreeFixture,
} from '../testing/fixture-helpers.js';

const toolsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const compiledCliPath = path.join(toolsRoot, 'dist/cli.js');

const ALL_RULES_FIXTURES: Record<number, readonly string[]> = {
  1: ['rule-01-fail.yaml'],
  2: ['rule-02-a.yaml', 'rule-02-b.yaml'],
  3: ['rule-03-fail.yaml'],
  4: ['rule-04-fail.yaml'],
  5: ['rule-05-fail.yaml'],
  6: ['rule-06-fail.yaml'],
  7: ['rule-07-fail.yaml'],
  8: ['rule-08-fail.yaml'],
  9: ['rule-09-fail.yaml'],
  10: ['rule-10-fail.yaml'],
  11: ['rule-11-fail.yaml'],
  12: ['rule-12-fail.yaml'],
  13: ['rule-13-fail.yaml'],
  14: ['rule-14-fail.yaml'],
  15: ['rule-15-split-empty.yaml'],
  16: ['rule-16-fail.yaml'],
};

const RULE_15_FAIL_FIXTURES: Array<{ file: string; message: RegExp; shared: readonly string[] }> = [
  { file: 'rule-15-split-empty.yaml', message: /split requires at least 2/, shared: [] },
  { file: 'rule-15-split-one.yaml', message: /split requires at least 2/, shared: [] },
  { file: 'rule-15-merged-two.yaml', message: /merged requires exactly 1/, shared: [] },
  { file: 'rule-15-retired-into.yaml', message: /retired must not carry into/, shared: [] },
  { file: 'rule-15-moved-bare.yaml', message: /must be <treeId>\/<uid>/, shared: [] },
  { file: 'rule-15-moved-same-tree.yaml', message: /different tree/, shared: [] },
  { file: 'rule-15-moved-missing-tree.yaml', message: /does not exist/, shared: [] },
  { file: 'rule-15-moved-wrong-uid.yaml', message: /must equal the entry uid/, shared: ['dest-tree.yaml'] },
  { file: 'rule-15-moved-missing-live-head.yaml', message: /repository head/, shared: ['dest-tree.yaml'] },
  { file: 'rule-15-split-foreign-uid.yaml', message: /must name a milestone or mastery uid in this tree/, shared: ['dest-tree.yaml'] },
  { file: 'rule-15-merged-foreign-uid.yaml', message: /must name a milestone or mastery uid in this tree/, shared: ['dest-tree.yaml'] },
];

const RULE_15_PASS_FIXTURES: Array<{ file: string; shared: readonly string[] }> = [
  { file: 'rule-15-split-pass.yaml', shared: [] },
  { file: 'rule-15-moved-pass.yaml', shared: ['dest-tree.yaml'] },
];

function copyTreeFixtures(treesDir: string, files: readonly string[]): string[] {
  for (const name of files) {
    cpSync(fixturePath('trees', name), path.join(treesDir, name));
  }
  return files.map((name) => path.join(treesDir, name));
}

function argvForAllRules(treesDir: string, excludeRules: number[] = []): string[] {
  const files = Object.entries(ALL_RULES_FIXTURES)
    .filter(([rule]) => !excludeRules.includes(Number(rule)))
    .flatMap(([, names]) => names);
  return copyTreeFixtures(treesDir, files);
}

function issuesForRule(result: ReturnType<typeof runValidate>, rule: string) {
  return result.report.issues.filter((issue) => issue.rule === rule);
}

function exitRules(result: ReturnType<typeof runValidate>): Set<string> {
  return new Set(result.exitIssues.map((issue) => issue.rule).filter(Boolean) as string[]);
}

function withTempRepo(run: (repoRoot: string, treesDir: string) => void): void {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'lst-validate-'));
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

function swapMap(repoRoot: string, mapName: string): void {
  copyFileSync(
    fixturePath('maps', mapName),
    path.join(repoRoot, 'content/taxonomy/map.yaml'),
  );
}

describe('lst validate', () => {
  it('passes a schema-valid semantically-clean tree', () => {
    withTempRepo((repoRoot, treesDir) => {
      const treePath = writeTreeFixture(treesDir, 'clean.yaml', minimalValidTree({ id: 'clean' }));
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(result.exitIssues).toEqual([]);
    });
  });

  it('reports schema violations in the same pass as semantic rules', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'schema-only' }) as unknown as Record<string, unknown>;
      tree.xp = 1;
      const treePath = writeTreeFixture(treesDir, 'schema-only.yaml', tree as never);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'schema').length).toBeGreaterThan(0);
      expect(result.report.issues.every((issue) => issue.file === treePath)).toBe(true);
    });
  });

  it('rule 1 fails when levels are out of order', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-1-fail' });
      tree.levels[0].level = 2;
      const treePath = writeTreeFixture(treesDir, 'rule-1-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 1').length).toBeGreaterThan(0);
    });
  });

  it('rule 2 fails on duplicate uid across repository trees', () => {
    withTempRepo((repoRoot, treesDir) => {
      const treeA = minimalValidTree({ id: 'tree-a' });
      const treeB = minimalValidTree({ id: 'tree-b' });
      const sharedUid = treeA.levels[0].milestones[0].uid!;
      treeB.levels[0].milestones[0].uid = sharedUid;
      writeTreeFixture(treesDir, 'tree-a.yaml', treeA);
      const treePathB = writeTreeFixture(treesDir, 'tree-b.yaml', treeB);
      const result = runValidate({ repoRoot, files: [treePathB] });
      const rule2 = issuesForRule(result, 'rule 2');
      expect(rule2.length).toBeGreaterThan(0);
      expect(rule2.some((issue) => issue.message.includes(sharedUid))).toBe(true);
    });
  });

  it('rule 3 fails when requires target is missing', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-3-fail' });
      tree.levels[1].milestones[0].requires = ['missing-slug'];
      const treePath = writeTreeFixture(treesDir, 'rule-3-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 3').length).toBeGreaterThan(0);
    });
  });

  it('rule 4 fails on requires cycles', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-4-fail' });
      tree.levels[0].milestones[0].requires = [tree.levels[0].milestones[1].id];
      tree.levels[0].milestones[1].requires = [tree.levels[0].milestones[0].id];
      const treePath = writeTreeFixture(treesDir, 'rule-4-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 4').length).toBeGreaterThan(0);
    });
  });

  it('rule 5 fails when prerequisite level exceeds dependent', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-5-fail' });
      tree.levels[0].milestones[0].requires = [tree.levels[1].milestones[0].id];
      const treePath = writeTreeFixture(treesDir, 'rule-5-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 5').length).toBeGreaterThan(0);
    });
  });

  it('rule 6 fails when requirement group references another level', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-6-fail' });
      tree.levels[0].requirements = [{ rule: 'all', milestones: [tree.levels[1].milestones[0].id] }];
      const treePath = writeTreeFixture(treesDir, 'rule-6-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 6').length).toBeGreaterThan(0);
    });
  });

  it('rule 7 treats any like n_of 1 and rejects n >= set size', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-7-fail' });
      tree.levels[0].requirements = [
        { rule: 'n_of', n: 4, milestones: tree.levels[0].milestones.map((m: { id: string }) => m.id) },
      ];
      const treePath = writeTreeFixture(treesDir, 'rule-7-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 7').length).toBeGreaterThan(0);
    });
  });

  it('rule 8 fails when a milestone is not referenced by any requirement group', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-8-fail' });
      tree.levels[0].requirements = [{ rule: 'all', milestones: [tree.levels[0].milestones[0].id] }];
      const treePath = writeTreeFixture(treesDir, 'rule-8-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 8').length).toBeGreaterThan(0);
    });
  });

  it('rule 9 fails when track reference is undeclared', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-9-fail', tracks: [{ id: 'main', title: 'Main' }] });
      tree.levels[0].milestones[0].track = 'missing-track';
      const treePath = writeTreeFixture(treesDir, 'rule-9-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 9').length).toBeGreaterThan(0);
    });
  });

  it('rule 10 fails for unknown primary domain', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-10-unknown-domain', domain: 'not-a-domain' as never });
      const treePath = writeTreeFixture(treesDir, 'rule-10-unknown-domain.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(
        issuesForRule(result, 'rule 10').some((issue) => issue.message.includes('not-a-domain')),
      ).toBe(true);
    });
  });

  it('rule 10 fails when primary domain is repeated in secondaryDomains', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({
        id: 'rule-10-secondary-repeat',
        domain: 'home',
        secondaryDomains: ['home'],
      });
      const treePath = writeTreeFixture(treesDir, 'rule-10-secondary-repeat.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(
        issuesForRule(result, 'rule 10').some((issue) => issue.message.includes('must not appear in secondaryDomains')),
      ).toBe(true);
    });
  });

  it('rule 11 fails when making lacks subregion', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-11-fail', domain: 'making' });
      delete tree.subregion;
      const treePath = writeTreeFixture(treesDir, 'rule-11-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 11').length).toBeGreaterThan(0);
    });
  });

  it('rule 12 fails when facet is unknown', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-12-fail', facets: ['missing-facet'] });
      const treePath = writeTreeFixture(treesDir, 'rule-12-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 12').length).toBeGreaterThan(0);
    });
  });

  it('rule 13 fails when copyleftDerived is absent and passes when false', () => {
    withTempRepo((repoRoot, treesDir) => {
      const fail = minimalValidTree({ id: 'rule-13-fail' });
      delete fail.provenance.copyleftDerived;
      const failPath = writeTreeFixture(treesDir, 'rule-13-fail.yaml', fail);
      const failReport = runValidate({ repoRoot, files: [failPath] });
      expect(issuesForRule(failReport, 'rule 13').length).toBeGreaterThan(0);

      const pass = minimalValidTree({ id: 'rule-13-pass' });
      pass.provenance.copyleftDerived = false;
      const passPath = writeTreeFixture(treesDir, 'rule-13-pass.yaml', pass);
      const passReport = runValidate({ repoRoot, files: [passPath] });
      expect(issuesForRule(passReport, 'rule 13')).toEqual([]);
    });
  });

  it('rule 14 fails when mastery carries forbidden layout fields', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-14-fail' });
      tree.mastery = [
        {
          id: 'mastery-a',
          uid: uidFor(100),
          title: 'Mastery',
          track: 'main',
        } as never,
      ];
      const treePath = writeTreeFixture(treesDir, 'rule-14-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 14').length).toBeGreaterThan(0);
    });
  });

  it('rule 16 fails when uid is missing and prints slugs', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-16-fail' });
      delete tree.levels[0].milestones[0].uid;
      const treePath = writeTreeFixture(treesDir, 'rule-16-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      const rule16 = issuesForRule(result, 'rule 16');
      expect(rule16.length).toBeGreaterThan(0);
      expect(rule16.some((issue) => issue.message.includes('l1-m1'))).toBe(true);
    });
  });

  describe('rule 15 on-disk fixtures', () => {
    it.each(RULE_15_FAIL_FIXTURES)('$file fails rule 15 only', ({ file, message, shared }) => {
      withTempRepo((repoRoot, treesDir) => {
        const paths = copyTreeFixtures(treesDir, [...shared, file]);
        const treePath = paths[paths.length - 1];
        const result = runValidate({ repoRoot, files: [treePath] });
        const rule15 = issuesForRule(result, 'rule 15');
        expect(rule15.map((issue) => issue.message).join('\n')).toMatch(message);
        expect(issuesForRule(result, 'rule 2')).toEqual([]);
      });
    });

    it.each(RULE_15_PASS_FIXTURES)('$file passes rule 15', ({ file, shared }) => {
      withTempRepo((repoRoot, treesDir) => {
        const paths = copyTreeFixtures(treesDir, [...shared, file]);
        const treePath = paths[paths.length - 1];
        const result = runValidate({ repoRoot, files: [treePath] });
        expect(issuesForRule(result, 'rule 15')).toEqual([]);
      });
    });
  });

  describe('map rules M1–M5', () => {
    it('runs map rules when only a tree file is passed', () => {
      withTempRepo((repoRoot, treesDir) => {
        swapMap(repoRoot, 'map-m1-fail.yaml');
        const treePath = writeTreeFixture(treesDir, 'one-tree.yaml', minimalValidTree({ id: 'one-tree' }));
        const result = runValidate({ repoRoot, files: [treePath] });
        expect(issuesForRule(result, 'M1').length).toBeGreaterThan(0);
      });
    });

    it.each([
      ['map-m1-fail.yaml', 'M1'],
      ['map-m2-fail.yaml', 'M2'],
      ['map-m3-fail.yaml', 'M3'],
      ['map-m4-fail.yaml', 'M4'],
      ['map-m5-fail.yaml', 'M5'],
    ])('%s fails %s', (mapFile, rule) => {
      withTempRepo((repoRoot, treesDir) => {
        swapMap(repoRoot, mapFile);
        const treePath = writeTreeFixture(treesDir, 'map-check.yaml', minimalValidTree({ id: 'map-check' }));
        const result = runValidate({ repoRoot, files: [treePath] });
        expect(issuesForRule(result, rule).length).toBeGreaterThan(0);
      });
    });

    it('map-m3-ring-pass.yaml passes M3 contiguity', () => {
      withTempRepo((repoRoot, treesDir) => {
        swapMap(repoRoot, 'map-m3-ring-pass.yaml');
        const treePath = writeTreeFixture(treesDir, 'ring-pass.yaml', minimalValidTree({ id: 'ring-pass' }));
        const result = runValidate({ repoRoot, files: [treePath] });
        expect(issuesForRule(result, 'M3')).toEqual([]);
      });
    });
  });

  it('accumulates multiple semantic violations in one pass', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'multi-fail', domain: 'making' });
      delete tree.subregion;
      delete tree.provenance.copyleftDerived;
      delete tree.levels[0].milestones[0].uid;
      tree.levels[0].milestones[0].requires = ['missing'];
      tree.levels[0].requirements = [{ rule: 'all', milestones: [tree.levels[0].milestones[0].id] }];
      tree.levels[0].level = 2;
      tree.facets = ['missing-facet'];
      const treePath = writeTreeFixture(treesDir, 'multi-fail.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      const rules = new Set(result.report.issues.map((issue) => issue.rule));
      expect(rules.has('rule 1')).toBe(true);
      expect(rules.has('rule 3')).toBe(true);
      expect(rules.has('rule 8')).toBe(true);
      expect(rules.has('rule 11')).toBe(true);
      expect(rules.has('rule 12')).toBe(true);
      expect(rules.has('rule 13')).toBe(true);
      expect(rules.has('rule 16')).toBe(true);
      expect(result.report.issues.every((issue) => issue.line >= 1 && issue.column >= 1)).toBe(true);
    });
  });

  it('rule 9 fails when track is used without any tracks declaration', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'rule-9-no-tracks-decl' });
      tree.levels[0].milestones[0].track = 'main';
      const treePath = writeTreeFixture(treesDir, 'rule-9-no-tracks-decl.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 9').length).toBeGreaterThan(0);
    });
  });

  it('does not validate module labels — module is a free-form presentation field', () => {
    withTempRepo((repoRoot, treesDir) => {
      const tree = minimalValidTree({ id: 'module-label-only', archetype: 'modular' });
      tree.levels[0].milestones[0].module = 'any-label';
      const treePath = writeTreeFixture(treesDir, 'module-label-only.yaml', tree);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(issuesForRule(result, 'rule 9')).toEqual([]);
    });
  });

  it('rules 3–5 validate mastery requires targets and cycles', () => {
    withTempRepo((repoRoot, treesDir) => {
      const pass = minimalValidTree({ id: 'mastery-requires-pass' });
      pass.mastery = [
        {
          id: 'capstone',
          uid: uidFor(200),
          title: 'Capstone',
          requires: [pass.levels[9].milestones[0].id],
        },
      ];
      const passPath = writeTreeFixture(treesDir, 'mastery-requires-pass.yaml', pass);
      expect(issuesForRule(runValidate({ repoRoot, files: [passPath] }), 'rule 3')).toEqual([]);

      const fail = minimalValidTree({ id: 'mastery-requires-fail' });
      fail.mastery = [{ id: 'capstone', uid: uidFor(201), title: 'Capstone', requires: ['missing'] }];
      const failPath = writeTreeFixture(treesDir, 'mastery-requires-fail.yaml', fail);
      expect(issuesForRule(runValidate({ repoRoot, files: [failPath] }), 'rule 3').length).toBeGreaterThan(0);

      const cycle = minimalValidTree({ id: 'mastery-cycle-fail' });
      cycle.mastery = [
        { id: 'cap-a', uid: uidFor(202), title: 'A', requires: ['cap-b'] },
        { id: 'cap-b', uid: uidFor(203), title: 'B', requires: ['cap-a'] },
      ];
      const cyclePath = writeTreeFixture(treesDir, 'mastery-cycle-fail.yaml', cycle);
      expect(issuesForRule(runValidate({ repoRoot, files: [cyclePath] }), 'rule 4').length).toBeGreaterThan(0);
    });
  });

  it('reports exact line and column for representative errors', () => {
    withTempRepo((repoRoot, treesDir) => {
      cpSync(fixturePath('trees/rule-01-fail.yaml'), path.join(treesDir, 'rule-01-fail.yaml'));
      const treePath = path.join(treesDir, 'rule-01-fail.yaml');
      const lines = readFileSync(treePath, 'utf8').split('\n');
      const levelLine = lines.findIndex((line) => /^\s+- level: 2/.test(line)) + 1;
      const levelLineText = lines[levelLine - 1];
      const levelValueColumn = levelLineText.indexOf('2', levelLineText.indexOf('level')) + 1;
      expect(levelLine).toBeGreaterThan(1);
      expect(levelValueColumn).toBeGreaterThan(1);

      const result = runValidate({ repoRoot, files: [treePath] });
      const schemaIssue = result.report.issues.find((issue) => issue.rule === 'schema');
      const rule1Issue = issuesForRule(result, 'rule 1').find((issue) =>
        issue.message.includes('expected level 1'),
      );
      expect(schemaIssue?.line).toBe(levelLine);
      expect(schemaIssue?.column).toBe(levelValueColumn);
      expect(rule1Issue?.line).toBe(levelLine);
      expect(rule1Issue?.column).toBe(levelValueColumn);
      expect(rule1Issue?.line).not.toBe(1);
    });
  });

  it('validateCommand exits 1 when map geometry fails but argv lists only a tree', () => {
    withTempRepo((repoRoot, treesDir) => {
      swapMap(repoRoot, 'map-m1-fail.yaml');
      const treePath = writeTreeFixture(treesDir, 'one-tree.yaml', minimalValidTree({ id: 'one-tree' }));
      expect(validateCommand([treePath], repoRoot)).toBe(EXIT_VALIDATION_FAILED);
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(result.exitIssues.some((issue) => issue.rule === 'M1')).toBe(true);
    });
  });

  it('validateCommand validates taxonomy argv without loading map as tree', () => {
    withTempRepo((repoRoot) => {
      swapMap(repoRoot, 'map-m2-fail.yaml');
      const mapPath = path.join(repoRoot, 'content/taxonomy/map.yaml');
      expect(validateCommand([mapPath], repoRoot)).toBe(EXIT_VALIDATION_FAILED);
      const result = runValidate({ repoRoot, files: [mapPath] });
      expect(result.exitIssues.some((issue) => issue.rule === 'M2')).toBe(true);
      expect(result.ctx.treeDocuments.size).toBe(0);
    });
  });

  it.each(Object.entries(ALL_RULES_FIXTURES))(
    'controlled fixture for rule %i is attributable and does not incidentally trigger rule 2',
    (ruleNumStr, files) => {
      const ruleNum = Number(ruleNumStr);
      withTempRepo((repoRoot, treesDir) => {
        const paths = copyTreeFixtures(treesDir, files);
        const result = runValidate({ repoRoot, files: paths });
        const rules = exitRules(result);
        expect(rules.has(`rule ${ruleNum}`), `expected rule ${ruleNum}`).toBe(true);
        if (ruleNum !== 2) {
          expect(rules.has('rule 2')).toBe(false);
        }
      });
    },
  );

  it('validateCommand surfaces all semantic rules 1–16 through exit filtering', () => {
    withTempRepo((repoRoot, treesDir) => {
      swapMap(repoRoot, 'map-m1-fail.yaml');
      const argv = argvForAllRules(treesDir);
      expect(validateCommand(argv, repoRoot)).toBe(EXIT_VALIDATION_FAILED);
      const result = runValidate({ repoRoot, files: argv });
      const rules = exitRules(result);
      for (let rule = 1; rule <= 16; rule += 1) {
        expect(rules.has(`rule ${rule}`), `expected rule ${rule}`).toBe(true);
      }
    });
  });

  it('all-rules aggregate loses rule 2 when rule-02 fixtures are omitted', () => {
    withTempRepo((repoRoot, treesDir) => {
      const argv = argvForAllRules(treesDir, [2]);
      const result = runValidate({ repoRoot, files: argv });
      const rules = exitRules(result);
      expect(rules.has('rule 2')).toBe(false);
      for (let rule = 1; rule <= 16; rule += 1) {
        if (rule === 2) {
          continue;
        }
        expect(rules.has(`rule ${rule}`), `expected rule ${rule}`).toBe(true);
      }
    });
  });

  it('CLI validate mirrors validateCommand exit filtering for broken map', () => {
    withTempRepo((repoRoot, treesDir) => {
      swapMap(repoRoot, 'map-m1-fail.yaml');
      const treePath = writeTreeFixture(treesDir, 'cli-tree.yaml', minimalValidTree({ id: 'cli-tree' }));
      const relativeTree = path.relative(repoRoot, treePath);
      const result = spawnSync(process.execPath, [compiledCliPath, 'validate', relativeTree], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, LST_REPO_ROOT: repoRoot },
      });
      expect(result.status).toBe(EXIT_VALIDATION_FAILED);
      expect(result.stderr).toContain('[M1]');
    });
  });

  it.each([
    ['rule-01-pass.yaml', false],
    ['rule-01-fail.yaml', true],
    ['rule-03-pass.yaml', false],
    ['rule-03-fail.yaml', true],
    ['rule-15-split-empty.yaml', true],
    ['rule-15-split-pass.yaml', false],
    ['rule-15-moved-pass.yaml', false],
  ])('on-disk fixture %s expected failure=%s', (fixtureName, shouldFail) => {
    withTempRepo((repoRoot, treesDir) => {
      if (fixtureName.startsWith('rule-02')) {
        copyTreeFixtures(treesDir, ['rule-02-a.yaml', fixtureName]);
      } else if (fixtureName.startsWith('rule-15-moved')) {
        copyTreeFixtures(treesDir, ['dest-tree.yaml', fixtureName]);
      } else {
        copyTreeFixtures(treesDir, [fixtureName]);
      }
      const treePath = path.join(treesDir, fixtureName);
      const exit = validateCommand([treePath], repoRoot);
      expect(exit === EXIT_VALIDATION_FAILED).toBe(shouldFail);
    });
  });
});

describe('fixture repo validate files', () => {
  it('validates against bundled fixture taxonomy without errors for clean tree', () => {
    withTempRepo((repoRoot, treesDir) => {
      const treePath = writeTreeFixture(treesDir, 'rule-01-pass.yaml', minimalValidTree({ id: 'rule-01-pass' }));
      const result = runValidate({ repoRoot, files: [treePath] });
      expect(result.exitIssues).toEqual([]);
    });
  });
});
