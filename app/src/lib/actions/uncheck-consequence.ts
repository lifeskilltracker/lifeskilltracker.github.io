/**
 * §11.10's un-check consequence, as arithmetic (T08).
 *
 * *"Un-checking this drops Cooking from Level 8 to Level 1."* The engine
 * recomputes honestly and the UI states the result before the action commits —
 * the alternative §11.10 rejects is ratcheting the score, which makes an
 * accidental check permanently inflating and destroys the number's meaning.
 *
 * Nothing here writes. It re-scores the tree with one milestone removed, which
 * costs one pass over one tree (§17.3), and returns `null` when the level
 * survives — the ordinary case, and the one where a warning would be noise.
 */

import { scoreSkill } from '$lib/scoring';
import type { CompiledTree, MilestoneState, TreeProgress } from '$lib/types';
import type { UncheckConsequence } from '$lib/components/intents.js';

export function uncheckConsequenceOf(
	tree: CompiledTree,
	current: TreeProgress,
	uid: string
): UncheckConsequence | null {
	if (current.milestones.get(uid) !== 'complete') return null;

	const milestones = new Map<string, MilestoneState>(current.milestones);
	milestones.delete(uid);
	const hypothetical: TreeProgress = { milestones, grandfathered: current.grandfathered };

	const before = scoreSkill(tree, current).attainedLevel;
	const after = scoreSkill(tree, hypothetical);
	if (after.attainedLevel >= before) return null;

	return { before, after: after.attainedLevel, cleared: after.cleared };
}
