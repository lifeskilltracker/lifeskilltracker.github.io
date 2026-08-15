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
import { estimateMilestones, scoreSkill, type SkillProgress } from '$lib/scoring';
import { NotWritableError, store } from '$lib/state/store.js';
import type { CompiledTree, MigrationReport } from '$lib/types';
import type { MilestoneIntent, UncheckConsequence } from '$lib/components/intents.js';
import { placementConsequenceOf, uncheckConsequenceOf } from './uncheck-consequence.js';

export interface TreeSession {
	/** §14.4's tree-local score, recomputed whenever the §13.2 mirror commits. */
	readonly progress: SkillProgress;
	/** §8's positions for a viewport. Memoized; user state is not in the key. */
	layoutFor(viewport: 'wide' | 'narrow'): TreeLayout;
	/** Resolves once the open sequence — §12.5's pass, then §12.3's write-back — has settled. */
	readonly ready: Promise<void>;
	/** §12.5's one summary, or null when the last open migrated nothing (T17). */
	readonly migration: MigrationReport | null;
	dismissMigration(): void;
	apply(intent: MilestoneIntent): Promise<void>;
	uncheckConsequence(uid: string): UncheckConsequence | null;
	/** F30's prefix for a coarse self-assessment (§11.8) — T15. */
	estimate(coarseLevel: number): string[];
	/** §11.10 for a whole placement: what committing this selection would cost. */
	placementConsequence(selection: readonly string[]): UncheckConsequence | null;
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

	/** §12.5's summary for this open. Reactive, so the page renders it when the
	 *  pass resolves rather than needing the route to await anything. */
	#migration = $state<MigrationReport | null>(null);

	get migration(): MigrationReport | null {
		return this.#migration;
	}

	dismissMigration(): void {
		this.#migration = null;
	}

	/**
	 * §12.5's migration pass, then §12.3's reconciliation. Neither rejects: a
	 * read-only session (§13.3) is the expected case, not an error, and a page
	 * that failed to render because a *denormalization* could not be refreshed
	 * would have escalated a cosmetic staleness into an outage.
	 *
	 * The order is fixed by T26/F26. `applyLineage` persists the level it
	 * recomputed and puts it on screen as `attainedLevel.after`; a reconcile
	 * running first would compute against pre-migration records, and one
	 * computing a different number afterwards would contradict a sentence the
	 * user is reading. Running second, it finds the value already stored and
	 * resolves `false`.
	 *
	 * The evaluator is passed in because §14.1 gives `lib/state` no edge to
	 * `lib/scoring`; this module is the layer that holds both.
	 */
	async #open(): Promise<void> {
		try {
			const report = await store.applyLineage(
				this.#tree,
				(progress) => scoreSkill(this.#tree, progress).attainedLevel
			);
			// §12.5: no summary for a pass that mutated nothing, which is the usual
			// outcome of §12.6's forced replay.
			if (report.changed) this.#migration = report;
		} catch (error) {
			if (!(error instanceof NotWritableError)) throw error;
		}

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

	/**
	 * Writes are serialized through one chain (T15).
	 *
	 * §12.4 makes each write its own transaction that reads the tree's records
	 * back and recomputes `attainedLevel` from them. F29's placement commits a
	 * whole review list at once, so without this the twelfth write could open its
	 * transaction against a store the third one had not finished changing, and the
	 * denormalized level would settle on whichever finished last. Rapid clicking
	 * in `TreeView` is the same hazard arriving more slowly.
	 */
	#queue: Promise<void> = Promise.resolve();

	apply(intent: MilestoneIntent): Promise<void> {
		const next = this.#queue.then(() => this.#applyOne(intent));
		// The chain must survive a rejected write — one failed milestone must not
		// wedge every later one — while the caller still sees its own failure.
		this.#queue = next.catch(() => undefined);
		return next;
	}

	async #applyOne(intent: MilestoneIntent): Promise<void> {
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

	/**
	 * F30's estimate (§11.8). It lives here rather than in the page because
	 * §13.4 forbids a route from importing the Scoring Engine at all, and
	 * `AssessmentFlow` takes it as a callback for the same reason `TreeView`
	 * takes `uncheckConsequence` as one.
	 */
	estimate(coarseLevel: number): string[] {
		return estimateMilestones(this.#tree, coarseLevel);
	}

	placementConsequence(selection: readonly string[]): UncheckConsequence | null {
		return placementConsequenceOf(this.#tree, store.progressFor(this.#tree.id), selection);
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
