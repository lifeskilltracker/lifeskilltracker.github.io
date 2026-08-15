/**
 * Three successive releases of one tree, with a ledger that accumulates (T17).
 *
 * §5.4 makes `lineage` append-only and §6.4 check 6 enforces it, so v3 carries
 * v2's entry as well as its own. That is the whole reason §12.5's fold has to
 * compose: a user who skips a release runs **one** pass against the latest
 * bundle's accumulated ledger, not one pass per version, and must land in the
 * same place as a user who opened the tree after every release.
 *
 * The sequence is deliberately the awkward one — a `split` in v2 whose
 * successors are `merged` in v3. Folded forward it composes; folded backwards
 * the merge matches nothing and the sweep orphans the lot, which is why §12.5
 * makes file order normative rather than incidental.
 */

import type { CompiledTree, LineageEntry } from '$lib/types';
import { makeTree } from '$lib/layout/fixtures.js';

/** Crockford-shaped and stable across the three releases — that is the point of a uid (D-05). */
export const KNIFE = 'q4np8w2r';
export const TAPER = 'm3xk90ab';
export const BEND = 'v8t2ncq5';
export const GRIND = 'z2vr65jm';
export const BOIL = 'b7ldk3fp';
export const EGG = 'h8dq37nc';
export const STEAK = 'c5fj92tk';

export interface BundleSpec {
  id?: string;
  contentVersion: number;
  /** Declared in level order, because `makeTree` pads its ten rows in that order. */
  milestones: { uid: string; slug: string; level: number; title?: string }[];
  lineage?: LineageEntry[];
}

/**
 * `makeTree` derives a deterministic uid from `(slug, index)`, which is right
 * for layout fixtures and wrong here: lineage exists precisely because a slug
 * may change while the uid does not, so these fixtures name their uids.
 */
export function bundle(spec: BundleSpec): CompiledTree {
  const tree = makeTree({
    id: spec.id ?? 'cooking',
    contentVersion: spec.contentVersion,
    milestones: spec.milestones.map((m) => ({
      id: m.slug,
      level: m.level,
      title: m.title ?? titleOf(m.uid),
    })),
  });
  spec.milestones.forEach((m, index) => {
    (tree.milestones[index] as { uid: string }).uid = m.uid;
  });
  return { ...tree, ...(spec.lineage === undefined ? {} : { lineage: spec.lineage }) };
}

export const titleOf = (uid: string): string => `Milestone ${uid}`;

/** v1 — before anything was revised. */
export const v1 = (): CompiledTree =>
  bundle({
    contentVersion: 1,
    milestones: [
      { uid: KNIFE, slug: 'knife-grip', level: 1 },
      { uid: BOIL, slug: 'boil-pasta', level: 1 },
      { uid: EGG, slug: 'fried-egg', level: 1 },
      { uid: STEAK, slug: 'sear-steak', level: 2 },
    ],
  });

/** v2 — the knife milestone was too coarse and became two. */
export const v2 = (): CompiledTree =>
  bundle({
    contentVersion: 2,
    milestones: [
      { uid: TAPER, slug: 'taper-a-blade', level: 1 },
      { uid: BEND, slug: 'bend-a-blade', level: 1 },
      { uid: BOIL, slug: 'boil-pasta', level: 1 },
      { uid: EGG, slug: 'fried-egg', level: 1 },
      { uid: STEAK, slug: 'sear-steak', level: 2 },
    ],
    lineage: [
      { uid: KNIFE, op: 'split', into: [TAPER, BEND], note: 'separated tapering from bending' },
    ],
  });

/** v3 — the two halves turned out to be one skill after all, and the egg went. */
export const v3 = (): CompiledTree =>
  bundle({
    contentVersion: 3,
    milestones: [
      { uid: GRIND, slug: 'grind-a-bevel', level: 1 },
      { uid: BOIL, slug: 'boil-pasta', level: 1 },
      { uid: STEAK, slug: 'sear-steak', level: 2 },
    ],
    lineage: [
      { uid: KNIFE, op: 'split', into: [TAPER, BEND], note: 'separated tapering from bending' },
      // Two entries, one target: §12.5 fold rule 2 evaluates them as one
      // disposition at the position of the second.
      { uid: TAPER, op: 'merged', into: [GRIND] },
      { uid: BEND, op: 'merged', into: [GRIND] },
      { uid: EGG, op: 'retired', note: 'covered by boil-pasta' },
    ],
  });
