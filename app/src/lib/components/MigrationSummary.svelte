<script lang="ts">
	/**
	 * §12.5's one dismissible summary (T17).
	 *
	 * "After any migration that changed something, the app shows one dismissible
	 * summary of what moved and why. Silent mutation of a user's record is the
	 * failure mode this whole mechanism exists to prevent, so it must not be
	 * silent." With no telemetry (§16.5, R-15) this component is the *only* way a
	 * user ever learns that a content release touched what they recorded.
	 *
	 * **One summary, not one per entry.** §12.6's import can rewind a dozen
	 * skills at once; a notice per disposition would be noise a user learns to
	 * dismiss without reading, which is the same outcome as saying nothing.
	 *
	 * **Nothing is rendered for a report that changed nothing.** `changed` is
	 * pinned to observed mutation rather than to "entries were evaluated"
	 * (§14.5), and a forced replay usually mutates nothing at all.
	 *
	 * It takes a report and emits a dismissal; it reads no store (§13.4, §14.1).
	 */
	import { resolve } from '$app/paths';
	import type { MigrationReport } from '$lib/types';

	interface Props {
		report: MigrationReport;
		ondismiss: () => void;
	}

	let { report, ondismiss }: Props = $props();

	/** §11.10: a rank consequence is stated, never left to be discovered. */
	let rankChanged = $derived(report.attainedLevel.before !== report.attainedLevel.after);

	function sentence(entry: MigrationReport['entries'][number]): string {
		switch (entry.op) {
			case 'split':
				return entry.outcome === 'unfrozen'
					? `${entry.title} was split in two; the level it had counted towards now counts the halves.`
					: `${entry.title} became ${entry.became.length} separate milestones. Your date and note are on each of them.`;
			case 'merged':
				return entry.outcome === 'orphaned'
					? `${entry.title} was merged into one larger milestone that you have not completed.`
					: `${entry.title} was merged into one larger milestone, which now counts as done.`;
			case 'retired':
				return `${entry.title} is no longer part of this skill.`;
			case 'moved':
				return `${entry.title} moved to another skill, and your record moved with it.`;
			case 'unknown':
				return `${entry.title} is no longer in this skill and the update did not say what became of it.`;
		}
	}
</script>

{#if report.changed}
	<!--
		`status`, never `alert`: §15.2 allows one polite live region and no
		interrupting one anywhere in the app. This is a statement about what
		already happened, not an interruption.
	-->
	<section class="summary" role="status" data-migration-summary aria-labelledby="migration-heading">
		<h2 id="migration-heading">This skill was revised</h2>
		<p>
			The library updated this skill since you last opened it. Nothing you recorded has
			been deleted — here is what moved.
		</p>

		<ul data-migration-entries>
			{#each report.entries as entry (entry.uid)}
				<li data-uid={entry.uid} data-op={entry.op} data-outcome={entry.outcome}>
					{sentence(entry)}
				</li>
			{/each}
		</ul>

		{#if report.partialMerge}
			<!--
				R-16, stated plainly rather than left to be inferred from a score
				drop. A user who completed one of two milestones that were later
				merged has not done the merged thing, and F46's `dismissed` is
				explicitly not a partial-credit state (D-22).
			-->
			<p data-partial-merge>
				Some milestones you had completed were merged into a larger one you have not
				finished, so they no longer count towards your level. What you recorded is kept
				under <a href={resolve('/data')}>retired achievements</a>, with your dates and
				notes.
			</p>
		{/if}

		{#if rankChanged}
			<p data-rank-change>
				Your level for this skill is now {report.attainedLevel.after}, from {report
					.attainedLevel.before}.
			</p>
		{/if}

		<button type="button" data-action="dismiss-migration" onclick={ondismiss}>Dismiss</button>
	</section>
{/if}

<style>
	.summary {
		border: 1px solid;
		padding: 0.75rem 1rem;
		margin-block-end: 1rem;
	}
	.summary h2 {
		margin-block-start: 0;
		font-size: 1rem;
	}
	.summary ul {
		margin-block: 0.5rem;
		padding-inline-start: 1.25rem;
	}
</style>
