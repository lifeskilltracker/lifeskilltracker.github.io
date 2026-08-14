<script lang="ts">
	/**
	 * §9 — the single tree renderer (T08, D-07, S1).
	 *
	 * **There is no shape branch in this file and there must never be one.** A
	 * linear skill is a tree with one column, a branching skill is a tree with
	 * several, and a choice-based skill is a tree whose levels carry `n_of`
	 * groups — by the time data reaches here (§8) the three have stopped
	 * differing structurally, and the grep gate under `tools/ci/` is the
	 * mechanical form of that promise (§9.1, §14.7). It scans this directory, so
	 * the field cannot even be named here: see that script for what it forbids.
	 *
	 * It computes nothing. Positions arrive from the Layout Engine and states
	 * from the Scoring Engine, both as props: §13.4 keeps the engines out of
	 * components, and §8.6 requires that toggling a milestone never re-runs
	 * layout — which is only structurally guaranteed if this file cannot call it.
	 */
	import type { TreeLayout } from '$lib/layout';
	import type { SkillProgress } from '$lib/scoring';
	import type { CompiledMilestone, CompiledTree, MasteryEntry } from '$lib/types';
	import { cappedLevel, dismissalWarning, uncheckWarning } from './consequences.js';
	import type { MilestoneIntent, UncheckConsequence } from './intents.js';
	import { presentationFor } from './node-state.js';
	import { attainmentLabel, bandTier } from './tiers.js';

	interface Props {
		tree: CompiledTree;
		/** From `layoutTree(tree, viewport)` — never computed here (§8.6, §13.4). */
		positions: TreeLayout;
		/** From `scoreSkill(tree, store.progressFor(tree.id))` (§14.4). */
		progress: SkillProgress;
		viewport: 'wide' | 'narrow';
		/** User intent, upward. This component never writes (§3.2, §14.1). */
		onintent?: (intent: MilestoneIntent) => void;
		/**
		 * §11.10: what un-checking this milestone would do to `attainedLevel`.
		 * `null` when nothing drops. Supplied rather than computed — a component
		 * that re-scored a hypothetical would be importing the engine (§13.4).
		 */
		uncheckConsequence?: (uid: string) => UncheckConsequence | null;
		/**
		 * The open milestone panel, bindable (T14). It is a prop rather than
		 * private state because §13.1 gives it a URL — `/s/<treeId>/m/<slug>` — so
		 * the shell must be able to open a panel it was deep-linked to, and to
		 * notice when the user closes one. The component still owns *when* it
		 * changes; the shell only owns the address.
		 */
		openUid?: string | null;
	}

	let {
		tree,
		positions,
		progress,
		viewport,
		onintent,
		uncheckConsequence,
		openUid = $bindable(null)
	}: Props = $props();

	const milestoneOf = (uid: string): CompiledMilestone | undefined =>
		tree.milestones.find((m) => m.uid === uid);

	/**
	 * What the **node box** shows (T10, §9.2). The box is 100×44 layout units and
	 * holds roughly forty characters; the authored `title` is a full statement of
	 * the achievement and ran to seventy in the first real tree, so it clipped —
	 * and clipped titles that share an opening ("Cook a full meal…", "Cook a full
	 * meal over live fire…") were indistinguishable in the primary view. The full
	 * title still goes everywhere with room for it, §9.4's panel above all.
	 */
	const labelOf = (uid: string): string => {
		const milestone = milestoneOf(uid);
		return milestone?.label ?? milestone?.title ?? uid;
	};

	/**
	 * The focused node drives §9.4's edge highlighting, which is the mitigation
	 * §8.4 leans on: crossings are never minimized, so any one node's
	 * dependencies have to be legible on demand instead.
	 */
	let focusedUid = $state<string | null>(null);

	const touches = (from: string, to: string): boolean =>
		focusedUid !== null && (from === focusedUid || to === focusedUid);

	/** One panel at a time (§9.4); `openUid` above is the whole of that state. */
	let noteDraft = $state('');
	let noteOpen = $state(false);

	const nodeElements: Record<string, (SVGGElement | HTMLElement) | undefined> = $state({});

	let open = $derived(
		openUid === null || openUid === undefined ? undefined : milestoneOf(openUid)
	);

	function openPanel(uid: string): void {
		openUid = uid;
		noteOpen = false;
		noteDraft = '';
		pending = null;
	}

	function closePanel(): void {
		const returnTo = openUid;
		openUid = null;
		pending = null;
		if (returnTo !== null && returnTo !== undefined) nodeElements[returnTo]?.focus();
	}

	function onNodeKey(event: KeyboardEvent, uid: string): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		// Space scrolls the page otherwise, which moves the tree under the user.
		event.preventDefault();
		openPanel(uid);
	}

	function emit(intent: MilestoneIntent): void {
		onintent?.(intent);
	}

	/**
	 * §11.10's intercept, pending the user's answer. `null` most of the time —
	 * an intercept is the exception, and completion never has one (F31).
	 */
	let pending = $state<{ kind: 'dismiss' | 'undo'; uid: string; message: string } | null>(null);

	/** One action, no confirmation, undoable afterwards (§9.4, F31). */
	function complete(uid: string): void {
		emit({ kind: 'complete', uid });
		closePanel();
	}

	function dismiss(uid: string): void {
		const capped = cappedLevel(tree, uid, progress.blocker?.level);
		if (capped === null) {
			emit({ kind: 'dismiss', uid });
			closePanel();
			return;
		}
		pending = {
			kind: 'dismiss',
			uid,
			message: dismissalWarning(tree.title, capped, progress.attainedLevel)
		};
	}

	function undo(uid: string): void {
		const consequence = uncheckConsequence?.(uid) ?? null;
		if (consequence === null || consequence.after >= consequence.before) {
			emit({ kind: 'undo', uid });
			closePanel();
			return;
		}
		pending = {
			kind: 'undo',
			uid,
			message: uncheckWarning(tree.title, consequence)
		};
	}

	function confirmPending(): void {
		if (pending === null) return;
		emit({ kind: pending.kind, uid: pending.uid });
		pending = null;
		closePanel();
	}

	/** §11.10's softer option. What hiding *does* is T19's. */
	function hidePending(): void {
		if (pending === null) return;
		emit({ kind: 'hide', uid: pending.uid });
		pending = null;
		closePanel();
	}

	function cancelPending(): void {
		pending = null;
	}

	function saveNote(uid: string): void {
		emit({ kind: 'note', uid, note: noteDraft });
		noteOpen = false;
	}

	/** §5.7 lets a mastery entry require milestones *or* other achievements. */
	function masteryPrerequisites(achievement: MasteryEntry): string[] {
		return (achievement.requires ?? []).map((ref) =>
			ref.kind === 'achievement'
				? ((tree.mastery ?? [])[ref.index]?.title ?? ref.slug)
				: (tree.milestones[ref.index]?.title ?? ref.slug)
		);
	}

	function prerequisitesOf(uid: string): CompiledMilestone[] {
		const milestone = milestoneOf(uid);
		return (milestone?.requires ?? [])
			.map((ref) => tree.milestones[ref.index])
			.filter((m): m is CompiledMilestone => m !== undefined);
	}
