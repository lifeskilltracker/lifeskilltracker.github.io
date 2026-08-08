import { pathPosition } from '../schema.js';
import type { ValidationContext } from '../context.js';
import { shouldReport } from '../context.js';
import type { ValidationReport } from '../report.js';

interface RequiresNode {
  id: string;
  kind: 'milestone' | 'mastery';
  level?: number;
  levelIndex?: number;
  milestoneIndex?: number;
  masteryIndex?: number;
}

function requiresNodes(treeId: string, ctx: ValidationContext): Map<string, RequiresNode> {
  const nodes = new Map<string, RequiresNode>();
  const milestoneSlugs = ctx.slugToMilestone.get(treeId) ?? new Map();
  for (const [slug, ref] of milestoneSlugs) {
    nodes.set(slug, {
      id: slug,
      kind: 'milestone',
      level: ref.level,
    });
  }
  const masterySlugs = ctx.slugToMastery.get(treeId) ?? new Map();
  for (const [slug] of masterySlugs) {
    nodes.set(slug, { id: slug, kind: 'mastery' });
  }
  return nodes;
}

export function checkRules3To5Requires(ctx: ValidationContext, report: ValidationReport): void {
  for (const loaded of ctx.treeDocuments.values()) {
    if (!shouldReport(ctx, loaded.path)) {
      continue;
    }
    const treeId = loaded.data.id;
    const nodes = requiresNodes(treeId, ctx);

    for (let levelIndex = 0; levelIndex < loaded.data.levels.length; levelIndex += 1) {
      const level = loaded.data.levels[levelIndex];
      for (let milestoneIndex = 0; milestoneIndex < level.milestones.length; milestoneIndex += 1) {
        const milestone = level.milestones[milestoneIndex];
        for (let reqIndex = 0; reqIndex < (milestone.requires ?? []).length; reqIndex += 1) {
          const target = milestone.requires![reqIndex];
          const prereq = nodes.get(target);
          if (!prereq) {
            report.addAt(
              loaded.path,
              pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'requires', reqIndex]),
              `requires target "${target}" does not resolve to a milestone or mastery entry in this tree`,
              'rule 3',
            );
            continue;
          }
          if (prereq.kind === 'milestone' && prereq.level! > level.level) {
            report.addAt(
              loaded.path,
              pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'requires', reqIndex]),
              `prerequisite "${target}" at level ${prereq.level} exceeds dependent "${milestone.id}" at level ${level.level}`,
              'rule 5',
            );
          }
        }
      }
    }

    for (let masteryIndex = 0; masteryIndex < (loaded.data.mastery ?? []).length; masteryIndex += 1) {
      const entry = loaded.data.mastery![masteryIndex];
      for (let reqIndex = 0; reqIndex < (entry.requires ?? []).length; reqIndex += 1) {
        const target = entry.requires![reqIndex];
        if (!nodes.has(target)) {
          report.addAt(
            loaded.path,
            pathPosition(loaded, ['mastery', masteryIndex, 'requires', reqIndex]),
            `requires target "${target}" does not resolve to a milestone or mastery entry in this tree`,
            'rule 3',
          );
        }
      }
    }

    const edges = new Map<string, string[]>();
    for (const level of loaded.data.levels) {
      for (const milestone of level.milestones) {
        edges.set(milestone.id, milestone.requires ?? []);
      }
    }
    for (const entry of loaded.data.mastery ?? []) {
      edges.set(entry.id, entry.requires ?? []);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const stack: string[] = [];

    const reportCycleAt = (node: string): void => {
      const cycleStart = stack.indexOf(node);
      const cycle = [...stack.slice(cycleStart), node].join(' → ');
      const levelIndex = loaded.data.levels.findIndex((level) =>
        level.milestones.some((m) => m.id === node),
      );
      if (levelIndex >= 0) {
        const milestoneIndex =
          loaded.data.levels[levelIndex]?.milestones.findIndex((m) => m.id === node) ?? 0;
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'requires']),
          `cycle detected in requires graph: ${cycle}`,
          'rule 4',
        );
        return;
      }
      const masteryIndex = (loaded.data.mastery ?? []).findIndex((entry) => entry.id === node);
      if (masteryIndex >= 0) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['mastery', masteryIndex, 'requires']),
          `cycle detected in requires graph: ${cycle}`,
          'rule 4',
        );
      }
    };

    const visit = (node: string): void => {
      if (visited.has(node)) {
        return;
      }
      if (visiting.has(node)) {
        reportCycleAt(node);
        return;
      }
      visiting.add(node);
      stack.push(node);
      for (const next of edges.get(node) ?? []) {
        if (nodes.has(next)) {
          visit(next);
        }
      }
      stack.pop();
      visiting.delete(node);
      visited.add(node);
    };

    for (const slug of edges.keys()) {
      visit(slug);
    }
  }
}
