<script lang="ts">
	/**
	 * §13.4's `SkillHeader` — level, tier, and progress to the next level (F32).
	 *
	 * It computes nothing about scoring. `SkillProgress` arrives whole from the
	 * session, and the header reads three fields off it: §13.4 keeps the engine
	 * out of components, and F32's "progress to next" is `blocker`, which §11.3
	 * already produced as part of deciding the attained level. Recomputing a
	 * shortfall here would be a second, drifting answer to a question the engine
	 * has already answered.
	 *
	 * **`hydrated: false` is not level zero.** The unknown case is stated in
	 * words, never rendered as a number (§13.3, T26/F23).
	 */
	import type { SkillProgress } from '$lib/scoring';
	import { attainmentLabel } from './tiers.js';

	interface Props {
		title: string;
		summary: string;
		/** From `scoreSkill(...)`, via the session — never computed here (§13.4). */
		progress: SkillProgress;
		/** False while — or permanently after — §13.3's hydration branch. */
		hydrated: boolean;
	}

	let { title, summary, progress, hydrated }: Props = $props();

	let standing = $derived(
		hydrated ? attainmentLabel(progress.attainedLevel, progress.tier) : 'Progress unknown'
	);

	/** F32: what is left of the first unsatisfied level (§11.3's `blocker`). */
	let shortfall = $derived(
		progress.blocker?.shortfall.filter((group) => !group.satisfied) ?? []
	);
</script>

<header class="skill-header">
	<h1>{title}</h1>
	<p class="summary">{summary}</p>

	<p class="standing" data-standing data-known={hydrated}>{standing}</p>

	{#if hydrated && progress.blocker !== undefined}
		<p class="to-next" data-to-next>
			To reach level {progress.blocker.level}:
			{#each shortfall as group, index (index)}
				{index > 0 ? '; ' : ''}{group.n - group.completed} more of {group.n}
			{/each}
		</p>
	{:else if !hydrated}
		<p class="to-next" data-to-next>
			We could not read your saved progress on this device, so this skill's level is not
			known this session.
		</p>
	{/if}
</header>

<style>
	.skill-header {
		margin-bottom: 1rem;
	}
	.skill-header h1 {
		margin-bottom: 0.25rem;
	}
	.summary,
	.standing,
	.to-next {
		margin: 0 0 0.25rem;
	}
	.standing[data-known='false'] {
		font-style: italic;
	}
</style>