</script>

<div class="tree-view" data-viewport={viewport}>
	<!--
		The glyph library. Rendered once per tree and referenced by `<use>`, so a
		state change swaps an `href` rather than re-creating anything (§9.3).
	-->
	<svg class="glyph-defs" aria-hidden="true" focusable="false">
		<defs>
			<symbol id="glyph-complete" viewBox="0 0 16 16">
				<path d="M3 8.5 L6.5 12 L13 4" fill="none" stroke="currentColor" stroke-width="2" />
			</symbol>
			<symbol id="glyph-bonus" viewBox="0 0 16 16">
				<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1" />
				<path d="M4 8.5 L7 11 L12 5" fill="none" stroke="currentColor" stroke-width="2" />
			</symbol>
			<symbol id="glyph-available" viewBox="0 0 16 16">
				<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2" />
			</symbol>
			<symbol id="glyph-locked" viewBox="0 0 16 16">
				<circle cx="8" cy="8" r="1.5" fill="currentColor" />
			</symbol>
			<symbol id="glyph-dismissed" viewBox="0 0 16 16">
				<path d="M4 4 L12 12 M12 4 L4 12" fill="none" stroke="currentColor" stroke-width="2" />
			</symbol>
		</defs>
	</svg>

	<!--
		The attainment readout. F32's "progress toward the next level" belongs to
		`SkillHeader` (§13.4); what is here is the part §11.3 makes a correctness
		matter — Level 0 is not a tier, and must never render as one.
	-->
	<p class="tree-status">{attainmentLabel(progress.attainedLevel, progress.tier)}</p>

	{#if viewport === 'wide'}
		<svg
			class="tree"
			viewBox="0 0 {positions.width} {positions.height}"
			role="group"
			aria-labelledby="tree-title"
		>
			<title id="tree-title">{tree.title}</title>
	
			<!-- Decorative: §15 carries the same relationships as text on the node. -->
			<g class="edges" aria-hidden="true">
				{#each positions.edges as edge (`${edge.fromUid}->${edge.toUid}`)}
					<path
						class="edge"
						class:is-lit={touches(edge.fromUid, edge.toUid)}
						class:is-dim={focusedUid !== null && !touches(edge.fromUid, edge.toUid)}
						d={edge.path}
						data-from={edge.fromUid}
						data-to={edge.toUid}
					/>
				{/each}
			</g>
	
			<g class="rows">
				{#each positions.rows as row (row.level)}
					{@const level = progress.levels.find((l) => l.level === row.level)}
					<g class="row" data-level={row.level} class:is-satisfied={level?.satisfied}>
						<rect class="row-band" x="0" y={row.y} width={positions.width} height={row.h} />
						<!--
							One readout per requirement group, never averaged: a level with an
							`all` group and an `n_of` group has two independent things to
							report, and one bar would hide which of them is blocking (§9.6).

							They are `tspan`s inside the label rather than `text` at a computed
							x, because a computed x has to guess how wide the tier name is —
							the first version parked them at 90 and "Level 6 · Journeyman"
							overprinted its own readout (T10). `dx` measures from wherever the
							text actually ended, so no tier name can be too long.
						-->
						<text class="row-label" x="4" y={row.y + 14}>
							Level {row.level} · {bandTier(row.level)}
							{#each level?.groups ?? [] as group, index (index)}
								<tspan class="group-progress" dx="12"
									>{Math.min(group.completed, group.n)} / {group.n}</tspan
								>
							{/each}
						</text>
					</g>
				{/each}
			</g>
	
			<g class="nodes">
				{#each positions.nodes as positioned (positioned.uid)}
					{@const state = progress.nodeStates.get(positioned.uid)}
					{@const look = presentationFor(state)}
					<g
						class="node {look.className}"
						data-uid={positioned.uid}
						data-state={state}
						data-level={positioned.level}
						tabindex="0"
						role="button"
						aria-describedby="ms-{positioned.uid}-desc"
						transform="translate({positioned.x}, {positioned.y})"
						bind:this={nodeElements[positioned.uid]}
						onclick={() => openPanel(positioned.uid)}
						onkeydown={(event) => onNodeKey(event, positioned.uid)}
						onfocus={() => (focusedUid = positioned.uid)}
						onblur={() => (focusedUid = null)}
					>
						<desc id="ms-{positioned.uid}-desc">Level {positioned.level}. {state}.</desc>
						<rect
							class="node-box"
							x="0"
							y="0"
							width={positioned.w}
							height={positioned.h}
							stroke-dasharray={look.dash}
							stroke-width={look.strokeWidth}
							rx="4"
						/>
						<use
							class="state-glyph"
							href={look.glyph}
							x="6"
							y={positioned.h / 2 - 8}
							width="16"
							height="16"
						/>
						<!--
							The label is HTML inside the SVG, and that is a fix rather than a
							flourish. As `<text>`, a real milestone title ("Cook dried pasta
							to al dente and drain it") is two and a half node-widths long, so
							it overflowed its box, covered the two nodes to its right, and
							swallowed clicks aimed at them — found by driving the built app
							in a browser for T10's gate. Here it wraps, clips, and takes no
							pointer events, leaving the box as the target §15.7 sizes.
						-->
						<foreignObject
							class="node-label"
							pointer-events="none"
							x="24"
							y="2"
							width={positioned.w - 28}
							height={positioned.h - 4}
						>
							<div class="node-label-inner" xmlns="http://www.w3.org/1999/xhtml">
								<!--
									Centred against the glyph, which sits at `h / 2`. Top-aligned,
									a one-line label left the glyph alone on the line below it,
									where it read as a bullet belonging to nothing.
								-->
								<span class="node-title">{labelOf(positioned.uid)}</span>
							</div>
						</foreignObject>
					</g>
				{/each}
			</g>
		</svg>
	{:else}
		<!--
			§9.5 — the same layout data as a linear list, which §15.1 makes the
			primary representation for assistive technology at every viewport. It is
			maintained because a third of users see it, which is what stops the
			usual screen-reader-only alternate view from rotting.

			Level 1 is first here, the opposite of wide (§8.5): this is a reading
			order, and running it 10 → 1 would present the deepest achievements
			first and put visual order in opposition to focus order.
		-->
		<div class="narrow-stack">
			{#each positions.rows as row (row.level)}
				{@const level = progress.levels.find((l) => l.level === row.level)}
				<section class="row" data-level={row.level} class:is-satisfied={level?.satisfied}>
					<h3>
						Level {row.level} · {bandTier(row.level)}
						{#each level?.groups ?? [] as group, index (index)}
							<span class="group-progress"
								>{Math.min(group.completed, group.n)} / {group.n}</span
							>
						{/each}
					</h3>
					<ol class="stack">
						{#each positions.nodes.filter((n) => n.level === row.level) as positioned (positioned.uid)}
							{@const state = progress.nodeStates.get(positioned.uid)}
							{@const look = presentationFor(state)}
							<li>
								<div
									class="node {look.className}"
									data-uid={positioned.uid}
									data-state={state}
									data-level={positioned.level}
									tabindex="0"
									role="button"
									aria-describedby="ms-{positioned.uid}-desc"
									bind:this={nodeElements[positioned.uid]}
									onclick={() => openPanel(positioned.uid)}
									onkeydown={(event) => onNodeKey(event, positioned.uid)}
									onfocus={() => (focusedUid = positioned.uid)}
									onblur={() => (focusedUid = null)}
								>
									<svg class="node-glyph" viewBox="0 0 16 16" aria-hidden="true">
										<use class="state-glyph" href={look.glyph} width="16" height="16" />
									</svg>
									<span class="node-title">{labelOf(positioned.uid)}</span>
									{#if prerequisitesOf(positioned.uid).length > 0}
										<span class="requires">
											Requires: {prerequisitesOf(positioned.uid)
												.map((m) => m.title)
												.join('; ')}
										</span>
									{/if}
									<span class="visually-hidden" id="ms-{positioned.uid}-desc">
										Level {positioned.level}. {state}.
									</span>
								</div>
							</li>
						{/each}
					</ol>
				</section>
			{/each}
		</div>
	{/if}

	{#if (tree.mastery ?? []).length > 0}
		<!--
			Below the tree and outside `<g class="rows">`: mastery entries have no
			level, no cell and no position (§6.2 rule 14), and being visibly outside
			the grid is what F5's exclusion from progress means on screen (§5.7,
			§9.6). Their prerequisites are text here because §8.2 step 7 emits no
			edge for an unpositioned endpoint.
		-->
		<section class="mastery-panel" aria-label="Mastery">
			<h3>Mastery</h3>
			<ul>
				{#each tree.mastery ?? [] as achievement (achievement.uid)}
					<li data-uid={achievement.uid}>
						<span class="mastery-title">{achievement.title}</span>
						{#if achievement.detail}<span class="detail">{achievement.detail}</span>{/if}
						{#if (achievement.requires ?? []).length > 0}
							<span class="requires">
								Requires: {masteryPrerequisites(achievement).join('; ')}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if open !== undefined}
		<!--
			A side panel, deliberately **not** a dialog: §9.4 makes completion one
			action with no confirmation, and a modal is exactly the blocking step
			F31 rules out. §15.7 turns it into a full-screen sheet on a narrow
			viewport; that is CSS, not a role change.
		-->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<aside
			class="milestone-panel"
			aria-label="Milestone detail"
			onkeydown={(event) => {
				if (event.key === 'Escape') closePanel();
			}}
		>
			<h3>{open.title}</h3>
			{#if open.detail}
				<p class="detail">{open.detail}</p>
			{/if}

			{#if prerequisitesOf(open.uid).length > 0}
				<div class="prerequisites">
					<h4>Requires</h4>
					<ul>
						{#each prerequisitesOf(open.uid) as prerequisite (prerequisite.uid)}
							<li>{prerequisite.title}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="actions">
				<button type="button" data-action="complete" onclick={() => complete(open.uid)}>
					Complete
				</button>
				<button type="button" data-action="note" onclick={() => (noteOpen = !noteOpen)}>
					Add note
				</button>
				<button type="button" data-action="dismiss" onclick={() => dismiss(open.uid)}>
					Not for me
				</button>
				<button type="button" data-action="undo" onclick={() => undo(open.uid)}> Undo </button>
			</div>

			{#if pending !== null}
				<!--
					§11.10's intercept. It states the consequence and then gets out of
					the way: `role="status"` and not a dialog, because the point is
					to inform before the commit, not to trap the user in a modal.
				-->
				<div class="consequence" role="status">
					<p>{pending.message}</p>
					<div class="actions">
						<button type="button" data-action="confirm" onclick={confirmPending}>
							{pending.kind === 'dismiss' ? 'Dismiss anyway' : 'Un-check anyway'}
						</button>
						{#if pending.kind === 'dismiss'}
							<button type="button" data-action="hide" onclick={hidePending}>
								Hide it instead
							</button>
						{/if}
						<button type="button" data-action="cancel" onclick={cancelPending}>Cancel</button>
					</div>
				</div>
			{/if}

			{#if noteOpen}
				<div class="note-editor">
					<label for="note-{open.uid}">Note</label>
					<textarea id="note-{open.uid}" bind:value={noteDraft}></textarea>
					<button type="button" data-action="save-note" onclick={() => saveNote(open.uid)}>
						Save note
					</button>
				</div>
			{/if}

			<button type="button" data-action="close" onclick={closePanel}>Close</button>
		</aside>
	{/if}
</div>

<style>
	.tree-view {
		container-type: inline-size;
	}

	.glyph-defs {
		position: absolute;
		width: 0;
		height: 0;
	}

	.tree {
		width: 100%;
		height: auto;
	}

	.row-band {
		fill: transparent;
	}

	.edge {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		opacity: 0.5;
		transition: opacity 120ms ease;
	}

	.edge.is-lit {
		opacity: 1;
		stroke-width: 2.5;
	}

	.edge.is-dim {
		opacity: 0.12;
	}

	/* §15.5 — nothing here conveys information through motion, so removing it
	   all costs nothing. */
	@media (prefers-reduced-motion: reduce) {
		.edge {
			transition: none;
		}
	}

	.node-box {
		fill: var(--surface, #fff);
		stroke: currentColor;
	}

	.node.is-complete .node-box {
		fill: var(--domain-accent, #2f6f4f);
	}

	.node.is-bonus .node-box {
		fill: var(--domain-accent-light, #8fc0a9);
	}

	.node.is-locked .node-box,
	.node.is-dismissed .node-box {
		fill: var(--surface-recessed, #f1f1f1);
	}

	.node-label-inner {
		height: 100%;
		display: flex;
		align-items: center;
	}

	.node-title {
		font-size: 11px;
		line-height: 1.15;
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.row-label,
	.group-progress {
		font-size: 10px;
		opacity: 0.75;
	}

	/* §15.7 — a touch target of at least 44×44 CSS pixels. In SVG that means the
	   drawn node stays as it is and the hit area is the group's own box. */
	.node {
		cursor: pointer;
	}

	/* Narrow: §8.5's stack, which §15.1 makes the primary representation. */
	.narrow-stack .row {
		margin-block-end: 1rem;
	}

	.narrow-stack .stack {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.narrow-stack .node {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		min-height: 44px;
		padding: 0.25rem 0.5rem;
		border: 1px solid currentColor;
	}

	.narrow-stack .node.is-locked {
		border-style: dashed;
	}

	.narrow-stack .node.is-dismissed {
		border-style: dotted;
	}

	.narrow-stack .node.is-available {
		border-width: 3px;
	}

	.node-glyph {
		width: 16px;
		height: 16px;
		flex: none;
	}

	.requires {
		font-size: 0.85em;
		opacity: 0.8;
		flex-basis: 100%;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.milestone-panel,
	.mastery-panel {
		margin-block-start: 1rem;
		padding: 0.75rem;
		border: 1px solid currentColor;
	}

	.milestone-panel .actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	/* §11.10's intercept: prominent, but never a modal — completion is one
	   action and nothing here may block it (F31). */
	.consequence {
		margin-block: 0.75rem;
		padding: 0.5rem;
		border-inline-start: 4px solid currentColor;
	}
</style>
