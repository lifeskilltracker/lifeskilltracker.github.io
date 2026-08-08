import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { taxonomyDir, treesDir, resolveRepoPath } from '../shared/paths.js';
import { readYamlFile, type ParsedYaml } from '../shared/yaml-source.js';
import type {
  DomainsFile,
  FacetsFile,
  LoadedTree,
  MapFile,
  MilestoneRef,
  MasteryRef,
  Tree,
} from './types.js';

export type ContentFileKind = 'tree' | 'domains' | 'facets' | 'map' | 'unknown';

export interface ValidationContext {
  repoRoot: string;
  reportFiles: ReadonlySet<string> | null;
  trees: LoadedTree[];
  treeById: Map<string, LoadedTree>;
  treeDocuments: Map<string, ParsedYaml<Tree>>;
  domains: ParsedYaml<DomainsFile> | null;
  facets: ParsedYaml<FacetsFile> | null;
  map: ParsedYaml<MapFile> | null;
  allMilestones: MilestoneRef[];
  allMastery: MasteryRef[];
  uidToMilestone: Map<string, MilestoneRef>;
  uidToMastery: Map<string, MasteryRef>;
  slugToMilestone: Map<string, Map<string, MilestoneRef>>;
  slugToMastery: Map<string, Map<string, MasteryRef>>;
  domainIds: Set<string>;
  facetIds: Set<string>;
  subregionIds: Set<string>;
}

function listYamlFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name) => path.join(dir, name))
    .sort();
}

function isYamlPath(filePath: string): boolean {
  return filePath.endsWith('.yaml') || filePath.endsWith('.yml');
}

export function classifyYamlContent(data: unknown, filePath: string): ContentFileKind {
  if (typeof data !== 'object' || data == null) {
    return 'unknown';
  }
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.levels)) {
    return 'tree';
  }
  if (Array.isArray(record.regions) && typeof record.hexSize === 'number') {
    return 'map';
  }
  if (Array.isArray(record.domains)) {
    return 'domains';
  }
  if (Array.isArray(record.facets)) {
    return 'facets';
  }

  const base = path.basename(filePath);
  if (base === 'domains.yaml') {
    return 'domains';
  }
  if (base === 'facets.yaml') {
    return 'facets';
  }
  if (base === 'map.yaml') {
    return 'map';
  }
  return 'unknown';
}

export function resolveInputFiles(repoRoot: string, files: string[]): string[] {
  const resolved = new Set<string>();
  for (const file of files) {
    const abs = resolveRepoPath(repoRoot, file);
    if (!existsSync(abs)) {
      throw new Error(`File not found: ${file}`);
    }
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      for (const child of listYamlFiles(abs)) {
        resolved.add(path.resolve(child));
      }
    } else if (isYamlPath(abs)) {
      resolved.add(path.resolve(abs));
    }
  }
  return [...resolved].sort();
}

export function buildReportScope(
  repoRoot: string,
  files: string[],
): ReadonlySet<string> | null {
  if (files.length === 0) {
    return null;
  }
  return new Set(resolveInputFiles(repoRoot, files));
}

function indexTree(
  loaded: ParsedYaml<Tree>,
  ctx: Pick<
    ValidationContext,
    | 'allMilestones'
    | 'allMastery'
    | 'uidToMilestone'
    | 'uidToMastery'
    | 'slugToMilestone'
    | 'slugToMastery'
  >,
): LoadedTree {
  const tree = loaded.data;
  const entry: LoadedTree = { path: loaded.path, tree };
  if (!ctx.slugToMilestone.has(tree.id)) {
    ctx.slugToMilestone.set(tree.id, new Map());
  }
  if (!ctx.slugToMastery.has(tree.id)) {
    ctx.slugToMastery.set(tree.id, new Map());
  }

  for (const level of tree.levels ?? []) {
    for (const milestone of level.milestones ?? []) {
      const ref: MilestoneRef = {
        treeId: tree.id,
        treePath: loaded.path,
        level: level.level,
        milestone,
        slug: milestone.id,
      };
      ctx.allMilestones.push(ref);
      ctx.slugToMilestone.get(tree.id)!.set(milestone.id, ref);
      if (milestone.uid) {
        ctx.uidToMilestone.set(milestone.uid, ref);
      }
    }
  }
  for (const mastery of tree.mastery ?? []) {
    const ref: MasteryRef = {
      treeId: tree.id,
      treePath: loaded.path,
      entry: mastery,
      slug: mastery.id,
    };
    ctx.allMastery.push(ref);
    ctx.slugToMastery.get(tree.id)!.set(mastery.id, ref);
    if (mastery.uid) {
      ctx.uidToMastery.set(mastery.uid, ref);
    }
  }
  return entry;
}

