/**
 * The skill page's session (T08) — the seam where a loaded bundle, the Scoring
 * Engine, and the User State Store meet.
 *
 * It lives in `lib/actions` because that is the only module §14.1 permits to
 * touch both I/O owners, and the route is a component. The single most
 * load-bearing thing it does is **register the open tree**: §14.5 gives
 * `setMilestoneState` no tree argument and §12.4 step 2 needs the bundle, so a
 * page that renders without calling `openTree` looks perfectly correct until
 * the first click, which rejects.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeScoringTree, uidOf } from '$lib/scoring/fixtures.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store, TreeNotOpenError } from '$lib/state/store.js';
import type { CompiledTree } from '$lib/types';
import { openTreeSession } from './tree-session.svelte.js';

/** Level 1 is one `all` group of two; clearing both attains level 1. */
function tinyTree(id: string): CompiledTree {
	return makeScoringTree({
		id,
		levels: [
			{ level: 1, milestones: ['a', 'b'] },
			{ level: 2, milestones: ['c', 'd'] }
		]
	});
}

let counter = 0;

beforeEach(async () => {
	progress.reset();
	progress.writable = true;
	progress.hydrated = true;
	await store.close();
});

describe('openTreeSession — §12.4’s write path from a rendered page', () => {
	it('registers the tree, so the first click does not reject', async () => {
		const tree = tinyTree(`session-${(counter += 1)}`);
		const session = openTreeSession(tree);

		await session.apply({ kind: 'complete', uid: uidOf(tree, 'a') });

		expect(store.progressFor(tree.id).milestones.get(uidOf(tree, 'a'))).toBe('complete');
	});

	it('rejects a write for a tree nobody opened — the failure the registration prevents', async () => {
		const tree = tinyTree(`unopened-${(counter += 1)}`);

		await expect(store.setMilestoneState(uidOf(tree, 'a'), 'complete')).rejects.toBeInstanceOf(
			TreeNotOpenError
		);
	});

	it('maps dismissal and undo onto §12.2’s record states', async () => {
		const tree = tinyTree(`states-${(counter += 1)}`);
		const session = openTreeSession(tree);
		const uid = uidOf(tree, 'a');

		await session.apply({ kind: 'dismiss', uid });
		expect(store.progressFor(tree.id).milestones.get(uid)).toBe('dismissed');

		// Incomplete is the absence of a record, never a stored null (§12.2).
		await session.apply({ kind: 'undo', uid });
		expect(store.progressFor(tree.id).milestones.has(uid)).toBe(false);
	});

	it('keeps a note against the state the milestone is already in (F31)', async () => {
		const tree = tinyTree(`note-${(counter += 1)}`);
		const session = openTreeSession(tree);
		const uid = uidOf(tree, 'a');

		await session.apply({ kind: 'complete', uid });
		await session.apply({ kind: 'note', uid, note: 'Used the cast iron.' });

		expect(store.progressFor(tree.id).milestones.get(uid)).toBe('complete');
		expect(progress.milestones[uid]?.note).toBe('Used the cast iron.');
	});

	it('scores the tree it was opened with', async () => {
		const tree = tinyTree(`score-${(counter += 1)}`);
		const session = openTreeSession(tree);

		expect(session.progress.attainedLevel).toBe(0);
		expect(session.progress.tier).toBeNull();

		await session.apply({ kind: 'complete', uid: uidOf(tree, 'a') });
		await session.apply({ kind: 'complete', uid: uidOf(tree, 'b') });

		expect(session.progress.attainedLevel).toBe(1);
	});
});

describe('uncheckConsequence — §11.10’s honest recomputation', () => {
	it('reports the drop an un-check would cause, without performing it', async () => {
		const tree = tinyTree(`drop-${(counter += 1)}`);
		const session = openTreeSession(tree);
		await session.apply({ kind: 'complete', uid: uidOf(tree, 'a') });
		await session.apply({ kind: 'complete', uid: uidOf(tree, 'b') });

		const consequence = session.uncheckConsequence(uidOf(tree, 'a'));

		expect(consequence?.before).toBe(1);
		expect(consequence?.after).toBe(0);
		// Level 1 stops being cleared; the fixture's empty levels stay vacuously
		// satisfied, which a real bundle's four-to-eight milestones (§5.3) prevent.
		expect(consequence?.cleared).not.toContain(1);
		// Nothing was written: the question was hypothetical.
		expect(store.progressFor(tree.id).milestones.get(uidOf(tree, 'a'))).toBe('complete');
	});

	it('is null when the level survives the un-check', async () => {
		const tree = tinyTree(`survives-${(counter += 1)}`);
		const session = openTreeSession(tree);
		await session.apply({ kind: 'complete', uid: uidOf(tree, 'c') });

		expect(session.uncheckConsequence(uidOf(tree, 'c'))).toBeNull();
	});
});
