<script lang="ts">
	/**
	 * The app shell (§13.3, §13.4) — T14.
	 *
	 * It is a component beside `+layout.svelte` rather than the layout itself so
	 * that its two dependencies can be injected: §13.3's four branches are the
	 * part of this task that has to be right, and three of them are unreachable
	 * against real browser capabilities. SvelteKit route components may take only
	 * `data` and `children`, which is the rule this split respects rather than
	 * suppresses.
	 *
	 * It runs §13.3's cold start and renders the branch it lands in. Four
	 * properties of this file are the task, and each is easy to lose:
	 *
	 * **Chrome renders immediately and there is no full-page spinner** (§13.3
	 * step 1). The nav is up before either promise settles, so a slow manifest
	 * looks like a slow page rather than a broken one, and `/about` — which needs
	 * neither promise — is readable throughout.
	 *
	 * **A degraded session never looks like a healthy one.** A hydration failure
	 * gets a persistent, unmissable banner: the store has already latched itself
	 * unwritable (§14.5), and the banner is what stops the user from spending an
	 * evening ticking milestones that are going nowhere (§13.3, §16.3).
	 *
	 * **A hard manifest failure replaces the page rather than emptying it.** "No
	 * skills found" and "we could not reach the library" look identical to a
	 * renderer, so the failure screen is rendered *instead of* `children`, and it
	 * links to `/data` because an export may still be possible (§16.3).
	 *
	 * **The offline branch says so.** §7.4's cached manifest is a correct render
	 * of possibly-stale content, which is worth having and not worth hiding.
	 */
	import { resolve } from '$app/paths';
	import ColdStartFailure from '$lib/components/ColdStartFailure.svelte';
	import ExportPrompt from '$lib/components/ExportPrompt.svelte';
	import { dismissExportPrompt, refreshExportPrompt } from '$lib/actions/export-prompt.js';
	import { exportPrompt } from '$lib/state/export-prompt.svelte.js';
	import {
		coldStart,
		type ColdStart,
		type ColdStartContent,
		type ColdStartStore
	} from '$lib/actions/cold-start.js';
	import { loader } from '$lib/content';
	import { content } from '$lib/content/store.svelte.js';
	import { progress } from '$lib/state/progress.svelte.js';
	import { store } from '$lib/state/store.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { applyDomainPalettes, initTheme, theme } from '$lib/styles/theme.svelte.js';
	import '$lib/styles/tokens.css';

	interface Props {
		children: import('svelte').Snippet;
		/** Injected only by tests — the same seam as `StoreOptions.open` (§14.5). */
		contentLoader?: ColdStartContent;
		userStore?: ColdStartStore;
	}

	let { children, contentLoader, userStore }: Props = $props();

	let start = $state<ColdStart | null>(null);

	async function run(): Promise<void> {
		// `loader()` is called here rather than at module scope because it binds to
		// `globalThis.caches`, which exists only in a browser (§7.4).
		const result = await coldStart(contentLoader ?? loader(), userStore ?? store);
		start = result;
		report(result);
		// §12.7's session-start work: poll `navigator.storage.estimate()` and
		// evaluate the three triggers. It runs after the cold start rather than
		// beside it because trigger 1 counts completions off §13.2's mirror, which
		// `hydrate()` is what fills. It never rejects.
		void refreshExportPrompt();
	}

	$effect(() => {
		// Browser-only by construction: `$effect` does not run during prerender,
		// and neither `caches` nor IndexedDB exists there (§13.3).
		void run();
	});

	// §4.1. Reads the stored choice and starts following the media query. The
	// pre-paint attribute is already set by `app.html`; this is what keeps it in
	// step afterwards, and the teardown matters because the media listener would
	// otherwise outlive the component.
	$effect(() => initTheme());

	/**
	 * §5.9 / A7 — the eight plates as `--domain-<id>`, re-injected whenever the
	 * resolved theme changes. Palettes are content and unknown at build time
	 * (D-03), so this is the one seam between `domains.yaml` and the stylesheet.
	 * It reads the manifest's taxonomy, so it can only run once the cold start has
	 * produced one.
	 */
	$effect(() => {
		const domains = content.manifest?.taxonomy.domains;
		if (domains === undefined) return;
		applyDomainPalettes(domains, theme.resolved);
	});

	/**
	 * §12.5's summaries are surfaced as notices here only so that the re-homing
	 * `applyMoves` performs is not silent; T17 owns the migration summary proper.
	 */
	function report(result: ColdStart): void {
		if (result.kind === 'ready' && result.migrations.length > 0) {
			const moved = result.migrations.reduce((sum, r) => sum + r.entries.length, 0);
			ui.notify(
				'info',
				`${moved} completed milestone${moved === 1 ? '' : 's'} moved to a different skill in this release.`
			);
		}
		if (result.kind === 'ready' && result.movesError !== undefined) {
			ui.notify(
				'warning',
				'Some completed milestones could not be moved to their new skill.',
				result.movesError
			);
		}
	}

	function retry(): void {
		start = null;
		void run();
	}

	/** The nav is chrome, so it is up before anything has loaded (§13.3 step 1). */
	const links = [
		{ id: '/', label: 'Map' },
		{ id: '/library', label: 'Library' },
		{ id: '/data', label: 'Data' },
		{ id: '/about', label: 'About' },
		{ id: '/contribute', label: 'Contribute' }
	] as const;
</script>

<header class="shell-chrome">
	<a class="wordmark" href={resolve('/')}>Life Skill Tracker</a>
	<nav aria-label="Primary">
		<ul>
			{#each links as link (link.id)}
				<li><a href={resolve(link.id)}>{link.label}</a></li>
			{/each}
		</ul>
	</nav>
</header>

<!--
	The notice host (§13.4). `role="status"` rather than `alert`: these are
	statements about the session, not interruptions, and §15's rule is that a
	screen reader hears them without losing its place.
-->
<div class="notices" data-notices>
	{#if !progress.writable}
		<p data-degraded role="status">
			Your saved progress could not be read on this device, so nothing will be saved this
			session. Reload to try again — your data has not been deleted.
			{#if start?.hydrationError}
				<span class="detail">{start.hydrationError}</span>
			{/if}
		</p>
	{/if}

	{#if content.offline}
		<p data-offline role="status">
			Offline — showing the skill library saved on this device. It may be out of date.
		</p>
	{/if}

	<!--
		§12.7's export prompt, inline with everything else in the host. It is
		deliberately *here* rather than anywhere that could float over the page:
		"non-modal, dismissible, never blocking" is only true of something in the
		flow of the document, and R-18 leaves F39's export as the only mitigation
		there is, so a prompt users learn to close reflexively costs real data.
	-->
	{#if exportPrompt.visible}
		<ExportPrompt reason={exportPrompt.reason} ondismiss={() => void dismissExportPrompt()} />
	{/if}

	{#each ui.notices as notice (notice.id)}
		<p data-notice data-kind={notice.kind} role="status">
			{notice.text}
			{#if notice.detail}<span class="detail">{notice.detail}</span>{/if}
			<button type="button" data-action="dismiss-notice" onclick={() => ui.dismiss(notice.id)}>
				Dismiss
			</button>
		</p>
	{/each}
</div>

{#if start?.kind === 'failed'}
	<ColdStartFailure reason={start.reason} hydrated={start.hydrated} onretry={retry} />
{:else}
	{@render children()}
{/if}

<style>
	.shell-chrome {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: baseline;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid;
	}
	.wordmark {
		font-weight: 700;
	}
	.shell-chrome ul {
		display: flex;
		gap: 1rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.notices p {
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
