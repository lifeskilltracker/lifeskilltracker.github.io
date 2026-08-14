/**
 * §15.2's live-region text (T20).
 *
 * *"Forge a leaf keyring complete. Level 2 complete. Blacksmithing is now
 * Level 2, Novice. Three milestones newly available."*
 *
 * **The announcement states the consequence, not the click.** That is the whole
 * requirement, and it is why this is a diff of two `SkillProgress` values rather
 * than a message composed at the point of the intent: the component that handles
 * the click does not know what the click caused. Only the before-and-after does,
 * and the shell hands the after back as a prop (§13.4, §14.4).
 *
 * Everything here is derived from the engine's output. Nothing re-scores, and no
 * threshold or tier mapping is repeated — `SkillProgress.tier` is already the
 * answer §11.3 gives.
 *
 * `polite`, on a single shared region, and there is no `assertive` region
 * anywhere in the app: an interruption on every checkbox is the failure mode
 * §15.2 names.
 */

import type { SkillProgress } from '$lib/scoring';
import type { CompiledTree, NodeState } from '$lib/types';
import { countWord } from './node-description.js';

function done(state: NodeState | undefined): boolean {
  return state === 'complete' || state === 'bonus';
}

function titleOf(tree: CompiledTree, uid: string): string {
  return tree.milestones.find((m) => m.uid === uid)?.title ?? uid;
}

/**
 * `null` when the two states differ in nothing worth speaking about — a note
 * saved, or a prop re-assigned with the same content. Announcing "nothing
 * changed" on every re-render is how a live region becomes noise a user turns
 * off.
 */
export function progressAnnouncement(
  tree: CompiledTree,
  before: SkillProgress,
  after: SkillProgress,
): string | null {
  const sentences: string[] = [];

  const newlyDone = [...after.nodeStates.keys()].filter(
    (uid) => done(after.nodeStates.get(uid)) && !done(before.nodeStates.get(uid)),
  );
  const newlyUndone = [...after.nodeStates.keys()].filter(
    (uid) => !done(after.nodeStates.get(uid)) && done(before.nodeStates.get(uid)),
  );

  for (const uid of newlyDone) sentences.push(`${titleOf(tree, uid)} complete.`);
  for (const uid of newlyUndone) sentences.push(`${titleOf(tree, uid)} un-checked.`);

  const clearedNow = after.cleared.filter((level) => !before.cleared.includes(level));
  const clearedLost = before.cleared.filter((level) => !after.cleared.includes(level));
  for (const level of clearedNow) sentences.push(`Level ${level} complete.`);
  for (const level of clearedLost) sentences.push(`Level ${level} is no longer complete.`);

  if (after.attainedLevel !== before.attainedLevel) {
    sentences.push(
      after.attainedLevel === 0
        ? `${tree.title} is back to Level 0, not yet ranked.`
        : `${tree.title} is now Level ${after.attainedLevel}, ${after.tier}.`,
    );
  }

  // Newly *available*, not the total: the count a user acts on is what opened up.
  const opened = after.available.filter((uid) => !before.available.includes(uid)).length;
  if (opened > 0) {
    sentences.push(`${countWord(opened)} milestone${opened === 1 ? '' : 's'} newly available.`);
  }

  return sentences.length === 0 ? null : sentences.join(' ');
}
