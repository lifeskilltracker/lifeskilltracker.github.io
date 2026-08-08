/** Deterministic post-processing for json-schema-to-typescript output. */

import {
  extractClosedIntersectionBody,
  findExportDeclaration,
  getExportDeclarationText,
  hasOpenIndexSignature,
  replaceExportDeclaration,
} from './declarations.js';
import { AXIAL_TILE, COMPILED_MASTERY_REQUIRES_REF } from './fragments.js';
import type { GeneratedFragments } from './schema-metadata.js';

function levelBodyNameFor(file: 'authored' | 'compiled'): string {
  return file === 'authored' ? 'AuthoredLevel' : 'CompiledLevel';
}

function assertDeclarationClosed(content: string, name: string, label: string): void {
  const text = getExportDeclarationText(content, name);
  if (!text) {
    throw new Error(`${label}: missing export declaration "${name}"`);
  }
  if (hasOpenIndexSignature(text)) {
    throw new Error(`${label}: "${name}" still contains an open index signature`);
  }
}

function convertOpenRootToInterface(content: string, rootName: string): string {
  const text = getExportDeclarationText(content, rootName);
  if (!text) return content;

  if (text.startsWith('export interface')) {
    if (hasOpenIndexSignature(text)) {
      throw new Error(`${rootName} interface still contains an open index signature`);
    }
    return content;
  }

  const body = extractClosedIntersectionBody(text);
  if (!body) {
    if (hasOpenIndexSignature(text)) {
      throw new Error(`${rootName} type alias still contains an open index signature`);
    }
    return content;
  }

  return replaceExportDeclaration(content, rootName, `export interface ${rootName} {\n  ${body}\n}`);
}

function fixLevelTuple(content: string, levelBodyName: string): string {
  const tupleBody = Array.from({ length: 10 }, (_, index) => {
    const level = index + 1;
    return `${levelBodyName} & { level: ${level} }`;
  }).join(',\n  ');

  return replaceExportDeclaration(
    content,
    'Levels',
    `export type Levels = [\n  ${tupleBody}\n];`,
  );
}

function fixAxialTile(content: string): string {
  if (!findExportDeclaration(content, 'AxialTile')) {
    return content;
  }
  return replaceExportDeclaration(content, 'AxialTile', AXIAL_TILE);
}

function fixMovedIndex(content: string): string {
  return content.replace(
    /moved: \{\s*\[k: string\]: string \| undefined;\s*\};/g,
    'moved: Record<string, string>;',
  );
}

function fixGrandfatheredIndex(content: string): string {
  return content.replace(
    /grandfathered: \{\s*\[k: string\]: FrozenSatisfaction \| undefined;\s*\};/g,
    'grandfathered: Record<string, FrozenSatisfaction>;',
  );
}

function fixCompiledUidComments(content: string): string {
  const compiledUidComment =
    'Immutable Crockford base32 identifier; required in compiled output (§5.4).';

  for (const name of ['CompiledMilestone', 'MasteryEntry'] as const) {
    const text = getExportDeclarationText(content, name);
    if (!text) continue;
    const next = text.replace(
      /Immutable Crockford base32 identifier; optional at authoring time \(§5\.4\)\./g,
      compiledUidComment,
    );
    content = replaceExportDeclaration(content, name, next);
  }

  return content;
}

function injectClosedTypes(
  content: string,
  replacements: ReadonlyArray<{ name: string; fragment: string }>,
): string {
  let next = content;
  for (const { name, fragment } of replacements) {
    if (!findExportDeclaration(next, name)) {
      throw new Error(`expected export declaration "${name}" missing before injection`);
    }
    next = replaceExportDeclaration(next, name, fragment);
  }
  return next;
}

export function postprocessAuthored(content: string, fragments: GeneratedFragments): string {
  let next = convertOpenRootToInterface(content, 'Tree');
  next = fixLevelTuple(next, levelBodyNameFor('authored'));
  next = fixAxialTile(next);
  next = fixGrandfatheredIndex(next);
  next = injectClosedTypes(next, [
    { name: 'RequirementGroup', fragment: fragments.authoredRequirementGroup },
    { name: 'Domain', fragment: fragments.authoredDomain },
  ]);
  return next;
}

