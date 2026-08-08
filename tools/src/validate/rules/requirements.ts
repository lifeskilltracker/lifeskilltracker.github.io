import { pathPosition } from '../schema.js';
import type { ValidationContext } from '../context.js';
import { shouldReport } from '../context.js';
import type { RequirementGroup } from '../types.js';
import type { ValidationReport } from '../report.js';

function effectiveRequirements(level: {
  milestones: Array<{ id: string }>;
  requirements?: RequirementGroup[];
}): RequirementGroup[] {
  if (level.requirements && level.requirements.length > 0) {
    return level.requirements;
  }
  return [{ rule: 'all', milestones: level.milestones.map((m) => m.id) }];
}

function groupSize(group: RequirementGroup): number {
  return group.milestones.length;
}

function effectiveN(group: RequirementGroup): number {
  if (group.rule === 'any') {
    return 1;
  }
  return group.n ?? group.milestones.length;
}

export function checkRules6To8Requirements(ctx: ValidationContext, report: ValidationReport): void {
  for (const loaded of ctx.treeDocuments.values()) {
    if (!shouldReport(ctx, loaded.path)) {
      continue;
    }
    const levelSlugs = new Map<number, Set<string>>();
    for (const level of loaded.data.levels) {
      levelSlugs.set(level.level, new Set(level.milestones.map((m) => m.id)));
    }

    for (let levelIndex = 0; levelIndex < loaded.data.levels.length; levelIndex += 1) {
      const level = loaded.data.levels[levelIndex];
      const allowed = levelSlugs.get(level.level) ?? new Set<string>();
      const groups = effectiveRequirements(level);
      const referenced = new Set<string>();

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const group = groups[groupIndex];
        const basePath = level.requirements
          ? (['levels', levelIndex, 'requirements', groupIndex] as const)
          : (['levels', levelIndex, 'milestones'] as const);

        for (let milestoneIndex = 0; milestoneIndex < group.milestones.length; milestoneIndex += 1) {
          const slug = group.milestones[milestoneIndex];
          referenced.add(slug);
          if (!allowed.has(slug)) {
            report.addAt(
              loaded.path,
              pathPosition(loaded, [...basePath, 'milestones', milestoneIndex]),
              `requirement group references milestone "${slug}" outside level ${level.level}`,
              'rule 6',
            );
          }
        }

        const size = groupSize(group);
        const n = effectiveN(group);
        if (group.rule === 'n_of' || group.rule === 'any') {
          if (n < 1 || n >= size) {
            report.addAt(
              loaded.path,
              pathPosition(loaded, [...basePath, group.rule === 'n_of' ? 'n' : 'rule']),
              `requirement group needs 1 ≤ n < ${size}, found n=${n}`,
              'rule 7',
            );
          }
        }
      }

      for (const milestone of level.milestones) {
        if (!referenced.has(milestone.id)) {
          const milestoneIndex = level.milestones.findIndex((m) => m.id === milestone.id);
          report.addAt(
            loaded.path,
            pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'id']),
            `milestone "${milestone.id}" is not referenced by any requirement group at level ${level.level}`,
            'rule 8',
          );
        }
      }
    }
  }
}
