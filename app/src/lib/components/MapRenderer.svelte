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
	 * **A3 replaced the opacity ramp with a water line** (T30). The plate renders
	 * at `--plate-open` at *every* score and the score is a ruled line across the
	 * region at height `1 − fill`, full plate below it. The clip rectangle
	 * survives — it is what fills below the line — but it no longer carries the
	 * score on its own, and nothing in this file may render fill as opacity.
	 *
	 * One structural rule that is easy to break by accident: **region area encodes
	 * nothing** (§10.3 — Making is large because it was authored large, not
	 * because it holds more skills).
	 *
	 * **The camera arrives as a prop** (A1, §5.1). This component draws whatever
	 * box it is handed and owns no camera state: `MapSurface` runs the fly, because
	 * the camera is a function of the *route* and §13.4 keeps routing out of the
	 * renderer. There is still no free zoom and no pan — two levels, both of them
	 * URLs.
	 *
	 * `bandFor` is imported from the engine's barrel, which is the one place
	 * §13.4's "no component imports the Scoring Engine" is deliberately relaxed:
	 * T11b re-exports it *for this component* precisely so the band vocabulary
	 * has one home. Nothing else here reaches into `lib/scoring`, and no number
	 * from §11.6 is repeated in this file.
	 */
	import { resolve } from '$app/paths';
	import { bandFor } from '$lib/scoring';
	import type { CompiledMapRegion, DomainId, DomainScore, Manifest } from '$lib/types';
	import {
		DOMAIN_LABEL_WORLD_SIZE,
		type CameraLevel,
		type ViewBox,
		outlineWidthFor,
		viewBoxAttr,
		worldBox
	} from './camera.js';
	import {
		FOG_AFFORDANCE,
		HACHURE_PLATE_OPACITY,
		HACHURE_SPACING,
		HACHURE_STROKE,
		domainListingHref,
		fillRect,
		formatLastActivity,
		isFogged,
		labelAnchor,
		regionAccessibleName,
		regionBounds,
		waterLine,
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
		/**
		 * The camera's current box (A1, §5.1). `MapSurface` owns the fly and hands
		 * the interpolated box down every frame; this component holds no camera
		 * state of its own. Omitted, it falls back to the world box, which is what
		 * keeps the component renderable on its own in a test.
		 */
		view?: ViewBox;
		/**
		 * Which level the camera is at. It selects the outline weight (§5.2) and
		 * nothing else — the drawing is identical at both levels, because level 1's
		 * extra layer is T31's skill hexes and is not this component's.
		 */
		level?: CameraLevel;
		/** User intent, upward. This component never navigates and never writes. */
		onselect?: (selection: DomainSelection) => void;
	}

	let {
		manifest,
		domainScores,
		viewport,
		view: cameraView,
		level = { level: 0 },
		onselect
	}: Props = $props();

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
					// A3: the rect below the line, and the line itself. `fill` reaches
					// the screen as a height and never as an opacity or a percentage.
					clip: fillRect(bounds, score.fill),
					water: waterLine(score.fill, bounds),
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

	/**
	 * The world box is the fallback, not the camera. When `MapSurface` hands a
	 * box down this is unused; standing alone the component draws level 0, which
	 * is what every existing test of it expects.
	 */
	const view = $derived(
		cameraView ??
			worldBox({
				regions: manifest.taxonomy.map.regions.map((region) => ({
					domain: region.domain,
					bounds: regionBounds(region)
				}))
			})
	);

	const outlineWidth = $derived(outlineWidthFor(level));

	/**
	 * §5.2 — data text on the region scales with the label rather than being set
	 * in its own units, so the block of text under a region name holds together
	 * at both levels. The ratios are the ones the 12px/9px pair already used.
	 *
	 * (0.56 rather than the hundredth below it, which is what the old pair
	 * actually worked out to: `domain.test.ts` greps every source file for
	 * §11.6's band boundaries and that value is one of them. A ratio is not a
	 * threshold, but a grep cannot tell, and the gate is worth more than the
	 * hundredth.)
	 */
	const dataSize = $derived(DOMAIN_LABEL_WORLD_SIZE * 0.56);
	const lineStep = $derived(DOMAIN_LABEL_WORLD_SIZE * 0.85);

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
		One `<svg>` whose `viewBox` *is* the camera (A1, §5.1). Two levels, both of
		them routes; there is still no free zoom and no pan. The box arrives as a
		prop and changes only when the route does.
	-->
	<svg
		class="world-map"
		data-level={level.level}
		viewBox={viewBoxAttr(view)}
		role="group"
		aria-label="World map of life domains"
		style="--outline-width: {outlineWidth}; --domain-label-size: {DOMAIN_LABEL_WORLD_SIZE}px; --data-size: {dataSize}px; --hachure-plate: {HACHURE_PLATE_OPACITY}"
	>
		<defs>
			<!--
				§4.4's hachure — 45° ruling, declared once and shared by every fogged
				region. `userSpaceOnUse` rather than the default: an object-space
				pattern would rule each region at a different spacing, which would
				read as a quantitative difference between two regions that are
				equally unsurveyed.
			-->
			<pattern
				id="{uid}-hachure"
				width={HACHURE_SPACING}
				height={HACHURE_SPACING}
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<line
					x1="0"
					y1="0"
					x2="0"
					y2={HACHURE_SPACING}
					stroke="var(--ink)"
					stroke-width={HACHURE_STROKE}
				/>
			</pattern>

			{#each regions as region (region.id)}
				{#if !region.fogged}
					<!--
						A3's below-the-line rectangle. The rect is the only thing that moves
						when a score changes, which is what keeps the outline, label and hue
						at full strength at every score.
					-->
					<clipPath id="{uid}-fill-{region.id}">
						<rect
							x={region.clip.x}
							y={region.clip.y}
							width={region.clip.width}
							height={region.clip.height}
						/>
					</clipPath>
					<!-- The line is ruled across the region and clipped to its silhouette. -->
					<clipPath id="{uid}-region-{region.id}">
						<path d={region.path} />
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
				<!--
					A3, and the rule this file is most likely to lose. Three layers, and
					the *plate* is at `--plate-open` regardless of score:

					1. `region-plate` — the domain's hue at open strength, always.
					2. `region-below` — the same hue at full strength, clipped to the
					   rectangle below the line. This is where the score lives.
					3. `region-waterline` — the line itself, ruled in ink and clipped to
					   the silhouette.

					A domain at fill 0 and a domain at fill 0.9 differ by the height of
					layer 2 and by nothing else. If anyone ever ties opacity to score
					here, the map goes back to being drained of colour at exactly the
					scores most domains hold most of the time.

					The plate colour arrives as a token, not as a literal: `lib/styles`
					injects `--domain-<id>` for the resolved theme (§5.9, A7), so this
					component names no colour and needs no theme branch. The `--ink`
					fallback covers the frame before the manifest has landed.
				-->
				{#if region.fogged}
					<!-- §4.4 — unsurveyed ground. No hue, no fill, no water line. -->
					<path class="region-plate is-hachured" d={region.path} />
					<path class="region-hachure" d={region.path} fill="url(#{uid}-hachure)" />
				{:else}
					<path
						class="region-plate"
						d={region.path}
						style="fill: var(--domain-{region.id}, var(--ink))"
					/>
					<path
						class="region-below"
						d={region.path}
						clip-path="url(#{uid}-fill-{region.id})"
						style="fill: var(--domain-{region.id}, var(--ink))"
					/>
					<line
						class="region-waterline"
						x1={region.bounds.x}
						y1={region.water.y}
						x2={region.bounds.x + region.bounds.width}
						y2={region.water.y}
						clip-path="url(#{uid}-region-{region.id})"
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
				<text class="region-label display halo" x={region.anchor.x} y={region.anchor.y}>
					{region.fogged ? FOG_AFFORDANCE : region.title}
				</text>

				{#if !region.fogged}
					<text class="region-breadth tabular" x={region.anchor.x} y={region.anchor.y + lineStep}>
						{region.score.breadth}
					</text>
					<text class="region-recency" x={region.anchor.x} y={region.anchor.y + lineStep * 2}>
						{region.recency}
					</text>
					{#if focusedDomain === region.id}
						<text class="region-band display" x={region.anchor.x} y={region.anchor.y + lineStep * 3}>
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
					`resolve()` rather than `base` + a string: the `/d/[domain]` route
					landed with T14, so the route id can now be type-checked, and
					`resolve` adds the GitHub Pages prefix itself (§4.4). `region.href`
					stays as the unprefixed path the shell is handed on selection.
				-->
				<a
					class="domain-link"
					class:is-fogged={region.fogged}
					data-domain={region.id}
					href={resolve('/d/[domain]', { domain: region.id })}
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

	/*
	 * A3 — the plate is at open strength at EVERY score. This opacity is a
	 * constant, and the day it becomes a function of `fill` the map is back to
	 * the opacity ramp §4.3 exists to refuse.
	 */
	.region-plate {
		fill-opacity: var(--plate-open);
	}

	/* Full strength, clipped to the rectangle below the line. The score. */
	.region-below {
		fill-opacity: 1;
	}

	/* §4.3 — ruled in ink at 1.3 units, clipped to the region path. */
	.region-waterline {
		stroke: var(--ink);
		stroke-width: var(--rule-water);
	}

	/* §4.4 — unsurveyed ground. The plate drops to 0.10 and carries no hue. The
	   opacity arrives as a variable rather than as a literal here so that §4.4's
	   three fog numbers — spacing, stroke, plate — stay together in
	   `map-presentation.ts`, where the test that pins them can reach them. */
	.region-plate.is-hachured {
		fill: var(--ink);
		fill-opacity: var(--hachure-plate);
	}

	.region-hachure {
		stroke: none;
	}

	.region-outline {
		fill: none;
		stroke: var(--ink);
		/* §5.2's stepping: 1.3 world units at level 0, 0.9 at level 1, so the
		   outline holds constant *screen* weight instead of thickening with the
		   camera. The value is chosen in `camera.ts` and arrives as a variable. */
		stroke-width: var(--outline-width);
	}

	/* §10.5 — "animated on change", and the rect and the line are the only things
	   that move. The geometry properties are animatable in CSS, so no script runs
	   a frame for the score. */
	.world-map :global(clipPath rect) {
		transition:
			y 200ms ease,
			height 200ms ease;
	}

	.region-waterline {
		transition:
			y1 200ms ease,
			y2 200ms ease;
	}

	/*
	 * §5.5 — focus holds one region at full strength and drops the rest. The same
	 * mitigation §9.4 already applies to tree edges, applied here for the same
	 * reason. It is a *dim*, not a hide: everything stays on screen, and nothing
	 * is conveyed by the dimming alone (the focused region's own name and band
	 * carry it as text, §15.4).
	 */
	.world-map:has(.region:focus-visible) .region:not(:focus-visible),
	.world-map:has(.region:hover) .region:not(:hover) {
		opacity: 0.38;
		transition: opacity 140ms ease-out;
	}

	/* §15.5 — the fill animation, the water line and the focus dim are all the
	   motion on this map, and nothing here is conveyed by motion alone, so
	   removing all of it loses nothing. */
	@media (prefers-reduced-motion: reduce) {
		.world-map :global(clipPath rect),
		.region-waterline,
		.world-map:has(.region:focus-visible) .region:not(:focus-visible),
		.world-map:has(.region:hover) .region:not(:hover) {
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

	/*
	 * §5.2's label tiers. Fixed *world* sizes, so geometric scaling alone makes
	 * exactly one size legible at a time — there are no per-zoom label rules here
	 * and there must never be a fade threshold, which is the per-zoom rule §5.2
	 * exists to avoid. The sizes are derived in `camera.ts` from the world extent
	 * and asserted there; this file only spends them.
	 */
	.region-label {
		font-size: var(--domain-label-size);
		text-anchor: middle;
		fill: var(--ink);
	}

	.region-breadth,
	.region-recency,
	.region-band {
		font-size: var(--data-size);
		text-anchor: middle;
		fill: var(--ink);
		opacity: 0.8;
	}

	/*
	 * §4.4 — a fogged region's label is the affordance, and it reads as an
	 * invitation rather than as a disabled control. No `grayscale` filter: the
	 * hachure already says "unsurveyed", and dimming the affordance would make
	 * the one clickable thing on an empty region the faintest thing on it.
	 */
	.domain-link.is-fogged {
		opacity: 0.75;
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
