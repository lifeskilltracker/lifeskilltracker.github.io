import { describe, expect, it } from 'vitest';

import {
  compileSchema,
  createValidator,
  loadJsonFixture,
  loadSchema,
  loadYamlFixture,
  validateFixture,
} from './load-schemas.js';

const SCHEMA_FILES = [
  'tree.schema.json',
  'domains.schema.json',
  'facets.schema.json',
  'map.schema.json',
  'export.schema.json',
  'compiled-tree.schema.json',
  'manifest.schema.json',
] as const;

describe('schema contracts (T02)', () => {
  describe('schema documents load under Ajv', () => {
    it.each(SCHEMA_FILES)('%s is valid JSON Schema and compiles', (file) => {
      const ajv = createValidator();
      expect(() => compileSchema(ajv, file)).not.toThrow();
    });
  });

  describe('tree.schema.json', () => {
    const ajv = createValidator();
    const validate = compileSchema(ajv, 'tree.schema.json');

    it('accepts a fixture exercising every §5.3 feature', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-valid-full.json');
      expect(validateFixture(validate, tree)).toBe(true);
    });

    it('accepts a tree with no uid lines at all', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-no-uids.json');
      expect(validateFixture(validate, tree)).toBe(true);
    });

    it('rejects nine levels', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-nine-levels.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects eleven levels', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-eleven-levels.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects levels out of order', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-levels-out-of-order.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects three milestones on a level', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-three-milestones.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects nine milestones on a level', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-nine-milestones.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it.each(['xp', 'points', 'weight', 'difficulty'] as const)(
      'rejects effort field %s via additionalProperties',
      (field) => {
        const tree = loadJsonFixture(`tools/test/fixtures/schema/tree-effort-${field}.json`);
        expect(validateFixture(validate, tree)).toBe(false);
      },
    );

    it('rejects making domain without subregion', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-making-no-subregion.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects subregion on a non-making domain', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-non-making-subregion.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects mastery entry with level field', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-mastery-level.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects mastery entry with track field', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-mastery-track.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects mastery entry with order field', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-mastery-order.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects n_of group without n', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-n-of-without-n.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects any group carrying n (§5.6: n belongs only to n_of)', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-any-with-n.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('accepts milestone aliases and detail fields', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-valid-full.json');
      const level1 = (tree as { levels: Array<{ milestones: Array<{ aliases?: string[]; detail?: string }> }> }).levels[0];
      expect(level1.milestones[0]?.aliases).toEqual(['light-forge']);
      expect(level1.milestones[0]?.detail).toContain('forge');
      expect(validateFixture(validate, tree)).toBe(true);
    });

    it('rejects provenance missing copyleftDerived', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/tree-no-copyleft.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });
  });

  describe('export.schema.json', () => {
    const ajv = createValidator();
    const validate = compileSchema(ajv, 'export.schema.json');

    it('accepts milestone with unknown photo key (§12.8 reservation)', () => {
      const file = loadJsonFixture('tools/test/fixtures/schema/export-photo-tolerance.json');
      expect(validateFixture(validate, file)).toBe(true);
    });

    it('requires lastActivityAt on every skills[] entry', () => {
      const file = loadJsonFixture('tools/test/fixtures/schema/export-missing-last-activity.json');
      expect(validateFixture(validate, file)).toBe(false);
    });

    it('requires contentVersionSeen on every skills[] entry', () => {
      const file = loadJsonFixture('tools/test/fixtures/schema/export-missing-content-version-seen.json');
      expect(validateFixture(validate, file)).toBe(false);
    });

    it('requires contentVersion on every milestones[] entry', () => {
      const file = loadJsonFixture('tools/test/fixtures/schema/export-missing-milestone-content-version.json');
      expect(validateFixture(validate, file)).toBe(false);
    });
  });

  describe('compiled-tree.schema.json', () => {
    const ajv = createValidator();
    const validate = compileSchema(ajv, 'compiled-tree.schema.json');

    it('accepts a full compiled fixture with materialized fields', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/compiled-tree-valid-full.json');
      expect(validateFixture(validate, tree)).toBe(true);
    });

    it('accepts mastery requires referencing milestones and achievements (§5.7)', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/compiled-tree-valid-full.json') as {
        mastery?: Array<{ requires?: Array<{ kind: string }> }>;
      };
      const kinds = new Set(tree.mastery?.flatMap((m) => m.requires?.map((r) => r.kind) ?? []));
      expect(kinds.has('milestone')).toBe(true);
      expect(kinds.has('achievement')).toBe(true);
    });

    it('rejects compiled milestone missing uid', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/compiled-tree-missing-uid.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });

    it('rejects compiled mastery entry missing uid', () => {
      const tree = loadJsonFixture('tools/test/fixtures/schema/compiled-tree-mastery-missing-uid.json');
      expect(validateFixture(validate, tree)).toBe(false);
    });
  });

  describe('domains.schema.json', () => {
    const ajv = createValidator();
    const validate = compileSchema(ajv, 'domains.schema.json');

    it('rejects subregions on a non-making domain', () => {
      const domains = loadJsonFixture('tools/test/fixtures/schema/domains-non-making-subregions.json');
      expect(validateFixture(validate, domains)).toBe(false);
    });

    it('rejects an unknown domain id outside the locked enum', () => {
      const domains = loadJsonFixture('tools/test/fixtures/schema/domains-invalid-id.json');
      expect(validateFixture(validate, domains)).toBe(false);
    });
  });

  describe('manifest.schema.json', () => {
    const ajv = createValidator();
    const validate = compileSchema(ajv, 'manifest.schema.json');

    it('requires the moved object', () => {
      const manifest = loadJsonFixture('tools/test/fixtures/schema/manifest-missing-moved.json');
      expect(validateFixture(validate, manifest)).toBe(false);
    });

    it('accepts an empty moved map', () => {
      const manifest = loadJsonFixture('tools/test/fixtures/schema/manifest-empty-moved.json');
      expect(validateFixture(validate, manifest)).toBe(true);
    });

    it('accepts a full manifest fixture with taxonomy and moved index', () => {
      const manifest = loadJsonFixture('tools/test/fixtures/schema/manifest-valid-full.json');
      expect(validateFixture(validate, manifest)).toBe(true);
    });
  });

  describe('seed taxonomy YAML', () => {
    const ajv = createValidator();
    const validateDomains = compileSchema(ajv, 'domains.schema.json');
    const validateFacets = compileSchema(ajv, 'facets.schema.json');

    it('validates content/taxonomy/domains.yaml with eight domains', () => {
      const domains = loadYamlFixture('content/taxonomy/domains.yaml');
      expect(validateFixture(validateDomains, domains)).toBe(true);
      expect((domains as { domains: unknown[] }).domains).toHaveLength(8);
    });

    it('declares subregions only on making', () => {
      const domains = loadYamlFixture<{ domains: Array<{ id: string; subregions?: unknown[] }> }>(
        'content/taxonomy/domains.yaml',
      );
      const withSubregions = domains.domains.filter((d) => d.subregions !== undefined);
      expect(withSubregions).toHaveLength(1);
      expect(withSubregions[0]?.id).toBe('making');
    });

    it('validates content/taxonomy/facets.yaml', () => {
      const facets = loadYamlFixture('content/taxonomy/facets.yaml');
      expect(validateFixture(validateFacets, facets)).toBe(true);
    });
  });

  describe('schema directory inventory', () => {
    it('contains all seven T02 schema files', () => {
      for (const file of SCHEMA_FILES) {
        expect(() => loadSchema(file)).not.toThrow();
      }
    });
  });
});
