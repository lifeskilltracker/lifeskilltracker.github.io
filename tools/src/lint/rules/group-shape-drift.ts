import type { LintRule } from '../context.js';
import type { RequirementGroup } from '../../validate/types.js';

const MAX_SHAPES = 3;

/**
 * A "shape" is the rule and, for `n_of`, its threshold — `all`, `any`,
 * `n_of:2`, `n_of:3`. Deliberately not the group's size: D14's worry is a
 * reader having to hold several different *rules* in mind, and `n_of: 2` over
 * three milestones and over five is one rule applied twice.
 */
function shapeOf(group: RequirementGroup): string {
  return group.rule === 'n_of' ? `n_of:${group.n}` : group.rule;
}

export const groupShapeDrift: LintRule = (ctx, report) => {
  const seen = new Set<string>();

  (ctx.tree.levels ?? []).forEach((level, levelIndex) => {
    (level.requirements ?? []).forEach((group, groupIndex) => {
      const shape = shapeOf(group);
      if (seen.has(shape)) {
        return;
      }
      seen.add(shape);
      if (seen.size <= MAX_SHAPES) {
        return;
      }
      report.addAt(
        'group-shape-drift',
        ctx.file,
        ctx.positionAt(['levels', levelIndex, 'requirements', groupIndex]),
        `${shape} is requirement-group shape ${seen.size} in this tree; more than ${MAX_SHAPES} distinct shapes is hard to hold in mind (D14)`,
      );
    });
  });
};
