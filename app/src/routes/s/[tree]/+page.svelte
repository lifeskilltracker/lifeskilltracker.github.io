<script lang="ts">
	/**
	 * The skill page (§13.4). It composes rather than computes: the session in
	 * `lib/actions` registers the bundle with the store and derives the score,
	 * and `TreeView` draws it and reports what the user wants done.
	 *
	 * The one decision made here is **which viewport applies**, because it is the
	 * one thing neither engine can know. §9.5 measures the tree's own container
	 * rather than the window, so the same component behaves correctly if it is
	 * ever embedded in a narrow panel on a wide screen.
	 */
	import TreeView from '$lib/components/TreeView.svelte';
	import type { MilestoneIntent } from '$lib/components/intents.js';
	import { openTreeSession, type TreeSession } from '$lib/actions/tree-session.svelte.js';
	import { layoutTree } from '$lib/layout';
	import type { SkillPageData } from './+page.js';

	let { data }: { data: SkillPageData } = $props();

	/** Below this, the tree collapses to §8.5's one-column reading order (§15.7). */
	const NARROW_BELOW = 720;

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
		// this one over.
		const opened = openTreeSession(tree);
		session = opened;
		return () => {
			opened.close();
			session = null;
		};
	});

	$effect(() => {
		const element = container;
		if (element === undefined || typeof ResizeObserver === 'undefined') return;

		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? element.clientWidth;
			viewport = width < NARROW_BELOW ? 'narrow' : 'wide';
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	/**
	 * Memoized on `(tree.id, contentVersion, viewport)` (§8.6), so switching
	 * viewports twice costs one layout, and user state never enters the key.
	 */
	let positions = $derived(data.tree === null ? null : layoutTree(data.tree, viewport));

	function onintent(intent: MilestoneIntent): void {
		// Fire and forget: §12.4's write is a transaction, and the mirror refresh
		// on commit is what redraws the tree (T26/F23).
		void session?.apply(intent);
	}
</script>

{#if data.tree === null}
	<main>
		<h1>Skill unavailable</h1>
		<p>
			We could not load <code>{data.treeId}</code>. Other skills are unaffected.
		</p>
		<p class="detail">{data.unavailable}</p>
	</main>
{:else}
	<main bind:this={container}>
		{#if data.offline}
			<p class="offline">Offline — showing content saved on this device.</p>
		{/if}
		<h1>{data.tree.title}</h1>
		<p>{data.tree.summary}</p>

		{#if session !== null && positions !== null}
			<TreeView
				tree={data.tree}
				{positions}
				progress={session.progress}
				{viewport}
				{onintent}
				uncheckConsequence={(uid) => session?.uncheckConsequence(uid) ?? null}
			/>
		{/if}
	</main>
{/if}

<style>
	.offline {
		font-style: italic;
	}
	.detail {
		font-family: monospace;
		font-size: 0.85em;
	}
</style>
