/**
 * §5.5's detail panel, assembled (T31).
 *
 * **The panel loads the bundle; the map does not.** This is the answer to the
 * hazard T31's task doc names, and it splits in two:
 *
 * - **Everything the *hexes* need is on the manifest** — title, domain, cell,
 *   authors (F6), and mastery presence. A level-1 frame draws twenty hexes, so
 *   deciding any of it per bundle would put twenty chunk fetches on the frame,
 *   which is exactly what §7.1's small-manifest/large-chunks split exists to
 *   prevent. `hasMastery` was added to the manifest for this reason.
 * - **Everything only the *panel* needs comes from the bundle** — progress to
 *   next, the blocking level, and the next available milestone are all functions
 *   of the compiled tree, and no summary of them belongs on the manifest. One
 *   bundle, fetched when a panel opens, on a user gesture, off the critical path
 *   (§3.3). The panel renders its manifest half immediately and fills the rest
 *   in, so opening it never looks like nothing happened.
 *
 * A load failure is a *degraded panel*, never an absent one. The manifest half
 * is still true, and `TreeUnavailableError` on a skill the user asked about is
 * not a reason to refuse to name it.
 */

import { scoreSkill, type SkillProgress } from '$lib/scoring';
import type { NextStepSources } from './next-step.js';
import type { SkillHexRow } from './skill-hexes.js';
import type { Manifest } from '$lib/types';

export interface SkillDetailMilestone {
  readonly uid: string;
  readonly slug: string;
  readonly title: string;
}

export interface SkillDetail {
  readonly row: SkillHexRow;
  /** F6 — from the manifest, so it is on screen with the rest of the header. */
  readonly authors: readonly string[];
  /** `null` while loading, and after a load that failed. */
  readonly progress: SkillProgress | null;
  /** The first available milestone in document order (F36's own order). */
  readonly next: SkillDetailMilestone | null;
  /** True once the bundle half has settled, whether or not it succeeded. */
  readonly resolved: boolean;
  /** Set when the bundle could not be read; the panel says so rather than lying. */
  readonly unavailable: boolean;
}

/** The manifest half, available synchronously — what the panel paints first. */
export function skillDetailHeader(manifest: Manifest, row: SkillHexRow): SkillDetail {
  const entry = manifest.trees.find((tree) => tree.id === row.treeId);
  return {
    row,
    authors: entry?.authors ?? [],
    progress: null,
    next: null,
    resolved: false,
    unavailable: false,
  };
}

/** The bundle half. Never rejects: a failed load is a degraded panel. */
export async function loadSkillDetail(
  sources: NextStepSources,
  manifest: Manifest,
  row: SkillHexRow,
): Promise<SkillDetail> {
  const header = skillDetailHeader(manifest, row);

  try {
    const tree = await sources.loadTree(row.treeId);
    const progress = scoreSkill(tree, sources.progressFor(row.treeId));
    const byUid = new Map(tree.milestones.map((milestone) => [milestone.uid, milestone]));

    // `available` is already in document order, which is the order F36's `.`
    // shortcut promises — "the next thing", not the nearest thing.
    const first = progress.available
      .map((uid) => byUid.get(uid))
      .find((milestone) => milestone !== undefined);

    return {
      ...header,
      progress,
      next: first === undefined ? null : { uid: first.uid, slug: first.id, title: first.title },
      resolved: true,
    };
  } catch {
    return { ...header, resolved: true, unavailable: true };
  }
}

/**
 * §11.3's blocker as a sentence. It is the panel's most useful line and the one
 * most easily rendered as a number with no meaning attached: "blocked at level
 * 4" says nothing a reader can act on, so the shortfall is named too.
 */
export function blockerText(progress: SkillProgress | null): string | null {
  if (progress?.blocker === undefined) return null;
  const { level, shortfall } = progress.blocker;
  if (shortfall.length === 0) return `Level ${level} is the next to clear.`;
  const groups = shortfall.length === 1 ? 'group' : 'groups';
  return `Level ${level} is blocked by ${shortfall.length} ${groups}.`;
}
