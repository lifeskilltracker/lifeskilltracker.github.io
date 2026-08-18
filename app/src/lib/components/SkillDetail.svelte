<script lang="ts">
	/**
	 * §5.5's skill detail panel (T31).
	 *
	 * **The panel is the second click, and the only thing here that navigates is
	 * Open tree.** §5.5 declines one-click navigation by name: a domain view
	 * exists to compare skills, and making every look cost a page load and a trip
	 * back is what it is avoiding. The hex opens this; this opens the tree.
	 *
	 * **It paints in two halves.** The header — title, authors (F6) — is on the
	 * manifest and is on screen immediately; progress to next, the blocking level
	 * and the next available milestone come from the bundle and arrive after.
	 * That is why `resolved` exists as a separate flag from `progress`: "still
	 * loading" and "loaded, and this skill has no blocker" are different states,
	 * and rendering them alike would tell a reader at level 10 that the panel is
	 * broken.
	 *
	 * It takes no store and no loader (§14.1); the shell hands it a `SkillDetail`.
	 */
	import { resolve } from '$app/paths';
	import { MAX_LEVEL } from '$lib/actions/skill-hexes.js';
	import { blockerText, type SkillDetail } from '$lib/actions/skill-detail.js';

	interface Props {
		detail: SkillDetail;
		onclose?: () => void;
	}

	let { detail, onclose }: Props = $props();

	const row = $derived(detail.row);
	const blocker = $derived(blockerText(detail.progress));

	/** F6 — named, and as a sentence rather than as a bare list of strings. */
	const authorLine = $derived(
		detail.authors.length === 0 ? null : `Written by ${detail.authors.join(', ')}`
	);
</script>

<!--
	`aria-label` rather than a heading reference: the panel is a dialog-shaped
	region over a map, and §15.2 keeps the map's one live region for the camera.
-->
<section class="skill-detail" data-skill-detail data-tree={row.treeId} aria-label="{row.title} — skill detail">
	<header>
		<h2>{row.title}</h2>
		<button type="button" data-action="close-skill-detail" onclick={() => onclose?.()}>
			Close
		</button>
	</header>

	<dl class="standing">
		<div>
			<dt>Level</dt>
			<!-- `n of 10`, never a percentage: F34's rule holds everywhere on the map. -->
			<dd data-level>{row.started ? `${row.attainedLevel} of ${MAX_LEVEL}` : 'Not started'}</dd>
		</div>
		{#if row.tier !== null}
			<div>
				<dt>Tier</dt>
				<dd data-tier>{row.tier}</dd>
			</div>
		{/if}
		{#if row.hasMastery}
			<div>
				<dt>Mastery</dt>
				<dd data-mastery>Mastery content published</dd>
			</div>
		{/if}
	</dl>

	{#if !detail.resolved}
		<p data-detail-pending>Loading this skill’s progress…</p>
	{:else if detail.unavailable}
		<!--
			A degraded panel, not an absent one. The header above is still true, and
			failing to read one bundle is not a reason to refuse to name the skill.
		-->
		<p data-detail-unavailable>
			This skill’s progress could not be loaded. The skill itself is still there.
		</p>
	{:else}
		{#if blocker !== null}
			<p data-blocker>{blocker}</p>
		{:else if row.attainedMax}
			<p data-blocker-none>Every level attained.</p>
		{/if}

		{#if detail.next !== null}
			<p class="next">
				<span class="next-label">Next available</span>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a
					data-next-milestone
					href={resolve('/s/[tree]/m/[slug]', { tree: row.treeId, slug: detail.next.slug })}
				>
					{detail.next.title}
				</a>
			</p>
		{/if}
	{/if}

	{#if authorLine !== null}
		<p class="authors" data-authors>{authorLine}</p>
	{/if}

	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="open-tree" data-action="open-tree" href={resolve('/s/[tree]', { tree: row.treeId })}>
		Open tree
	</a>
</section>

<style>
	.skill-detail {
		background: var(--paper);
		border: 1px solid var(--rule);
		padding: 1rem;
		display: grid;
		gap: 0.6rem;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		font-family: var(--font-display);
		margin: 0;
	}

	.standing {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.5rem;
		margin: 0;
	}

	dt {
		font-family: var(--font-data);
		font-size: 0.8em;
		color: var(--ink-muted, var(--ink));
	}

	dd {
		margin: 0;
	}

	.next-label {
		display: block;
		font-family: var(--font-data);
		font-size: 0.8em;
	}

	.authors {
		font-size: 0.85em;
		margin: 0;
	}

	.open-tree {
		justify-self: start;
	}
</style>
