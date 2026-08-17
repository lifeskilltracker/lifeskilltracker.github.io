<script lang="ts">
	/**
	 * `/` — the world map, camera level 0 (§13.1, F21, A6).
	 *
	 * **The map is not drawn here.** T30 moved the surface into the shell so that
	 * `/` and `/d/<domainId>` share one set of DOM nodes and entering a domain
	 * flies the camera rather than navigating (§5.1). What is left on this route
	 * is what is genuinely the *page's*: its title, and the two states the map
	 * cannot render because it does not exist yet.
	 *
	 * The `<main>` landmark belongs to the shell for the same reason — one map,
	 * one main, across both camera levels. A second one here would nest.
	 *
	 * It renders whatever it has. The map appears when the manifest resolves and
	 * the regions fill in when hydration does; neither waits on the other, which
	 * is what §13.3's parallel step 2 is for. There is no spinner over the page.
	 */
	import { content } from '$lib/content/store.svelte.js';
	import { progress } from '$lib/state/progress.svelte.js';
</script>

<svelte:head>
	<title>Life Skill Tracker</title>
</svelte:head>

{#if content.manifest !== null}
	{#if !progress.hydrated}
		<p class="unknown" data-progress-unknown>
			Your progress has not been read on this device yet, so the regions show the library
			rather than your standing.
		</p>
	{/if}
{:else}
	<!--
		Not a spinner and not "no skills" (§13.3 step 1, §16.3). The chrome above is
		already interactive, and this line disappears the moment the manifest
		resolves — or is replaced wholesale by the failure screen if it cannot.
	-->
	<h1>Life Skill Tracker</h1>
	<p data-map-pending>Loading the skill library…</p>
{/if}

<style>
	.unknown {
		font-style: italic;
		padding: 0 1rem;
	}
</style>
