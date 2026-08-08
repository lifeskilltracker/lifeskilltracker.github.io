import type {
  AuthoredLevel,
  LineageEntry,
  MasteryEntry,
  Milestone,
  RequirementGroup,
  Track,
  Tree,
} from '../validate/types.js';

export interface MilestoneRef {
  index: number;
  slug: string;
}

export interface MasteryRequiresRef {
  kind: 'milestone' | 'achievement';
  index: number;
  slug: string;
}

export interface CompiledRequirementGroup {
  rule: 'all' | 'n_of';
  n?: number;
  milestones: MilestoneRef[];
}

export interface CompiledLevel {
  level: number;
  milestones: MilestoneRef[];
  requirements: CompiledRequirementGroup[];
}

export interface CompiledMilestone {
  id: string;
  uid: string;
  title: string;
  detail?: string;
  aliases?: string[];
  level: number;
  track: string;
  trackIndex: number;
  order: number;
  module?: string;
  requires?: MilestoneRef[];
}

export interface CompiledMasteryEntry {
  id: string;
  uid: string;
  title: string;
  detail?: string;
  requires?: MasteryRequiresRef[];
}

export interface CompiledTree {
  schemaVersion: number;
  contentVersion: number;
  id: string;
  title: string;
  summary: string;
  domain: Tree['domain'];
  secondaryDomains?: Tree['secondaryDomains'];
  subregion?: Tree['subregion'];
  facets?: string[];
  archetype?: string;
  tracks?: Track[];
  provenance: Tree['provenance'];
  levels: CompiledLevel[];
  mastery?: CompiledMasteryEntry[];
  lineage?: LineageEntry[];
  milestones: CompiledMilestone[];
}

export class CompileError extends Error {
  readonly code: 'config' | 'content';

  constructor(message: string, code: 'config' | 'content' = 'content') {
    super(message);
    this.name = 'CompileError';
    this.code = code;
  }
}

function resolveTrack(
  milestone: Milestone,
  tracks: Track[],
): { track: string; trackIndex: number } {
  if (tracks.length === 0) {
    return { track: '', trackIndex: 0 };
  }
  const trackId = milestone.track ?? tracks[0].id;
  const trackIndex = tracks.findIndex((track) => track.id === trackId);
  if (trackIndex < 0) {
    throw new CompileError(`milestone "${milestone.id}" references undeclared track "${trackId}"`);
  }
  return { track: trackId, trackIndex };
}

function resolveOrdersForLevel(level: AuthoredLevel, tracks: Track[]): Map<string, number> {
  const orders = new Map<string, number>();
  const cellIndices = new Map<string, number>();

  for (const milestone of level.milestones) {
    const { track } = resolveTrack(milestone, tracks);
    const fileIndex = cellIndices.get(track) ?? 0;
    cellIndices.set(track, fileIndex + 1);
    orders.set(milestone.id, milestone.order ?? fileIndex);
  }

  return orders;
}

function effectiveRequirementGroups(level: AuthoredLevel): RequirementGroup[] {
  if (level.requirements && level.requirements.length > 0) {
    return level.requirements;
  }
  return [{ rule: 'all', milestones: level.milestones.map((milestone) => milestone.id) }];
}

function compileRequirementGroups(
  level: AuthoredLevel,
  slugToIndex: Map<string, number>,
): CompiledRequirementGroup[] {
  return effectiveRequirementGroups(level).map((group) => {
    const compiled: CompiledRequirementGroup = {
      rule: group.rule === 'any' ? 'n_of' : group.rule,
      milestones: group.milestones.map((slug) => {
        const index = slugToIndex.get(slug);
        if (index === undefined) {
          throw new CompileError(`requirement group references unknown milestone "${slug}"`);
        }
        return { index, slug };
      }),
    };
    if (compiled.rule === 'n_of') {
      compiled.n = group.rule === 'any' ? 1 : group.n;
    }
    return compiled;
  });
}

function resolveMilestoneRequires(
  requires: string[] | undefined,
  slugToIndex: Map<string, number>,
): MilestoneRef[] | undefined {
  if (!requires || requires.length === 0) {
    return undefined;
  }
  return requires.map((slug) => {
    const index = slugToIndex.get(slug);
    if (index === undefined) {
      throw new CompileError(`requires target "${slug}" does not resolve to a milestone`);
    }
    return { index, slug };
  });
}

function resolveMasteryRequires(
  requires: string[] | undefined,
  slugToIndex: Map<string, number>,
  masterySlugToIndex: Map<string, number>,
): MasteryRequiresRef[] | undefined {
  if (!requires || requires.length === 0) {
    return undefined;
  }
  return requires.map((slug) => {
    const milestoneIndex = slugToIndex.get(slug);
    if (milestoneIndex !== undefined) {
      return { kind: 'milestone' as const, index: milestoneIndex, slug };
    }
    const masteryIndex = masterySlugToIndex.get(slug);
    if (masteryIndex !== undefined) {
      return { kind: 'achievement' as const, index: masteryIndex, slug };
    }
    throw new CompileError(`mastery requires target "${slug}" does not resolve in this tree`);
  });
}

