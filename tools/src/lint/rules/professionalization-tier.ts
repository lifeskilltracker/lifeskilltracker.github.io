import { milestoneSites, type LintRule } from '../context.js';

/**
 * F43: turning professional is not the same as mastery, so the top two levels
 * are where the confusion shows up. The level bound is the whole rule — the
 * verbs are perfectly good milestones lower down, which is exactly the
 * `docs/PRIOR-ART.md` §7.3 case ("teach a certification course") that made D-15
 * advisory in the first place.
 */
const TOP_LEVELS = new Set([9, 10]);

const VERBS = /\b(?:teach|teaches|teaching|sell|sells|selling|publish|publishes|publishing|certify|certifies|certifying)\b/i;

export const professionalizationTier: LintRule = (ctx, report) => {
  for (const site of milestoneSites(ctx.tree)) {
    if (!TOP_LEVELS.has(site.level)) {
      continue;
    }
    const title = site.milestone.title ?? '';
    if (!VERBS.test(title)) {
      continue;
    }
    report.addAt(
      'professionalization-tier',
      ctx.file,
      ctx.positionAt([...site.path, 'title']),
      `${site.milestone.id}: "${title}" puts professionalization at level ${site.level}; mastery is depth, not a career step (F43)`,
    );
  }
};
