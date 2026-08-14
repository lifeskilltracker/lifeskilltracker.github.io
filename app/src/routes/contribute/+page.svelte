<script lang="ts">
	/**
	 * `/contribute` — the contribution guide entry point (§13.1).
	 *
	 * An entry point, not the guide: the authoring rules live with the content
	 * they govern (§6.7) so they are versioned alongside it and reviewed in the
	 * same pull request. Restating them here would create a second copy that
	 * drifts.
	 */
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Contribute — Life Skill Tracker</title>
</svelte:head>

<main>
	<h1>Contribute</h1>

	<p>
		Skill trees are authored as YAML in the repository's <code>content/</code> directory
		and compiled on merge. A tree is ten levels; each level is four to eight milestones
		that are concrete enough for someone else to agree you have done them.
	</p>

	<p>
		A greyed-out region on the <a href={resolve('/')}>map</a> is a domain with no skills written
		yet. Those are the openings.
	</p>

	<p>
		Everything is checked automatically before merge: identifiers, level structure, the
		lineage ledger that keeps your completions attached when a tree is revised, and the map
		geometry. The validator explains what it wants; you do not need to have read the
		architecture to add a skill.
	</p>
</main>

<style>
	main {
		padding: 1rem;
		max-width: 40rem;
	}
</style>
