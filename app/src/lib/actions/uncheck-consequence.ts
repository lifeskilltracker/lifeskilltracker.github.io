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

/**
 * The same question asked of a whole placement (§11.8, T15).
 *
 * Placement is bulk completion, so most of the time it only ever raises the
 * level and this returns `null`. It is not always additive, though: the review
 * list starts from what is already recorded, so a user who un-checks something
 * they had previously completed is un-checking it for real (§12.2 — incomplete
 * is the absence of a record, and there is no third "estimated" state to hide
 * in). §11.10 requires the consequence to be stated before that commits, and
 * F29 makes it the normal case rather than an edge one.
 *
 * `selection` is the set of uids the flow would record as complete. Everything
 * else in the tree keeps whatever it has unless it is currently complete, in
 * which case the placement is clearing it.
 */
export function placementConsequenceOf(
	tree: CompiledTree,
	current: TreeProgress,
	selection: readonly string[]
): UncheckConsequence | null {
	const selected = new Set(selection);
	const milestones = new Map<string, MilestoneState>(current.milestones);

	for (const milestone of tree.milestones) {
		if (selected.has(milestone.uid)) milestones.set(milestone.uid, 'complete');
		else if (milestones.get(milestone.uid) === 'complete') milestones.delete(milestone.uid);
	}

	const hypothetical: TreeProgress = { milestones, grandfathered: current.grandfathered };
	const before = scoreSkill(tree, current).attainedLevel;
	const after = scoreSkill(tree, hypothetical);
	if (after.attainedLevel >= before) return null;

	return { before, after: after.attainedLevel, cleared: after.cleared };
}

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
