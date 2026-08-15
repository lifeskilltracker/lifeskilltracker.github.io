import type { LintRule } from '../context.js';

/**
 * "Deviates sharply" needs a number, and the schema already bounds a level at
 * 4–8 milestones (F8), so the widest possible gap is 4. Three is the threshold:
 * it cannot fire on a tree that varies by one or two, and it always fires on
 * the 4-versus-8 jump the bound permits.
 */
const MAX_DEVIATION = 3;

export const levelPacing: LintRule = (ctx, report) => {
  const levels = ctx.tree.levels ?? [];
  const counts = levels.map((level) => (level.milestones ?? []).length);

  counts.forEach((count, index) => {
    const neighbours = [counts[index - 1], counts[index + 1]].filter(
      (value): value is number => value !== undefined,
    );
    if (neighbours.length === 0) {
      return;
    }
    const mean = neighbours.reduce((sum, value) => sum + value, 0) / neighbours.length;
    if (Math.abs(count - mean) < MAX_DEVIATION) {
      return;
    }
    report.addAt(
      'level-pacing',
      ctx.file,
      ctx.positionAt(['levels', index]),
      `level ${levels[index].level} has ${count} milestones against a neighbouring average of ${mean}; the climb should feel even`,
    );
  });
};
