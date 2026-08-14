<script lang="ts">
	/**
	 * The app shell. Its one job in Phase 0 is §13.3's first step: hydrate
	 * §13.2's mirror from IndexedDB before the user can look at a tree and
	 * conclude their progress is gone (T10).
	 *
	 * The rest of §13.3 — `applyMoves`, the version-gated `applyLineage`, the
	 * notice host, the offline branch — is **T14**. The banner below is
	 * deliberately the crudest possible thing: it exists because a degraded
	 * session that looks identical to a healthy one is how a user overwrites
	 * their own data, not because this is where that surface belongs.
	 */
	import { bootstrapUserState, type BootstrapStatus } from '$lib/actions/bootstrap.js';
	import { progress } from '$lib/state/progress.svelte.js';

	let { children } = $props();

	let status = $state<BootstrapStatus | null>(null);

	$effect(() => {
		// Browser-only by construction: `$effect` does not run during prerender,
		// and IndexedDB does not exist there (§13.3).
		void bootstrapUserState().then((result) => {
			status = result;
		});
	});
</script>

{#if !progress.writable}
	<p data-degraded role="status">
		Your saved progress could not be read on this device, so nothing will be saved this
		session. Reload to try again — your data has not been deleted.
		{#if status?.error}
			<span class="detail">{status.error}</span>
		{/if}
	</p>
{/if}

{@render children()}

<style>
	[data-degraded] {
		border: 1px solid;
		padding: 0.75rem 1rem;
		margin: 0;
	}
	.detail {
		display: block;
		font-family: monospace;
		font-size: 0.85em;
	}
</style>
