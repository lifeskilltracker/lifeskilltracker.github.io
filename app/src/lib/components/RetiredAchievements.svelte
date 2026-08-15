<script lang="ts">
	/**
	 * §12.5's "retired achievements" section (T17).
	 *
	 * "Nothing is ever silently deleted from user state. Orphans keep their
	 * frozen title, timestamp, and note, are always exported, and surface in a
	 * retired-achievements section rather than vanishing. They never score."
	 * This is that section — the place a user can see that what they did is
	 * still theirs after the milestone stopped existing.
	 *
	 * **No slug, and therefore no link** (§12.2). A slug is a live reference into
	 * a tree, and an orphan is exactly the milestone that is no longer in one, so
	 * a retained slug would render a `/s/<treeId>/m/<slug>` link that looks
	 * ordinary and resolves to nothing.
	 *
	 * The rows arrive as a prop: §14.1 forbids a component from importing
	 * `lib/state`, and the shape is restated structurally here rather than
	 * imported from it for the same reason.
	 */
	interface Orphan {
		uid: string;
		treeId: string;
		title: string;
		state: 'complete' | 'dismissed';
		at: string;
		note?: string;
		reason: 'retired' | 'merged' | 'unknown';
	}

	interface Props {
		orphans: readonly Orphan[];
		/** Rendered above the list; the page owns the framing sentence. */
		headingId?: string;
	}

	let { orphans, headingId = 'orphans-heading' }: Props = $props();

	/**
	 * §15.4's rule applies to a list as much as to the map: the reason is the
	 * only thing distinguishing an accepted loss from a record the migration
	 * could not account for, so it is said in words rather than implied.
	 */
	const REASONS: Record<Orphan['reason'], string> = {
		retired: 'removed from the skill',
		merged: 'merged into a milestone you have not completed',
		unknown: 'no longer in the skill, with no explanation given'
	};
</script>

<section aria-labelledby={headingId}>
	<h2 id={headingId}>Retired achievements</h2>
	<p>
		These milestones are no longer part of their skill, usually because the skill was
		revised. What you did is still recorded, and it is still in your exports.
	</p>
	<ul data-orphans>
		{#each orphans as orphan (orphan.uid)}
			<li data-uid={orphan.uid} data-reason={orphan.reason}>
				<span class="orphan-title">{orphan.title}</span>
				<span class="detail">{orphan.treeId} · {orphan.at} · {REASONS[orphan.reason]}</span>
				{#if orphan.note}<span class="detail">{orphan.note}</span>{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	[data-orphans] {
		list-style: none;
		padding: 0;
	}
	[data-orphans] li {
		margin-block-end: 0.5rem;
	}
	.detail {
		display: block;
		font-family: monospace;
		font-size: 0.85em;
	}
</style>
