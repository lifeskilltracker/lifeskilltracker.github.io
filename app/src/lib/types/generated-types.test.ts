import { describe, expect, it } from 'vitest';

import type { ContentDomainId, Domain, ExportFileDocument, Milestone, RequirementGroup } from './authored.js';
import type { CompiledTree, MasteryRequiresRef } from './compiled.js';
import type { DomainId, ExportFile, MapFile, MovedIndex, Tree } from './index.js';

type Assert<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

/** Compile-time: Tree levels are a usable 10-tuple, not never. */
type TreeLevel0 = Tree['levels'][0];
type TreeMilestone = TreeLevel0['milestones'][number];
type TreeMilestoneTitle = TreeMilestone['title'];
type _treeLevelsNotNever = Assert<IsNever<TreeMilestoneTitle> extends false ? true : false>;
type _treeLevelHasMilestones = Assert<
  TreeLevel0['milestones'] extends readonly unknown[] ? true : false
>;

/** Compile-time: map axial tiles are [number, number]. */
type MapRegion = MapFile['regions'][number];
type MapTile = MapRegion['tiles'][number];
type _mapTileTuple = Assert<[MapTile[0], MapTile[1]] extends [number, number] ? true : false>;
type _mapTileNotNever = Assert<IsNever<MapTile[0]> extends false ? true : false>;

/** Compile-time: closed Tree/CompiledTree roots reject arbitrary string keys. */
type _treeClosed = Assert<'totallyFakeField' extends keyof Tree ? false : true>;
type _compiledClosed = Assert<
  'totallyFakeField' extends keyof CompiledTree ? false : true
>;

/** Compile-time: MovedIndex values are exactly string, not string | undefined. */
type MovedDestination = MovedIndex[string];
type _movedValueIsString = Assert<
  MovedDestination extends string
    ? string extends MovedDestination
      ? true
      : false
    : false
>;
type _movedNotUndefined = Assert<undefined extends MovedDestination ? false : true>;

/** Compile-time: authored RequirementGroup is a closed discriminated union. */
type AuthoredAllGroup = Extract<RequirementGroup, { rule: 'all' }>;
type AuthoredAnyGroup = Extract<RequirementGroup, { rule: 'any' }>;
type AuthoredNOfGroup = Extract<RequirementGroup, { rule: 'n_of' }>;
type _reqGroupNotEmpty = Assert<RequirementGroup extends Record<string, never> ? false : true>;
type _reqAllHasMilestones = Assert<
  AuthoredAllGroup extends { milestones: string[] } ? true : false
>;
type _reqAnyHasMilestones = Assert<
  AuthoredAnyGroup extends { milestones: string[] } ? true : false
>;
type _reqNOfRequiresN = Assert<
  AuthoredNOfGroup extends { n: number; milestones: string[] } ? true : false
>;
type _reqAllRejectsExplicitN = Assert<
  { rule: 'all'; milestones: string[]; n: number } extends RequirementGroup ? false : true
>;
type _reqAnyRejectsExplicitN = Assert<
  { rule: 'any'; milestones: string[]; n: number } extends RequirementGroup ? false : true
>;
type _reqGroupClosed = Assert<'xp' extends keyof RequirementGroup ? false : true>;

type MakingDomain = Extract<Domain, { id: 'making' }>;
type _domainClosed = Assert<'totallyFakeField' extends keyof Domain ? false : true>;
type _domainHasPalette = Assert<'palette' extends keyof Domain ? true : false>;
type _makingRequiresSubregions = Assert<
  MakingDomain extends { subregions: unknown } ? true : false
>;
type _makingWithoutSubregionsRejected = Assert<
  {
    id: 'making';
    title: string;
    blurb: string;
    palette: { base: string; accent: string };
  } extends Domain
    ? false
    : true
>;
type _mindDomainAccepted = Assert<
  {
    id: 'mind';
    title: string;
    blurb: string;
    palette: { base: string; accent: string };
  } extends Domain
    ? true
    : false
>;
type _nonMakingUsesExplicitIds = Assert<
  import('./authored.js').ContentNonMakingDomainId extends
    | 'mind'
    | 'body'
    | 'home'
    | 'people'
    | 'work-money'
    | 'play'
    | 'outdoors-nature'
    ? true
    : false
>;

/** Compile-time: public DomainId (§14.4) stays open string; content ids are locked separately. */
type _publicDomainIdIsString = Assert<
  DomainId extends string ? (string extends DomainId ? true : false) : false
>;
type _contentDomainIdIsLocked = Assert<
  ContentDomainId extends
    | 'mind'
    | 'body'
    | 'making'
    | 'home'
    | 'people'
    | 'work-money'
    | 'play'
    | 'outdoors-nature'
    ? true
    : false
>;
type _contentDomainIdNotOpenString = Assert<
  string extends ContentDomainId ? false : true
>;
type _futureDomainAcceptedByPublicId = Assert<'future-domain' extends DomainId ? true : false>;
type _futureDomainRejectedByContentId = Assert<
  'future-domain' extends ContentDomainId ? false : true
>;

/** Compile-time: ExportFile alias preserves required export schema fields. */
type ExportSkillRow = ExportFile['skills'][number];
type ExportMilestoneRow = ExportFile['milestones'][number];
type _exportSkillsArray = Assert<
  ExportFile extends { skills: readonly unknown[] } ? true : false
>;
type _exportSkillLastActivity = Assert<
  'lastActivityAt' extends keyof ExportSkillRow ? true : false
