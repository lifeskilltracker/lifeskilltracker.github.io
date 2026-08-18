<script lang="ts">
	/**
	 * The map surface (§13.4, A1/A6 — T30).
	 *
	 * **This component exists so that `/` and `/d/<domainId>` are one surface.**
	 * §5.1's claim is that entering a domain *flies the camera* rather than
	 * navigating, and in SvelteKit two route components cannot share a DOM node —
	 * the router destroys one and creates the other. So the surface is mounted by
	 * the shell, which survives the navigation, and the routes contribute only
	 * which level the camera should be at. That is what makes the transition an
	 * animation instead of a page load, and it is what `shell.test.ts` asserts by
	 * checking the region paths are the *same DOM nodes* across the change.
	 *
	 * It owns the camera and nothing else. `MapRenderer` draws whatever box it is
	 * handed and holds no camera state; the level is a function of the route,
	 * which §14.1 keeps out of the renderer; `camera.ts` does the maths and is
	 * pure. Three files, three jobs.
	 *
	 * **It paints to the resting frame on first load.** No fly on mount, ever —
	 * T35 layers "The Survey" reveal on top of this, and a map that animates
	 * itself into place would leave the reveal nothing to hand over to.
	 */
	import { untrack } from 'svelte';
	import type { DomainId, DomainScore, Manifest } from '$lib/types';
	import MapRenderer, { type DomainSelection } from './MapRenderer.svelte';
	import {
		FLY_MS,
		type CameraLevel,
		type ViewBox,
		fit,
		interpolate
	} from './camera.js';
	import { domainEntryAnnouncement, isFogged, regionBounds } from './map-presentation.js';
	import type { SkillHexRow } from '$lib/actions/skill-hexes.js';

	/** Level-1 only, so its own chunk — see `MapRenderer`'s note (§17.1). */
	const domainSkillList = () => import('./DomainSkillList.svelte');

	interface Props {
		manifest: Manifest;
		domainScores: ReadonlyMap<DomainId, DomainScore>;
		/** Where the URL says the camera is (§5.1 — every camera state is a URL). */
		level: CameraLevel;
		viewport: 'map' | 'list';
		/** §5.4's rows for the focused domain, in §15.3's order (T31). */
		skills?: readonly SkillHexRow[];
		selectedSkill?: string | null;
		onselect?: (selection: DomainSelection) => void;
		onskillselect?: (row: SkillHexRow) => void;
		onleavelevel?: () => void;
		/**
		 * Injected only by tests. In a browser this follows the media query, but
		 * jsdom has no real one and §15.5's "instant, not faster" is exactly the
		 * behaviour worth asserting, so it has to be reachable.
		 */
		reducedMotion?: boolean;
	}

	let {
		manifest,
		domainScores,
		level,
		viewport,
		skills = [],
		selectedSkill = null,
		onselect,
		onskillselect,
		onleavelevel,
		reducedMotion
	}: Props = $props();

	/**
	 * **U-10 — the threshold is the camera level, not the viewport** (§8.1, T31).
	 *
	 * ARCH §10.7 substituted a list below a width, so a phone visitor never saw
	 * the map at all. The Curious Browser is disproportionately on a phone and the
	 * map is the entire reason they might care, so the threshold was in the wrong
	 * place. Eight labelled regions genuinely do fit a phone; *skill hexes* are
	 * where labels stop being legible and 44×44 px touch targets stop fitting.
	 *
	 * So level 0 is a map on every viewport, and only level 1 substitutes — and
	 * what it substitutes is the **skill** list, not the region list. The width
	 * measurement is unchanged; only what it decides has moved.
	 */
	const substituteList = $derived(level.level === 1 && viewport === 'list');

	const domainTitle = $derived(
		level.level === 0
			? ''
			: (manifest.taxonomy.domains.find((entry) => entry.id === level.domain)?.title ??
				level.domain)
	);

	const world = $derived({
		regions: manifest.taxonomy.map.regions.map((region) => ({
			domain: region.domain,
			bounds: regionBounds(region)
		}))
	});

	/** Where the camera should come to rest for the level the route is at. */
	const target = $derived(fit(level, world));

	/**
	 * The box actually drawn. It starts *at* the target — the resting frame, no
	 * animation — and is only ever moved by the fly below.
	 *
	 * `untrack` because capturing the initial value is exactly the intent: this
	 * is the frame the map paints on load, and re-deriving it would make the
	 * camera follow the target instead of flying to it.
	 */
	let current = $state<ViewBox>(untrack(() => fit(level, world)));

	function prefersReducedMotion(): boolean {
		if (reducedMotion !== undefined) return reducedMotion;
		if (typeof matchMedia !== 'function') return false;
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	let frame = 0;
	let previousKey = untrack(() => levelKey(level));

	function levelKey(value: CameraLevel): string {
		return value.level === 0 ? 'world' : `d/${value.domain}`;
	}

	/**
	 * The fly. It runs only when the *level* changes, never when a score does — a
	 * water line moving is §10.5's own 200 ms CSS transition and must not drag the
	 * camera with it.
	 *
	 * Under `prefers-reduced-motion: reduce` this jumps. §15.5's requirement is
	 * "instant", not "shorter": a 420 ms fly run at 100 ms is still motion, and
	 * nothing here is conveyed by the motion, so losing it costs nothing.
	 */
	$effect(() => {
		const key = levelKey(level);
		const to = target;
		if (key === previousKey) {
			// Same level, new geometry (the manifest landed). Snap: there is no
			// journey between "no map" and "the map".
			current = to;
			return;
		}
		previousKey = key;

		if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
			current = to;
			return;
		}

		const from = current;
		const started = performance.now();
		cancelAnimationFrame(frame);

		const step = (now: number): void => {
			const t = Math.min(1, (now - started) / FLY_MS);
			current = interpolate(from, to, t);
			if (t < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);

		return () => cancelAnimationFrame(frame);
	});

	/**
	 * §8.2 — camera transitions are **announced**, not just animated. A reader who
	 * cannot see the fly still needs to know where the camera went, and the count
	 * of published skills is the one channel that is not already on the region at
	 * level 0.
	 */
	let announcement = $state('');

	$effect(() => {
		if (level.level === 0) {
			announcement = '';
			return;
		}
		const domain = manifest.taxonomy.domains.find((entry) => entry.id === level.domain);
		const score = domainScores.get(level.domain);
		if (domain === undefined || score === undefined) return;

		announcement = domainEntryAnnouncement(
			domain.title,
			score,
			manifest.trees.filter((tree) => tree.domain === level.domain).length,
			isFogged(manifest, level.domain)
		);
	});
</script>

<div class="map-surface" data-map-surface data-level={level.level}>
	{#if substituteList}
		{#await domainSkillList() then list}
			<list.default rows={skills} {domainTitle} onselect={onskillselect} />
		{/await}
	{:else}
		<!--
			`viewport="map"` unconditionally: U-10 moved the substitution above, and
			passing the measured value through would reinstate the level-0 list this
			task exists to remove. `MapRenderer` keeps the prop because its region
			list is still §15.3's documented order made visible, and the a11y suite
			compares the two orders against each other through it.
		-->
		<MapRenderer
			{manifest}
			{domainScores}
			viewport="map"
			{level}
			view={current}
			{skills}
			{selectedSkill}
			{onselect}
			{onskillselect}
			{onleavelevel}
		/>
	{/if}

	<!--
		Polite, and the map's own: §15.2 reserves "one shared live region" for the
		tree, and forbids the *app* an assertive one. This states where the camera
		went without taking the reader's place.
	-->
	<p class="visually-hidden" role="status" aria-live="polite" data-map-announcement>
		{announcement}
	</p>
</div>

<style>
	.map-surface {
		position: relative;
	}

	/*
	 * The map takes the height the sidebar gave it back (§6.1). `svh` rather than
	 * `vh` so a phone's collapsing browser chrome does not crop the world.
	 */
	.map-surface :global(.world-map) {
		display: block;
		width: 100%;
		max-block-size: 88svh;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
</style>
