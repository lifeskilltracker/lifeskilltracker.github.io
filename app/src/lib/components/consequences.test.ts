/**
 * §11.10's two consequence messages, as arithmetic over props (T08).
 *
 * They are here rather than in the component because the interesting part is
 * the *predicate* — which dismissals cap a skill and which do not — and a
 * predicate that can only be exercised by clicking is a predicate that will be
 * tested for one case.
 */

import { describe, expect, it } from 'vitest';
import { makeScoringTree, uidOf } from '$lib/scoring/fixtures.js';
import { cappedLevel, formatClearedLevels } from './consequences.js';

const tree = makeScoringTree({
	id: 'consequences',
	levels: [
		{ level: 1, milestones: ['a', 'b'] },
		{
			level: 2,
			milestones: ['c', 'd', 'e', 'f'],
			requirements: [
				{ rule: 'all', milestones: ['c', 'd'] },
				{ rule: 'n_of', n: 1, milestones: ['e', 'f'] }
			]
		},
		{ level: 3, milestones: ['g', 'h'] }
	]
});

describe('cappedLevel — which dismissals make a level unsatisfiable', () => {
	it('names the level for an `all` milestone at the blocker', () => {
		expect(cappedLevel(tree, uidOf(tree, 'c'), 2)).toBe(2);
	});

	it('names it below the blocker as well', () => {
		expect(cappedLevel(tree, uidOf(tree, 'a'), 2)).toBe(1);
	});

	it('is null for an `n_of` milestone — the group has other ways to satisfy', () => {
		expect(cappedLevel(tree, uidOf(tree, 'e'), 2)).toBeNull();
	});

	it('is null above the blocker, which is already unreached', () => {
		expect(cappedLevel(tree, uidOf(tree, 'g'), 2)).toBeNull();
	});

	it('treats every level as reachable when nothing blocks', () => {
		expect(cappedLevel(tree, uidOf(tree, 'g'), undefined)).toBe(3);
	});
});

describe('formatClearedLevels — §11.3’s surviving record', () => {
	it('collapses a contiguous run, as §11.10’s own example does', () => {
		expect(formatClearedLevels([3, 4, 5, 6, 7, 8])).toBe('3–8');
	});

	it('keeps gaps visible, because F29 makes the scattered case the normal one', () => {
		expect(formatClearedLevels([1, 3, 4, 6])).toBe('1, 3–4, 6');
	});

	it('reports a single level as itself', () => {
		expect(formatClearedLevels([5])).toBe('5');
	});

	it('is empty for nothing cleared', () => {
		expect(formatClearedLevels([])).toBe('');
	});
});
