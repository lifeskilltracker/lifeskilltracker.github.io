/**
 * The skill page's session (§13.4, §14.1) — T08.
 *
 * `lib/actions` is the one module permitted to touch both I/O owners, so the
 * sequence "a tree opened, therefore register it, score it, and route the
 * user's intents at the store" belongs here rather than in the route or the
 * renderer. `TreeView` receives values and emits intent; nothing in
 * `lib/components` imports the store or the engine (§13.4, §14.1).
 *
 * **`openTree` is the load-bearing line.** §14.5 fixes `setMilestoneState(uid,
 * state, opts)` with no tree argument, while §12.4 step 2 recomputes against
 * the in-memory bundle and §14.1 forbids the store from fetching one. So the
 * shell hands the bundle over when the route opens, and a page that skips it
 * renders perfectly and rejects on the first click.
 */

import { scoreSkill, type SkillProgress } from '$lib/scoring';
import { store } from '$lib/state/store.js';
import type { CompiledTree } from '$lib/types';
import type { MilestoneIntent, UncheckConsequence } from '$lib/components/intents.js';
import { uncheckConsequenceOf } from './uncheck-consequence.js';

export interface TreeSession {
	/** §14.4's tree-local score, recomputed whenever the §13.2 mirror commits. */
	readonly progress: SkillProgress;
	apply(intent: MilestoneIntent): Promise<void>;
	uncheckConsequence(uid: string): UncheckConsequence | null;
	close(): void;
}

class Session implements TreeSession {
	readonly #tree: CompiledTree;

	constructor(tree: CompiledTree) {
		this.#tree = tree;
		store.openTree(tree);
	}

	/**
	 * `progressFor` is synchronous and reads §13.2's mirror, which every writer
	 * refreshes on commit (T26/F23) — so this re-derives on its own after a
	 * write, with no invalidation call anywhere.
	 */
	readonly progress: SkillProgress = $derived.by(() =>
		scoreSkill(this.#tree, store.progressFor(this.#tree.id))
	);

	async apply(intent: MilestoneIntent): Promise<void> {
		switch (intent.kind) {
			case 'complete':
				await store.setMilestoneState(intent.uid, 'complete');
				return;
			case 'dismiss':
				await store.setMilestoneState(intent.uid, 'dismissed');
				return;
			case 'undo':
				// Incomplete is the absence of a record (§12.2), and un-dismissal is
				// the same operation — F46 makes dismissal reversible, not a state to
				// be reversed into a third one.
				await store.setMilestoneState(intent.uid, null);
				return;
			case 'note': {
				// F31: the note is an optional addition *after* the fact, so it
				// attaches to the state the milestone is already in and never invents
				// one. A note on an untouched milestone has nothing to attach to.
				const current = store.progressFor(this.#tree.id).milestones.get(intent.uid) ?? null;
				if (current === null) return;
				await store.setMilestoneState(intent.uid, current, { note: intent.note });
				return;
			}
			case 'hide':
				// §11.10 requires the *offer*; T19 owns the dismissed/hidden flow and
				// its denominator semantics. Doing nothing here is the honest state of
				// that work — it must not quietly become a dismissal.
				return;
		}
	}

	/**
	 * §11.10's un-check consequence. The arithmetic is in a plain module beside
	 * this one — it is a pure question about a hypothetical, and nothing about it
	 * belongs in reactive state.
	 */
	uncheckConsequence(uid: string): UncheckConsequence | null {
		return uncheckConsequenceOf(this.#tree, store.progressFor(this.#tree.id), uid);
	}

	close(): void {
		store.closeTree(this.#tree.id);
	}
}

export function openTreeSession(tree: CompiledTree): TreeSession {
	return new Session(tree);
}
