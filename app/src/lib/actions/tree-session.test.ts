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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeScoringTree, uidOf } from '$lib/scoring/fixtures.js';
import { exportPrompt } from '$lib/state/export-prompt.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store, TreeNotOpenError } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
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
	ui.reset();
	exportPrompt.reset();
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

describe('§11.8 — the placement seam (T15)', () => {
	it('hands out F30’s prefix for the tree it was opened with', () => {
		const tree = tinyTree(`estimate-${(counter += 1)}`);
		const session = openTreeSession(tree);

		expect(session.estimate(1)).toEqual([uidOf(tree, 'a'), uidOf(tree, 'b')]);
		expect(session.estimate(2)).toEqual([
			uidOf(tree, 'a'),
			uidOf(tree, 'b'),
			uidOf(tree, 'c'),
			uidOf(tree, 'd')
		]);
	});

	it('reports what a whole placement would cost, without performing it', async () => {
		const tree = tinyTree(`placement-${(counter += 1)}`);
		const session = openTreeSession(tree);
		await session.apply({ kind: 'complete', uid: uidOf(tree, 'a') });
		await session.apply({ kind: 'complete', uid: uidOf(tree, 'b') });

		// The user un-ticks one of the two the level needs.
		const consequence = session.placementConsequence([uidOf(tree, 'a')]);
		expect(consequence?.before).toBe(1);
		expect(consequence?.after).toBe(0);
		expect(store.progressFor(tree.id).milestones.get(uidOf(tree, 'b'))).toBe('complete');

		// Adding to what is already there costs nothing, which is the F29 case.
		expect(
			session.placementConsequence([uidOf(tree, 'a'), uidOf(tree, 'b'), uidOf(tree, 'c')])
		).toBeNull();
	});

	it('serializes a bulk commit, so the denormalized level settles on the last write', async () => {
		const tree = tinyTree(`bulk-${(counter += 1)}`);
		const session = openTreeSession(tree);

		// Fired the way `AssessmentFlow` fires them: synchronously, in a loop.
		const writes = ['a', 'b', 'c', 'd'].map((slug) =>
			session.apply({ kind: 'complete', uid: uidOf(tree, slug) })
		);
		await Promise.all(writes);

		// Levels 3–10 hold no milestones in this fixture and are vacuously
		// satisfied, so clearing 1 and 2 attains 10 — what matters here is that
		// all four writes landed and the stored level agrees with the score.
		expect(session.progress.attainedLevel).toBe(10);
		expect(progress.skills[tree.id].attainedLevel).toBe(10);
		expect(Object.keys(progress.milestones)).toHaveLength(4);
	});
});

/**
 * §16.3: "IndexedDB write fails (quota) — surface immediately, do not update
 * the UI as though it succeeded, prompt export" (T18).
 *
 * The session is where this has to happen. `SkillPage` fires intents and
 * forgets them, so a rejection that stopped here would be a milestone the user
 * watched fail to tick with nothing on screen to say why — §16.3's recurring
 * rule is that a write failure never becomes a silent success.
 *
 * The store is stubbed to reject rather than a quota being provoked: the
 * rollback itself is proved against a real aborted transaction in
 * `export-prompt.test.ts`, and what this asks is only where the failure goes.
 */
describe('a failed write (§16.3)', () => {
	it('tells the user and raises the export prompt, and still rejects', async () => {
		const tree = tinyTree(`quota-${(counter += 1)}`);
		const session = openTreeSession(tree);
		const spy = vi
			.spyOn(store, 'setMilestoneState')
			.mockRejectedValue(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));

		await expect(session.apply({ kind: 'complete', uid: uidOf(tree, 'a') })).rejects.toThrow(
			/quota/i
		);

		expect(ui.notices).toHaveLength(1);
		expect(ui.notices[0].kind).toBe('error');
		expect(exportPrompt.reason).toBe('write-failed');
		// Nothing was written, and nothing pretends otherwise.
		expect(progress.milestones[uidOf(tree, 'a')]).toBeUndefined();
		spy.mockRestore();
	});

	it('leaves the queue usable, so one failure does not wedge every later write', async () => {
		const tree = tinyTree(`queue-${(counter += 1)}`);
		const session = openTreeSession(tree);
		const spy = vi
			.spyOn(store, 'setMilestoneState')
			.mockRejectedValueOnce(new Error('QuotaExceededError'));

		await expect(session.apply({ kind: 'complete', uid: uidOf(tree, 'a') })).rejects.toThrow();
		spy.mockRestore();

		await session.apply({ kind: 'complete', uid: uidOf(tree, 'b') });

		expect(store.progressFor(tree.id).milestones.get(uidOf(tree, 'b'))).toBe('complete');
	});
});
