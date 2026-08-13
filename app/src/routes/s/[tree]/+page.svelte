<script lang="ts">
	/**
	 * Minimal text rendering, replaced by TreeView in T08 (§9). This page exists
	 * to prove the Content Loader end to end: title and level spine, served from
	 * `app/static/content/` with no route-level fetch (§3.2).
	 */
	import type { SkillPageData } from './+page.js';

	let { data }: { data: SkillPageData } = $props();
</script>

{#if data.tree === null}
	<main>
		<h1>Skill unavailable</h1>
		<p>
			We could not load <code>{data.treeId}</code>. Other skills are unaffected.
		</p>
		<p class="detail">{data.unavailable}</p>
	</main>
{:else}
	<main>
		{#if data.offline}
			<p class="offline">Offline — showing content saved on this device.</p>
		{/if}
		<h1>{data.tree.title}</h1>
		<p>{data.tree.summary}</p>

		<ol>
			{#each data.tree.levels as level (level.level)}
				<li>
					<h2>Level {level.level}</h2>
					<ul>
						{#each level.milestones as ref (ref.slug)}
							<li>{data.tree.milestones[ref.index].title}</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ol>
	</main>
{/if}

<style>
	.offline {
		font-style: italic;
	}
	.detail {
		font-family: monospace;
		font-size: 0.85em;
	}
</style>
