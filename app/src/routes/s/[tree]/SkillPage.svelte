<script lang="ts">
	/**
	 * The skill page body (§13.4) — shared by `/s/<treeId>` and
	 * `/s/<treeId>/m/<slug>`, which differ only in whether a panel starts open.
	 *
	 * It is a plain component in a route directory rather than one under
	 * `lib/components/` on purpose: it reaches for `lib/actions`, and §14.1's
	 * graph runs `ACTIONS → ROUTES`, never `ACTIONS → COMP`. Components take
	 * values and emit intent; this composes.
	 *
	 * It composes rather than computes. The session in `lib/actions` registers the
	 * bundle with the store, scores it, performs §12.3's write-back, and produces
	 * the layout; `TreeView` draws it and reports what the user wants done.
	 *
	 * The one decision made here is **which viewport applies**, because it is the
	 * one thing neither engine can know. §9.5 measures the tree's own container
	 * rather than the window, so the same component behaves correctly if it is
	 * ever embedded in a narrow panel on a wide screen.
	 */
	import TreeView from '$lib/components/TreeView.svelte';
	import SkillHeader from '$lib/components/SkillHeader.svelte';
	import { TREE_NARROW_BELOW } from '$lib/components/breakpoints.js';
	import type { MilestoneIntent } from '$lib/components/intents.js';
	import { openTreeSession, type TreeSession } from '$lib/actions/tree-session.svelte.js';
	import { progress } from '$lib/state/progress.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { resolve } from '$app/paths';
	import type { SkillPageData } from './+page.js';

	interface Props {
		data: SkillPageData;
		/** §13.1's deep link: the milestone panel to open on arrival. */
		openUid?: string | null;
		/** An unresolvable slug says so here rather than 404ing (§13.1, §5.4). */
		notice?: string | null;
	}

	let { data, openUid = null, notice = null }: Props = $props();

	let container: HTMLElement | undefined = $state();
	let viewport = $state<'wide' | 'narrow'>('wide');

	let session = $state<TreeSession | null>(null);

	$effect(() => {
		const tree = data.tree;
		if (tree === null) {
			session = null;
			return;
		}
		// Registering the tree is what makes the first click work at all (§12.4
		// step 2): the store is given no way to fetch a bundle, so the shell hands
		// this one over. The session also reconciles §12.3's stored level.
		const opened = openTreeSession(tree);
		session = opened;
		return () => {
			opened.close();
			session = null;
		};
	});

	/**
	 * The URL is the authority on which panel is open when the page arrives
	 * (§13.1). Afterwards the renderer is: `panelUid` is bound, so closing the
	 * panel is a state change here rather than a navigation, and §13.2's `ui`
	 * store is what carries it back out to the shell.
	 */
	let panelUid = $derived(openUid);

	$effect(() => {
		if (data.tree === null) return;
		if (panelUid === null) ui.closePanel();
		else ui.openPanel(data.tree.id, panelUid);
	});

	$effect(() => {
		const element = container;
		if (element === undefined || typeof ResizeObserver === 'undefined') return;

		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? element.clientWidth;
			// §8.5's one-column reading order; the threshold is §15.7's, named with
			// the other two in `lib/components/breakpoints.ts`.
			viewport = width < TREE_NARROW_BELOW ? 'narrow' : 'wide';
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	/**
	 * Memoized on `(tree.id, contentVersion, viewport)` (§8.6), so switching
	 * viewports twice costs one layout, and user state never enters the key.
	 */
	let positions = $derived(session === null ? null : session.layoutFor(viewport));

	/**
	 * Whether the user has a `SKILL` row for a tree the library no longer has.
	 * Read off §13.2's mirror, so it is only meaningful once hydration has
	 * landed — an unhydrated mirror says "no row", which is why the message it
	 * gates is additive rather than a denial.
	 */
	let started = $derived(progress.skills[data.treeId] !== undefined);

	function onintent(intent: MilestoneIntent): void {
		// Fire and forget: §12.4's write is a transaction, and the mirror refresh
		// on commit is what redraws the tree (T26/F23).
		void session?.apply(intent);
	}
</script>

{#if data.tree === null}
	<main>
		<h1>Skill unavailable</h1>
		{#if data.reason === 'missing'}
			<p>
				<code>{data.treeId}</code> is not in this skill library. That usually means it
				came from a different or newer library than the one running here.
			</p>
			{#if started}
				<!--
					§16.3, T26/F22: the row is retained, never deleted, and the user must
					be able to see that their progress is intact.
				-->
				<p data-progress-intact>
					Your progress for it is still stored on this device and has not been
					touched. <a href={resolve('/data')}>See it on the data page</a>.
				</p>
			{/if}
		{:else}
			<p>
				We could not load <code>{data.treeId}</code>. Other skills are unaffected.
			</p>
		{/if}
		<p class="detail">{data.unavailable}</p>
	</main>
{:else}
	<main bind:this={container}>
		{#if data.offline}
			<p class="offline">Offline — showing content saved on this device.</p>
		{/if}
		{#if notice !== null}
			<p class="notice" data-page-notice role="status">{notice}</p>
		{/if}

		{#if session !== null && positions !== null}
			<SkillHeader
				title={data.tree.title}
				summary={data.tree.summary}
				progress={session.progress}
				hydrated={progress.hydrated}
			/>
			<TreeView
				tree={data.tree}
				{positions}
				progress={session.progress}
				{viewport}
				{onintent}
				bind:openUid={panelUid}
				uncheckConsequence={(uid) => session?.uncheckConsequence(uid) ?? null}
			/>
		{/if}
	</main>
{/if}

<style>
	main {
		padding: 1rem;
	}
	.offline {
		font-style: italic;
	}
	.detail {
		font-family: monospace;
		font-size: 0.85em;
	}
	.notice {
		border: 1px solid;
		padding: 0.5rem 0.75rem;
	}
</style>
