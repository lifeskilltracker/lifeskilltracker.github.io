import { positionAtPath, type ParsedYaml, type SourcePosition } from '../shared/yaml-source.js';
import type { Milestone, Tree } from '../validate/types.js';
import type { LintReport } from './report.js';

/**
 * Every §6.3 rule is tree-local — none of the seven needs another tree, the
 * taxonomy, or git history. That is why lint can be scoped to argv outright
 * rather than reading everything and filtering the report as §6.2 must.
 */
export interface TreeLintContext {
  readonly file: string;
  readonly tree: Tree;
  readonly loaded: ParsedYaml<Tree>;
  positionAt(jsonPath: Array<string | number>): SourcePosition;
}

export type LintRule = (ctx: TreeLintContext, report: LintReport) => void;

export function createTreeLintContext(loaded: ParsedYaml<Tree>): TreeLintContext {
  return {
    file: loaded.path,
    tree: loaded.data,
    loaded,
    positionAt: (jsonPath) => positionAtPath(loaded.doc, jsonPath, loaded.lineCounter),
  };
}

export interface MilestoneSite {
  milestone: Milestone;
  level: number;
  /** JSON path to the milestone node, for `positionAt`. */
  path: Array<string | number>;
}

/** Walks `levels[].milestones[]` once, carrying the path each rule needs. */
export function milestoneSites(tree: Tree): MilestoneSite[] {
  const sites: MilestoneSite[] = [];
  (tree.levels ?? []).forEach((level, levelIndex) => {
    (level.milestones ?? []).forEach((milestone, milestoneIndex) => {
      sites.push({
        milestone,
        level: level.level,
        path: ['levels', levelIndex, 'milestones', milestoneIndex],
      });
    });
  });
  return sites;
}

/**
 * §5.5: an omitted `track` means the first declared track. A tree with no
 * `tracks` block has no columns at all, so its milestones belong to no track.
 */
export function effectiveTrack(tree: Tree, milestone: Milestone): string | null {
  if (milestone.track) {
    return milestone.track;
  }
  return tree.tracks?.[0]?.id ?? null;
}
