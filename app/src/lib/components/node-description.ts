/**
 * §15.2's node accessible name and description (T20, D-10, N5).
 *
 * This module exists because the description is the one part of the tree that a
 * sighted user reads off the *layout* for free: which milestones gate this one,
 * whether those are done, and which requirement group this milestone serves.
 * None of that is recoverable from a drawn graph by a screen reader, and §15.1
 * makes the list — not the graph — the primary representation, so the text has
 * to carry it.
 *
 * It is a pure function over the compiled tree and `SkillProgress` so the
 * wording is assertable without a DOM, and so the component stays a renderer:
 * §13.4 keeps the engines out of components, and this reads the engine's
 * *output* rather than re-deriving any of it.
 *
 * Two deliberate departures from §15.2's worked example, both forced by the
 * schema:
 *
 * - The example names a *"core group"*. Requirement groups have **no name** in
 *   the schema (§5.6 — a group is a rule, a threshold, and a milestone list),
 *   so the group is identified by what it demands instead: "all of Level 2's
 *   required group", "any 1 of 3 in Level 2's choice group". Inventing a name
 *   here would put authored-looking vocabulary in the renderer.
 * - The example's *"— both complete"* reads well only when the prerequisites
 *   agree. When they disagree, a trailing summary would state a count and lose
 *   *which* one is outstanding, which is the single most useful fact in the
 *   sentence, so a mixed set annotates each prerequisite individually.
 */

import type { CompiledMilestone, CompiledTree, NodeState } from '$lib/types';
import type { SkillProgress } from '$lib/scoring';

/**
 * §9.3's five states as prose. `bonus` and `dismissed` are the two whose
 * internal names would mislead: a screen reader saying "Bonus" conveys nothing,
 * and "Dismissed" reads as a judgement where §9.3 means "set aside".
 */
const STATE_TEXT: Record<NodeState, string> = {
  complete: 'Complete',
  bonus: 'Complete — surplus for this level',
  available: 'Available',
  locked: 'Locked',
  dismissed: 'Set aside',
};

const WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
];

/** Small counts read better as words in speech; large ones do not. */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

function milestoneOf(tree: CompiledTree, uid: string): CompiledMilestone | undefined {
  return tree.milestones.find((m) => m.uid === uid);
}

/** The level a milestone is declared at, or `undefined` for mastery (§5.7). */
export function levelOf(tree: CompiledTree, uid: string): number | undefined {
  for (const level of tree.levels) {
    if (level.milestones.some((ref) => tree.milestones[ref.index]?.uid === uid)) {
      return level.level;
    }
  }
  return undefined;
}

/**
 * The accessible **name**: the authored title in full, never the short `label`.
 * The node box shows `label` because it holds about forty characters (T10), and
 * the whole point of the pair is that the clipped form is visual only — two
 * milestones sharing an opening are indistinguishable by their labels alone.
 */
export function nodeAccessibleName(tree: CompiledTree, uid: string): string {
  const milestone = milestoneOf(tree, uid);
  return milestone?.title ?? uid;
}

/**
 * The **title** of the track a milestone sits in, or `''` for a track-less tree
 * (§8.2 step 2's synthetic column). `trackIndex` is the compiled form; the
 * authored `title` is what a reader is shown, and §9 draws the same string as
 * the column header, so the two cannot drift.
 */
export function trackTitleOf(tree: CompiledTree, uid: string): string {
  const tracks = tree.tracks ?? [];
  if (tracks.length === 0) return '';
  const milestone = milestoneOf(tree, uid);
  if (milestone === undefined || milestone.track === '') return '';
  return tracks[milestone.trackIndex]?.title ?? '';
}

/** §5's optional module grouping, or `''` when the tree declares none (F29). */
export function moduleOf(tree: CompiledTree, uid: string): string {
  return milestoneOf(tree, uid)?.module ?? '';
}

function isDone(state: NodeState | undefined): boolean {
  return state === 'complete' || state === 'bonus';
}

/** §5.7 lets a milestone's `requires` name only other milestones. */
function prerequisitesOf(tree: CompiledTree, uid: string): CompiledMilestone[] {
  const milestone = milestoneOf(tree, uid);
  return (milestone?.requires ?? [])
    .map((ref) => tree.milestones[ref.index])
    .filter((m): m is CompiledMilestone => m !== undefined);
}

/**
 * "Requires: a; b — both complete." — the clause §15.2 requires to state the
 * prerequisites *and whether they are met*. Empty string when there are none:
 * "Requires nothing" is noise on the majority of nodes in a linear tree.
 */
