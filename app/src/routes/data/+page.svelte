<script lang="ts">
	/**
	 * `/data` — export, import, and storage status (§13.1, F38, F39).
	 *
	 * T14 built the route and the two things it could tell the truth about with no
	 * export path: what the browser is storing, and which started skills the
	 * current library no longer contains. **T16 adds the export and import
	 * mechanics** (§12.6) and the retired-achievement list §16.5 asks for.
	 *
	 * **Nothing leaves the device.** N2 forbids user data leaving by any path the
	 * app controls, so the export is a local download and the import is a local
	 * file read. There is no upload endpoint, no share target, and no sync.
	 *
	 * **Replace is behind a confirmation and merge is not** (§12.6). Merge only
	 * ever adds or advances records; replace deletes everything the file does not
	 * carry, and it exists for restoring a known-good backup, which is a
	 * deliberate act rather than a default.
	 */
	import { resolve } from '$app/paths';
	import RetiredAchievements from '$lib/components/RetiredAchievements.svelte';
	import { joinDomainRows } from '$lib/actions/domain-scores.js';
	import { content } from '$lib/content/store.svelte.js';
	import { exportFileName, serializeExportFile } from '$lib/state/export.js';
	import { progress } from '$lib/state/progress.svelte.js';
	import { store } from '$lib/state/store.js';
	import type { ImportReport } from '$lib/types';
	import { APP_VERSION } from '$lib/version.js';

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

	let orphans = $derived(Object.values(progress.orphans));

	const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

	// ── Export ────────────────────────────────────────────────────────────────

	let exportError = $state<string | null>(null);

	async function downloadExport(): Promise<void> {
		exportError = null;
		try {
			const file = await store.export();
			const blob = new Blob([serializeExportFile(file)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = exportFileName(file.exportedAt);
			anchor.click();
			// Revoked on the next task: revoking synchronously races the download in
			// some browsers, and the object outlives this function either way.
			setTimeout(() => URL.revokeObjectURL(url), 0);
			// Re-read, so the "last export" line reflects what just happened.
			storage = await store.storageStatus();
		} catch (error) {
			exportError = error instanceof Error ? error.message : String(error);
		}
	}

	// ── Import ────────────────────────────────────────────────────────────────

	let picked = $state<{ name: string; text: string } | null>(null);
	let confirmingReplace = $state(false);
	let importError = $state<string | null>(null);
	let report = $state<ImportReport | null>(null);

	async function pick(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		importError = null;
		report = null;
		confirmingReplace = false;
		if (file === undefined) {
			picked = null;
			return;
		}
		picked = { name: file.name, text: await file.text() };
	}

	async function run(mode: 'merge' | 'replace'): Promise<void> {
		if (picked === null) return;
		importError = null;
		report = null;
		try {
			// Parsed here rather than in the store: §14.5 types `import` as taking a
			// file, and a syntax error is a different failure from an invalid one.
			const parsed: unknown = JSON.parse(picked.text);
			report = await store.import(parsed as Parameters<typeof store.import>[0], mode);
			picked = null;
			confirmingReplace = false;
		} catch (error) {
			importError = error instanceof Error ? error.message : String(error);
		}
	}
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
		<h2 id="export-heading">Export</h2>
		<p>
			One plain JSON file with everything you have recorded. It stays on this device —
			nothing is uploaded — and it is meant to be readable on its own, years from now,
			with or without this app.
		</p>
		<button type="button" data-action="export" onclick={downloadExport}>
			Download my progress
		</button>
		{#if exportError !== null}
			<!-- `status`, never `alert`: §15.2 allows one polite region and no
			     interrupting one anywhere in the app. -->
			<p class="detail" data-export-error role="status">{exportError}</p>
		{/if}
	</section>

	<section aria-labelledby="import-heading">
		<h2 id="import-heading">Import</h2>
		<p>
			Read a file back in. <strong>Merging</strong> is the usual choice: it adds anything
			this device is missing and keeps the newer record wherever the two disagree.
		</p>
		<label for="import-file">Choose an export file</label>
		<input
			id="import-file"
			type="file"
			accept="application/json,.json"
			data-import-file
			onchange={pick}
		/>

		{#if picked !== null}
			<div class="actions" data-import-actions>
				<button type="button" data-action="import-merge" onclick={() => run('merge')}>
					Merge <code>{picked.name}</code>
				</button>
				<button
					type="button"
					data-action="import-replace"
					onclick={() => (confirmingReplace = true)}
				>
					Replace everything…
				</button>
			</div>
		{/if}

		{#if confirmingReplace}
			<!--
				§12.6's "explicit confirmation". Replace deletes every record the file
				does not carry, which is the one operation on this page that can lose
				data the user has no other copy of.
			-->
			<div class="consequence" role="status" data-replace-confirm>
				<p>
					Replacing deletes everything recorded on this device that is not in the file,
					and cannot be undone. Use it to restore a backup you trust.
				</p>
				<div class="actions">
					<button type="button" data-action="confirm-replace" onclick={() => run('replace')}>
						Replace everything
					</button>
					<button
						type="button"
						data-action="cancel-replace"
						onclick={() => (confirmingReplace = false)}
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}

		{#if importError !== null}
			<!--
				§16.3: say which field failed. "Your file is invalid" is useless to
				someone holding the only copy of their progress.
			-->
			<p class="detail" data-import-error role="status">{importError}</p>
		{/if}

		{#if report !== null}
			<div data-import-report role="status">
				<p>
					Imported by {report.mode}. Skills: {report.skills.added} added, {report.skills
						.updated} updated. Milestones: {report.milestones.added} added, {report
						.milestones.updated} updated.
				</p>
				{#if report.migrated}
					<p>The file came from schema version {report.schemaVersionIn} and was migrated.</p>
				{/if}
				{#if report.treesRewound > 0}
					<p>
						{report.treesRewound} skill{report.treesRewound === 1 ? '' : 's'} will re-check
						for retired milestones the next time you open them.
					</p>
				{/if}
				{#if report.orphans.droppedForLiveRecord > 0}
					<p>
						{report.orphans.droppedForLiveRecord} retired record{report.orphans
							.droppedForLiveRecord === 1
							? ''
							: 's'} gave way to a live one.
					</p>
				{/if}
				{#if report.skillsWithNoManifestEntry > 0}
					<p>
						{report.skillsWithNoManifestEntry} skill{report.skillsWithNoManifestEntry === 1
							? ''
							: 's'} in the file are not in this library. Nothing was dropped; they are
						listed below.
					</p>
				{/if}
			</div>
		{/if}
	</section>

	{#if orphans.length > 0}
		<!--
			§16.5's retired achievements. T16 rendered this list inline; T17 is the
			task that first *writes* an orphan, and it moved the list into a
			component so the migration path and this page cannot drift apart about
			what an orphan looks like.
		-->
		<RetiredAchievements {orphans} />
	{/if}

	{#if unmatched.length > 0}
		<section aria-labelledby="unmatched-heading">
			<h2 id="unmatched-heading">Skills not in the current library</h2>
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

	<section aria-labelledby="versions-heading">
		<h2 id="versions-heading">Versions</h2>
		<!--
			T26/F8: there is no library-wide content counter (§7.2, §16.1). The
			manifest's `generated` stamp is what tells a human which build they are
			looking at, and it is the value every export carries. Per-tree
			`contentVersion`s are per tree and belong beside their trees.
		-->
		<p data-versions>
			App {APP_VERSION} · library built {content.manifest?.generated ?? 'unknown'}
		</p>
	</section>

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
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block: 0.5rem;
	}
	.consequence {
		margin-block: 0.75rem;
		padding: 0.5rem;
		border-inline-start: 4px solid currentColor;
	}
	/* The orphan list's own rules moved with it into RetiredAchievements. */
</style>