function compileMastery(
  tree: Tree,
  slugToIndex: Map<string, number>,
): CompiledMasteryEntry[] | undefined {
  if (!tree.mastery || tree.mastery.length === 0) {
    return undefined;
  }
  const masterySlugToIndex = new Map(tree.mastery.map((entry, index) => [entry.id, index]));
  return tree.mastery.map((entry: MasteryEntry) => {
    const compiled: CompiledMasteryEntry = {
      id: entry.id,
      uid: entry.uid!,
      title: entry.title,
    };
    if (entry.detail !== undefined) {
      compiled.detail = entry.detail;
    }
    const requires = resolveMasteryRequires(entry.requires, slugToIndex, masterySlugToIndex);
    if (requires) {
      compiled.requires = requires;
    }
    return compiled;
  });
}

export function compileTreeBundle(tree: Tree): CompiledTree {
  const tracks = tree.tracks ?? [];
  const flatMilestones: CompiledMilestone[] = [];

  for (const level of tree.levels) {
    const orderMap = resolveOrdersForLevel(level, tracks);
    for (const milestone of level.milestones) {
      const { track, trackIndex } = resolveTrack(milestone, tracks);
      const compiled: CompiledMilestone = {
        id: milestone.id,
        uid: milestone.uid!,
        title: milestone.title,
        level: level.level,
        track,
        trackIndex,
        order: orderMap.get(milestone.id)!,
      };
      if (milestone.detail !== undefined) {
        compiled.detail = milestone.detail;
      }
      if (milestone.aliases) {
        compiled.aliases = milestone.aliases;
      }
      if (milestone.module) {
        compiled.module = milestone.module;
      }
      flatMilestones.push(compiled);
    }
  }

  const slugToIndex = new Map(flatMilestones.map((milestone, index) => [milestone.id, index]));

  for (const milestone of flatMilestones) {
    const authored = findAuthoredMilestone(tree, milestone.id);
    const requires = resolveMilestoneRequires(authored?.requires, slugToIndex);
    if (requires) {
      milestone.requires = requires;
    }
  }

  const levels: CompiledLevel[] = tree.levels.map((level) => ({
    level: level.level,
    milestones: level.milestones.map((milestone) => ({
      index: slugToIndex.get(milestone.id)!,
      slug: milestone.id,
    })),
    requirements: compileRequirementGroups(level, slugToIndex),
  }));

  const compiled: CompiledTree = {
    schemaVersion: tree.schemaVersion,
    contentVersion: tree.contentVersion,
    id: tree.id,
    title: tree.title,
    summary: tree.summary,
    domain: tree.domain,
    provenance: tree.provenance,
    levels,
    milestones: flatMilestones,
  };

  if (tree.secondaryDomains) {
    compiled.secondaryDomains = tree.secondaryDomains;
  }
  if (tree.subregion) {
    compiled.subregion = tree.subregion;
  }
  if (tree.facets) {
    compiled.facets = tree.facets;
  }
  if (tree.archetype) {
    compiled.archetype = tree.archetype;
  }
  if (tracks.length > 0) {
    compiled.tracks = tracks;
  }

  const mastery = compileMastery(tree, slugToIndex);
  if (mastery) {
    compiled.mastery = mastery;
  }

  if (tree.lineage && tree.lineage.length > 0) {
    compiled.lineage = tree.lineage.map((entry) => ({ ...entry }));
  }

  return compiled;
}

function findAuthoredMilestone(tree: Tree, slug: string): Milestone | undefined {
  for (const level of tree.levels) {
    const milestone = level.milestones.find((entry) => entry.id === slug);
    if (milestone) {
      return milestone;
    }
  }
  return undefined;
}

export function collectMovedMap(trees: Tree[]): Record<string, string> {
  const moved: Record<string, string> = {};

  for (const tree of trees) {
    for (const entry of tree.lineage ?? []) {
      if (entry.op !== 'moved') {
        continue;
      }
      const into = entry.into ?? [];
      if (into.length !== 1) {
        throw new CompileError(
          `moved entry for uid "${entry.uid}" in tree "${tree.id}" requires exactly one into target`,
        );
      }
      const target = into[0];
      const parts = target.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new CompileError(
          `moved target "${target}" in tree "${tree.id}" must be <treeId>/<uid>`,
        );
      }
      const [destTreeId, destUid] = parts;
      if (destUid !== entry.uid) {
        throw new CompileError(
          `moved target uid "${destUid}" must equal entry uid "${entry.uid}" in tree "${tree.id}"`,
        );
      }
      if (entry.uid in moved && moved[entry.uid] !== destTreeId) {
        throw new CompileError(`duplicate moved uid "${entry.uid}" with conflicting destinations`);
      }
      moved[entry.uid] = destTreeId;
    }
  }

  return moved;
}
