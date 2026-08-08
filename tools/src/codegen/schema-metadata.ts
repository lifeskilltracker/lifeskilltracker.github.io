import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const schemaDir = path.join(repoRoot, 'schema');

const MAKING_DOMAIN_ID = 'making';

type EnumDef = { enum: readonly string[] };

function readSchema(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(schemaDir, relativePath), 'utf8')) as Record<
    string,
    unknown
  >;
}

function readCommonDef(defName: string): Record<string, unknown> {
  const common = readSchema('common.schema.json');
  const defs = common.$defs as Record<string, Record<string, unknown>>;
  return defs[defName] ?? {};
}

function readDefEnum(schemaFile: string, defName: string, property: string): readonly string[] {
  const schema = readSchema(schemaFile);
  const defs = schema.$defs as Record<string, Record<string, unknown>>;
  const def = defs[defName];
  if (!def) {
    throw new Error(`${schemaFile} missing $defs.${defName}`);
  }
  const properties = def.properties as Record<string, EnumDef>;
  const values = properties[property]?.enum;
  if (!values || values.length === 0) {
    throw new Error(`${schemaFile} $defs.${defName}.properties.${property}.enum is missing`);
  }
  return values;
}

function formatStringUnion(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(' | ');
}

export interface DomainIdSets {
  readonly all: readonly string[];
  readonly making: typeof MAKING_DOMAIN_ID;
  readonly nonMaking: readonly string[];
}

export function loadDomainIdSets(): DomainIdSets {
  const domainIdDef = readCommonDef('domainId') as EnumDef;
  const all = [...domainIdDef.enum];
  if (!all.includes(MAKING_DOMAIN_ID)) {
    throw new Error('common.schema.json domainId enum must include making');
  }
  const nonMaking = all.filter((id) => id !== MAKING_DOMAIN_ID);
  if (nonMaking.length === 0) {
    throw new Error('common.schema.json domainId enum must include non-making ids');
  }
  return { all, making: MAKING_DOMAIN_ID, nonMaking };
}

export function loadAuthoredRequirementGroupRules(): readonly string[] {
  return readDefEnum('tree.schema.json', 'requirementGroup', 'rule');
}

export function loadCompiledRequirementGroupRules(): readonly string[] {
  return readDefEnum('compiled-tree.schema.json', 'requirementGroup', 'rule');
}

const SUBREGION_SHAPE = `{
      id: 'expression' | 'objects' | 'systems';
      title: string;
    }`;

function buildMakingDomainInterface(name: string): string {
  return `export interface ${name} {
  id: 'making';
  title: string;
  blurb: string;
  palette: {
    base: string;
    accent: string;
  };
  subregions: [
    ${SUBREGION_SHAPE},
    ...${SUBREGION_SHAPE}[]
  ];
}`;
}

function buildNonMakingDomainInterface(name: string, idUnion: string): string {
  return `export interface ${name} {
  id: ${idUnion};
  title: string;
  blurb: string;
  palette: {
    base: string;
    accent: string;
  };
  subregions?: never;
}`;
}

export function buildAuthoredDomainFragment(domainIds: DomainIdSets): string {
  const domainIdUnion = formatStringUnion(domainIds.all);
  const nonMakingIdUnion = formatStringUnion(domainIds.nonMaking);
  return [
    `/** Locked content domain ids declared in common.schema.json (§5.9, F20). */`,
    `export type ContentDomainId = ${domainIdUnion};`,
    '',
    buildMakingDomainInterface('MakingDomain'),
    '',
    `export type ContentNonMakingDomainId = ${nonMakingIdUnion};`,
    '',
    buildNonMakingDomainInterface('NonMakingDomain', 'ContentNonMakingDomainId'),
    '',
    '/** Domain taxonomy entry. Runtime schema requires subregions iff id is making (§5.9). */',
    'export type Domain = MakingDomain | NonMakingDomain;',
  ].join('\n');
}

export function buildCompiledDomainFragment(domainIds: DomainIdSets): string {
  const domainIdUnion = formatStringUnion(domainIds.all);
  const nonMakingIdUnion = formatStringUnion(domainIds.nonMaking);
  return [
    `/** Locked content domain ids declared in common.schema.json (§5.9, F20). */`,
    `export type ContentDomainId = ${domainIdUnion};`,
    '',
    buildMakingDomainInterface('CompiledMakingDomain'),
    '',
    `export type ContentNonMakingDomainId = ${nonMakingIdUnion};`,
    '',
    buildNonMakingDomainInterface('CompiledNonMakingDomain', 'ContentNonMakingDomainId'),
    '',
    '/** Compiled domain taxonomy entry. Runtime schema requires subregions iff id is making (§5.9). */',
    'export type CompiledDomain = CompiledMakingDomain | CompiledNonMakingDomain;',
  ].join('\n');
}

