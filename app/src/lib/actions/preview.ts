/**
 * The guided preview's derivations (UI-SPEC §7.1 — PRD D25, §12 Q4).
 *
 * D25's remainder was "how does a visitor who will never tap *start* reach a
 * compelling view of a **tree**". The answer this module serves is that they
 * reach a real one, unstarted, and the level camera walks them up it — so what
 * is needed here is not content but two questions about content the application
 * is already holding: *which* tree, and *what to say* as the camera passes.
 *
 * **Both answers are derived, and that is load-bearing rather than tidy.** The
 * alternatives considered were a tree authored for the demonstration and a
 * `preview:` block in the schema; both were declined (§11.2). Each would have
 * put hand-written content on the one path a first-time visitor is guaranteed to
 * walk, where it would rot silently — the tree it described would be revised
 * under it (F43) and nothing would fail. Deriving means the preview is correct
 * by construction for every tree in the library, today and at 500.
 *
 * Pure, and deliberately in `lib/actions` rather than beside the component:
 * §14.1 makes this the one layer that may hold a manifest and a compiled tree at
 * once, and `featuredTreeId` reads the former while `previewAnnotations` reads
 * the latter.
 */

import type { CompiledTree, Manifest } from '$lib/types';

/**
 * The three rungs the tour stops at: the bottom of the ladder, its middle, and
 * its top. Five is the interesting one — PRD §4.4 describes this visitor as
 * wanting to know "what Level 5 Cooking means", and this is the line that
 * answers them literally.
 */
export const PREVIEW_LEVELS = [1, 5, 10] as const;

export interface PreviewAnnotation {
  readonly level: number;
  /** A real milestone's short form, or its title where it has no short form. */
  readonly title: string;
}

/**
 * The skill the welcome opens (§6.5).
 *
 * **The fullest ladder wins**, because the preview is an advertisement for the
 * idea of a ladder and a forty-node tree makes that case better than a
 * twelve-node one. Ties break on tree id so the choice is stable: the compiler
 * is free to reorder `trees`, and a welcome that opened a different skill on
 * every deploy would not be a designed first impression.
 *
 * `milestoneCount` is on the manifest entry already (§7.2), so this costs no
 * bundle fetch — which is why the welcome can name its destination before
 * anything below the map has loaded.
 *
 * Deliberately **not** a `featured:` flag in `domains.yaml`. That would be one
 * more thing for a maintainer to keep true, and goal 2 exists to prevent
 * exactly that class of bottleneck.
 */
export function featuredTreeId(manifest: Manifest): string | null {
  let best: { id: string; count: number } | null = null;
  for (const tree of manifest.trees) {
    if (
      best === null ||
      tree.milestoneCount > best.count ||
      (tree.milestoneCount === best.count && tree.id < best.id)
    ) {
      best = { id: tree.id, count: tree.milestoneCount };
    }
  }
  return best?.id ?? null;
}

/**
 * What the tour says at each stop.
 *
 * The text is a milestone the contributor actually wrote — "make instant
 * noodles" at the bottom, "teach a cooking class" at the top — which is the
 * whole sell, and it costs the content pipeline nothing.
 *
 * A level with no milestones is **dropped rather than filled**. Levels are
 * always 1..10 (§5.3) but a sparse tree may leave one empty, and an annotation
 * pointing at an empty band would glide the camera to nothing. A shorter tour is
 * the honest outcome.
 */
export function previewAnnotations(tree: CompiledTree): readonly PreviewAnnotation[] {
  return PREVIEW_LEVELS.map((level) => {
    // Authored order, which `order` carries (§5.3) — not array position, which
    // is an artefact of how the flat index happened to be built.
    const first = tree.milestones
      .filter((milestone) => milestone.level === level)
      .sort((a, b) => a.order - b.order)[0];
    return first === undefined
      ? null
      : { level, title: first.label ?? first.title };
  }).filter((annotation): annotation is PreviewAnnotation => annotation !== null);
}
