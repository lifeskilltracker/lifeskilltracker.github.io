import { milestoneSites, type LintRule } from '../context.js';

/**
 * F2 asks for an observable completion condition. Two phrasings reliably lack
 * one: an effort quantity (how long you spent, not what you can now do) and a
 * hedge (what you "understand", which nobody can check).
 */
const PATTERNS: Array<{ pattern: RegExp; kind: string }> = [
  { pattern: /\bpractic(?:e|es|ing)\b/i, kind: 'effort quantity' },
  { pattern: /\bpractis(?:e|es|ing)\b/i, kind: 'effort quantity' },
  { pattern: /\bstud(?:y|ies|ying)\b/i, kind: 'effort quantity' },
  {
    pattern: /\bspend\b[^.]*\b(?:minutes?|hours?|days?|weeks?|months?|years?)\b/i,
    kind: 'effort quantity',
  },
  { pattern: /\bunderstand(?:s|ing)?\b/i, kind: 'hedge' },
  { pattern: /\blearn about\b/i, kind: 'hedge' },
  { pattern: /\bbe familiar with\b/i, kind: 'hedge' },
  { pattern: /\bfamiliaris(?:e|ed|ing)\b|\bfamiliariz(?:e|ed|ing)\b/i, kind: 'hedge' },
];

export const vagueMilestone: LintRule = (ctx, report) => {
  for (const site of milestoneSites(ctx.tree)) {
    const title = site.milestone.title ?? '';
    const hit = PATTERNS.find((entry) => entry.pattern.test(title));
    if (!hit) {
      continue;
    }
    report.addAt(
      'vague-milestone',
      ctx.file,
      ctx.positionAt([...site.path, 'title']),
      `${site.milestone.id}: "${title}" reads as ${hit.kind}, not an observable achievement (F2)`,
    );
  }
};
