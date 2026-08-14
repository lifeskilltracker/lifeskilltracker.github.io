<script lang="ts">
	/**
	 * §10.5–§10.7 — the world map (T13, D-02, D-08).
	 *
	 * It draws eight paths the compiler already unioned (§10.4) and three
	 * quantitative channels over them. **It computes none of the three.** Fill,
	 * breadth, and recency arrive on `DomainScore` from `domainScores` (§14.4);
	 * fog arrives from the manifest. §13.4 keeps the engines out of components,
	 * and here that is more than tidiness: `fill = s / (s + 48)` and the
	 * contribution table are bound to each other by §11.6's constraint, and a
	 * component that re-derived either could break that pair silently.
	 *
	 * Each channel's encoding is a rejection of an easier, wrong alternative,
	 * and all three are easy to "improve" back into the wrong one:
	 *
	 * - **Fill is a clip rectangle, never opacity and never a percentage.** A
	 *   clip is what leaves a partly-filled region its full-strength outline and
	 *   label (§10.5); a percentage would give a domain a denominator it does
	 *   not have (F34, §11.6). The legible form is the **named band**, resolved
	 *   through `bandFor` — one table, one resolver, and no threshold in this
	 *   file (T26/F18).
	 * - **Recency is a date.** No saturation, no shimmer, no fade, no constant to
	 *   tune: D-20 adopted the date after finding that every shipped system that
	 *   decayed a visible value for inactivity was withdrawn by its own vendor or
	 *   is the most-resented part of its product (§11.7). The graded channel is
	 *   R-20, phase 2, and must not be built here even behind a flag.
	 * - **Breadth is a count**, the one channel with nothing to obscure (F35).
	 *
	 * Two structural rules that are easy to break by accident: **region area
	 * encodes nothing** (§10.3 — Making is large because it was authored large,
	 * not because it holds more skills), and there is **no pan, no zoom, and no
	 * camera** (§10.7). The map fits its viewport, and below the point where
	 * labels stop being legible the shell asks for the list instead.
	 *
	 * `bandFor` is imported from the engine's barrel, which is the one place
	 * §13.4's "no component imports the Scoring Engine" is deliberately relaxed:
	 * T11b re-exports it *for this component* precisely so the band vocabulary
	 * has one home. Nothing else here reaches into `lib/scoring`, and no number
	 * from §11.6 is repeated in this file.
	 */
	import { base } from '$app/paths';
	import { bandFor } from '$lib/scoring';
	import type { CompiledMapRegion, DomainId, DomainScore, Manifest } from '$lib/types';
	import {
		FOG_AFFORDANCE,
		domainListingHref,
		fillRect,
		formatLastActivity,
		isFogged,
		labelAnchor,
		mapViewBox,
		regionAccessibleName,
		regionBounds,
		centroidOf
	} from './map-presentation.js';

	export interface DomainSelection {
		domain: DomainId;
		/** T14's listing route, decided in one place (§10.7, F23). */
		href: string;
	}

	interface Props {
		/** Geometry, palette, titles, and — through `trees` — fog (§7.2, §10.5). */
		manifest: Manifest;
		/** From `domainScores(manifest.taxonomy, rows)`; total over the taxonomy (§14.4). */
		domainScores: ReadonlyMap<DomainId, DomainScore>;
		/**
		 * `list` below §10.7's legibility threshold. The shell measures its own
		 * container and decides, exactly as the skill page does for §8.5 — the one
		 * thing neither this component nor an engine can know (§15.7).
		 */
		viewport: 'map' | 'list';
		/** User intent, upward. This component never navigates and never writes. */
		onselect?: (selection: DomainSelection) => void;
	}

	let { manifest, domainScores, viewport, onselect }: Props = $props();

	/**
	 * Clip-path ids have to be unique in the document, and §13.4 puts this
	 * component on a page that may hold more than one of it (and a test file
	 * that certainly does). `#fill-making` as written in §10.5 is illustrative;
	 * a duplicate id would have the second map clipped by the first map's fill.
	 */
	const uid = $props.id();

	const regionsByDomain = $derived(
		new Map<string, CompiledMapRegion>(
			manifest.taxonomy.map.regions.map((region) => [region.domain, region])
		)
	);

	function scoreOf(domain: DomainId): DomainScore {
		const score = domainScores.get(domain);
		// §14.4 makes the map total over the taxonomy, so this is a wiring error
		// in the caller rather than a state to render. Rendering a zero here would
		// show an untouched region for a domain the user has worked in.
		if (score === undefined) {
			throw new Error(`§14.4: domainScores is total over the taxonomy; "${domain}" is missing`);
		}
		return score;
	}

	/**
	 * Reading order is the **manifest's domain order**, never the geometry
	 * (§10.7, §15.3): a tab order that followed pixel positions would change
	 * whenever a region moved, and §15.3 promises a stable documented order that
	 * the list below the threshold reproduces exactly.
	 */
	const regions = $derived(
		manifest.taxonomy.domains.flatMap((domain) => {
			const region = regionsByDomain.get(domain.id);
			if (region === undefined) return [];
			const score = scoreOf(domain.id);
			const fogged = isFogged(manifest, domain.id);
			const bounds = regionBounds(region);
			const subregionTitles = new Map(
				(domain.subregions ?? []).map((subregion) => [subregion.id, subregion.title])
			);

			return [
				{
					id: domain.id,
					title: domain.title,
					palette: domain.palette,
					path: region.path,
					bounds,
					anchor: labelAnchor(region),
					clip: fillRect(bounds, score.fill),
					fogged,
					score,
					band: bandFor(score.fill),
					recency: formatLastActivity(score.lastActivityAt),
					href: domainListingHref(domain.id),
					name: regionAccessibleName(domain.title, score, fogged),
					subregions: (region.subregions ?? []).map((subregion) => ({
						id: subregion.id,
						path: subregion.path,
						title: subregionTitles.get(subregion.id) ?? subregion.id,
						anchor: centroidOf(subregion.path)
					}))
				}
			];
		})
	);

	const view = $derived(mapViewBox(manifest.taxonomy.map.regions));

	/** §15.4's redundant channel for the fill height, shown on focus (§10.5, N5). */
	let focusedDomain = $state<DomainId | null>(null);

	function select(domain: DomainId, href: string): void {
		onselect?.({ domain, href });
	}

	function onRegionKey(event: KeyboardEvent, domain: DomainId, href: string): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		// Space scrolls the page otherwise, which moves the map under the user.
		event.preventDefault();
		select(domain, href);
	}

	function onLinkClick(event: MouseEvent, domain: DomainId, href: string): void {
		// A real `href` so the list works with no shell wired up and reads as a
		// link to assistive technology; the handler takes over when there is one.
		if (onselect === undefined) return;
		event.preventDefault();
		select(domain, href);
	}
