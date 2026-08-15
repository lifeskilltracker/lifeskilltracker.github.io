<script lang="ts">
	/**
	 * §12.7's export prompt (T18) — "non-modal, dismissible, never blocking".
	 *
	 * §12.7 says those three things in one line, and they are one requirement
	 * stated defensively because the wrong version is so natural to write. A modal
	 * that interrupts a user mid-milestone converts a durability reminder into the
	 * thing they close reflexively, and R-18 has no second mitigation: browser
	 * storage is not durable, ITP evicts after seven days of non-use for
	 * non-installed sites, and F39's export is the only backup that exists.
	 *
	 * So this is a paragraph in §13.4's notice host with a link and a dismiss
	 * button. No dialog, no backdrop, no focus management, no key handling, no
	 * fixed positioning — every one of which would block the page underneath while
	 * still rendering as an ordinary element.
	 *
	 * **The message is about backup, not about space.** §17.4 puts a phase 1 heavy
	 * user under 1 MB against quotas measured in hundreds of megabytes, so copy
	 * implying "running out of room" would be factually wrong as well as alarming.
	 * The wording lives in `lib/state/export-prompt.ts` as one constant so the app
	 * and its tests cannot drift apart about what it says.
	 *
	 * The reason arrives as a prop rather than being read from the store: §14.1
	 * forbids a component from importing `lib/state` at all, which is also why
	 * the message itself sits in `./durability-copy.js` beside this file.
	 */
	import { resolve } from '$app/paths';
	import { DURABILITY_MESSAGE } from './durability-copy.js';

	interface Props {
		ondismiss: () => void;
		/**
		 * Why the prompt is up. Only `write-failed` changes the copy — §16.3's
		 * quota row is a statement about something that just happened, and the
		 * three §12.7 triggers are all "you should take a backup".
		 */
		reason?: string | null;
	}

	let { ondismiss, reason = null }: Props = $props();
</script>

<!--
	`role="status"` rather than `alert`: §15.2 allows one polite live region and no
	interrupting one anywhere in the app, and a durability reminder is the least
	interrupting thing in the system.
-->
<p data-export-prompt data-reason={reason ?? 'trigger'} role="status">
	{#if reason === 'write-failed'}
		<strong>Your last change could not be saved.</strong>
	{/if}
	{DURABILITY_MESSAGE}
	<a href={resolve('/data')} data-action="go-to-export">Export your progress</a>
	<button type="button" data-action="dismiss-export-prompt" onclick={ondismiss}>
		Dismiss
	</button>
</p>

<style>
	/*
		Deliberately in normal flow. Taking it out of flow and stretching it over
		the viewport is the shape of an overlay, and an overlay blocks every click
		underneath it — the thing §12.7 rules out, whether or not anyone calls it a
		modal. `ExportPrompt.test.ts` asserts the absence of those rules here.
	*/
	p {
		border: 1px solid;
		padding: 0.75rem 1rem;
		margin: 0;
	}
</style>
