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
 *
 * **The layout call is here rather than in the route** (T14). §13.4 makes
 * `TreeView` the only *component* that consumes the Layout Engine, and it
 * consumes it as a prop precisely so that toggling a milestone cannot re-run
 * layout (§8.6, §9.3) — which leaves the call itself needing a home outside both
 * the renderer and the page. `layoutFor` is that home, and `layoutTree` is
 * memoized on `(tree identity, viewport)`, so asking twice costs once.
 *
 * **§12.3's write-back is here too** (T26/F26). The store may not fetch a bundle
 * and may not import the engine, so the only place that can reconcile
 * `SKILL.attainedLevel` against a freshly scored tree is the layer holding both.
 * It runs **after** T17's `applyLineage`, never before: when a migration has
 * just run, its `attainedLevel.after` is already on screen as §12.5's summary,
 * and a reconcile writing a different number would contradict a sentence the
 * user is reading.
 */

import { layoutTree, type TreeLayout } from '$lib/layout';
import { scoreSkill, type SkillProgress } from '$lib/scoring';
import { NotWritableError, store } from '$lib/state/store.js';
import type { CompiledTree } from '$lib/types';
import type { MilestoneIntent, UncheckConsequence } from '$lib/components/intents.js';
import { uncheckConsequenceOf } from './uncheck-consequence.js';

export interface TreeSession {
	/** §14.4's tree-local score, recomputed whenever the §13.2 mirror commits. */
	readonly progress: SkillProgress;
	/** §8's positions for a viewport. Memoized; user state is not in the key. */
	layoutFor(viewport: 'wide' | 'narrow'): TreeLayout;
	/** Resolves once the open sequence — §12.3's write-back — has settled. */
	readonly ready: Promise<void>;
	apply(intent: MilestoneIntent): Promise<void>;
	uncheckConsequence(uid: string): UncheckConsequence | null;
	close(): void;
}

class Session implements TreeSession {
	readonly #tree: CompiledTree;
	readonly ready: Promise<void>;

	constructor(tree: CompiledTree) {
		this.#tree = tree;
		store.openTree(tree);
		this.ready = this.#open();
	}

	/**
	 * §12.3's reconciliation on open. It never rejects: a read-only session
	 * (§13.3) is the expected case, not an error, and a page that failed to
	 * render because a *denormalization* could not be refreshed would have
	 * escalated a cosmetic staleness into an outage.
	 */
	async #open(): Promise<void> {
		// T17 inserts `applyLineage` here, before the line below (§12.5).
		try {
			await store.reconcileAttainedLevel(this.#tree.id, this.progress.attainedLevel);
		} catch (error) {
			if (!(error instanceof NotWritableError)) throw error;
		}
	}

	layoutFor(viewport: 'wide' | 'narrow'): TreeLayout {
		return layoutTree(this.#tree, viewport);
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
	const session = new Session(tree);
	// The open sequence is fire-and-forget for a caller that does not care, and
	// awaitable for a test that does. Claiming the rejection here is what keeps
	// the first form from surfacing as an unhandled rejection.
	void session.ready.catch(() => undefined);
	return session;
}
