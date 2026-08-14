<script lang="ts">
	/**
	 * `/` — the world map (§13.1, F21).
	 *
	 * The shell's job here is the **join**, not the drawing. `worldScores` crosses
	 * the manifest with the `SKILL` store because neither the engine nor the store
	 * may reach the other half (§14.1, T26/F4); `MapRenderer` receives the result
	 * and computes none of it (§10.5).
	 *
	 * It renders whatever it has. The map appears when the manifest resolves, and
	 * the regions fill in when hydration does — neither waits on the other, which
	 * is what §13.3's parallel step 2 is for. There is no spinner over the page.
	 *
	 * The viewport decision is made here for the same reason the tree route makes
	 * its own: §10.7 has no pan and no zoom, so below the width where labels stop
	 * being legible the honest substitute is the list, and only the container
	 * knows its own width (§15.7).
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { worldScores } from '$lib/actions/domain-scores.js';
	import MapRenderer, { type DomainSelection } from '$lib/components/MapRenderer.svelte';
	import { MAP_LIST_BELOW } from '$lib/components/map-presentation.js';
	import { content } from '$lib/content/store.svelte.js';
	import { progress } from '$lib/state/progress.svelte.js';

	let container: HTMLElement | undefined = $state();
	let viewport = $state<'map' | 'list'>('map');

	let world = $derived(
		content.manifest === null ? null : worldScores(content.manifest, progress.skills)
	);

	$effect(() => {
		const element = container;
		if (element === undefined || typeof ResizeObserver === 'undefined') return;

		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? element.clientWidth;
			viewport = width < MAP_LIST_BELOW ? 'list' : 'map';
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	function onselect(selection: DomainSelection): void {
		void goto(resolve('/d/[domain]', { domain: selection.domain }));
	}
</script>

<svelte:head>
	<title>Life Skill Tracker</title>
</svelte:head>

<main bind:this={container}>
	{#if content.manifest !== null && world !== null}
		<MapRenderer
			manifest={content.manifest}
			domainScores={world.scores}
			{viewport}
			{onselect}
		/>
		{#if !progress.hydrated}
			<p class="unknown" data-progress-unknown>
				Your progress has not been read on this device yet, so the regions show the
				library rather than your standing.
			</p>
		{/if}
	{:else}
		<!--
			Not a spinner and not "no skills" (§13.3 step 1, §16.3). The chrome above
			is already interactive, and this line disappears the moment the manifest
			resolves — or is replaced wholesale by the failure screen if it cannot.
		-->
		<h1>Life Skill Tracker</h1>
		<p data-map-pending>Loading the skill library…</p>
	{/if}
</main>

<style>
	main {
		padding: 1rem;
	}
	.unknown {
		font-style: italic;
	}
</style>
