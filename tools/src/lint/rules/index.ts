import type { LintRule } from '../context.js';
import type { LintRuleId } from '../report.js';

import { groupShapeDrift } from './group-shape-drift.js';
import { levelPacing } from './level-pacing.js';
import { lonelyTrack } from './lonely-track.js';
import { orphanMilestone } from './orphan-milestone.js';
import { professionalizationTier } from './professionalization-tier.js';
import { trackOveruse } from './track-overuse.js';
import { vagueMilestone } from './vague-milestone.js';

/**
 * The registry knows nothing about exit codes, and that is R-04's promotion
 * path: a rule verdict is a finding here, and whether findings gate is decided
 * once in `lint/index.ts`. Nothing in this table has to change to promote one.
 */
export const LINT_RULES: ReadonlyArray<{ id: LintRuleId; run: LintRule }> = [
  { id: 'vague-milestone', run: vagueMilestone },
  { id: 'professionalization-tier', run: professionalizationTier },
  { id: 'group-shape-drift', run: groupShapeDrift },
  { id: 'track-overuse', run: trackOveruse },
  { id: 'lonely-track', run: lonelyTrack },
  { id: 'level-pacing', run: levelPacing },
  { id: 'orphan-milestone', run: orphanMilestone },
];
