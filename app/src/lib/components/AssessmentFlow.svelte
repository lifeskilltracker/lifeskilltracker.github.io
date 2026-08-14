<script lang="ts">
	/**
	 * §11.8's self-assessment — F29 placement and F30's estimator (T15, S3).
	 *
	 * Two mechanisms, one review list. **Placement is ordinary completion in
	 * bulk**: it opens the list on what is already recorded and lets the user tick
	 * the rest, which is what makes F29 "require no additional per-skill authored
	 * content". **The estimator** pre-checks the contiguous prefix D20 defines and
	 * then gets out of the way. They share a review step because they produce the
	 * same thing — a set of milestones the user is asserting they have done — and
	 * splitting them into two screens would duplicate every accessibility
	 * obligation in §15.6.
	 *
	 * It computes nothing and writes nothing. The estimate arrives as a callback
	 * from `lib/actions` (§13.4 keeps the engines out of components) and the
	 * commit leaves as `MilestoneIntent`s (§3.2 gives the store the only write
	 * path). There is no second write path here and there must never be one.
	 *
	 * **Nothing durable records that a milestone was estimated.** §12.2 has
	 * exactly two states and incomplete is the absence of a record; a third
	 * "estimated" state would leak an assessment artifact into the user's only
	 * copy of their progress and into every export of it forever. The pre-check
	 * marker below is a property of this flow before commit, and dies with it.
	 */
	import type { SkillProgress } from '$lib/scoring';
	import type { CompiledMilestone, CompiledTree } from '$lib/types';
	import { placementWarning } from './consequences.js';
	import type { MilestoneIntent, UncheckConsequence } from './intents.js';

	interface Props {
		tree: CompiledTree;
		/** From `scoreSkill(...)` (§14.4) — the current score, never recomputed here. */
		progress: SkillProgress;
		/**
		 * `estimateMilestones(tree, L)` (§11.8), supplied rather than imported: a
		 * component that called the engine would be running one (§13.4).
		 */
		estimate: (coarseLevel: number) => string[];
		/**
		 * §11.10 for the bulk case — what committing this selection would do to
		 * `attainedLevel`, or `null` when nothing drops. Supplied for the same
		 * reason: it is a hypothetical re-score.
		 */
		placementConsequence?: (selection: readonly string[]) => UncheckConsequence | null;
		/** User intent, upward. This component never writes (§3.2, §14.1). */
		onintent?: (intent: MilestoneIntent) => void;
	}

	let { tree, progress, estimate, placementConsequence, onintent }: Props = $props();

	const LEVELS = 10;

	/**
	 * A record already stands for this milestone. `bonus` is a completion too —
	 * it is §11.4's name for surplus completion inside an `n_of` group, not a
	 * different kind of record — and treating it as incomplete here would have the
	 * flow silently re-complete work the user had already done.
	 */
	function isRecorded(uid: string): boolean {
		const state = progress.nodeStates.get(uid);
		return state === 'complete' || state === 'bonus';
	}

	const byLevel = $derived(
		Array.from({ length: LEVELS }, (_, index) => ({
			level: index + 1,
			milestones: tree.milestones.filter((m) => m.level === index + 1)
		})).filter((row) => row.milestones.length > 0)
	);

	let open = $state(false);
	/** D20's coarse input. Bands, if they are ever shown, map onto it (§15.6). */
	let coarse = $state(1);

	/**
	 * The draft, as a plain reactive record rather than a `Set`: §15.6 requires
	 * the flow to be "interruptible and resumable", so this survives closing the
	 * list and is only cleared on commit or on an explicit discard.
	 */
	let selected = $state<Record<string, boolean>>({});
	let preChecked = $state<Record<string, boolean>>({});
	let started = $state(false);

	const selection = $derived(tree.milestones.filter((m) => selected[m.uid]).map((m) => m.uid));

	/** What the flow would write, as intents — the whole of its effect (§12.4). */
	const intents = $derived(
		tree.milestones.flatMap((milestone): MilestoneIntent[] => {
			const recorded = isRecorded(milestone.uid);
			if (selected[milestone.uid] === true && !recorded) {
				return [{ kind: 'complete', uid: milestone.uid }];
			}
			// Un-checking something already recorded is a real un-check (§12.2):
			// the record goes away rather than becoming a third state.
			if (selected[milestone.uid] !== true && recorded) {
				return [{ kind: 'undo', uid: milestone.uid }];
			}
			return [];
		})
	);

	function seedFromRecords(): Record<string, boolean> {
		const seed: Record<string, boolean> = {};
		for (const milestone of tree.milestones) {
			if (isRecorded(milestone.uid)) seed[milestone.uid] = true;
		}
		return seed;
	}

	/** F29: no estimate, no pre-checks — just the list, opened on the truth. */
	function startPlacement(): void {
		if (!started) {
			selected = seedFromRecords();
			preChecked = {};
			started = true;
		}
		pending = null;
		open = true;
	}

	/**
	 * F30. The estimate is added to what is already recorded rather than
	 * replacing it: the prefix is a suggestion (§11.8), and a suggestion that
	 * silently un-ticked work the user had really done would be asserting
	 * something about them, which §15.6 rules out in as many words.
	 */
	function startEstimate(): void {
		const suggested = estimate(coarse);
		const next = seedFromRecords();
		const marks: Record<string, boolean> = {};
		for (const uid of suggested) {
			// Only what the estimate *adds* is marked as pre-checked. A milestone
			// the user genuinely completed is their work, not the estimator's guess.
			if (next[uid] !== true) marks[uid] = true;
			next[uid] = true;
		}
		selected = next;
		preChecked = marks;
		started = true;
		pending = null;
		open = true;
	}

	function toggle(uid: string, checked: boolean): void {
		selected = { ...selected, [uid]: checked };
		// Correcting a pre-check makes it the user's answer, so the marker goes.
		if (preChecked[uid] === true) {
			const rest = { ...preChecked };
			delete rest[uid];
			preChecked = rest;
		}
	}

	const selectedCount = (milestones: CompiledMilestone[]): number =>
		milestones.filter((m) => selected[m.uid] === true).length;

	/** §11.10's intercept, pending the user's answer. `null` unless something drops. */
	let pending = $state<string | null>(null);

	function commit(): void {
		for (const intent of intents) onintent?.(intent);
		selected = {};
		preChecked = {};
		started = false;
		pending = null;
		open = false;
	}

	function save(): void {
		const consequence = placementConsequence?.(selection) ?? null;
		if (consequence === null || consequence.after >= consequence.before) {
			commit();
			return;
		}
		pending = placementWarning(tree.title, consequence);
	}

	/** §15.6's "interruptible and resumable" — the draft is kept, not committed. */
	function pause(): void {
		pending = null;
		open = false;
	}

	function discard(): void {
		selected = {};
		preChecked = {};
		started = false;
		pending = null;
		open = false;
	}
