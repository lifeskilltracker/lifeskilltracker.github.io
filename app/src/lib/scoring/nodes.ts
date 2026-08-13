/**
 * §11.4 — the five node states and the derived availability set.
 *
 * `available` is derived, never stored, and is the concrete-next-action set the
 * product exists to supply — §15.2's `.` shortcut jumps between them.
 *
 * **Note for T19:** §9.3 says four states come from the engine and "`dismissed`
 * comes from user state directly", while `NodeState` includes it and §11.4
 * defines it. §14.4 is followed here — the engine emits all five — and the
 * discrepancy is flagged rather than silently resolved.
 */

import type { CompiledTree, NodeState, TreeProgress } from '$lib/types';
import { thresholdOf } from './groups.js';

/**
 * **The surplus rule is order-independent, and that has a visible consequence.**
 *
 * §11.4 defines `complete` as "complete *and it is within its group's
 * threshold*", and `bonus` as complete "but its group already had
 * `completed >= n` without it". Those two phrasings disagree once a group has
 * more completions than it needs: "within the threshold" implies *selecting*
 * which `n` completions count, while the `bonus` test is per-milestone and
 * selects nothing.
 *
 * The per-milestone test is followed here, because any selection rule would
 * depend on iteration order — and §11.5 rejects exactly that reasoning for
 * `satisfiedBy` ("picking `n` of them would make the frozen set depend on
 * iteration order"). It would be incoherent for the same surplus to be
 * order-independent when frozen and order-dependent when rendered.
 *
 * The consequence, stated so §9's renderer is not surprised by it: in an
 * `n_of` group with **more** completions than the threshold, *every* completion
 * is individually surplus, so all of them read `bonus` and none reads
 * `complete`. At exactly the threshold, none is surplus and all read `complete`.
 * **Flagged for T08** — if that reads badly in the UI, the fix is a presentation
 * rule in §9, not a selection rule here.
 */

/**
 * **The multi-group rule, chosen and stated because §11.4 does not settle it.**
 *
 * §5.6 permits a milestone to appear in more than one group, and §11.4 defines
 * `bonus` relative to "its group" as though there were one — so a milestone can
 * be surplus in one group and load-bearing in another. The rule here is
 * **surplus in *every* group containing it**, which is the least surprising of
 * the available readings: a node is only demoted to decoration when it is
 * carrying no weight anywhere. The alternative (surplus in any one group) would
 * mark a milestone that is the sole reason another group is satisfied as
 * `bonus`, which reads as "you did not need this" about something the level
 * genuinely needs.
 *
 * Flagged for review with §9.6's renderer (T08).
 */
function isSurplusEverywhere(uid: string, tree: CompiledTree, complete: Set<string>): boolean {
  let appearsInAGroup = false;

  for (const level of tree.levels) {
    for (const group of level.requirements) {
      const uids = group.milestones
        .map((ref) => tree.milestones[ref.index]?.uid)
        .filter((u): u is string => u !== undefined);
      if (!uids.includes(uid)) continue;

      appearsInAGroup = true;
      const completedWithout = uids.filter((u) => u !== uid && complete.has(u)).length;
      // Its group already had `completed >= n` without it (F11's surplus).
      if (completedWithout < thresholdOf(group)) return false;
    }
  }

  // §6.2 rule 8 puts every milestone in at least one group at its level, so
  // this is unreachable through a validated bundle.
  return appearsInAGroup;
}

export interface NodeStateResult {
  nodeStates: ReadonlyMap<string, NodeState>;
  available: string[];
}

export function evaluateNodes(tree: CompiledTree, progress: TreeProgress): NodeStateResult {
  const complete = new Set<string>();
  for (const milestone of tree.milestones) {
    if (progress.milestones.get(milestone.uid) === 'complete') complete.add(milestone.uid);
  }

  const nodeStates = new Map<string, NodeState>();
  const available: string[] = [];

  for (const milestone of tree.milestones) {
    const state = progress.milestones.get(milestone.uid);

    if (state === 'complete') {
      nodeStates.set(
        milestone.uid,
        isSurplusEverywhere(milestone.uid, tree, complete) ? 'bonus' : 'complete',
      );
      continue;
    }

    if (state === 'dismissed') {
      nodeStates.set(milestone.uid, 'dismissed');
      continue;
    }

    // Every `requires` target complete — and dismissal is not completion, so a
    // milestone whose prerequisite was dismissed stays locked (F36).
    const unlocked = (milestone.requires ?? []).every((ref) => {
      const prerequisite = tree.milestones[ref.index]?.uid;
      return prerequisite !== undefined && complete.has(prerequisite);
    });

    if (unlocked) {
      nodeStates.set(milestone.uid, 'available');
      available.push(milestone.uid);
    } else {
      nodeStates.set(milestone.uid, 'locked');
    }
  }

  return { nodeStates, available };
}
