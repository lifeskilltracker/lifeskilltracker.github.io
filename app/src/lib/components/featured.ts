/**
 * Which skill the welcome cartouche offers (§6.5, §7.1 — PRD D25, §12 Q4).
 *
 * **Its own module, and that is a bundle decision rather than a taxonomy one.**
 * `welcome.ts` beside it is imported by the shell, so everything in it is on the
 * map's first paint (§17.1). This is read only by the cartouche, which is a lazy
 * chunk the returning Player never fetches — so it lives where only that chunk
 * reaches it, and the map pays nothing for it.
 */

/**
 * Just the fields the choice reads, declared structurally rather than importing
 * `TreeEntry` — the same move `tree-camera.ts` makes with `CameraLayout`, and for
 * the same reason: a real manifest entry satisfies this without a cast.
 */
export interface FeaturedCandidate {
  readonly id: string;
  readonly title: string;
  readonly milestoneCount: number;
}

/**
 * **The fullest ladder wins**, because the preview is an advertisement for the
 * idea of a ladder and a forty-node tree makes that case better than a
 * twelve-node one. Ties break on tree id so the choice is stable: the compiler is
 * free to reorder its output, and a welcome that opened a different skill on
 * every deploy would not be a designed first impression.
 *
 * `milestoneCount` is already on the manifest entry (§7.2), so this costs no
 * bundle fetch — the cartouche can name its destination before anything below the
 * map has loaded.
 *
 * Deliberately **not** a `featured:` flag in `domains.yaml`. That would be one
 * more thing for a maintainer to keep true, and goal 2 exists to prevent exactly
 * that class of bottleneck.
 */
export function featuredTree<T extends FeaturedCandidate>(
  trees: readonly T[],
): T | null {
  let best: T | null = null;
  for (const tree of trees) {
    if (
      best === null ||
      tree.milestoneCount > best.milestoneCount ||
      (tree.milestoneCount === best.milestoneCount && tree.id < best.id)
    ) {
      best = tree;
    }
  }
  return best;
}