function buildRequirementGroupFragment(
  rules: readonly string[],
  milestoneType: string,
): string {
  const variants = rules.map((rule) => {
    if (rule === 'n_of') {
      return `  | {
      rule: 'n_of';
      n: number;
      milestones: ${milestoneType};
    }`;
    }
    return `  | {
      rule: '${rule}';
      milestones: ${milestoneType};
      n?: never;
    }`;
  });

  return `export type RequirementGroup =\n${variants.join('\n')};`;
}

export function buildAuthoredRequirementGroupFragment(rules: readonly string[]): string {
  return buildRequirementGroupFragment(rules, 'string[]');
}

export function buildCompiledRequirementGroupFragment(rules: readonly string[]): string {
  return buildRequirementGroupFragment(rules, '[MilestoneRef, ...MilestoneRef[]]');
}

export interface GeneratedFragments {
  readonly authoredRequirementGroup: string;
  readonly compiledRequirementGroup: string;
  readonly authoredDomain: string;
  readonly compiledDomain: string;
}

export function buildFragmentsFromSchema(): GeneratedFragments {
  const domainIds = loadDomainIdSets();
  const authoredRules = loadAuthoredRequirementGroupRules();
  const compiledRules = loadCompiledRequirementGroupRules();

  return {
    authoredRequirementGroup: buildAuthoredRequirementGroupFragment(authoredRules),
    compiledRequirementGroup: buildCompiledRequirementGroupFragment(compiledRules),
    authoredDomain: buildAuthoredDomainFragment(domainIds),
    compiledDomain: buildCompiledDomainFragment(domainIds),
  };
}

function extractTypeAliasBody(fragment: string, name: string): string {
  const marker = `export type ${name} =`;
  const start = fragment.indexOf(marker);
  if (start === -1) {
    throw new Error(`fragment missing export type ${name}`);
  }
  const end = fragment.indexOf(';', start);
  return fragment.slice(start, end + 1);
}

export function assertFragmentsAlignedWithSchema(fragments: GeneratedFragments): void {
  const domainIds = loadDomainIdSets();
  const authoredRules = loadAuthoredRequirementGroupRules();
  const compiledRules = loadCompiledRequirementGroupRules();

  const authoredContentDomainIdAlias = extractTypeAliasBody(
    fragments.authoredDomain,
    'ContentDomainId',
  );
  for (const id of domainIds.all) {
    if (!authoredContentDomainIdAlias.includes(`'${id}'`)) {
      throw new Error(`authored ContentDomainId alias missing domain id '${id}' from schema enum`);
    }
  }

  const compiledContentDomainIdAlias = extractTypeAliasBody(
    fragments.compiledDomain,
    'ContentDomainId',
  );
  for (const id of domainIds.all) {
    if (!compiledContentDomainIdAlias.includes(`'${id}'`)) {
      throw new Error(`compiled ContentDomainId alias missing domain id '${id}' from schema enum`);
    }
  }

  const nonMakingAlias = extractTypeAliasBody(fragments.authoredDomain, 'ContentNonMakingDomainId');
  for (const id of domainIds.nonMaking) {
    if (!nonMakingAlias.includes(`'${id}'`)) {
      throw new Error(`ContentNonMakingDomainId missing '${id}' from schema enum`);
    }
  }

  const compiledNonMakingAlias = extractTypeAliasBody(
    fragments.compiledDomain,
    'ContentNonMakingDomainId',
  );
  for (const id of domainIds.nonMaking) {
    if (!compiledNonMakingAlias.includes(`'${id}'`)) {
      throw new Error(`compiled ContentNonMakingDomainId missing '${id}' from schema enum`);
    }
  }

  for (const rule of authoredRules) {
    if (!fragments.authoredRequirementGroup.includes(`rule: '${rule}'`)) {
      throw new Error(`authored RequirementGroup fragment missing rule '${rule}' from schema enum`);
    }
  }

  for (const rule of compiledRules) {
    if (!fragments.compiledRequirementGroup.includes(`rule: '${rule}'`)) {
      throw new Error(
        `compiled RequirementGroup fragment missing rule '${rule}' from schema enum`,
      );
    }
  }

  if (authoredRules.includes('n_of') && !fragments.authoredRequirementGroup.includes('n: number')) {
    throw new Error('authored RequirementGroup fragment missing n: number for n_of rule');
  }

  if (compiledRules.includes('n_of') && !fragments.compiledRequirementGroup.includes('n: number')) {
    throw new Error('compiled RequirementGroup fragment missing n: number for n_of rule');
  }
}
