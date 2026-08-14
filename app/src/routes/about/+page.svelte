<script lang="ts">
	/**
	 * `/about` — the project entry point (§13.1).
	 *
	 * Fully static, and deliberately dependent on neither the manifest nor
	 * IndexedDB: it is the one page that still says something useful when the
	 * cold start has failed in both directions.
	 */
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>About — Life Skill Tracker</title>
</svelte:head>

<main>
	<h1>About</h1>

	<p>
		Life Skill Tracker is a map of practical human skills, each broken into ten levels of
		concrete, checkable milestones. You mark what you have actually done; the map fills in
		to show where your competence is broad and where it runs deep.
	</p>

	<p>
		It has no account, no server, and no analytics. Your progress is stored in this
		browser and nowhere else, which is why the <a href={resolve('/data')}>data page</a> exists
		and why exporting matters.
	</p>

	<p>
		The skill trees are content, not code — authored, reviewed, and versioned in the open.
		<a href={resolve('/contribute')}>Contributing a skill</a> is the main way the library grows.
	</p>
</main>

<style>
	main {
		padding: 1rem;
		max-width: 40rem;
	}
</style>