</script>

{#if viewport === 'map'}
	<!--
		One `<svg>` sized entirely by its `viewBox`: no pan, no zoom, no camera
		(§10.7). The whole map fits whatever box it is given, and below the
		legibility threshold the shell asks for the list instead of scaling this
		down past the point where the labels mean anything.
	-->
	<svg
		class="world-map"
		viewBox="{view.x} {view.y} {view.width} {view.height}"
		role="group"
		aria-label="World map of life domains"
	>
		<defs>
			{#each regions as region (region.id)}
				{#if !region.fogged}
					<!--
						§10.5's fill: a rectangle rising from the region's base, clipped to
						the region path. The rect is the only thing that moves when a score
						changes, which is what keeps the outline and label at full strength.
					-->
					<clipPath id="{uid}-fill-{region.id}">
						<rect
							x={region.clip.x}
							y={region.clip.y}
							width={region.clip.width}
							height={region.clip.height}
						/>
					</clipPath>
				{/if}
			{/each}
		</defs>

		{#each regions as region (region.id)}
			<g
				class="region"
				class:is-fogged={region.fogged}
				data-domain={region.id}
				tabindex="0"
				role="link"
				aria-label={region.name}
				data-href={region.href}
				onclick={() => select(region.id, region.href)}
				onkeydown={(event) => onRegionKey(event, region.id, region.href)}
				onfocus={() => (focusedDomain = region.id)}
				onblur={() => (focusedDomain = null)}
			>
				<path class="region-base" d={region.path} style="fill: {region.palette.base}" />
				{#if !region.fogged}
					<path
						class="region-fill"
						d={region.path}
						clip-path="url(#{uid}-fill-{region.id})"
						style="fill: {region.palette.accent}"
					/>
				{/if}
				<path class="region-outline" d={region.path} />

				{#if region.subregions.length > 0}
					<!--
						§10.6 — interior grouping lines, not three territories. Stroke only,
						no fill and no outline class: F27 keeps Making one domain, and the
						visual weight has to match that. Decorative, because the subregion
						names carry no progress and the region's own name already announces
						every channel (§15.3).
					-->
					<g class="subregions" aria-hidden="true">
						{#each region.subregions as subregion (subregion.id)}
							<path class="subregion-boundary" d={subregion.path} fill="none" />
							<text class="subregion-label" x={subregion.anchor.x} y={subregion.anchor.y}>
								{subregion.title}
							</text>
						{/each}
					</g>
				{/if}

				<!--
					A fogged region's name is replaced by the affordance (§10.5); the
					domain's own name survives in the accessible name (§15.3), so the
					identity §15.4 asks for is never lost even where the label is.
				-->
				<text class="region-label" x={region.anchor.x} y={region.anchor.y}>
					{region.fogged ? FOG_AFFORDANCE : region.title}
				</text>

				{#if !region.fogged}
					<text class="region-breadth" x={region.anchor.x} y={region.anchor.y + 14}>
						{region.score.breadth}
					</text>
					<text class="region-recency" x={region.anchor.x} y={region.anchor.y + 28}>
						{region.recency}
					</text>
					{#if focusedDomain === region.id}
						<text class="region-band" x={region.anchor.x} y={region.anchor.y + 42}>
							{region.band}
						</text>
					{/if}
				{/if}
			</g>
		{/each}
	</svg>
{:else}
	<!--
		§10.7's substitution below the legibility threshold, and §15.3's promise
		that it is the same content in the same order — so the small-viewport
		experience and the screen-reader experience converge rather than diverging.
	-->
	<ul class="domain-list" aria-label="Life domains">
		{#each regions as region (region.id)}
			<li>
				<!--
					`base` rather than `resolve()`: the `/d/[domain]` route is T14's and
					does not exist yet, so `resolve()` has no route id to type-check
					against. `base` supplies the only thing it would add here — the
					GitHub Pages prefix (§4.4) — and this line is worth revisiting when
					the route lands.
				-->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					class="domain-link"
					class:is-fogged={region.fogged}
					data-domain={region.id}
					href="{base}{region.href}"
					aria-label={region.name}
					onclick={(event) => onLinkClick(event, region.id, region.href)}
				>
					<span class="region-label">{region.fogged ? FOG_AFFORDANCE : region.title}</span>
					{#if !region.fogged}
						<span class="region-band">{region.band}</span>
						<span class="region-breadth">{region.score.breadth}</span>
						<span class="region-recency">{region.recency}</span>
					{/if}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</li>
		{/each}
	</ul>
{/if}

<style>
	.world-map {
		width: 100%;
		height: auto;
	}

	.region {
		cursor: pointer;
	}

	.region-outline {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}

	/* §10.5 — "animated on change", and the rect is the only thing that moves.
	   The geometry properties are animatable in CSS, so no script runs a frame. */
	.world-map :global(clipPath rect) {
		transition:
			y 200ms ease,
			height 200ms ease;
	}

	/* §15.5 — the fill animation is the one piece of motion on this map, and
	   nothing here is conveyed by motion alone, so removing it costs nothing. */
	@media (prefers-reduced-motion: reduce) {
		.world-map :global(clipPath rect) {
			transition: none;
		}
	}

	/* §10.6 — subdued, so subregions read as neighbourhoods within a territory
	   rather than as three territories (F27). D21's promotion trigger, if the
	   owner ever pulls it, is a change to these two rules and nothing else. */
	.subregion-boundary {
		stroke: currentColor;
		stroke-width: 0.5;
		opacity: 0.4;
	}

	.subregion-label {
		font-size: 8px;
		opacity: 0.5;
	}

	.region-label {
		font-size: 12px;
		text-anchor: middle;
	}

	.region-breadth,
	.region-recency,
	.region-band {
		font-size: 9px;
		text-anchor: middle;
		opacity: 0.8;
	}

	/* Desaturated and low-contrast (§10.5). `grayscale` rather than a saturation
	   value, so nothing in this file is a knob anyone could mistake for D-20's
	   rejected recency channel. */
	.region.is-fogged,
	.domain-link.is-fogged {
		filter: grayscale(1);
		opacity: 0.6;
	}

	.domain-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.domain-link {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		/* §15.7's 44×44 touch target, which the list has to meet as much as the
		   map does — it is the phone-sized view. */
		min-height: 44px;
		padding: 0.25rem 0.5rem;
	}

	.domain-link .region-band,
	.domain-link .region-breadth,
	.domain-link .region-recency {
		font-size: 0.85em;
	}
</style>
