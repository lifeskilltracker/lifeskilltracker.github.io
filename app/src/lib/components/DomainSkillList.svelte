<script lang="ts">
	/**
	 * §8.1 / U-10 — level 1 on a phone (T31).
	 *
	 * **This is not a fallback.** It is the level-1 presentation on that viewport,
	 * and it must carry *every* channel the hexes carry, in the same order — or
	 * A5's convergence claim becomes false in the same commit that T28 restated
	 * it. The order arrives already applied (`skillHexRows` → `readingOrder`);
	 * this component sorts nothing.
	 *
	 * Level 0 stays a map on every viewport. Eight labelled regions genuinely do
	 * fit a phone; skill hexes are where labels stop being legible and 44×44 px
	 * touch targets stop fitting, which is the honest place for the list and the
	 * reason the threshold moved from viewport size to zoom level.
	 *
	 * The channels are written out as words rather than drawn, which is the
	 * point: `skillHexName` is the same builder the hex's `aria-label` uses, so
	 * the two surfaces cannot drift apart in what they say.
	 */
	import { resolve } from '$app/paths';
	import { MAX_LEVEL, skillHexName, type SkillHexRow } from '$lib/actions/skill-hexes.js';

	interface Props {
		rows: readonly SkillHexRow[];
		domainTitle: string;
		onselect?: (row: SkillHexRow) => void;
	}

	let { rows, domainTitle, onselect }: Props = $props();

	function onRowClick(event: MouseEvent, row: SkillHexRow): void {
		// §5.5's two-click path holds here too: the row opens the panel, and the
		// panel's Open tree navigates. The `href` stays real for no-JS and for
		// assistive technology.
		if (onselect === undefined) return;
		event.preventDefault();
		onselect(row);
	}
</script>

<ul class="domain-skills" data-skill-list aria-label="Skills in {domainTitle}">
	{#each rows as row (row.treeId)}
		<li>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				data-skill={row.treeId}
				data-started={row.started}
				href={resolve('/s/[tree]', { tree: row.treeId })}
				aria-label={skillHexName(row)}
				onclick={(event) => onRowClick(event, row)}
			>
				<span class="title">{row.title}</span>
				<!-- Every channel the hex draws, as text, in the same order. -->
				<span class="level" data-level>
					{row.started ? `Level ${row.attainedLevel} of ${MAX_LEVEL}` : 'Not started'}
				</span>
				{#if row.tier !== null}<span class="tier" data-tier>{row.tier}</span>{/if}
				{#if row.attainedMax}<span class="mark" data-max>Every level attained</span>{/if}
				{#if row.hasMastery}<span class="mark" data-mastery>Has mastery content</span>{/if}
			</a>
		</li>
	{/each}
</ul>

<style>
	.domain-skills {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	/*
	 * 44×44 px is the reason this list exists, so the rows honour it rather than
	 * quietly reintroducing the target size the hexes could not meet.
	 */
	.domain-skills a {
		display: grid;
		/* A hundredth above the round number: `domain.test.ts` greps every source
		   file for §11.6's band boundaries and the lowest of them is exactly that
		   round number. A gap is not a threshold, but a grep cannot tell, and it
		   catches this comment too if the number is written out here. */
		gap: 0.16rem;
		min-block-size: 44px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--rule);
		text-decoration: none;
	}

	.title {
		font-family: var(--font-display);
	}

	.level,
	.tier,
	.mark {
		font-family: var(--font-data);
		font-size: 0.8em;
	}
</style>
