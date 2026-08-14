<script lang="ts">
	/**
	 * §16.3's cold-start failure screen — the manifest could not be fetched and
	 * there was no cached copy (T14).
	 *
	 * Three things are required of it, and the third is the one that gets left
	 * out: **say what happened**, **offer a retry**, and **link to `/data`**. The
	 * link is there because hydration is independent of the manifest: the user's
	 * progress may be perfectly readable while the content is not, and in a system
	 * with no account and no server, being able to export it during an outage is
	 * the difference between a bad afternoon and a lost year (§16.5, R-15).
	 *
	 * It never says "no skills found". An empty library and an unreachable one
	 * look identical to a renderer and could not be less alike to a user (§7.4).
	 */
	import { resolve } from '$app/paths';

	interface Props {
		/** The loader's own message — a status code, a parse failure (§16.3). */
		reason: string;
		/** Read-only sessions still get the export link; §13.3 says so. */
		hydrated: boolean;
		onretry?: () => void;
	}

	let { reason, hydrated, onretry }: Props = $props();

	function retry(): void {
		if (onretry !== undefined) {
			onretry();
			return;
		}
		// The default retry is a reload, which is also the documented recovery
		// from a hydration failure (§14.5: `writable` is session-scoped).
		globalThis.location?.reload();
	}
</script>

<main class="cold-start-failure" data-cold-start-failure>
	<h1>The skill library could not be loaded</h1>

	<p>
		This device has no saved copy of the library to fall back on, so there is nothing to
		show yet. Your progress has not been touched.
	</p>

	<p class="detail" data-reason>{reason}</p>

	<div class="actions">
		<button type="button" data-action="retry" onclick={retry}>Try again</button>
		<a href={resolve('/data')} data-export-link>
			{hydrated ? 'Export your progress' : 'Storage and export'}
		</a>
	</div>

	{#if !hydrated}
		<p class="detail">
			Your saved progress could not be read on this device either, so nothing will be
			written this session.
		</p>
	{/if}
</main>

<style>
	.cold-start-failure {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}
	.detail {
		font-family: monospace;
		font-size: 0.85em;
	}
	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
</style>
