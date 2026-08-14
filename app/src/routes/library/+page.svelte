<script lang="ts">
	/**
	 * `/library` — every skill, filterable by domain, subregion and facet (§13.1).
	 *
	 * The map answers "how am I doing"; this answers "what is there". It is also
	 * §10.7's and §15's fallback surface — the same content in the same order,
	 * reachable without the map — so it must keep working when the map cannot be
	 * drawn at all.
	 *
	 * The filtering is `lib/content/filter.ts`, a pure function tested on its own.
	 * Doing it inline would put three conjunctive predicates in a template where
	 * the empty-filter case is exactly the one that is easy to get backwards.
	 */
	import { standings } from '$lib/actions/domain-scores.js';
	import SkillCard from '$lib/components/SkillCard.svelte';
	import { filterTrees, subregionsOf, type SkillFilter } from '$lib/content/filter.js';
	import { content } from '$lib/content/store.svelte.js';
	import { progress } from '$lib/state/progress.svelte.js';

	let domain = $state('');
	let subregion = $state('');
	let facet = $state('');

	let filter = $derived<SkillFilter>({
		...(domain === '' ? {} : { domain }),
		...(subregion === '' ? {} : { subregion }),
		...(facet === '' ? {} : { facet })
	});

	let trees = $derived(filterTrees(content.manifest?.trees ?? [], filter));
	let standing = $derived(standings(progress.skills));

	let subregions = $derived(
		content.manifest === null
			? []
			: subregionsOf(content.manifest, domain === '' ? undefined : domain)
	);
</script>

<svelte:head>
	<title>Library — Life Skill Tracker</title>
</svelte:head>

<main>
	<h1>Library</h1>

	{#if content.manifest === null}
		<p data-library-pending>Loading the skill library…</p>
	{:else}
		<form class="filters" data-filters>
			<label>
				Domain
				<select bind:value={domain} data-filter="domain">
					<option value="">All</option>
					{#each content.manifest.taxonomy.domains as entry (entry.id)}
						<option value={entry.id}>{entry.title}</option>
					{/each}
				</select>
			</label>

			{#if subregions.length > 0}
				<label>
					Subregion
					<select bind:value={subregion} data-filter="subregion">
						<option value="">All</option>
						{#each subregions as id (id)}
							<option value={id}>{id}</option>
						{/each}
					</select>
				</label>
			{/if}

			<label>
				Facet
				<select bind:value={facet} data-filter="facet">
					<option value="">All</option>
					{#each content.manifest.taxonomy.facets as entry (entry.id)}
						<option value={entry.id}>{entry.title}</option>
					{/each}
				</select>
			</label>
		</form>

		<p class="count" data-count>{trees.length} of {content.manifest.trees.length} skills</p>

		<ul class="skills" data-skill-list>
			{#each trees as tree (tree.id)}
				<li>
					<SkillCard
						id={tree.id}
						title={tree.title}
						summary={tree.summary}
						attainedLevel={standing.get(tree.id)?.attainedLevel}
						tier={standing.get(tree.id)?.tier ?? null}
						hydrated={progress.hydrated}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		padding: 1rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.skills {
		display: grid;
		gap: 0.75rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
