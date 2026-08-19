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
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { bandFor } from '$lib/scoring';
	import type { SkillHexRow } from '$lib/actions/skill-hexes.js';
	import type { SearchHighlight } from './search.js';

	/**
	 * **The skill layer is a separate chunk** (§17.1, §7.1). It is level-1 only,
	 * and level 0 is the first route every visitor lands on — a static import
	 * would put the hexes, their glyphs and their keyboard model into the frame
	 * that has to paint before anything else, which took `App JS, first route`
	 * over its 52 kB budget the moment it was written.
	 *
	 * Hoisted to module scope rather than written inline in the `{#await}` so the
	 * import expression is evaluated once, not once per render.
	 *
	 * The delay is free: §5.6 already holds the layer back 120 ms behind the
	 * camera and fades it over 260 ms, so a chunk that lands inside that window
	 * is invisible.
	 */
	const skillLayer = () => import('./SkillHexLayer.svelte');
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
		HACHURE_LINE_OPACITY,
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
	import {
		PLATE_OPEN,
		REVEAL_MS,
		frameAt,
		markRevealed,
		revealStagger,
		shouldReveal
	} from './reveal.js';

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
		 * whether the skill layer is drawn at all — level 0 renders eight paths and
		 * no hexes, which is what bounds the labelled-hex count as the library
		 * grows (§5.1).
		 */
		level?: CameraLevel;
		/**
		 * §5.4's rows for the focused domain, already in §15.3's documented order
		 * (T31). Empty or absent at level 0, and the component does not check: the
		 * layer is gated on the *level*, because "no rows" and "not at level 1" are
		 * different states and only one of them should draw nothing.
		 */
		skills?: readonly SkillHexRow[];
		/** Which skill the detail panel is open on. Owned by the shell (§13.4). */
		selectedSkill?: string | null;
		/** User intent, upward. This component never navigates and never writes. */
		onselect?: (selection: DomainSelection) => void;
		onskillselect?: (row: SkillHexRow) => void;
		/** `Esc` inside the skill layer — the shell owns the route back to level 0. */
		onleavelevel?: () => void;
		/**
		 * §6.2's filter (T33). `null` when Find is closed or its query is empty —
		 * and `null` is not the same as an empty result, which dims *everything*
		 * and is the honest picture of a query that matched nothing.
		 *
		 * It reaches both levels: `domains` lights the regions at level 0, where
		 * there are no hexes to light, and `matches` lights the hexes at level 1.
		 */
		highlight?: SearchHighlight | null;
		/**
		 * Injected only by tests, exactly as `MapSurface` does it. jsdom has no
		 * real media query, and §15.5's "skipped, not shortened" is the single
		 * most important thing about the reveal to be able to assert.
		 */
		reducedMotion?: boolean;
	}

	let {
		manifest,
		domainScores,
		viewport,
		view: cameraView,
		level = { level: 0 },
		skills = [],
		selectedSkill = null,
		onselect,
		onskillselect,
		onleavelevel,
		highlight = null,
		reducedMotion
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
	/**
	 * §5.7's per-region `t` — distance from the world centre, normalized. Keyed
	 * by domain rather than positional so it survives the `flatMap` below
	 * dropping a domain the map has no region for.
	 */
	const stagger = $derived.by(() => {
		const drawn = manifest.taxonomy.map.regions;
		const ts = revealStagger(drawn.map((region) => regionBounds(region)));
		return new Map(drawn.map((region, index) => [region.domain, ts[index] ?? 0]));
	});

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
					t: stagger.get(domain.id) ?? 0,
					band: bandFor(score.fill),
					recency: formatLastActivity(score.lastActivityAt),
					href: domainListingHref(domain.id),
					name: regionAccessibleName(domain.title, score, fogged),
					// §6.2 reuses T30's dim rather than writing a second dimming path:
					// same opacity, same 140 ms, same "everything stays on screen" rule.
					// Only the trigger differs — a query instead of a pointer.
					unmatched: highlight !== null && !highlight.domains.has(domain.id),
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

	/* ── "The Survey" — the first-load reveal (§5.7, T35) ──────────────────────
	 *
	 * The map is drawn in the order a real one is made: linework, then the colour
	 * plates, then the type. It runs **once ever**, and everything about how it
	 * is wired here follows from the other two load-bearing properties.
	 *
	 * **It ends on the resting frame** because the reveal drives custom
	 * properties and the stylesheet's *fallbacks* are the resting values. When
	 * `revealMs` goes null the style attribute disappears and every rule below
	 * falls back — there is no second set of numbers to disagree with the first,
	 * and no final frame to land wrong.
	 *
	 * **Under reduced motion it does not run at all.** `shouldReveal` returns
	 * false, the effect returns before requesting a frame, and the map's first
	 * paint is the resting frame. Not a shortened reveal; skipped (§15.5).
	 */
	let surface = $state<SVGSVGElement | null>(null);
	let revealMs = $state<number | null>(null);
	/**
	 * Path lengths, measured once. `getTotalLength()` forces layout, so measuring
	 * it inside the per-frame style build would force one per region per frame —
	 * §5.7 calls this out by name and `MapRenderer.reveal.test.ts` counts the
	 * calls. Deliberately not `$state` and deliberately a plain record: it is
	 * written once before the first frame and read by a function the frame
	 * counter already invalidates, so reactivity here would buy nothing and a
	 * `SvelteMap` would advertise the opposite.
	 */
	const pathLengths: Record<string, number> = {};

	$effect(() => {
		if (!shouldReveal(reducedMotion)) return;
		// Spent as the reveal *starts*. A visitor who navigates away halfway has
		// seen it, and replaying it next time is the failure §5.7 names.
		markRevealed();

		// `untrack` throughout: this effect must run exactly once, and reading the
		// element or the region list reactively would restart the reveal every
		// time a score changed underneath it.
		const svg = untrack(() => surface);
		if (svg === null) return;

		for (const outline of svg.querySelectorAll('.region-outline')) {
			const domain = outline.closest('[data-domain]')?.getAttribute('data-domain');
			if (domain === null || domain === undefined) continue;
			const measure = (outline as SVGGeometryElement).getTotalLength;
			pathLengths[domain] = typeof measure === 'function' ? measure.call(outline) : 0;
		}

		let handle = 0;
		let started = -1;
		const step = (now: number): void => {
			// The first frame's timestamp is the origin rather than a `performance.now()`
			// taken during setup: the gap between them is a frame the reveal would
			// otherwise skip, and it is the frame where nothing is drawn yet.
			if (started < 0) started = now;
			const elapsed = now - started;
			revealMs = elapsed >= REVEAL_MS ? null : elapsed;
			if (revealMs !== null) handle = requestAnimationFrame(step);
		};

		revealMs = 0;
		handle = requestAnimationFrame(step);
		return () => cancelAnimationFrame(handle);
	});

	/**
	 * One region's frame, as custom properties. Absent — not zeroed — when no
	 * reveal is running, so the fallbacks in the stylesheet take over.
	 */
	function revealStyle(id: string, t: number): string | undefined {
		if (revealMs === null) return undefined;
		const frame = frameAt(revealMs, t);
		const length = pathLengths[id] ?? 0;
		// The plates phase drives three resting values, not one: the hue plate at
		// `--plate-open`, the fogged plate at `--plate-fog`, and the score fill at
		// full. Its bare progress is what scales all three, and `plateOpacity`
		// divided by its own end value is that progress.
		const plates = frame.plateOpacity / PLATE_OPEN;
		return (
			`--reveal-len: ${length}; --reveal-line: ${length * frame.dashOffset};` +
			` --reveal-plate: ${frame.plateOpacity};` +
			` --reveal-fog-plate: ${plates * HACHURE_PLATE_OPACITY};` +
			` --reveal-hachure: ${frame.hachureOpacity}; --reveal-fill: ${plates};` +
			` --reveal-label: ${frame.labelOpacity}; --reveal-track: ${frame.letterSpacingEm}em`
		);
	}

	/**
	 * §5.7's camera settle — a 1.06 → 1.00 pull-back about the world centre. It
	 * is a modifier layered over the sequence rather than a phase of it, which is
	 * why it takes no stagger and why it is a transform on a group rather than a
	 * change to the `viewBox`: the box belongs to the route (A1), and a reveal
	 * that wrote to it would be a second camera.
	 */
	const revealCamera = $derived.by(() => {
		if (revealMs === null) return undefined;
		const cx = view.x + view.w / 2;
		const cy = view.y + view.h / 2;
		return `translate(${cx} ${cy}) scale(${frameAt(revealMs, 0).cameraScale}) translate(${-cx} ${-cy})`;
	});

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
		bind:this={surface}
		class="world-map"
		data-level={level.level}
		data-revealing={revealMs === null ? undefined : ''}
		viewBox={viewBoxAttr(view)}
		role="group"
		aria-label="World map of life domains"
		style="--outline-width: {outlineWidth}; --domain-label-size: {DOMAIN_LABEL_WORLD_SIZE}px; --data-size: {dataSize}px; --hachure-plate: {HACHURE_PLATE_OPACITY}; --hachure-line: {HACHURE_LINE_OPACITY}"
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

		<!--
			§5.7's camera settle. The group is always here and the transform is not:
			an identity transform on every frame would be a second camera to reason
			about, and a group that appeared mid-reveal would re-create every region
			node underneath it.
		-->
		<g class="reveal-camera" transform={revealCamera}>
		{#each regions as region (region.id)}
			<g
				class="region"
				class:is-fogged={region.fogged}
				class:is-unmatched={region.unmatched}
				data-domain={region.id}
				style={revealStyle(region.id, region.t)}
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

		<!--
			§5.4's hexes, at level 1 only (T31). They are drawn *inside* this `<svg>`
			in world coordinates, so the camera moves them for free — there is no
			second viewBox and no transform of their own. Gated on the level rather
			than on the rows being non-empty: a domain with no published trees at
			level 1 is a fogged region, and it should render as one rather than as an
			empty skill layer.
		-->
		{#if level.level === 1}
			{#await skillLayer() then layer}
				<layer.default
					rows={skills}
					{highlight}
					selected={selectedSkill}
					onselect={onskillselect}
					onleave={onleavelevel}
				/>
			{/await}
		{/if}
		</g>
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
		fill-opacity: var(--reveal-plate, var(--plate-open));
	}

	/* Full strength, clipped to the rectangle below the line. The score. */
	.region-below {
		fill-opacity: var(--reveal-fill, 1);
	}

	/* §4.3 — ruled in ink at 1.3 units, clipped to the region path. */
	.region-waterline {
		stroke: var(--ink);
		stroke-width: var(--rule-water);
		opacity: var(--reveal-fill, 1);
	}

	/* §4.4 — unsurveyed ground. The plate drops to 0.10 and carries no hue. The
	   opacity arrives as a variable rather than as a literal here so that §4.4's
	   three fog numbers — spacing, stroke, plate — stay together in
	   `map-presentation.ts`, where the test that pins them can reach them. */
	.region-plate.is-hachured {
		fill: var(--ink);
		fill-opacity: var(--reveal-fog-plate, var(--hachure-plate));
	}

	/*
	 * §5.7's plates phase raises the ruling to just over a half, which only ends
	 * on the resting frame if that is what it rests at — so this is the settled
	 * value, not a reveal-only one, and `--hachure-line` carries it from
	 * `map-presentation.ts` the same way `--hachure-plate` already does.
	 */
	.region-hachure {
		stroke: none;
		opacity: var(--reveal-hachure, var(--hachure-line));
	}

	.region-outline {
		fill: none;
		stroke: var(--ink);
		/* §5.2's stepping: 1.3 world units at level 0, 0.9 at level 1, so the
		   outline holds constant *screen* weight instead of thickening with the
		   camera. The value is chosen in `camera.ts` and arrives as a variable. */
		stroke-width: var(--outline-width);
		/*
		 * §5.7's linework, and the reason it is a dash rather than a fade: an
		 * outline that fades in appears everywhere at once, and the whole claim
		 * of the reveal is that the map is *drawn*. With no reveal running both
		 * fall back and the stroke is an ordinary solid one.
		 */
		stroke-dasharray: var(--reveal-len, none);
		stroke-dashoffset: var(--reveal-line, 0);
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

	/*
	 * §6.2's filter dim — T30's treatment above, driven by a query instead of a
	 * pointer. Deliberately the same two numbers: two different "this is not the
	 * thing you are looking at" strengths on one map would read as two different
	 * meanings.
	 */
	.region.is-unmatched {
		opacity: 0.38;
		transition: opacity 140ms ease-out;
	}

	/* §15.5 — the fill animation, the water line and the focus dim are all the
	   motion on this map, and nothing here is conveyed by motion alone, so
	   removing all of it loses nothing. */
	/*
	 * §5.7's reveal is not listed here and cannot be: it is skipped in the
	 * script, before a frame is ever requested, which is what §15.5 asks for.
	 * A `transition: none` here would be the shortened version of a reveal that
	 * had already started.
	 */
	@media (prefers-reduced-motion: reduce) {
		.world-map :global(clipPath rect),
		.region-waterline,
		.world-map:has(.region:focus-visible) .region:not(:focus-visible),
		.world-map:has(.region:hover) .region:not(:hover),
		.region.is-unmatched {
			transition: none;
		}
	}

	/*
	 * §15.4 — under a forced palette the user's own colours replace ours and
	 * opacity is the one channel they cannot compensate for. Fog is the state
	 * most at risk of disappearing, so the ruling goes back to full strength.
	 */
	@media (forced-colors: active) {
		.region-hachure {
			opacity: 1;
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
		/*
		 * §5.7's lettering phase. The tracking settles *to* `--display-tracking`,
		 * which `.display` in `tokens.css` already sets — this rule states the
		 * same value as its own fallback rather than a second one, so the type is
		 * set identically whether or not a reveal ever ran.
		 */
		opacity: var(--reveal-label, 1);
		letter-spacing: var(--reveal-track, var(--display-tracking));
	}

	/* The data under the name is part of the type, so it arrives with it. The
	   0.8 is the resting value these three already had; the reveal scales it
	   rather than replacing it, so nothing about the settled map moves. */
	.region-breadth,
	.region-recency,
	.region-band {
		opacity: calc(0.8 * var(--reveal-label, 1));
	}

	/* Interior grouping lines keep their own two opacities (below) and take the
	   lettering phase as a plain multiplier on the group. */
	.subregions {
		opacity: var(--reveal-label, 1);
	}

	.region-breadth,
	.region-recency,
	.region-band {
		font-size: var(--data-size);
		text-anchor: middle;
		fill: var(--ink);
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
