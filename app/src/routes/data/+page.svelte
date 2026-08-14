<script lang="ts">
	/**
	 * `/data` — export, import, and storage status (§13.1, F38, F39).
	 *
	 * T14 owns the **route** and the two things it can already tell the truth
	 * about: what the browser is storing, and which started skills the current
	 * library no longer contains. The export and import mechanics are §12.6 and
	 * belong to T16; there are no buttons here that pretend otherwise, because a
	 * dead export control on the page §16.3 sends people to during an outage
	 * would be the worst possible place for one.
	 *
	 * **The orphaned-skill list is this page's own responsibility** (T26/F22,
	 * §16.3). A `SKILL` row whose tree has left the manifest is dropped from every
	 * score and every breadth count and **deleted from nothing** — so without this
	 * list it would be invisible everywhere, which is indistinguishable from
	 * having been thrown away.
	 */
	import { resolve } from '$app/paths';
	import { joinDomainRows } from '$lib/actions/domain-scores.js';
	import { content } from '$lib/content/store.svelte.js';
	import { progress } from '$lib/state/progress.svelte.js';
	import { store } from '$lib/state/store.js';

	interface Storage {
		usage: number;
		quota: number;
		lastExportAt?: string;
	}

	let storage = $state<Storage | null>(null);
	let storageError = $state<string | null>(null);

	$effect(() => {
		void store
			.storageStatus()
			.then((status) => {
				storage = status;
			})
			.catch((error: unknown) => {
				storageError = error instanceof Error ? error.message : String(error);
			});
	});

	let unmatched = $derived(
		content.manifest === null
			? []
			: joinDomainRows(content.manifest, progress.skills).unmatched
	);

	const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
</script>

<svelte:head>
	<title>Data — Life Skill Tracker</title>
</svelte:head>

<main>
	<h1>Your data</h1>

	<section aria-labelledby="storage-heading">
		<h2 id="storage-heading">Storage</h2>
		{#if !progress.hydrated}
			<p data-storage-unknown>
				Your saved progress could not be read on this device this session, so nothing
				below reflects what is stored. Reloading is the way to try again.
			</p>
		{/if}
		{#if storage !== null}
			<p data-storage>
				Using {megabytes(storage.usage)} of {megabytes(storage.quota)} available.
			</p>
			<p data-last-export>
				{storage.lastExportAt === undefined
					? 'You have never exported your progress.'
					: `Last export: ${storage.lastExportAt}`}
			</p>
		{:else if storageError !== null}
			<p class="detail" data-storage-error>{storageError}</p>
		{/if}
	</section>

	<section aria-labelledby="export-heading">
		<h2 id="export-heading">Export and import</h2>
		<p>
			Export and import are §12.6 of the architecture and are not wired up yet. Your
			progress is stored in this browser only; until export ships, clearing site data for
			this site removes it.
		</p>
	</section>

	{#if unmatched.length > 0}
		<section aria-labelledby="orphans-heading">
			<h2 id="orphans-heading">Skills not in the current library</h2>
			<p>
				These skills are still recorded on this device, but the library no longer lists
				them — usually an export made against a different or newer library. Nothing has
				been deleted; they are simply not counted in any domain.
			</p>
			<ul data-unmatched-skills>
				{#each unmatched as skill (skill.treeId)}
					<li data-tree={skill.treeId}>
						<code>{skill.treeId}</code> — level {skill.attainedLevel}, last active
						{skill.lastActivityAt}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p><a href={resolve('/about')}>About this project</a></p>
</main>

<style>
	main {
		padding: 1rem;
		max-width: 45rem;
	}
	.detail {
		font-family: monospace;
		font-size: 0.85em;
	}
</style>
