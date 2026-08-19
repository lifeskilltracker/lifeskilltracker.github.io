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
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ColdStartFailure from '$lib/components/ColdStartFailure.svelte';
	import ExportPrompt from '$lib/components/ExportPrompt.svelte';
	import MapSurface from '$lib/components/MapSurface.svelte';
	import type { DomainSelection } from '$lib/components/MapRenderer.svelte';
	import type { CameraLevel } from '$lib/components/camera.js';
	import { MAP_LIST_BELOW } from '$lib/components/map-presentation.js';
	import NextStepCard from '$lib/components/NextStepCard.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { sidebarCollapse } from '$lib/components/sidebar-collapse.svelte.js';
	import type { NextStep, NextStepView } from '$lib/components/next-step.js';
	import { dismissExportPrompt, refreshExportPrompt } from '$lib/actions/export-prompt.js';
	import {
		domainProgressRows,
		startedSkillRows,
		worldScores
	} from '$lib/actions/domain-scores.js';
	import { assembleNextStep, type NextStepSources } from '$lib/actions/next-step.js';
	import { skillHexRows, type SkillHexRow } from '$lib/actions/skill-hexes.js';
	import type { SearchResult } from '$lib/components/search.js';
	import type { DomainId } from '$lib/types';
	import type { SkillDetail as SkillDetailData } from '$lib/actions/skill-detail.js';

	/**
	 * The panel and its assembly are both level-1, gesture-triggered, and behind
	 * a `{#await}` for the same reason the hex layer is: §17.1's first-route JS
	 * budget is 52 kB and the map at level 0 needs none of this (§7.1).
	 *
	 * `skill-detail.js` is imported dynamically too — it reaches `scoreSkill`,
	 * and a panel nobody has opened should not put the Scoring Engine's level
	 * evaluation on the first paint.
	 */
	const skillDetailPanel = () => import('$lib/components/SkillDetail.svelte');

	/**
	 * §6.2 and §6.3's corner, on the same seam and for the same reason (T33). The
	 * matcher, both dialogs and the whole legend are one chunk, fetched on the map
	 * route rather than reached from the entry graph — §17.1's first-route budget
	 * had 0.4 kB of headroom when this landed.
	 */
	const mapControls = () => import('$lib/components/MapControls.svelte');
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
		/**
		 * The current path, handed down by `+layout.svelte`. It arrives as a prop
		 * rather than being read here so the shell stays mountable outside a
		 * SvelteKit router — which is what makes §13.3's four branches testable.
		 */
		pathname?: string;
		/** Injected only by tests — the same seam as `StoreOptions.open` (§14.5). */
		contentLoader?: ColdStartContent;
		userStore?: ColdStartStore;
		/** The card's two I/O halves, injected on the same seam (§6.4, T32). */
		nextStepSources?: NextStepSources;
	}

	let {
		children,
		pathname = '/',
		contentLoader,
		userStore,
		nextStepSources
	}: Props = $props();

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

	/**
	 * §6.1's four blocks, assembled here (A6, T32).
	 *
	 * The sidebar is chrome, so its first two blocks are up before either promise
	 * settles (§13.3 step 1) — `domains` and the progress rows simply fill in when
	 * the manifest and the mirror arrive. Every derivation runs through
	 * `lib/actions`, which is the one layer §14.1 lets hold a manifest and a
	 * `SKILL` row at once; the sidebar itself imports neither.
	 */
	let world = $derived(
		content.manifest === null ? null : worldScores(content.manifest, progress.skills)
	);

	let domains = $derived(
		(content.manifest?.taxonomy.domains ?? []).map((domain) => ({
			id: domain.id,
			title: domain.title
		}))
	);

	let startedSkills = $derived(
		content.manifest === null ? [] : startedSkillRows(content.manifest, progress.skills)
	);

	let domainProgress = $derived(
		content.manifest === null || world === null
			? []
			: domainProgressRows(content.manifest.taxonomy, world.scores)
	);

	/** §6.1 block 2 doubles as the level-1 "where am I" indicator (A6, §13.1). */
	let activeDomain = $derived(/^\/d\/([^/]+)/.exec(pathname)?.[1] ?? null);

	/**
	 * §6.4's card is the map's, so it rides the two routes that *are* the map.
	 * `/s/<treeId>` has F36's `.` shortcut and a tree the user is already looking
	 * at; a card naming a milestone two rows below the one they are reading would
	 * be a second answer to a question the page is already answering.
	 */
	let onMap = $derived(pathname === '/' || pathname.startsWith('/d/'));

	/**
	 * A1/A6 — **the map surface is mounted here, not by either route.**
	 *
	 * §5.1 requires that entering a domain flies the camera rather than
	 * navigating, and two SvelteKit route components cannot share a DOM node: the
	 * router destroys one and creates the other. The shell survives that
	 * navigation, so mounting the surface here is what makes `/` → `/d/<id>` an
	 * animation instead of a page load. The routes contribute the camera *level*
	 * and their own supplementary content; the surface itself never remounts.
	 *
	 * The level is read from the path rather than from `page.params` for the same
	 * reason `pathname` is a prop: it keeps the shell mountable outside a router,
	 * which is what makes §13.3's four branches testable at all.
	 */
	let level = $derived<CameraLevel>(
		activeDomain === null ? { level: 0 } : { level: 1, domain: activeDomain }
	);

	/**
	 * §10.7's substitution. Still a viewport decision at this task: U-10 moves the
	 * threshold from viewport size to *zoom level*, and it arrives with T31, which
	 * is the task that draws the skill hexes the phone would be substituting for.
	 * Moving it here first would give the phone a level-1 map with nothing on it
	 * that a list does not already say better.
	 */
	/**
	 * `null` and not `undefined` once the map has been mounted and left: Svelte
	 * clears a `bind:this` to `null` on teardown, and the shell outlives the
	 * `<main>` it binds — leaving the map for `/library` runs this effect again
	 * with the element gone. An `=== undefined` guard passes that through to
	 * `observe(null)`, which throws and takes the whole client runtime with it, so
	 * every later navigation changes the URL and renders nothing.
	 */
	let mapContainer: HTMLElement | null | undefined = $state();
	let viewport = $state<'map' | 'list'>('map');

	$effect(() => {
		const element = mapContainer;
		if (element == null || typeof ResizeObserver === 'undefined') return;

		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? element.clientWidth;
			viewport = width < MAP_LIST_BELOW ? 'list' : 'map';
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	/**
	 * §5.5 — selecting a region enters that domain. It is a `goto` rather than a
	 * direct camera write because §5.1 makes every camera state a URL: browser
	 * Back is the breadcrumb, and a camera moved without the URL moving would
	 * leave Back going somewhere else entirely. There is no breadcrumb widget for
	 * the same reason.
	 */
	function onselect(selection: DomainSelection): void {
		void goto(resolve('/d/[domain]', { domain: selection.domain }));
	}

	/**
	 * §6.4's selection, assembled off the shell's derived layer (T32).
	 *
	 * An effect rather than a `$derived` because it fetches: the available set is
	 * F36's, which needs a scored bundle, and §3.3 keeps bundles off the map's
	 * critical path. `generation` is what stops a slow load from overwriting the
	 * answer to a newer question — a user completing a milestone re-runs this, and
	 * the in-flight pass must not win the race.
	 */
	let step = $state<NextStep | null>(null);
	let stepResolved = $state(false);
	let generation = 0;

	$effect(() => {
		const manifest = content.manifest;
		const skills = progress.skills;
		if (manifest === null || !progress.hydrated) return;

		const mine = ++generation;
		const sources = nextStepSources ?? {
			loadTree: (treeId: string) => loader().loadTree(treeId),
			progressFor: (treeId: string) => store.progressFor(treeId)
		};
		void assembleNextStep(sources, manifest, skills).then((result) => {
			if (mine !== generation) return;
			step = result;
			stepResolved = true;
		});
	});

	/**
	 * §5.4's rows for whichever domain the camera is in (T31).
	 *
	 * Derived, not fetched: every channel the hexes draw is on the manifest or in
	 * §12.3's denormalized level, which is what keeps a level-1 frame free of
	 * bundle loads. The panel is the only thing here that reaches for one.
	 */
	let skillRows = $derived<SkillHexRow[]>(
		content.manifest === null || activeDomain === null
			? []
			: skillHexRows(content.manifest, activeDomain, progress.skills)
	);

	/**
	 * §5.5's panel. The selection is a tree id rather than a row so that it
	 * survives the rows being re-derived — completing a milestone rebuilds every
	 * row, and a panel that closed itself on each completion would be unusable.
	 */
	let selectedSkill = $state<string | null>(null);
	let skillDetail = $state<SkillDetailData | null>(null);
	let detailGeneration = 0;

	function openSkill(row: SkillHexRow): void {
		selectedSkill = row.treeId;

		const manifest = content.manifest;
		if (manifest === null) return;

		const mine = ++detailGeneration;
		const sources = nextStepSources ?? {
			loadTree: (treeId: string) => loader().loadTree(treeId),
			progressFor: (treeId: string) => store.progressFor(treeId)
		};

		void import('$lib/actions/skill-detail.js').then(
			async ({ loadSkillDetail, skillDetailHeader }) => {
				// A slow load must not overwrite the answer to a newer question — the
				// same race the next-step card guards, for the same reason.
				if (mine !== detailGeneration) return;
				// The manifest half first, so opening the panel never looks like
				// nothing happened; the bundle half replaces it when it lands.
				skillDetail = skillDetailHeader(manifest, row);

				const result = await loadSkillDetail(sources, manifest, row);
				if (mine !== detailGeneration) return;
				skillDetail = result;
			}
		);
	}

	function closeSkill(): void {
		detailGeneration += 1;
		selectedSkill = null;
		skillDetail = null;
	}

	/** §5.5 — `Esc` inside the skill layer leaves level 1. Back is still the URL. */
	function leaveLevel(): void {
		closeSkill();
		void goto(resolve('/'));
	}

	/**
	 * §6.2's filter, owned here (T33).
	 *
	 * **Q5, resolved (2026-08-18): the highlight persists across a camera move.**
	 * It is shell state for exactly that reason — the shell survives the
	 * navigation that `onfly` performs and that clicking a region performs, so a
	 * filter put anywhere below this would be cleared by the very move it was
	 * meant to survive. "What have I got in this area" has to still be answered
	 * once the reader has arrived in the area.
	 *
	 * `null` when Find is closed or empty; an empty result is a different state,
	 * and dims everything, which is the honest picture of a query matching nothing.
	 */
	let highlight = $state<SearchResult | null>(null);

	/**
	 * §6.2 — `Enter` flies to the top hit's region. Not to the hex: there is no
	 * free camera (§5.1), level 1 is the closest the camera comes to one skill,
	 * and §5.5's two-click path is deliberate — the panel opens on a click on the
	 * hex, not on arriving near it.
	 */
	function flyTo(domain: DomainId): void {
		void goto(resolve('/d/[domain]', { domain }));
	}

	// Leaving a domain closes its panel: a panel naming a skill from the domain
	// the camera has just left is worse than no panel at all.
	$effect(() => {
		if (activeDomain === null) closeSkill();
	});

	let nextStepView = $derived<NextStepView>(
		step !== null ? { kind: 'step', step } : stepResolved ? { kind: 'invitation' } : { kind: 'pending' }
	);
</script>

<div class="shell" data-sidebar-collapsed={sidebarCollapse.collapsed}>
	<Sidebar
		{activeDomain}
		{domains}
		{startedSkills}
		{domainProgress}
		hydrated={progress.hydrated}
	/>

	<div class="shell-body">
		<!--
	§6.4's card, before the page in the document so the keyboard reaches it
	before the map (§8.2) — the whole point of "reachable without traversing
	the map". It is positioned bottom-left by CSS, not by document order.
-->
		{#if onMap && !ui.nextStepDismissed}
			<NextStepCard
				view={nextStepView}
				ondismiss={() => {
					ui.nextStepDismissed = true;
				}}
			/>
		{/if}

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
		{:else if onMap}
			<!--
				A6 — one `<main>` for both camera levels, holding one surface. The
				route's own content renders *under* the map: at `/` that is the
				pre-manifest notice, at `/d/<id>` the domain's skill listing. Neither
				route draws a map of its own, and neither owns a `<main>`.
			-->
			<main class="map-main" bind:this={mapContainer}>
				{#if content.manifest !== null && world !== null}
					<MapSurface
						manifest={content.manifest}
						domainScores={world.scores}
						{level}
						{viewport}
						skills={skillRows}
						{selectedSkill}
						{highlight}
						{onselect}
						onskillselect={openSkill}
						onleavelevel={leaveLevel}
					/>
				{/if}

				<!--
					§5.5's panel, beside the surface rather than inside it: it is HTML
					over an `<svg>`, and the map must not have to know what a panel is.
				-->
				{#if skillDetail !== null}
					{#await skillDetailPanel() then panel}
						<panel.default detail={skillDetail} onclose={closeSkill} />
					{/await}
				{/if}

				<!--
					§6.2/§6.3's corner. Inside `main` and only on the map, which is what
					keeps `Ctrl`/`Cmd`+`F` the browser's on every other route: the
					handler is installed by `Find`, so not mounting it is the whole of
					the scoping.
				-->
				{#await mapControls() then controls}
					<controls.default
						manifest={content.manifest}
						skills={progress.skills}
						onresult={(next) => (highlight = next)}
						onfly={flyTo}
					/>
				{/await}
				{@render children()}
			</main>
		{:else}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	/*
	 * A6's layout: the sidebar owns a column and the page owns the rest. The
	 * sidebar replaces a top bar, which is the whole point — a horizontal band
	 * spends the map's *vertical* extent, and vertical is the axis the map has
	 * least of on a laptop (§6.1).
	 *
	 * The column width lives here rather than in `Sidebar.svelte` because two
	 * things depend on it — the grid track and the card's left offset — and a
	 * width stated twice is a width that drifts the first time the rail changes.
	 */
	.shell {
		--sidebar-width: 15rem;
		display: grid;
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
		min-height: 100vh;
		min-height: 100dvh;
	}
	.shell[data-sidebar-collapsed='true'] {
		--sidebar-width: 3.25rem;
	}

	.shell-body {
		position: relative;
		min-width: 0;
	}

	.notices p {
		border: 1px solid var(--rule);
		padding: 0.75rem 1rem;
		margin: 0;
	}
	.detail {
		display: block;
		font-family: var(--font-data);
		font-size: 0.85em;
	}

	/*
	 * §6.4 — bottom-left, over the page rather than in its flow, so adding the
	 * card moves the map by not one pixel. Fixed rather than absolute because
	 * "always visible on the map" has to survive a scrolled page; offset by the
	 * sidebar so it clears it, and the bottom-*right* corner is left empty for
	 * T33's Find and Info.
	 */
	.shell-body :global(.next-step) {
		position: fixed;
		z-index: 2;
		inset-inline-start: calc(var(--sidebar-width) + 1rem);
		inset-block-end: 1rem;
		box-shadow: 0 1px 6px color-mix(in srgb, var(--ink) 16%, transparent);
	}
</style>