</script>

<section class="assessment-flow" aria-labelledby="assessment-heading">
	<h3 id="assessment-heading">Already practise this?</h3>

	{#if !open}
		<p>
			Record what you can already do without working through the tree one milestone at
			a time. Nothing is saved until you review it.
		</p>
		<div class="entry">
			<label for="coarse-level">Roughly what level are you at?</label>
			<select id="coarse-level" bind:value={coarse}>
				{#each Array.from({ length: LEVELS }, (_, i) => i + 1) as level (level)}
					<option value={level}>Level {level}</option>
				{/each}
			</select>
			<button type="button" data-action="estimate" onclick={startEstimate}>
				Suggest what I've done
			</button>
			<button type="button" data-action="placement" onclick={startPlacement}>
				{started ? 'Resume marking' : "Mark what I've done"}
			</button>
		</div>
		{#if started}
			<p class="draft-note" data-draft role="status">
				You have an unsaved review in progress. Nothing has been recorded yet.
			</p>
		{/if}
	{:else}
		<!--
			§15.6: grouped by level, a running count per level, keyboard-operable
			throughout, interruptible and resumable. It is a long list of checkboxes
			and the grouping is what keeps it navigable in a screen reader — a
			forty-milestone flat list is the failure mode §15.6 names.
		-->
		<form
			class="review"
			data-review
			onsubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			<p class="visually-hidden" role="status" aria-live="polite">
				{selection.length} of {tree.milestones.length} milestones selected.
			</p>

			{#each byLevel as row (row.level)}
				<fieldset data-level={row.level}>
					<legend>
						Level {row.level}
						<span class="count" aria-live="polite" data-count={row.level}>
							{selectedCount(row.milestones)} of {row.milestones.length} selected
						</span>
					</legend>
					<ul>
						{#each row.milestones as milestone (milestone.uid)}
							<li>
								<label data-uid={milestone.uid} data-prechecked={preChecked[milestone.uid] === true}>
									<input
										type="checkbox"
										checked={selected[milestone.uid] === true}
										onchange={(event) =>
											toggle(milestone.uid, event.currentTarget.checked)}
									/>
									<span class="title">{milestone.title}</span>
									{#if preChecked[milestone.uid] === true}
										<!--
											§11.8 and §15.6: every pre-checked item is announced as
											pre-checked. It is inside the label, so it is part of the
											checkbox's accessible name rather than decoration a
											screen reader would skip — "a shortcut that silently
											asserts things about the user would be worse than no
											shortcut".
										-->
										<span class="suggested">suggested — un-check if you haven't</span>
									{/if}
								</label>
							</li>
						{/each}
					</ul>
				</fieldset>
			{/each}

			{#if pending !== null}
				<!--
					§11.10's intercept, for the bulk case F29 makes ordinary. It states
					the consequence and then gets out of the way — `role="status"`, not a
					dialog, and nothing here blocks the save.
				-->
				<div class="consequence" role="status" data-consequence>
					<p>{pending}</p>
					<div class="actions">
						<button type="button" data-action="confirm" onclick={commit}>Save anyway</button>
						<button type="button" data-action="cancel" onclick={() => (pending = null)}>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<div class="actions">
				<button type="submit" data-action="save">Save {intents.length} change{intents.length === 1 ? '' : 's'}</button>
				<button type="button" data-action="pause" onclick={pause}>Finish later</button>
				<button type="button" data-action="discard" onclick={discard}>Discard</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.assessment-flow {
		margin-block-start: 1rem;
		padding: 0.75rem;
		border: 1px solid currentColor;
	}

	.entry {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.review fieldset {
		margin-block: 0.75rem;
	}

	.review ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.review label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		/* §15.7's 44×44 target: the whole row is the label, so the hit area is the
		   line rather than the checkbox glyph. */
		min-height: 44px;
	}

	.suggested {
		font-size: 0.85em;
		opacity: 0.8;
	}

	.count {
		font-size: 0.85em;
		opacity: 0.75;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.consequence {
		margin-block: 0.75rem;
		padding: 0.5rem;
		border-inline-start: 4px solid currentColor;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