>;
type _exportSkillContentVersionSeen = Assert<
  'contentVersionSeen' extends keyof ExportSkillRow ? true : false
>;
type _exportMilestoneContentVersion = Assert<
  'contentVersion' extends keyof ExportMilestoneRow ? true : false
>;
type _exportMilestonePhotoTolerance = Assert<
  ExportFileDocument['milestones'][number] extends { [key: string]: unknown }
    ? true
    : false
>;

/** Compile-time: milestones reject effort fields like xp. */
type _milestoneNoXp = Assert<'xp' extends keyof Milestone ? false : true>;

/** Compile-time: compiled milestones require uid. */
type CompiledMilestone = CompiledTree['milestones'][number];
type _compiledMilestoneUidRequired = Assert<
  'uid' extends keyof CompiledMilestone ? true : false
>;
type CompiledMilestoneUid = CompiledMilestone['uid'];
type _compiledUidNotOptional = Assert<
  undefined extends CompiledMilestoneUid ? false : true
>;

/** Compile-time: compiled mastery entries require uid. */
type CompiledMastery = NonNullable<CompiledTree['mastery']>[number];
type _compiledMasteryUidRequired = Assert<
  'uid' extends keyof CompiledMastery ? true : false
>;
type CompiledMasteryUid = CompiledMastery['uid'];
type _compiledMasteryUidNotOptional = Assert<
  undefined extends CompiledMasteryUid ? false : true
>;

/** Compile-time: mastery requires expose milestone and achievement refs (§5.7). */
type MasteryRequires = NonNullable<CompiledMastery['requires']>[number];
type _masteryRequiresKind = Assert<
  MasteryRequires['kind'] extends 'milestone' | 'achievement' ? true : false
>;
type _masteryRequiresUsable = Assert<
  IsNever<MasteryRequires['slug']> extends false ? true : false
>;
type _masteryRequiresIndexDoc = Assert<
  MasteryRequiresRef extends { index: number; kind: 'milestone' | 'achievement' }
    ? true
    : false
>;

/** Compile-time: compiled RequirementGroup reflects normalized all/n_of grammar. */
type CompiledAllGroup = Extract<
  NonNullable<CompiledTree['levels'][0]['requirements']>[number],
  { rule: 'all' }
>;
type CompiledNOfGroup = Extract<
  NonNullable<CompiledTree['levels'][0]['requirements']>[number],
  { rule: 'n_of' }
>;
type _compiledReqAllHasRefs = Assert<
  CompiledAllGroup extends { milestones: Array<{ index: number; slug: string }> }
    ? true
    : false
>;
type _compiledReqNOfHasN = Assert<
  CompiledNOfGroup extends { n: number; milestones: Array<{ index: number; slug: string }> }
    ? true
    : false
>;
type _compiledReqAllRejectsExplicitN = Assert<
  {
    rule: 'all';
    milestones: [{ index: 0; slug: 'a' }];
    n: number;
  } extends CompiledAllGroup
    ? false
    : true
>;

describe('generated type contracts (T02 review fixes)', () => {
  it('satisfies compile-time closed-type contracts', () => {
    const _checks: [
      _treeLevelsNotNever,
      _treeLevelHasMilestones,
      _mapTileTuple,
      _mapTileNotNever,
      _treeClosed,
      _compiledClosed,
      _movedValueIsString,
      _movedNotUndefined,
      _reqGroupNotEmpty,
      _reqAllHasMilestones,
      _reqAnyHasMilestones,
      _reqNOfRequiresN,
      _reqAllRejectsExplicitN,
      _reqAnyRejectsExplicitN,
      _reqGroupClosed,
      _domainClosed,
      _domainHasPalette,
      _makingRequiresSubregions,
      _makingWithoutSubregionsRejected,
      _mindDomainAccepted,
      _nonMakingUsesExplicitIds,
      _publicDomainIdIsString,
      _contentDomainIdIsLocked,
      _contentDomainIdNotOpenString,
      _futureDomainAcceptedByPublicId,
      _futureDomainRejectedByContentId,
      _exportSkillsArray,
      _exportSkillLastActivity,
      _exportSkillContentVersionSeen,
      _exportMilestoneContentVersion,
      _exportMilestonePhotoTolerance,
      _milestoneNoXp,
      _compiledMilestoneUidRequired,
      _compiledUidNotOptional,
      _compiledMasteryUidRequired,
      _compiledMasteryUidNotOptional,
      _masteryRequiresKind,
      _masteryRequiresUsable,
      _masteryRequiresIndexDoc,
      _compiledReqAllHasRefs,
      _compiledReqNOfHasN,
      _compiledReqAllRejectsExplicitN,
    ] = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ];
    expect(_checks.every(Boolean)).toBe(true);
  });

  it('proves levels[0].milestones[number] is usable at type level', () => {
    type Title = Tree['levels'][0]['milestones'][0]['title'];
    const title: Title = 'forge milestone';
    expect(title).toBe('forge milestone');
  });

  it('proves map tile coordinates are usable at type level', () => {
    type Tile = MapFile['regions'][0]['tiles'][0];
    const tile: Tile = [3, 7];
    expect(tile[0] + tile[1]).toBe(10);
  });

  it('proves RequirementGroup variants carry milestones and n rules at type level', () => {
    const allGroup: RequirementGroup = { rule: 'all', milestones: ['a', 'b'] };
    const nOfGroup: RequirementGroup = { rule: 'n_of', n: 2, milestones: ['a', 'b', 'c'] };
    expect(allGroup.milestones).toHaveLength(2);
    expect(nOfGroup.n).toBe(2);
  });
});
