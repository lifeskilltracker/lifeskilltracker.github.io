import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { newCommand, runNew } from '../../src/new/index.js';
import { renderTreeScaffold } from '../../src/new/template.js';
import { runValidate } from '../../src/validate/index.js';
import { withTempContentRepo } from '../testing/fixture-helpers.js';

describe('lst new — the §5.3 scaffold', () => {
  it('writes content/trees/<id>.yaml with the id from the argument', () => {
    withTempContentRepo('new', (repoRoot, treesDir) => {
      const created = runNew({ id: 'demo-skill', repoRoot });
      expect(created.path).toBe(path.join(treesDir, 'demo-skill.yaml'));
      expect(readFileSync(created.path, 'utf8')).toContain('id: demo-skill');
    });
  });

  it('emits no uid lines — `lst ids` is the next authoring step (§5.4)', () => {
    expect(renderTreeScaffold('demo-skill')).not.toMatch(/^\s*uid:/m);
  });

  it('passes lst validate Layer 1 as written', () => {
    withTempContentRepo('new-validate', (repoRoot) => {
      const created = runNew({ id: 'demo-skill', repoRoot });
      const schemaIssues = runValidate({ repoRoot, files: [created.path] }).report.issues.filter(
        (issue) => issue.rule === 'schema',
      );
      expect(schemaIssues).toEqual([]);
    });
  });

  it('fails rule 16 until `lst ids` has run — the scaffold is a draft, not a tree', () => {
    withTempContentRepo('new-rule16', (repoRoot) => {
      const created = runNew({ id: 'demo-skill', repoRoot });
      const issues = runValidate({ repoRoot, files: [created.path] }).exitIssues;
      expect(issues.some((issue) => issue.rule === 'rule 16')).toBe(true);
    });
  });

  it('titles the tree from its id', () => {
    expect(renderTreeScaffold('demo-skill')).toContain('title: Demo Skill');
  });

  it('lays out ten levels', () => {
    const scaffold = renderTreeScaffold('demo-skill');
    for (let level = 1; level <= 10; level += 1) {
      expect(scaffold).toContain(`- level: ${level}`);
    }
  });
});

describe('lst new — refusals', () => {
  it('refuses to overwrite an existing tree', () => {
    withTempContentRepo('new-clobber', (repoRoot, treesDir) => {
      const existing = path.join(treesDir, 'demo-skill.yaml');
      writeFileSync(existing, 'do not lose me\n', 'utf8');
      expect(newCommand('demo-skill', repoRoot)).not.toBe(0);
      expect(readFileSync(existing, 'utf8')).toBe('do not lose me\n');
    });
  });

  it('refuses an id that is not a slug', () => {
    withTempContentRepo('new-badslug', (repoRoot) => {
      expect(newCommand('Demo Skill', repoRoot)).not.toBe(0);
    });
  });

  it('exits 0 on a fresh id', () => {
    withTempContentRepo('new-ok', (repoRoot) => {
      expect(newCommand('demo-skill', repoRoot)).toBe(0);
    });
  });
});
