<script lang="ts">
	/**
	 * One skill in a listing — `/d/<domainId>` and `/library` (§13.4, F23).
	 *
	 * Everything it shows about the user arrives as props, including whether the
	 * user's progress is *known at all*. §13.3's hydration-failure branch is a
	 * display problem as much as a write problem: `progressFor` is total, so an
	 * unhydrated store and an unstarted skill both produce zero, and a card that
	 * printed "Level 0" in the first case would be telling the user their progress
	 * is gone (T26/F23).
	 */
	import { resolve } from '$app/paths';
	import type { TierName } from '$lib/types';
	import { attainmentLabel } from './tiers.js';

	interface Props {
		id: string;
		title: string;
		summary: string;
		/** §12.3's denormalized level; absent for a skill never started. */
		attainedLevel?: number;
		tier?: TierName | null;
		/** False while — or permanently after — §13.3's hydration branch. */
		hydrated: boolean;
	}

	let { id, title, summary, attainedLevel, tier = null, hydrated }: Props = $props();

	let standing = $derived(
		!hydrated
			? 'Progress unknown'
			: attainedLevel === undefined
				? 'Not started'
				: attainmentLabel(attainedLevel, tier)
	);
</script>

<article class="skill-card" data-tree={id}>
	<h3><a href={resolve('/s/[tree]', { tree: id })}>{title}</a></h3>
	<p class="summary">{summary}</p>
	<p class="standing" data-standing data-known={hydrated}>{standing}</p>
</article>

<style>
	.skill-card {
		border: 1px solid;
		padding: 0.75rem 1rem;
	}
	.skill-card h3 {
		margin: 0 0 0.25rem;
	}
	.summary {
		margin: 0 0 0.5rem;
	}
	.standing {
		margin: 0;
		font-size: 0.9em;
	}
	.standing[data-known='false'] {
		font-style: italic;
	}
</style>
