/**
 * §11.10's two intercepts, as pure functions over props (T08).
 *
 * §11.10 is explicit that this is **UI behaviour, not engine behaviour**: the
 * engine recomputes honestly and reports, and the renderer states the
 * consequence before the action commits. Nothing here prevents anything —
 * dismissal stays reversible (D-22) and un-checking stays a real
 * recomputation. All these functions do is find the words.
 *
 * `cappedLevel` is the one piece of reasoning in the component's vicinity, and
 * it is reasoning about *content*, not about score: which level's `all` group
 * contains this milestone. `all` is the rule with no alternative route, so
 * dismissing a member makes that level permanently unsatisfiable and caps the
 * skill below it.
 */

import type { CompiledTree } from '$lib/types';

/**
 * The level a dismissal of `uid` would make unsatisfiable, or `null`.
 *
 * Scoped to levels **at or below the blocker** (§11.10): above it the level is
 * already out of reach through an earlier level, so the dismissal changes
 * nothing the user can act on and a warning there would be noise. An undefined
 * blocker means every level is currently satisfied, so every level counts.
 */
export function cappedLevel(
	tree: CompiledTree,
	uid: string,
	blockerLevel: number | undefined
): number | null {
	const ceiling = blockerLevel ?? tree.levels.length;

	for (const level of tree.levels) {
		if (level.level > ceiling) continue;
		for (const group of level.requirements) {
			if (group.rule !== 'all') continue;
			const holdsIt = group.milestones.some((ref) => tree.milestones[ref.index]?.uid === uid);
			if (holdsIt) return level.level;
		}
	}
	return null;
}

/** §11.3's satisfied set, printed with its gaps intact: `1, 3–4, 6`. */
export function formatClearedLevels(cleared: readonly number[]): string {
	const sorted = [...cleared].sort((a, b) => a - b);
	const runs: number[][] = [];
	for (const level of sorted) {
		const last = runs[runs.length - 1];
		if (last !== undefined && level === last[last.length - 1] + 1) last.push(level);
		else runs.push([level]);
	}
	return runs
		.map((run) => (run.length === 1 ? `${run[0]}` : `${run[0]}–${run[run.length - 1]}`))
		.join(', ');
}

/**
 * The same sentence for a whole placement (§11.8, T15): *"Saving this drops
 * Cooking from Level 8 to Level 1. Levels 3–8 stay cleared."*
 *
 * §11.10's warning is written for one milestone at a time, and F29 makes the
 * bulk case the ordinary one — a user correcting the estimator's guesses is
 * un-checking several things in a single action, and stating the consequence
 * afterwards would be stating it too late.
 */
export function placementWarning(
	skillTitle: string,
	consequence: { before: number; after: number; cleared: readonly number[] }
): string {
	const drop = `Saving this drops ${skillTitle} from Level ${consequence.before} to Level ${consequence.after}.`;
	const survives = formatClearedLevels(consequence.cleared);
	if (survives === '') return drop;
	const plural = consequence.cleared.length === 1 ? 'Level' : 'Levels';
	return `${drop} ${plural} ${survives} stay cleared.`;
}

/** *"Level 2 can't be completed without this. Cooking will stay at Level 1."* */
export function dismissalWarning(
	skillTitle: string,
	cappedAt: number,
	attainedLevel: number
): string {
	const stays = Math.min(attainedLevel, cappedAt - 1);
	return `Level ${cappedAt} can't be completed without this. ${skillTitle} will stay at Level ${stays}.`;
}

/**
 * *"Un-checking this drops Cooking from Level 8 to Level 1. Levels 3–8 stay
 * cleared."* The second sentence is what makes the first tolerable — the user
 * loses a rank, not their history (§11.10).
 */
export function uncheckWarning(
	skillTitle: string,
	consequence: { before: number; after: number; cleared: readonly number[] }
): string {
	const drop = `Un-checking this drops ${skillTitle} from Level ${consequence.before} to Level ${consequence.after}.`;
	const survives = formatClearedLevels(consequence.cleared);
	if (survives === '') return drop;
	const plural = consequence.cleared.length === 1 ? 'Level' : 'Levels';
	return `${drop} ${plural} ${survives} stay cleared.`;
}
