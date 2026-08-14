/**
 * Cold start, minimal (T10).
 *
 * §13.3's full cold-start sequence — `applyMoves`, the version-gated
 * `applyLineage`, the notice host, the offline branch — is **T14**. What is here
 * is the one step Phase 0's exit criteria require: a completion has to survive a
 * page reload, and it cannot, because §13.2's mirror starts empty and only
 * `hydrate()` fills it. Without this the records are in IndexedDB and the tree
 * renders as though nothing was ever done.
 *
 * The failure branch matters more than the happy one. §13.3 latches the store
 * unwritable for the session when hydration fails, and the dangerous bug is not
 * "cannot read progress" but "read as empty, then wrote".
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeScoringTree, uidOf } from '$lib/scoring/fixtures.js';
import { progress } from '$lib/state/progress.svelte.js';
import { createUserStateStore } from '$lib/state/store.js';
import { bootstrapUserState } from './bootstrap.js';

let counter = 0;

beforeEach(() => {
	progress.reset();
	progress.writable = true;
});

function tinyTree(id: string) {
	return makeScoringTree({ id, levels: [{ level: 1, milestones: ['a', 'b'] }] });
}

describe('bootstrapUserState', () => {
	it('hydrates, so a completion written before a reload is there after it', async () => {
		const databaseName = `bootstrap-${(counter += 1)}`;
		const tree = tinyTree('cooking');
		const uid = uidOf(tree, 'a');

		const beforeReload = createUserStateStore({ databaseName });
		await bootstrapUserState(beforeReload);
		beforeReload.openTree(tree);
		await beforeReload.setMilestoneState(uid, 'complete');
		await beforeReload.close();

		// A reload is exactly this: the mirror is gone, the database is not.
		progress.reset();
		const afterReload = createUserStateStore({ databaseName });
		await bootstrapUserState(afterReload);

		expect(afterReload.hydrated).toBe(true);
		expect(afterReload.progressFor('cooking').milestones.get(uid)).toBe('complete');
	});

	it('reports a hydration failure instead of throwing, and leaves the store unwritable', async () => {
		const failing = createUserStateStore({
			databaseName: `bootstrap-fail-${(counter += 1)}`,
			open: () => Promise.reject(new Error('quota exhausted'))
		});

		const status = await bootstrapUserState(failing);

		expect(status.hydrated).toBe(false);
		expect(status.error).toContain('quota exhausted');
		expect(failing.writable).toBe(false);
	});
});
