/**
 * The guided preview's two derivations (UI-SPEC §7.1, PRD D25 / §12 Q4).
 *
 * A pure function over content the application already holds, and that is the
 * point of the design it serves: D25's remainder was closed *without* authoring
 * a demonstration tree, without a schema field, and without fabricating
 * progress. If this ever needs a hand-authored input, that decision has been
 * reopened and this file is where it shows.
 *
 * Its sibling question — *which* skill the cartouche offers — is
 * `featured.test.ts`, beside the module that answers it.
 */

import { describe, expect, it } from 'vitest';
import { makeScoringTree } from '$lib/scoring/fixtures.js';
import type { CompiledTree } from '$lib/types';
import { PREVIEW_LEVELS, previewAnnotations } from './preview.js';

/** A tree whose every level carries four milestones, titled distinguishably. */
function fullTree(id = 'cooking'): CompiledTree {
  return makeScoringTree({
    id,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      milestones: [`L${i + 1}-a`, `L${i + 1}-b`, `L${i + 1}-c`, `L${i + 1}-d`],
    })),
  });
}

describe('previewAnnotations — what the glide says as it passes', () => {
  it('names levels 1, 5 and 10, which is the shape of the ladder', () => {
    const annotations = previewAnnotations(fullTree());
    expect(annotations.map((a) => a.level)).toEqual([...PREVIEW_LEVELS]);
  });

  it('takes its text from the content, never from a literal in the app', () => {
    // The whole D25 answer rests on this: the annotation is a real milestone
    // title, so no copy is authored for the preview and every tree in the
    // library gets one for free.
    const annotations = previewAnnotations(fullTree());
    expect(annotations.map((a) => a.title)).toEqual(['L1-a', 'L5-a', 'L10-a']);
  });

  it('takes the first milestone of the level in authored order', () => {
    const tree = makeScoringTree({
      id: 'ordered',
      levels: [{ level: 1, milestones: ['first', 'second', 'third', 'fourth'] }],
    });
    expect(previewAnnotations(tree)[0]?.title).toBe('first');
  });

  it('prefers a milestone label over its title where one exists', () => {
    // §9.2's short form exists because a node box cannot legibly show more, and
    // the annotation sits beside that same box.
    const tree = fullTree();
    const target = tree.milestones.find((m) => m.id === 'L1-a')!;
    const labelled: CompiledTree = {
      ...tree,
      milestones: tree.milestones.map((m) =>
        m === target ? { ...m, label: 'Boil an egg' } : m,
      ),
    };
    expect(previewAnnotations(labelled)[0]?.title).toBe('Boil an egg');
  });

  it('omits a level that has no milestones rather than inventing one', () => {
    // Levels are 1..10 always (§5.3) but a level may be empty in a sparse tree,
    // and an annotation pointing at nothing would glide the camera to a blank
    // band. Dropping it leaves a shorter, honest tour.
    const sparse = makeScoringTree({
      id: 'sparse',
      levels: [
        { level: 1, milestones: ['a', 'b', 'c', 'd'] },
        { level: 10, milestones: ['y1', 'y2', 'y3', 'y4'] },
      ],
    });
    expect(previewAnnotations(sparse).map((a) => a.level)).toEqual([1, 10]);
  });
});