export function postprocessCompiled(content: string, fragments: GeneratedFragments): string {
  let next = convertOpenRootToInterface(content, 'CompiledTree');
  next = fixLevelTuple(next, levelBodyNameFor('compiled'));
  next = fixMovedIndex(next);
  next = fixCompiledUidComments(next);

  if (findExportDeclaration(next, 'MasteryRequiresRef')) {
    next = replaceExportDeclaration(next, 'MasteryRequiresRef', COMPILED_MASTERY_REQUIRES_REF);
  }

  next = injectClosedTypes(next, [
    { name: 'RequirementGroup', fragment: fragments.compiledRequirementGroup },
    { name: 'CompiledDomain', fragment: fragments.compiledDomain },
  ]);

  return next;
}

export interface QualityExpectations {
  readonly roots: readonly string[];
  readonly closedAliases: readonly string[];
  readonly requiredFragments: ReadonlyArray<{ readonly name: string; readonly needle: string }>;
}

export function createAuthoredQuality(domainIds: readonly string[]): QualityExpectations {
  return {
    roots: ['Tree'],
    closedAliases: [
      'RequirementGroup',
      'Domain',
      'ContentDomainId',
      'MakingDomain',
      'NonMakingDomain',
      'ContentNonMakingDomainId',
    ],
    requiredFragments: [
      { name: 'Tree', needle: 'levels: Levels' },
      { name: 'RequirementGroup', needle: "rule: 'all'" },
      { name: 'RequirementGroup', needle: "rule: 'n_of'" },
      { name: 'Domain', needle: 'MakingDomain' },
      { name: 'ContentDomainId', needle: `'${domainIds[0]}'` },
      { name: 'ContentNonMakingDomainId', needle: `'mind'` },
      { name: 'ExportFileDocument', needle: 'skills:' },
      { name: 'SkillRow', needle: 'lastActivityAt:' },
      { name: 'SkillRow', needle: 'contentVersionSeen:' },
      { name: 'MilestoneRow', needle: 'contentVersion:' },
      { name: 'MilestoneRow', needle: '[k: string]:' },
    ],
  };
}

export function createCompiledQuality(domainIds: readonly string[]): QualityExpectations {
  return {
    roots: ['CompiledTree'],
    closedAliases: [
      'RequirementGroup',
      'CompiledDomain',
      'ContentDomainId',
      'CompiledMakingDomain',
      'CompiledNonMakingDomain',
      'ContentNonMakingDomainId',
    ],
    requiredFragments: [
      { name: 'CompiledTree', needle: 'milestones:' },
      { name: 'CompiledMilestone', needle: 'uid: string' },
      { name: 'MasteryEntry', needle: 'uid: string' },
      { name: 'MasteryRequiresRef', needle: 'CompiledTree.milestones when kind is milestone' },
      { name: 'RequirementGroup', needle: "rule: 'n_of'" },
      { name: 'CompiledDomain', needle: 'CompiledMakingDomain' },
      { name: 'ContentDomainId', needle: `'${domainIds[0]}'` },
      { name: 'ContentNonMakingDomainId', needle: `'mind'` },
    ],
  };
}

function assertRequiredFragments(
  content: string,
  label: string,
  fragments: QualityExpectations['requiredFragments'],
): void {
  for (const { name, needle } of fragments) {
    const text = getExportDeclarationText(content, name);
    if (!text?.includes(needle)) {
      throw new Error(`${label}: "${name}" missing required fragment "${needle}"`);
    }
  }
}

export function assertGeneratedQuality(
  content: string,
  label: string,
  expectations: QualityExpectations,
): void {
  if (content.includes('= never[]')) {
    throw new Error(`${label} still contains never[] tuple output`);
  }

  if (/export type DomainId =/.test(content)) {
    throw new Error(
      `${label} must not export schema-generated DomainId; use ContentDomainId for locked content ids`,
    );
  }

  if (/moved: \{\s*\[k: string\]: string \| undefined;/.test(content)) {
    throw new Error(`${label} still widens MovedIndex with string | undefined values`);
  }

  for (const name of expectations.roots) {
    assertDeclarationClosed(content, name, label);
  }

  for (const name of expectations.closedAliases) {
    if (getExportDeclarationText(content, name)) {
      assertDeclarationClosed(content, name, label);
    }
  }

  assertRequiredFragments(content, label, expectations.requiredFragments);
}

export { findExportDeclaration, getExportDeclarationText, hasOpenIndexSignature };
