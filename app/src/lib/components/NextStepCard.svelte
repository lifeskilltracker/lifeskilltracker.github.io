<script lang="ts">
	/**
	 * §6.4's next-step card — the one place this design goes beyond its reference
	 * (T32, U-06).
	 *
	 * F36 and §15.2's `.` shortcut already promise the concrete next action, and
	 * the PRD calls it the product's central differentiator, but until this card
	 * nothing above the tree level surfaced it. The prior-art review found both
	 * poles of the axis and both fail: one product bought perfect orientation by
	 * deleting all agency, the other has total agency with weak orientation and
	 * left its "recommended next" affordance behind an experiment flag. A map that
	 * shows state *and* answers "so what do I do" is the gap between them.
	 *
	 * **It is a landmark** (§8.2), so a reader reaches it without traversing the
	 * map, and it sits before the page content in the document so the keyboard
	 * reaches it first too.
	 *
	 * **It names one milestone, concretely** — "Blacksmithing · Forge a J hook" —
	 * and activating it opens that milestone. It is a real link rather than a
	 * button running `goto`: the destination is a URL (§13.1), and a link is the
	 * control that can be opened in a new tab, copied, and read as a destination.
	 * T30's camera fly hangs off the same activation; until it lands, following the
	 * link is the whole behaviour rather than half of it.
	 *
	 * **`pending` is not a spinner.** It is the honest gap between "the manifest
	 * resolved" and "the started skills have been scored", and it exists so a
	 * returning Player is never shown §6.4's invitation to start something while
	 * their own progress is still being read (§13.3).
	 */
	import { resolve } from '$app/paths';
	import type { NextStepView } from './next-step.js';

	interface Props {
		view: NextStepView;
		/** Dismissal is the shell's to remember — for the session, and no longer. */
		ondismiss: () => void;
	}

	let { view, ondismiss }: Props = $props();
</script>

<aside class="next-step" data-next-step data-kind={view.kind} aria-label="Next step">
	<h2 class="head display">Next step</h2>

	{#if view.kind === 'step'}
		<a
			class="action"
			data-next-step-link
			data-tree={view.step.treeId}
			data-uid={view.step.milestoneUid}
			href={resolve('/s/[tree]/m/[slug]', {
				tree: view.step.treeId,
				slug: view.step.milestoneSlug
			})}
		>
			<span class="skill">{view.step.skillTitle}</span>
			<span class="sep" aria-hidden="true">·</span>
			<span class="milestone">{view.step.milestoneTitle}</span>
		</a>
	{:else if view.kind === 'invitation'}
		<p class="invitation" data-next-step-invitation>
			Nothing lined up yet. <a href={resolve('/library')}>Find a skill you already do</a> and
			mark what you have done.
		</p>
	{:else}
		<p class="pending" data-next-step-pending>Looking up where you left off…</p>
	{/if}

	<button type="button" class="dismiss" data-action="dismiss-next-step" onclick={ondismiss}>
		Dismiss
	</button>
</aside>

<style>
	.next-step {
		display: grid;
		gap: 0.25rem;
		box-sizing: border-box;
		max-width: 22rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		background: var(--paper);
		color: var(--ink);
	}

	.head {
		margin: 0;
		font-size: 0.7rem;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.action {
		color: inherit;
		text-decoration: none;
	}
	.action:hover .milestone {
		text-decoration: underline;
	}
	.action:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
	.skill {
		font-weight: 600;
	}
	.sep {
		opacity: 0.6;
	}

	.invitation,
	.pending {
		margin: 0;
		font-size: 0.85rem;
	}
	.pending {
		font-style: italic;
		opacity: 0.8;
	}

	.dismiss {
		justify-self: start;
		margin-top: 0.2rem;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.7rem;
		opacity: 0.7;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
