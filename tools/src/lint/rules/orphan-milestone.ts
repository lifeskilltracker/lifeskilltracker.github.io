import { milestoneSites, type LintRule } from '../context.js';

/**
 * An orphan is a milestone sitting *off* the prerequisite graph entirely — it
 * requires nothing and nothing requires it — in a tree that draws a graph
 * elsewhere. The "in a tree that otherwise uses prerequisites" clause is what
 * keeps this quiet on the many trees that legitimately have no `requires` at
 * all; without it the rule would fire on every milestone of every such tree.
 *
 * Mastery `requires` counts as a reference: a milestone named by a mastery
 * achievement is plainly connected, even though mastery itself is unpositioned
 * (§6.2 rule 14).
 */
export const orphanMilestone: LintRule = (ctx, report) => {
  const sites = milestoneSites(ctx.tree);
  const mastery = ctx.tree.mastery ?? [];

  const referenced = new Set<string>();
  let usesPrerequisites = false;
  for (const requires of [
    ...sites.map((site) => site.milestone.requires),
    ...mastery.map((entry) => entry.requires),
  ]) {
    if (!requires || requires.length === 0) {
      continue;
    }
    usesPrerequisites = true;
    for (const slug of requires) {
      referenced.add(slug);
    }
  }

  if (!usesPrerequisites) {
    return;
  }

  for (const site of sites) {
    const hasPrerequisites = (site.milestone.requires ?? []).length > 0;
    if (hasPrerequisites || referenced.has(site.milestone.id)) {
      continue;
    }
    report.addAt(
      'orphan-milestone',
      ctx.file,
      ctx.positionAt(site.path),
      `${site.milestone.id} requires nothing and is required by nothing, in a tree that uses prerequisites elsewhere`,
    );
  }
};
