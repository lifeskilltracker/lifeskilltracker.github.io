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
 * Pure, and in `lib/actions` because it reads a compiled tree — the bundle the
 * skill route has already loaded. Its sibling question, *which* tree the welcome
 * offers, lives in `lib/components/welcome.ts` instead: that one is answered on
 * the map, before any bundle exists, and keeping it there is what stops the map's
 * first paint from carrying code only the tree route runs (§17.1).
 */

import type { CompiledTree } from '$lib/types';

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
  return PREVIEW_LEVELS.map((level): PreviewAnnotation | null => {
    // Authored order, which `order` carries (§5.3) — not array position, which
    // is an artefact of how the flat index happened to be built.
    const first = tree.milestones
      .filter((milestone) => milestone.level === level)
      .sort((a, b) => a.order - b.order)[0];
    return first === undefined ? null : { level, title: first.label ?? first.title };
  }).filter((annotation) => annotation !== null);
}
