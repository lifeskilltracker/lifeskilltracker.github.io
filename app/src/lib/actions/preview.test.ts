/**
 * The guided preview's two derivations (UI-SPEC §7.1, PRD D25 / §12 Q4).
 *
 * Both are pure functions over content the application already holds, and that
 * is the point of the design they serve: D25's remainder was closed *without*
 * authoring a demonstration tree, without a schema field, and without
 * fabricating progress. If either of these ever needs a hand-authored input,
 * that decision has been reopened and this file is where it shows.
 */

import { describe, expect, it } from 'vitest';
import { makeScoringTree } from '$lib/scoring/fixtures.js';
import type { CompiledTree, Manifest, TreeEntry } from '$lib/types';
import { PREVIEW_LEVELS, featuredTreeId, previewAnnotations } from './preview.js';

function entry(id: string, milestoneCount: number): TreeEntry {
  return {
    id,
    contentVersion: 1,
    title: id,
    summary: '',
    domain: 'making',
    milestoneCount,
    authors: [],
    bundle: `${id}.json`,
    hasMastery: false,
    cell: { q: 0, r: 0 },
  };
}

function manifestOf(...trees: TreeEntry[]): Manifest {
  return {
    schemaVersion: 1,
    generated: '2026-08-26T00:00:00Z',
    taxonomy: { domains: [], facets: [], map: { regions: [] } },
    trees,
    moved: {},
  };
}

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

describe('featuredTreeId — which skill the welcome opens', () => {
  it('picks the fullest ladder, because that is the best advertisement', () => {
    const manifest = manifestOf(entry('piano', 40), entry('cooking', 73), entry('sleep', 22));
    expect(featuredTreeId(manifest)).toBe('cooking');
  });

  it('breaks a tie by tree id, so the choice is stable across builds', () => {
    // Two trees of equal size must not swap places when the compiler happens to
    // emit them in a different order — a welcome that opens a different skill on
    // every deploy is not a designed first impression.
    const ascending = manifestOf(entry('archery', 50), entry('baking', 50));
    const descending = manifestOf(entry('baking', 50), entry('archery', 50));
    expect(featuredTreeId(ascending)).toBe('archery');
    expect(featuredTreeId(descending)).toBe('archery');
  });

  it('is null for an empty library rather than throwing', () => {
    // A manifest with no trees is a real state — every domain fogged (§4.4) —
    // and the welcome must degrade to its second button, not to a crash.
    expect(featuredTreeId(manifestOf())).toBeNull();
  });
});

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
