/**
 * Which skill the welcome cartouche offers (§6.5, §7.1 — PRD D25, §12 Q4).
 *
 * Small, and worth its own file for the same reason the module is its own: this
 * runs inside a lazy chunk that the returning Player never fetches, and keeping
 * it separate is what stops the map's first paint from carrying it (§17.1).
 */

import { describe, expect, it } from 'vitest';
import { featuredTree } from './featured.js';

const tree = (id: string, milestoneCount: number) => ({
  id,
  title: id[0].toUpperCase() + id.slice(1),
  milestoneCount,
});

describe('featuredTree', () => {
  it('picks the fullest ladder, because that is the best advertisement', () => {
    expect(featuredTree([tree('piano', 40), tree('cooking', 73), tree('sleep', 22)])?.id).toBe(
      'cooking',
    );
  });

  it('breaks a tie by tree id, so the choice is stable across builds', () => {
    // Two trees of equal size must not swap places when the compiler happens to
    // emit them in a different order — a welcome that opens a different skill on
    // every deploy is not a designed first impression.
    const ascending = [tree('archery', 50), tree('baking', 50)];
    expect(featuredTree(ascending)?.id).toBe('archery');
    expect(featuredTree([...ascending].reverse())?.id).toBe('archery');
  });

  it('returns the whole entry, so the button can name the skill', () => {
    // "Show me Cooking" is a concrete promise where "Show me a skill" is an
    // unlabelled door.
    expect(featuredTree([tree('cooking', 73)])?.title).toBe('Cooking');
  });

  it('is null for an empty library rather than throwing', () => {
    // Every domain fogged (§4.4) is a real state, and the cartouche degrades to
    // its second button.
    expect(featuredTree([])).toBeNull();
  });
});