export function prerequisiteClause(tree: CompiledTree, progress: SkillProgress, uid: string): string {
  const prerequisites = prerequisitesOf(tree, uid);
  if (prerequisites.length === 0) return '';

  const done = prerequisites.map((m) => isDone(progress.nodeStates.get(m.uid)));
  const met = done.filter(Boolean).length;
  const titles = prerequisites.map((m) => m.title);

  if (met === prerequisites.length) {
    const suffix =
      prerequisites.length === 1 ? 'complete' : prerequisites.length === 2 ? 'both complete' : 'all complete';
    return `Requires: ${titles.join('; ')} — ${suffix}.`;
  }

  if (met === 0) {
    const suffix =
      prerequisites.length === 1
        ? 'not complete'
        : prerequisites.length === 2
          ? 'neither complete'
          : 'none complete';
    return `Requires: ${titles.join('; ')} — ${suffix}.`;
  }

  // Mixed: annotate each, because the count alone hides which one is outstanding.
  const annotated = prerequisites.map(
    (m, index) => `${m.title} (${done[index] ? 'complete' : 'not complete'})`,
  );
  return `Requires: ${annotated.join('; ')}.`;
}

/**
 * "Counts toward: all of Level 2's required group." — §15.2's last sentence,
 * and the one a sighted user gets from the row chrome (§9.6) for free.
 *
 * A milestone may serve more than one group (§5.6), so every group it appears
 * in is named. §5.6 also guarantees it appears in at least one, which makes the
 * empty case an authoring defect rather than a state to phrase — but the
 * renderer says so plainly instead of falling silent, since an unreferenced
 * milestone is exactly the mistake that rule exists to catch.
 */
export function countsTowardClause(tree: CompiledTree, uid: string): string {
  const level = tree.levels.find((candidate) =>
    candidate.milestones.some((ref) => tree.milestones[ref.index]?.uid === uid),
  );
  if (level === undefined) return '';

  const required = level.requirements.filter((group) => group.rule === 'all');
  const choice = level.requirements.filter((group) => group.rule === 'n_of');

  const phrases: string[] = [];
  for (const group of level.requirements) {
    if (!group.milestones.some((ref) => tree.milestones[ref.index]?.uid === uid)) continue;

    if (group.rule === 'all') {
      const ordinal = required.length > 1 ? `${ORDINALS[required.indexOf(group)] ?? ''} ` : '';
      phrases.push(`all of Level ${level.level}'s ${ordinal}required group`);
    } else {
      const ordinal = choice.length > 1 ? `${ORDINALS[choice.indexOf(group)] ?? ''} ` : '';
      phrases.push(
        `any ${group.n} of ${group.milestones.length} in Level ${level.level}'s ${ordinal}choice group`,
      );
    }
  }

  if (phrases.length === 0) {
    return `Counts toward nothing — it is in no requirement group for Level ${level.level}.`;
  }
  return `Counts toward: ${phrases.join('; and ')}.`;
}

/**
 * The whole §15.2 description: level, **track and module**, state, prerequisites
 * and whether they are met, and the requirement group served — in that order,
 * which is the order the worked example fixes, with F29's two placements slotted
 * beside the level because all three answer "where am I".
 *
 * F29's correctness half lands here rather than on the accessible *name*.
 * §15.2's grid order is `(level, track, lane)` and `↑`/`↓` move within a track,
 * so a reader who is never told the track is navigating a structure they have no
 * word for. The name stays the authored title alone — that is a stated contract
 * above, and prefixing every name with its track would make a list of fifty
 * milestones read as fifty repetitions of three strings before any of them says
 * what it is.
 */
export function nodeDescription(tree: CompiledTree, progress: SkillProgress, uid: string): string {
  const level = levelOf(tree, uid);
  const state = progress.nodeStates.get(uid);
  const track = trackTitleOf(tree, uid);
  const moduleName = moduleOf(tree, uid);

  return [
    level === undefined ? '' : `Level ${level}.`,
    track === '' ? '' : `${track} track.`,
    moduleName === '' ? '' : `${moduleName} module.`,
    state === undefined ? '' : `${STATE_TEXT[state]}.`,
    prerequisiteClause(tree, progress, uid),
    countsTowardClause(tree, uid),
  ]
    .filter((part) => part !== '')
    .join(' ');
}

/**
 * §15.2's level heading: number, tier name, and per-group progress, so a user
 * traversing by heading gets F32's readout without entering the level. The
 * visible heading renders the same three things (§9.6) — this is the accessible
 * name for the `<section>`, which needs the counts spelled out rather than left
 * as the bare `n / m` fragments the eye reads as a row.
 */
export function levelSectionName(
  level: number,
  tier: string,
  groups: readonly { completed: number; n: number }[],
): string {
  const counts = groups.map((group) => `${Math.min(group.completed, group.n)} of ${group.n}`);
  const progress =
    counts.length === 0
      ? ''
      : counts.length === 1
        ? ` — ${counts[0]} complete.`
        : ` — ${counts.join(', ')} complete across ${countWord(counts.length).toLowerCase()} requirement groups.`;
  return `Level ${level}, ${tier}${progress}`;
}
