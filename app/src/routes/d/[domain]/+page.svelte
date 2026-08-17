<script lang="ts">
	/**
	 * `/d/<domainId>` — the domain skill listing (§13.1, F23).
	 *
	 * Prerendered, one per domain, and reading the manifest from §13.2's store
	 * rather than fetching one of its own. That split is the point of §7.1: the
	 * page's *shell* is static and its *content* is a runtime read, so adding a
	 * skill to a domain never requires a rebuild of this route.
	 *
	 * Only `domain` selects a skill, not `secondaryDomains`. §11.6 scores the
	 * primary domain alone, and a listing that included secondaries would show
	 * skills whose progress is counted elsewhere — the sort of quiet
	 * disagreement between two views that F35 exists to avoid.
	 *
	 * **This route is a camera state, not a second page** (A6, §5.1, T30). The
	 * shell holds the map surface and flies it to this domain; what is left here
	 * is the listing beneath it, and no `<main>` of its own — the shell owns the
	 * one landmark that spans both camera levels.
	 *
	 * The listing stays on every viewport for now. U-10 moves the phone's list
	 * substitution from viewport size to zoom level, and it belongs to T31, the
	 * task that draws the skill hexes the list is substituting *for*.
	 */
	import { page } from '$app/state';
	import { standings } from '$lib/actions/domain-scores.js';
	import SkillCard from '$lib/components/SkillCard.svelte';
	import { content } from '$lib/content/store.svelte.js';
	import { progress } from '$lib/state/progress.svelte.js';

	let domainId = $derived(page.params.domain ?? '');

	let domain = $derived(
		content.manifest?.taxonomy.domains.find((entry) => entry.id === domainId) ?? null
	);

	let trees = $derived(
		(content.manifest?.trees ?? []).filter((tree) => tree.domain === domainId)
	);

	let standing = $derived(standings(progress.skills));
</script>

<svelte:head>
	<title>{domain?.title ?? 'Domain'} — Life Skill Tracker</title>
</svelte:head>

<section class="listing" aria-labelledby="domain-heading">
	<h1 id="domain-heading">{domain?.title ?? domainId}</h1>
	{#if domain !== null}
		<p class="blurb">{domain.blurb}</p>
	{/if}

	{#if content.manifest === null}
		<p data-listing-pending>Loading the skill library…</p>
	{:else if trees.length === 0}
		<!-- Reachable only with a manifest in hand, so it means what it says. -->
		<p data-listing-empty>No skills have been written for this domain yet.</p>
	{:else}
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
</section>

<style>
	.listing {
		padding: 1rem;
	}
	.skills {
		display: grid;
		gap: 0.75rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
