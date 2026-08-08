import { describe, expect, it } from 'vitest';

import {
  assertFragmentsAlignedWithSchema,
  buildAuthoredDomainFragment,
  buildFragmentsFromSchema,
  loadAuthoredRequirementGroupRules,
  loadCompiledRequirementGroupRules,
  loadDomainIdSets,
} from './schema-metadata.js';

describe('schema-metadata', () => {
  it('loads the eight locked domain ids from common.schema.json', () => {
    const ids = loadDomainIdSets();
    expect(ids.all).toHaveLength(8);
    expect(ids.all).toContain('making');
    expect(ids.nonMaking).toEqual(
      expect.arrayContaining([
        'mind',
        'body',
        'home',
        'people',
        'work-money',
        'play',
        'outdoors-nature',
      ]),
    );
    expect(ids.nonMaking).not.toContain('making');
  });

  it('derives requirement-group rules from tree and compiled-tree schemas', () => {
    expect(loadAuthoredRequirementGroupRules()).toEqual(['all', 'n_of', 'any']);
    expect(loadCompiledRequirementGroupRules()).toEqual(['all', 'n_of']);
  });

  it('builds domain fragments containing every schema domain id', () => {
    const ids = loadDomainIdSets();
    const authored = buildAuthoredDomainFragment(ids);
    for (const id of ids.all) {
      expect(authored).toContain(`'${id}'`);
    }
    expect(authored).toContain('export type ContentNonMakingDomainId =');
    expect(authored).not.toContain('id: string;');
    expect(authored).not.toContain('export type DomainId =');
  });

  it('fails fragment/schema sync when a domain id is missing from generated fragments', () => {
    const fragments = buildFragmentsFromSchema();
    expect(() => assertFragmentsAlignedWithSchema(fragments)).not.toThrow();

    const broken = {
      ...fragments,
      authoredDomain: fragments.authoredDomain.replace(
        /export type ContentNonMakingDomainId =[\s\S]*?;/,
        "export type ContentNonMakingDomainId = 'body' | 'home';",
      ),
    };
    expect(() => assertFragmentsAlignedWithSchema(broken)).toThrow(
      /ContentNonMakingDomainId missing 'mind'/,
    );
  });

  it('fails fragment/schema sync when an authored requirement rule is missing', () => {
    const fragments = buildFragmentsFromSchema();
    const broken = {
      ...fragments,
      authoredRequirementGroup: fragments.authoredRequirementGroup.replace("rule: 'any'", ''),
    };
    expect(() => assertFragmentsAlignedWithSchema(broken)).toThrow(/missing rule 'any'/);
  });
});
