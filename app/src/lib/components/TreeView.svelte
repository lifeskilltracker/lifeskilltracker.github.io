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
	import { progressAnnouncement } from './announcements.js';
	import { cappedLevel, dismissalWarning, uncheckWarning } from './consequences.js';
	import type { MilestoneIntent, UncheckConsequence } from './intents.js';
	import { focusTarget, gridOrder, isGridKey } from './keyboard-grid.js';
	import {
		levelSectionName,
		moduleOf,
		nodeAccessibleName,
		nodeDescription,
		trackTitleOf,
	} from './node-description.js';
	import { hitRect, levelFill, presentationFor } from './node-state.js';
	import {
		anchorFor,
		glideDuration,
		glidePosition,
		type CameraTarget
	} from './tree-camera.js';
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
		/**
		 * §11.10's "hide it instead", resolved (T19): uids the user asked to see
		 * less of, held by the session and written down nowhere.
		 *
		 * It is a prop and not local state for the same reason `openUid` is —
		 * `lib/actions` owns the decision, the component owns the drawing — and it
		 * is deliberately *not* consulted anywhere near `progress`. Hiding is the
		 * option §11.10 offers because it does **not** cap the skill, so a hidden
		 * milestone stays incomplete, stays in its group's denominator, and stays
		 * one click from being completed. Everything below only stops drawing it.
		 */
		hidden?: ReadonlySet<string>;
	}

	let {
		tree,
		positions,
		progress,
		viewport,
		onintent,
		uncheckConsequence,
		openUid = $bindable(null),
		hidden = new Set<string>()
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

	/**
	 * Whether the hidden milestones are on screen anyway (T19).
	 *
	 * Hiding has to be reversible from the same view that performed it, and the
	 * only reversal a hidden node can offer is one the user cannot see. So the
	 * count is always stated and the set is always one press from being back —
	 * the suppression is a filter over the drawing, never a deletion.
	 */
	let revealHidden = $state(false);

	const isHidden = (uid: string): boolean => hidden.has(uid);
	const drawn = (uid: string): boolean => revealHidden || !hidden.has(uid);

	/**
	 * The nodes actually drawn. Everything downstream — grid order, the tab stop,
	 * the arrow keys, the narrow stack — reads this rather than
	 * `positions.nodes`, so a hidden milestone cannot be reached by a key press
	 * that has nowhere visible to land.
	 */
	const drawnNodes = $derived(positions.nodes.filter((node) => drawn(node.uid)));

	/**
	 * An edge to a node that is not on screen renders as a line into empty space,
	 * which reads as a data bug rather than as a hidden milestone.
	 */
	const drawnEdges = $derived(
		positions.edges.filter((edge) => drawn(edge.fromUid) && drawn(edge.toUid))
	);

	/**
	 * §15.2's grid order — `(level, track, lane)` — and it is the order the nodes
	 * are *rendered* in, in both viewports. Document order, focus order and
	 * §15.1's reading order are one order; the arithmetic lives in
	 * `keyboard-grid.ts` so it can be tested without a DOM.
	 */
	const ordered = $derived(gridOrder(drawnNodes));

	/**
	 * §15.2 — "a single tab stop with roving `tabindex`", so an eighty-milestone
	 * tree does not cost eighty tabs. Resolved against `ordered` rather than read
	 * straight back, so switching tree cannot leave the roving uid naming a node
	 * that no longer exists — which would leave the tree with no tab stop at all.
	 */
	let rovingUid = $state<string | null>(null);
	const tabStop = $derived(
		ordered.find((node) => node.uid === rovingUid)?.uid ?? ordered[0]?.uid ?? null
	);

	function moveFocus(uid: string): void {
		rovingUid = uid;
		nodeElements[uid]?.focus();
	}

	/**
	 * §15.2's live region: `polite`, one of them, and stating the consequence
	 * rather than the click. The consequence is only visible as a *diff*, and this
	 * component is handed the after-state as a prop (§13.4) — so the previous
	 * value is kept in a plain variable, deliberately not `$state`: it is an
	 * input to the effect, never a dependency of it, and making it reactive would
	 * make the effect re-run on its own write.
	 */
	let announcement = $state('');
	let previousProgress: SkillProgress | null = null;

	$effect(() => {
		const current = progress;
		if (previousProgress !== null && previousProgress !== current) {
			const spoken = progressAnnouncement(tree, previousProgress, current);
			if (spoken !== null) announcement = spoken;
		}
		previousProgress = current;
	});

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

	/** The whole of §15.2's key table, activation and traversal alike. */
	function onNodeKey(event: KeyboardEvent, uid: string): void {
		if (event.key === 'Enter' || event.key === ' ') {
			// Space scrolls the page otherwise, which moves the tree under the user.
			event.preventDefault();
			openPanel(uid);
			return;
		}

		// Esc closes from the node as well as from the panel: opening a panel does
		// not move focus (§9.4 — it is not a dialog and must not trap), so the node
		// is exactly where the key press arrives.
		if (event.key === 'Escape') {
			if (openUid === null || openUid === undefined) return;
			event.preventDefault();
			closePanel();
			return;
		}

		if (!isGridKey(event.key)) return;
		// Arrows scroll and Home/End jump the document otherwise; both would move
		// the tree out from under the focus this is about to place.
		event.preventDefault();
		const target = focusTarget(drawnNodes, progress.nodeStates, uid, event.key, viewport);
		if (target === undefined) return;
		moveFocus(target);
		// F36's shortcut gains its visual counterpart (§7): `.` already moved
		// focus to the next available milestone; the camera now follows it there.
		// Only `.` — the arrows step to a neighbour the user can already see, and
		// a camera that jumped on every arrow press would be motion sickness.
		if (event.key === '.') cameraToNode(target);
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

	/**
	 * §11.10's softer option (T19). It emits `hide` and nothing else — no
	 * `dismiss`, no state, no second denominator rule. The user asked to stop
	 * looking at the milestone, not to give it up.
	 */
	function hidePending(): void {
		if (pending === null) return;
		emit({ kind: 'hide', uid: pending.uid });
		pending = null;
		closePanel();
	}

	/**
	 * Hiding from the panel directly, with no intercept in front of it: there is
	 * no consequence to state. This is what makes the "hide it instead" offer an
	 * ordinary action the user can reach again rather than a one-time escape
	 * hatch inside a warning they have already dismissed.
	 */
	function hide(uid: string): void {
		emit({ kind: 'hide', uid });
		closePanel();
	}

	function unhide(uid: string): void {
		emit({ kind: 'unhide', uid });
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

	/* ---------------------------------------------------------------------- *
	 * The level camera (T34, UI-SPEC §7).
	 *
	 * **It moves the viewport and never the focus order.** §15.2's grid and
	 * roving `tabindex` are unchanged above and below this block; every anchor
	 * here is a scroll offset. There is no zoom and no pan: §7 declines both by
	 * name, and if a tree ever feels too tall the answer is another named anchor
	 * in `tree-camera.ts`, not a scale factor.
	 *
	 * The arithmetic is all in `tree-camera.ts`, which is pure. What is left
	 * here is the only part that genuinely needs a browser: a scroll container,
	 * a frame clock, and the user's motion preference.
	 * ---------------------------------------------------------------------- */

	/** The header strip each level band carries, in layout units (§4.3's line lives on it). */
	const LEVEL_HEADER_H = 20;

	let cameraElement = $state<HTMLDivElement | undefined>(undefined);
	let svgElement = $state<SVGSVGElement | undefined>(undefined);

	/**
	 * Where the camera is pointed, in layout units — `null` until it is first
	 * asked to move. Reflected onto the container as `data-camera-anchor` because
	 * that is the only honest way to observe it: `scrollTop` is a pixel and a
	 * pixel needs a laid-out box, which is exactly what a component test does not
	 * have.
	 */
	let cameraAnchor = $state<number | null>(null);

	let glideFrame: number | null = null;

	function cancelGlide(): void {
		if (glideFrame !== null) globalThis.cancelAnimationFrame?.(glideFrame);
		glideFrame = null;
	}

	$effect(() => cancelGlide);

	/** §15.5. Asked at the moment of the move, so a mid-session change is honoured. */
	function prefersReducedMotion(): boolean {
		return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	}

	/**
	 * Layout units → rendered pixels. The `viewBox` maps the engine's extent onto
	 * the element box one-to-one (`xMidYMid meet`, `height: auto`), so one ratio
	 * is the whole conversion. An unmeasured box falls back to 1:1 rather than to
	 * 0, which would collapse every anchor onto the top of the tree.
	 */
	function unitScale(): number {
		const drawn = svgElement?.clientHeight ?? 0;
		return drawn > 0 && positions.height > 0 ? drawn / positions.height : 1;
	}

	function glideTo(offset: number): void {
		const element = cameraElement;
		if (element === undefined) return;
		cancelGlide();

		const to = offset * unitScale();
		const from = element.scrollTop;
		const duration = glideDuration(prefersReducedMotion());
		const raf = globalThis.requestAnimationFrame;

		// Instant is the correct behaviour twice over: under `reduce`, and where
		// there are no frames to animate with at all.
		if (duration <= 0 || typeof raf !== 'function') {
			element.scrollTop = to;
			return;
		}

		let started: number | null = null;
		const step = (now: number): void => {
			started ??= now;
			const elapsed = now - started;
			element.scrollTop = glidePosition(from, to, elapsed, duration);
			glideFrame = elapsed < duration ? raf(step) : null;
		};
		glideFrame = raf(step);
	}

	/**
	 * The camera's one entry point, exported so the page around the tree can put
	 * §7's three controls on screen without owning the scroll container.
	 */
	export function moveCamera(target: CameraTarget): void {
		if (viewport !== 'wide') return; // §9.5's stack is unchanged, and scrolls itself.
		const anchor = anchorFor(target, positions, progress);
		cameraAnchor = anchor;
		glideTo(anchor);
	}

	/**
	 * The `.` shortcut's visual counterpart (F36). It follows the node focus
	 * actually landed on rather than re-resolving `next-available`, because `.`
	 * wraps through every available milestone in turn and the camera has to show
	 * the one the user just reached, not always the first.
	 */
	function cameraToNode(uid: string): void {
		const positioned = drawnNodes.find((candidate) => candidate.uid === uid);
		if (positioned !== undefined) moveCamera({ kind: 'level', level: positioned.level });
	}
</script>

<!--
	The domain's plate, resolved for the live theme, named once (§4.2, A7).

	It is an inline custom property rather than a class per domain because the
	eight palettes are *content* (D-03) — `theme.svelte.ts` injects them as
	`--domain-<id>` from `domains.yaml`, and a stylesheet cannot enumerate a
	palette it has never seen. The fallback is `--ink` and not a hex: §4.3 gives
	hue one source, and a literal here would be a second one.
-->
<div
	class="tree-view"
	data-viewport={viewport}
	style="--plate: var(--domain-{tree.domain}, var(--ink))"
>
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

	{#if hidden.size > 0}
		<!--
			T19: the whole of hiding's user-facing memory. The count is stated
			whether or not the set is revealed, because a suppression the user
			cannot find again is indistinguishable from data loss — and because
			hiding changes no score, there is nothing else about it to report.
		-->
		<p class="hidden-controls">
			<button
				type="button"
				data-action="reveal-hidden"
				aria-pressed={revealHidden}
				onclick={() => (revealHidden = !revealHidden)}
			>
				{revealHidden ? 'Stop showing hidden' : 'Show hidden'} ({hidden.size})
			</button>
		</p>
	{/if}

	<!--
		§15.2's single shared live region. `polite` — never `assertive`, which
		interrupts — and it holds the consequence of the last change, not a log.
		Visually hidden because the same consequence is already on screen as the
		node's own state and the row's readout.
	-->
	<p class="visually-hidden announcer" aria-live="polite" role="status">{announcement}</p>

	{#if viewport === 'wide'}
		<!--
			F29 — the track titles. `columns[].trackId` and `.title` were computed by
			§8.2 step 2 and drawn nowhere, so a three-column tree gave a reader the
			structure in x-positions and no way to learn what the columns were.

			HTML above the `viewBox` rather than a header band inside it, so §8 keeps
			its `height` and every layout stability test stands. The alignment is
			exact rather than approximate: `.tree` is `width: 100%; height: auto`, so
			with the default `xMidYMid meet` there is no letterboxing and the viewBox
			maps onto the element box one-to-one — a percentage of `positions.width`
			is therefore the same fraction of the rendered SVG.

			`aria-hidden`, because this is a second presentation of a fact every node
			already carries in its own description (F29's other half). Spoken here it
			would be three labels floating free of anything they name.
		-->
		{#if positions.columns.some((column) => column.trackId !== '')}
			<div class="column-heads" aria-hidden="true">
				{#each positions.columns as column (column.trackId)}
					<div
						class="column-head"
						data-track={column.trackId}
						style="left: {(column.x / positions.width) * 100}%; width: {(column.w /
							positions.width) *
							100}%"
					>
						{column.title}
					</div>
				{/each}
			</div>
		{/if}
		<!--
			§7's level camera viewport, and the only structural change T34 makes to
			the wide tree.

			It is a scroll box and nothing more: no transform, no scale, no pan
			handler. The camera parks a level band at its top; the user scrolls it
			exactly as they scrolled the page before. `max-block-size` caps nothing
			on a short tree, so a five-level skill is unaffected.

			Not focusable, and it must not become so: every node inside it is, which
			is what makes it a keyboard-reachable scroll region already, and adding a
			tab stop here would put one press between the user and every tree.
		-->
		<div class="tree-camera" bind:this={cameraElement} data-camera-anchor={cameraAnchor}>
			<svg
				class="tree"
				bind:this={svgElement}
				viewBox="0 0 {positions.width} {positions.height}"
				role="group"
				aria-labelledby="tree-title"
			>
				<title id="tree-title">{tree.title}</title>
	
			<!-- Decorative: §15 carries the same relationships as text on the node. -->
			<g class="edges" aria-hidden="true">
				{#each drawnEdges as edge (`${edge.fromUid}->${edge.toUid}`)}
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
					<!--
						§15.2's level section, in the form SVG has one: a named group. The
						name carries number, tier and per-group progress, so traversing the
						structure gives F32's readout without entering a level — and it
						carries them as words, because the visible `2 / 2` is spoken as
						"2 slash 2".
					-->
					{@const fill = levelFill(level?.groups)}
					{@const waterY = row.y + LEVEL_HEADER_H * (1 - fill)}
					<g
						class="row"
						data-level={row.level}
						class:is-satisfied={level?.satisfied}
						role="group"
						aria-label={levelSectionName(row.level, bandTier(row.level), level?.groups ?? [])}
					>
						<rect class="row-band" x="0" y={row.y} width={positions.width} height={row.h} />
						<!--
							§4.3, on the level header: the plate renders at full strength at
							every score and the *score* is the height of a ruled water line, so
							the plate is inked at `--plate-open` above the line and at full
							strength below it. Opacity-as-fill is the thing §4.3 exists to
							forbid — a level at 20% is a level with a low water line, not a
							faded level — and it is why the line is drawn rather than the plate
							dimmed.

							It states nothing the `n / m` readouts beside it do not already
							state in text (§9.6, §15.4), so it adds no channel N5 has to
							police.
						-->
						<rect
							class="header-plate"
							x="0"
							y={row.y}
							width={positions.width}
							height={LEVEL_HEADER_H}
						/>
						<rect
							class="header-water"
							x="0"
							y={waterY}
							width={positions.width}
							height={LEVEL_HEADER_H * fill}
						/>
						<line
							class="water-line"
							x1="0"
							x2={positions.width}
							y1={waterY}
							y2={waterY}
							data-fill={fill}
						/>
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
						<text class="row-label display halo" x="4" y={row.y + 14}>
							Level {row.level} · {bandTier(row.level)}
							{#each level?.groups ?? [] as group, index (index)}
								<tspan class="group-progress tabular" dx="12"
									>{Math.min(group.completed, group.n)} / {group.n}</tspan
								>
							{/each}
						</text>
					</g>
				{/each}
			</g>
	
			<g class="nodes">
				{#each ordered as positioned (positioned.uid)}
					{@const state = progress.nodeStates.get(positioned.uid)}
					{@const look = presentationFor(state)}
					{@const hit = hitRect(positioned.w, positioned.h)}
					<g
						class="node {look.className}"
						class:is-hidden={isHidden(positioned.uid)}
						data-uid={positioned.uid}
						data-state={state}
						data-hidden={isHidden(positioned.uid) ? 'true' : undefined}
						data-level={positioned.level}
						data-plate={look.plate}
						tabindex={positioned.uid === tabStop ? 0 : -1}
						role="button"
						aria-label={nodeAccessibleName(tree, positioned.uid)}
						aria-describedby="ms-{positioned.uid}-desc"
						transform="translate({positioned.x}, {positioned.y})"
						bind:this={nodeElements[positioned.uid]}
						onclick={() => openPanel(positioned.uid)}
						onkeydown={(event) => onNodeKey(event, positioned.uid)}
						onfocus={() => {
							focusedUid = positioned.uid;
							rovingUid = positioned.uid;
						}}
						onblur={() => (focusedUid = null)}
					>
						<desc id="ms-{positioned.uid}-desc"
							>{nodeDescription(tree, progress, positioned.uid)}</desc
						>
						<!--
							§15.7's 44×44 target. Transparent and centred on the drawn box, so
							the node can be smaller than a finger without being harder to hit.
							First child, so the box, glyph and label all paint over it.
						-->
						<rect
							class="hit-area"
							fill="transparent"
							pointer-events="all"
							x={hit.x}
							y={hit.y}
							width={hit.width}
							height={hit.height}
						/>
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
									F29 — the module label. `module` reached the renderer and was
									dropped, which left a tree grouped into modules looking
									exactly like a plain linear one: mental-health's `n_of`
									groups change what clears a level, and nothing on screen said
									which milestones belonged to which practice.

									**Text, not colour and not a glyph.** §9.3 has already spent
									fill, border *and* glyph on the five node states, so both of
									the cheap channels are taken, and N5 forbids adding a sixth
									meaning to colour. Text is the one channel still free.

									No track label here — in wide the column header above says it
									once for the whole column, and repeating it on all fifty
									nodes is the noise that header exists to avoid.
								-->
								{#if moduleOf(tree, positioned.uid) !== ''}
									<span class="node-module">{moduleOf(tree, positioned.uid)}</span>
								{/if}
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
		</div>
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
				<!--
						§15.2's structure: a section per level, named by its own heading, and
						an ordered list of milestones inside it. The heading's accessible name
						spells the counts out — the visible `2 / 2` is spoken "2 slash 2" —
						while the visible text stays the compact form §9.6 draws.
					-->
					<section
						class="row"
						data-level={row.level}
						class:is-satisfied={level?.satisfied}
						aria-labelledby="level-{row.level}-heading"
					>
						<h3
							id="level-{row.level}-heading"
							class="display"
							aria-label={levelSectionName(row.level, bandTier(row.level), level?.groups ?? [])}
						>
							Level {row.level} · {bandTier(row.level)}
						{#each level?.groups ?? [] as group, index (index)}
							<span class="group-progress tabular"
								>{Math.min(group.completed, group.n)} / {group.n}</span
							>
						{/each}
					</h3>
					<ol class="stack">
						{#each ordered.filter((n) => n.level === row.level) as positioned (positioned.uid)}
							{@const state = progress.nodeStates.get(positioned.uid)}
							{@const look = presentationFor(state)}
							<li>
								<div
									class="node {look.className}"
									class:is-hidden={isHidden(positioned.uid)}
									data-uid={positioned.uid}
									data-state={state}
									data-hidden={isHidden(positioned.uid) ? 'true' : undefined}
									data-level={positioned.level}
									data-plate={look.plate}
									tabindex={positioned.uid === tabStop ? 0 : -1}
									role="button"
									aria-label={nodeAccessibleName(tree, positioned.uid)}
									aria-describedby="ms-{positioned.uid}-desc"
									bind:this={nodeElements[positioned.uid]}
									onclick={() => openPanel(positioned.uid)}
									onkeydown={(event) => onNodeKey(event, positioned.uid)}
									onfocus={() => {
										focusedUid = positioned.uid;
										rovingUid = positioned.uid;
									}}
									onblur={() => (focusedUid = null)}
								>
									<svg class="node-glyph" viewBox="0 0 16 16" aria-hidden="true">
										<use class="state-glyph" href={look.glyph} width="16" height="16" />
									</svg>
									<!--
										F29 in narrow. The **track** appears per node here, unlike
										wide: narrow has one synthetic column and therefore no
										header to hang it on, and §8.5 sorts the stack by
										`(level, trackIndex, order, slug)`, so without this the
										track boundaries inside a level are invisible in the one
										view §15.1 makes primary for assistive technology.
									-->
									{#if trackTitleOf(tree, positioned.uid) !== '' || moduleOf(tree, positioned.uid) !== ''}
										<span class="node-meta" aria-hidden="true">
											{[trackTitleOf(tree, positioned.uid), moduleOf(tree, positioned.uid)]
												.filter((part) => part !== '')
												.join(' · ')}
										</span>
									{/if}
									<span class="node-title">{labelOf(positioned.uid)}</span>
									{#if prerequisitesOf(positioned.uid).length > 0}
										<span class="requires">
											Requires: {prerequisitesOf(positioned.uid)
												.map((m) => m.title)
												.join('; ')}
										</span>
									{/if}
									<span class="visually-hidden" id="ms-{positioned.uid}-desc">
										{nodeDescription(tree, progress, positioned.uid)}
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
				{#if isHidden(open.uid)}
					<button type="button" data-action="unhide" onclick={() => unhide(open.uid)}>
						Unhide
					</button>
				{:else}
					<button type="button" data-action="hide" onclick={() => hide(open.uid)}> Hide </button>
				{/if}
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
	/*
		The Survey system, applied (T34, UI-SPEC §4).

		**Not one colour literal lives in this file.** §4.3 makes hue identity and
		forbids it from ever encoding score, which only holds if hue has exactly one
		source; `tokens.css` is that source and `--plate` is the domain's own ink,
		handed in on the root element because palettes are content (D-03, A7).

		Everything below restates §9.3's encoding in that vocabulary. It restates —
		it does not extend. The five states still carry glyph, border and fill, and
		N5's rule that no meaning rides on colour alone is met exactly where it was.
	*/
	.tree-view {
		container-type: inline-size;
		color: var(--ink);
	}

	.glyph-defs {
		position: absolute;
		width: 0;
		height: 0;
	}

	/*
		§7's level camera viewport. A scroll box and nothing else: there is no
		transform here and there must never be one, because §15.2's arrow grid and
		roving `tabindex` both assume stable positions and a scale factor is exactly
		what would move them. `max-block-size` is a cap, not a height — a tree
		shorter than the viewport is drawn whole and never scrolls at all.
	*/
	.tree-camera {
		overflow-y: auto;
		overflow-x: hidden;
		max-block-size: 78svh;
		/* The camera scrolls; the user's fingers must not zoom (§7). */
		touch-action: pan-y;
	}

	.tree {
		width: 100%;
		height: auto;
	}

	.row-band {
		fill: transparent;
	}

	/*
		§4.3 on the level header. The plate is inked at `--plate-open` across the
		whole strip and at full strength below the water line; the line itself is
		ruled in ink at `--rule-water`. What moves with the score is the line, never
		the plate's opacity — a level at 20% is a level with a low water line, not a
		faded level, and the difference is the whole of §4.3.
	*/
	.header-plate {
		fill: var(--plate);
		fill-opacity: var(--plate-open);
	}

	.header-water {
		fill: var(--plate);
		transition: y 200ms ease, height 200ms ease;
	}

	.water-line {
		stroke: var(--ink);
		stroke-width: var(--rule-water);
		transition: y1 200ms ease, y2 200ms ease;
	}

	.edge {
		fill: none;
		stroke: var(--ink);
		stroke-width: var(--rule-outline-l1);
		opacity: 0.5;
		transition: opacity 140ms ease;
	}

	.edge.is-lit {
		opacity: 1;
		stroke-width: var(--rule-outline-l0);
	}

	.edge.is-dim {
		opacity: 0.12;
	}

	/* §15.5 — nothing here conveys information through motion, so removing it
	   all costs nothing. The camera's own glide is disabled in script, where the
	   preference is read at the moment of the move (`glideDuration`). */
	@media (prefers-reduced-motion: reduce) {
		.edge {
			transition: none;
		}

		.header-water {
			transition: none;
		}

		.water-line {
			transition: none;
		}
	}

	/*
		§4.6's five plates. `--plate` is the domain's ink and the only hue in the
		tree; `full` and `bonus` are two strengths of it, and `open` is bare paper.
		The border and the glyph carry the state without any of this (§15.4), which
		is why the fill lives in CSS at all — so `forced-colors: active` can throw it
		away and lose nothing.
	*/
	.node-box {
		fill: var(--paper);
		stroke: var(--ink);
	}

	.node.is-complete .node-box {
		fill: var(--plate);
	}

	.node.is-bonus .node-box {
		fill: var(--plate);
		fill-opacity: var(--plate-bonus);
	}

	/* "Surface, recessed" (§9.3), and deliberately not a weaker domain plate:
	   a third strength of the domain ink would read as a third score, and §4.3
	   forbids the plate from carrying one. `--rule` is neutral. */
	.node.is-locked .node-box,
	.node.is-dismissed .node-box {
		fill: var(--rule);
	}

	/*
		§4.5's knockout, in the one place the tree needs it: a label sitting on a
		full-strength plate. Ink on that plate runs 1.45:1 at worst, so the type is
		reversed to paper rather than haloed — a `foreignObject` label is HTML and
		has no `paint-order` to halo with. The box keeps its ink stroke, so the node
		does not lose its border to the same swap.
	*/
	.node.is-complete {
		color: var(--paper);
	}

	/* T19 — a revealed hidden node. Faded, and nothing more: hiding says nothing
	   about the milestone's state, so it must not borrow `dismissed`'s dotted
	   border or its ✕. Deliberately not `display: none` even here — the node is
	   only ever in the DOM when the user has asked to see the hidden set, and a
	   node that is present but invisible would be reachable and unreadable. */
	.node.is-hidden {
		opacity: 0.4;
	}

	.hidden-controls {
		margin: 0.25rem 0;
	}

	.node-label-inner {
		height: 100%;
		display: flex;
		/*
			Column since F29 put the module label above the title. `justify-content`
			keeps the pair centred against the glyph at `h / 2`, which is what
			`align-items: center` was doing when this was a single row.
		*/
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
	}

	/*
		F29's module label. Deliberately quiet — it is orientation, not the thing
		the node is, so it must not out-weigh the title. Uppercase and letter-spaced
		rather than coloured, because §9.3 has spent fill, border and glyph on the
		five node states and N5 bars a sixth meaning on colour.
	*/
	.node-module {
		font-size: 8px;
		line-height: 1.2;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.7;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.node-title {
		font-family: var(--font-body);
		font-size: 11px;
		line-height: 1.15;
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	/* The narrow-viewport counterpart, carrying track and module on one line. */
	.node-meta {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	/*
		F29's track titles, aligned to the SVG below by percentage. `position:
		relative` on the strip makes each head's `left`/`width` a fraction of the
		same box the viewBox maps onto, so the two stay locked at any width.
	*/
	.column-heads {
		position: relative;
		height: 1.4em;
		margin-bottom: 0.2em;
	}

	.column-head {
		position: absolute;
		top: 0;
		font-family: var(--font-display);
		font-size: 11px;
		letter-spacing: var(--display-tracking);
		text-align: center;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		border-bottom: var(--rule-outline-l0) solid var(--rule);
		opacity: 0.75;
	}

	/*
		§4.5's engraved lettering. `display` and `halo` are the shared classes from
		`tokens.css` — the halo is an accessibility mechanism and not a flourish, so
		it is imported rather than re-derived. Only its *width* is local: 2.8 world
		units is sized for a map region's label and would swallow 10px type.
	*/
	.row-label {
		--halo-width: 1.4;

		fill: var(--ink);
		font-size: 10px;
	}

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

	.narrow-stack h3 {
		font-size: 1rem;
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
		border: 1.3px solid var(--ink);
		background: var(--paper);
	}

	/* §4.6's plates again, in the viewport that has no SVG to fill. */
	.narrow-stack .node.is-complete {
		background: var(--plate);
		color: var(--paper);
	}

	.narrow-stack .node.is-bonus {
		background: color-mix(in srgb, var(--plate) 42%, transparent);
	}

	.narrow-stack .node.is-locked,
	.narrow-stack .node.is-dismissed {
		background: var(--rule);
	}

	.narrow-stack .node.is-locked {
		border-style: dashed;
	}

	.narrow-stack .node.is-dismissed {
		border-style: dotted;
	}

	.narrow-stack .node.is-available {
		border-width: 2.2px;
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
		border: var(--rule-outline-l0) solid var(--rule);
		background: var(--paper);
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
		border-inline-start: 4px solid var(--ink);
	}

	/*
		§15.4's floor. `forced-colors: active` throws every plate away, and what has
		to survive is the *structure*: a node still needs a border and a glyph the
		platform will paint in its own colours. `stroke: currentColor` hands both
		back to the system rather than pinning them to a token it has just ignored.
	*/
	@media (forced-colors: active) {
		.node-box {
			fill: Canvas;
			stroke: CanvasText;
		}

		.node.is-complete {
			color: CanvasText;
		}

		.header-plate,
		.header-water {
			fill: Canvas;
		}

		.water-line,
		.edge {
			stroke: CanvasText;
		}
	}

	/* §15.7's third threshold: the milestone detail becomes a full-screen sheet.
	   A `@container` rule and not a media query — `.tree-view` is the container —
	   so a tree embedded in a narrow column gets the sheet on a wide screen too.
	   The literal is `PANEL_SHEET_BELOW`; a container query cannot read a
	   constant, so `TreeView.a11y.test.ts` asserts the two agree.

	   It stays an `<aside>` with the same role it had: §9.4 makes completion one
	   action with no confirmation, so becoming full-screen must not make it a
	   dialog that traps focus (F31). */
	@container (width < 560px) {
		.milestone-panel {
			position: fixed;
			inset: 0;
			z-index: 2;
			margin: 0;
			overflow-y: auto;
			background: var(--paper);
		}
	}
</style>