function loadOptionalTaxonomy<T>(
  defaultPath: string,
  overridePath: string | null,
): ParsedYaml<T> | null {
  const filePath = overridePath ?? defaultPath;
  if (!existsSync(filePath)) {
    return null;
  }
  return readYamlFile<T>(filePath);
}

export function loadValidationContext(
  repoRoot: string,
  inputFiles: string[],
): ValidationContext {
  const reportFiles = buildReportScope(repoRoot, inputFiles);
  const argvPaths = resolveInputFiles(repoRoot, inputFiles);

  const treePaths = new Set<string>(listYamlFiles(treesDir(repoRoot)));
  let domainsOverride: string | null = null;
  let facetsOverride: string | null = null;
  let mapOverride: string | null = null;

  for (const filePath of argvPaths) {
    const loaded = readYamlFile(filePath);
    const kind = classifyYamlContent(loaded.data, filePath);
    switch (kind) {
      case 'tree':
        treePaths.add(filePath);
        break;
      case 'domains':
        domainsOverride = filePath;
        break;
      case 'facets':
        facetsOverride = filePath;
        break;
      case 'map':
        mapOverride = filePath;
        break;
      default:
        throw new Error(`Unrecognized content file (expected tree or taxonomy): ${filePath}`);
    }
  }

  const treeDocuments = new Map<string, ParsedYaml<Tree>>();
  const trees: LoadedTree[] = [];
  const allMilestones: MilestoneRef[] = [];
  const allMastery: MasteryRef[] = [];
  const uidToMilestone = new Map<string, MilestoneRef>();
  const uidToMastery = new Map<string, MasteryRef>();
  const slugToMilestone = new Map<string, Map<string, MilestoneRef>>();
  const slugToMastery = new Map<string, Map<string, MasteryRef>>();

  for (const treePath of [...treePaths].sort()) {
    const loaded = readYamlFile<Tree>(treePath);
    const kind = classifyYamlContent(loaded.data, treePath);
    if (kind !== 'tree') {
      continue;
    }
    treeDocuments.set(treePath, loaded);
    trees.push(
      indexTree(loaded, {
        allMilestones,
        allMastery,
        uidToMilestone,
        uidToMastery,
        slugToMilestone,
        slugToMastery,
      }),
    );
  }

  const domainsPath = path.join(taxonomyDir(repoRoot), 'domains.yaml');
  const facetsPath = path.join(taxonomyDir(repoRoot), 'facets.yaml');
  const mapPath = path.join(taxonomyDir(repoRoot), 'map.yaml');

  const domains = loadOptionalTaxonomy<DomainsFile>(domainsPath, domainsOverride);
  const facets = loadOptionalTaxonomy<FacetsFile>(facetsPath, facetsOverride);
  const map = loadOptionalTaxonomy<MapFile>(mapPath, mapOverride);

  const domainIds = new Set((domains?.data.domains ?? []).map((d) => d.id));
  const facetIds = new Set((facets?.data.facets ?? []).map((f) => f.id));
  const subregionIds = new Set<string>();
  for (const domain of domains?.data.domains ?? []) {
    for (const sub of domain.subregions ?? []) {
      subregionIds.add(sub.id);
    }
  }

  const treeById = new Map(trees.map((t) => [t.tree.id, t]));

  return {
    repoRoot,
    reportFiles,
    trees,
    treeById,
    treeDocuments,
    domains,
    facets,
    map,
    allMilestones,
    allMastery,
    uidToMilestone,
    uidToMastery,
    slugToMilestone,
    slugToMastery,
    domainIds,
    facetIds,
    subregionIds,
  };
}

/** Uids present on milestone and mastery content in the repository head. */
export function liveHeadUidSet(ctx: ValidationContext): Set<string> {
  const uids = new Set<string>();
  for (const ref of ctx.allMilestones) {
    if (ref.milestone.uid) {
      uids.add(ref.milestone.uid);
    }
  }
  for (const ref of ctx.allMastery) {
    if (ref.entry.uid) {
      uids.add(ref.entry.uid);
    }
  }
  return uids;
}

/** All uids used for repository-wide uniqueness (rule 2). */
export function repoUidSet(ctx: ValidationContext): Set<string> {
  return liveHeadUidSet(ctx);
}

export function shouldReport(ctx: ValidationContext, filePath: string): boolean {
  if (ctx.reportFiles == null) {
    return true;
  }
  return ctx.reportFiles.has(path.resolve(filePath));
}

export function sameTreeLiveUids(ctx: ValidationContext, treeId: string): Set<string> {
  const uids = new Set<string>();
  for (const ref of ctx.allMilestones) {
    if (ref.treeId === treeId && ref.milestone.uid) {
      uids.add(ref.milestone.uid);
    }
  }
  for (const ref of ctx.allMastery) {
    if (ref.treeId === treeId && ref.entry.uid) {
      uids.add(ref.entry.uid);
    }
  }
  return uids;
}
