<script lang="ts">
	/**
	 * §16.5's storage panel on `/data` (T18).
	 *
	 * §16.5 fixes the list — "storage estimate, last export, content version, app
	 * version" — and T26/F8 settles the third: there is no library-wide content
	 * counter (§7.2, §16.1), so the manifest's `generated` stamp is what tells a
	 * human which build they are looking at, and it is the value every export
	 * carries. Per-tree `contentVersion`s belong beside their trees.
	 *
	 * **The figures are estimates and are said to be.** `navigator.storage`
	 * reports approximations, padded deliberately by some browsers, and §17.4 puts
	 * a phase 1 heavy user under 1 MB against a quota in the hundreds — so a
	 * precise-looking percentage would be both false and a warning about nothing.
	 *
	 * **The persistence grant is not shown.** §12.7 says request it, do not depend
	 * on it, and R-18 records that Safari effectively never grants it outside an
	 * installed PWA. A permanent "storage is not persistent" line would alarm the
	 * user about a condition they cannot change and that F39's export answers.
	 */

	interface Props {
		usage: number;
		quota: number;
		lastExportAt?: string;
		appVersion: string;
		/** §7.2's build stamp from the manifest — T26/F8's "content version". */
		libraryBuilt: string;
		headingId?: string;
	}

	let {
		usage,
		quota,
		lastExportAt,
		appVersion,
		libraryBuilt,
		headingId = 'storage-heading'
	}: Props = $props();

	const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

	/**
	 * Zeroes are `durability.pollEstimate()`'s degraded reading, not a fact about
	 * the disk (§12.7). "Using 0.00 MB of 0.00 MB" would read as an empty device.
	 */
	let known = $derived(quota > 0);
</script>

<section aria-labelledby={headingId}>
	<h2 id={headingId}>Storage</h2>

	<p data-storage>
		{#if known}
			Roughly {megabytes(usage)} of an estimated {megabytes(quota)} available. Browsers
			report these as estimates, not exact figures.
		{:else}
			This browser could not tell us how much it is storing.
		{/if}
	</p>

	<p data-last-export>
		{lastExportAt === undefined
			? 'You have never exported your progress.'
			: `Last export: ${lastExportAt}`}
	</p>

	<p data-versions>
		App {appVersion} · library built {libraryBuilt}
	</p>
</section>
