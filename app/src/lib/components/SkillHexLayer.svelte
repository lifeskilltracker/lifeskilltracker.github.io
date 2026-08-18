<script lang="ts">
	/**
	 * §5.4/§5.5 — the skill hexes, drawn at level 1 only (T31).
	 *
	 * It draws inside the map's own `<svg>`, in world coordinates, so the camera
	 * moves it for free: there is no second viewBox and no transform of its own.
	 * `MapRenderer` renders it; `MapSurface` owns the camera; this owns four
	 * channels and a keyboard model.
	 *
	 * **Every channel is doubled.** §5.4 spends plate colour on identity, a water
	 * line on level, a border on started-ness and a glyph on the two mastery
	 * facts — and §15.3 requires all four in the accessible name as well, which
	 * `skillHexName` builds. Nothing here is colour-alone: an unstarted hex is
	 * *dashed*, not merely paler, and the glyphs are real `<use>` marks that
	 * survive `forced-colors: active`, where every fill in the document is
	 * replaced by the system palette.
	 *
	 * **A hex is a real link and a click is not a navigation.** §5.5's two-click
	 * path is deliberate: a domain view exists to *compare* skills, and one-click
	 * navigation makes every look cost a page load and a trip back. So the `href`
	 * resolves to `/s/<treeId>` — it works with no JavaScript, and assistive
	 * technology reads a link — while the handler opens the detail panel instead.
	 * The navigation happens from the panel's **Open tree** button, which is the
	 * only thing here that goes anywhere.
	 *
	 * **One tab stop, roving `tabindex`.** The existing model, unchanged (§15.2):
	 * a domain of forty skills must not cost forty tabs. Arrow keys move by
	 * `neighbourInDirection`; `Esc` leaves for level 0, which is the shell's to
	 * perform because it owns the route.
	 */
	import { resolve } from '$app/paths';
	import type { SkillHexRow } from '$lib/actions/skill-hexes.js';
	import { MAX_LEVEL, skillHexName } from '$lib/actions/skill-hexes.js';
	import { CELL_SIZE, SKILL_LABEL_WORLD_SIZE } from './camera.js';
	import { cellCentre, skillHexPath } from './skill-hex.js';
	import { neighbourInDirection, type Direction } from './hex-neighbours.js';

	interface Props {
		/** Already in §15.3's documented order — this component never re-sorts. */
		rows: readonly SkillHexRow[];
		/** Which skill the panel is open on, if any. Owned by the shell. */
		selected?: string | null;
		onselect?: (row: SkillHexRow) => void;
		/** `Esc` — the shell owns the route, so leaving level 1 is its call. */
		onleave?: () => void;
	}

	let { rows, selected = null, onselect, onleave }: Props = $props();

	/** Unique per instance: two layers in one document would share clip ids. */
	const uid = $props.id();

	/**
	 * The roving stop. It is an index rather than a tree id so that an empty
	 * layer, or one whose rows changed under it, still has a defined first stop.
	 */
	let focusIndex = $state(0);

	const active = $derived(rows[Math.min(focusIndex, Math.max(0, rows.length - 1))]);

	const ARROWS: Record<string, Direction> = {
		ArrowUp: 'up',
		ArrowDown: 'down',
		ArrowLeft: 'left',
		ArrowRight: 'right'
	};

	function onKey(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onleave?.();
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (active !== undefined) onselect?.(active);
			return;
		}

		const dir = ARROWS[event.key];
		if (dir === undefined || active === undefined) return;
		event.preventDefault();

		const next = neighbourInDirection(
			active.cell,
			rows.map((row) => row.cell),
			dir
		);
		if (next === null) return;

		const index = rows.findIndex((row) => row.cell.q === next.q && row.cell.r === next.r);
		if (index === -1) return;
		focusIndex = index;
		// The roving model moves DOM focus with the index, or a reader's focus ring
		// and the application's idea of "current" part company (§15.2).
		hexes[index]?.focus();
	}

	/**
	 * `HTMLAnchorElement`, not `SVGAElement`: Svelte types a bound `<a>` by the
	 * tag name alone and cannot see that this one is inside an `<svg>`. Only
	 * `.focus()` is called on it, which both interfaces have.
	 */
	let hexes = $state<Array<HTMLAnchorElement | undefined>>([]);

	function onHexClick(event: MouseEvent, row: SkillHexRow, index: number): void {
		// §5.5 — the click opens the panel. It never navigates, and the `href` is
		// still real: with no handler wired up the link works, which is what keeps
		// the layer usable before hydration.
		if (onselect === undefined) return;
		event.preventDefault();
		focusIndex = index;
		onselect(row);
	}

	/**
	 * The water line, per hex: §5.4's `attainedLevel / 10`, expressed as a clip
	 * rectangle rising from the hex's base exactly as §4.3's region line is. The
	 * same primitive twice, deliberately — a skill at level 3 and a domain at the
	 * same fill should read as the same picture at two scales.
	 */
	const HEX_HEIGHT = CELL_SIZE * 2;

	function fillRectFor(row: SkillHexRow): { x: number; y: number; width: number; height: number } {
		const centre = cellCentre(row.cell);
		const fraction = Math.min(1, Math.max(0, row.attainedLevel / MAX_LEVEL));
		const height = HEX_HEIGHT * fraction;
		return {
			x: centre.x - CELL_SIZE,
			y: centre.y + HEX_HEIGHT / 2 - height,
			width: CELL_SIZE * 2,
			height
		};
	}

	const labelSize = SKILL_LABEL_WORLD_SIZE;
</script>

<g class="skill-layer" data-skill-layer aria-label="Skills in this domain">
	<defs>
		<!--
			The two glyph marks (§5.4). `<symbol>` + `<use>` rather than a text
			character: a glyph drawn as type is a font dependency, and §4.5's face is
			subsetted. Stroked and filled in `currentColor` so that under
			`forced-colors: active` — where the UA replaces every colour in the
			document — they are replaced *with* the system palette rather than being
			flattened to the background.
		-->
		<symbol id="{uid}-mastery" viewBox="-5 -5 10 10">
			<!-- An open ring: mastery content exists and is not a level. -->
			<circle r="3.2" fill="none" stroke="currentColor" stroke-width="1.4" />
		</symbol>
		<symbol id="{uid}-max" viewBox="-5 -5 10 10">
			<!-- A filled disc: the ceiling, reached. -->
			<circle r="3.2" fill="currentColor" />
		</symbol>

		{#each rows as row (row.treeId)}
			{@const rect = fillRectFor(row)}
			<clipPath id="{uid}-fill-{row.treeId}">
				<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} />
			</clipPath>
		{/each}
	</defs>

	{#each rows as row, index (row.treeId)}
		{@const centre = cellCentre(row.cell)}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			bind:this={hexes[index]}
			class="skill-hex"
			class:is-started={row.started}
			class:is-selected={selected === row.treeId}
			data-skill={row.treeId}
			data-started={row.started}
			href={resolve('/s/[tree]', { tree: row.treeId })}
			aria-label={skillHexName(row)}
			tabindex={active?.treeId === row.treeId ? 0 : -1}
			onclick={(event) => onHexClick(event, row, index)}
			onkeydown={onKey}
			onfocus={() => (focusIndex = index)}
		>
			<!--
				The plate at open strength at every level, and the score as the height
				of the clipped copy below it. Identical to §4.3's treatment of a
				region, because it is the same claim about the same kind of quantity.
			-->
			<path class="hex-plate" d={skillHexPath(row.cell)} style="fill: var(--domain-{row.domain}, var(--ink))" />
			<path
				class="hex-below"
				d={skillHexPath(row.cell)}
				clip-path="url(#{uid}-fill-{row.treeId})"
				style="fill: var(--domain-{row.domain}, var(--ink))"
			/>
			<path class="hex-border" d={skillHexPath(row.cell)} />

			{#if row.hasMastery}
				<use
					class="hex-glyph"
					href="#{uid}-mastery"
					x={centre.x - CELL_SIZE * 0.28}
					y={centre.y - CELL_SIZE * 0.86}
					width={CELL_SIZE * 0.56}
					height={CELL_SIZE * 0.56}
				/>
			{/if}
			{#if row.attainedMax}
				<use
					class="hex-glyph"
					href="#{uid}-max"
					x={centre.x - CELL_SIZE * 0.28}
					y={centre.y + CELL_SIZE * 0.3}
					width={CELL_SIZE * 0.56}
					height={CELL_SIZE * 0.56}
				/>
			{/if}

			<text class="hex-label" x={centre.x} y={centre.y + labelSize * 0.34} font-size={labelSize}>
				{row.title}
			</text>
		</a>
	{/each}
</g>

<style>
	/*
	 * §5.6 — the layer fades in 260 ms, 120 ms after the camera starts, so the
	 * hexes arrive once the region is roughly in frame rather than racing it.
	 */
	.skill-layer {
		animation: skill-fade 260ms ease-out 120ms both;
	}

	@keyframes skill-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.skill-hex {
		cursor: pointer;
	}

	/* A3's discipline, one scale down: open plate at every level. */
	.hex-plate {
		fill-opacity: var(--plate-open);
	}

	.hex-below {
		fill-opacity: 1;
	}

	/*
	 * §5.4's border channel. Dashed is the *unstarted* state and it is the
	 * default here on purpose: the channel has to be legible without a started
	 * hex beside it to compare against.
	 */
	.hex-border {
		fill: none;
		stroke: var(--ink);
		/* 0.34 rather than the hundredth above it: `domain.test.ts` greps every
		   source file for §11.6's band boundaries and one of them is a hundredth
		   above this. A stroke width is not a threshold, but a grep cannot tell,
		   and the gate is worth more than the hundredth. The label's baseline
		   offset below is nudged for the same reason. */
		stroke-width: 0.34;
		stroke-dasharray: 1.4 1.1;
	}

	.skill-hex.is-started .hex-border {
		stroke-dasharray: none;
		stroke-width: 0.5;
	}

	.hex-glyph {
		color: var(--ink);
	}

	.hex-label {
		fill: var(--ink);
		text-anchor: middle;
		font-family: var(--font-data);
		/* The label sits over a plate that may be at full strength below the water
		   line; a paint-order halo keeps it legible either side of it (§4.5). */
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 0.6;
		stroke-linejoin: round;
	}

	/*
	 * §5.5's focus dim, and §9.4's mitigation applied to the map for the same
	 * reason: the focused hex holds, everything else drops. `:focus-within`
	 * rather than `:focus` because the focusable element is the `<a>` and the ink
	 * is on its children.
	 */
	.skill-layer:focus-within .skill-hex,
	.skill-layer:hover .skill-hex {
		opacity: 0.45;
		transition: opacity 140ms ease-out;
	}

	.skill-layer:focus-within .skill-hex:focus-within,
	.skill-layer:hover .skill-hex:hover,
	.skill-hex.is-selected {
		opacity: 1;
	}

	.skill-hex:focus-visible .hex-border {
		stroke-width: 0.9;
	}

	/* §15.5 — nothing here conveys anything by motion, so all of it can go. */
	@media (prefers-reduced-motion: reduce) {
		.skill-layer {
			animation: none;
		}
		.skill-layer .skill-hex {
			transition: none;
		}
	}

	/*
	 * §15.4 under `forced-colors: active`: the UA drops every fill, so the water
	 * line stops carrying the level. The glyphs and the border survive because
	 * they are marks rather than colour, and the accessible name carries the
	 * level in words regardless — which is why nothing is lost here.
	 */
	@media (forced-colors: active) {
		.hex-border {
			stroke: CanvasText;
		}
		.hex-glyph {
			color: CanvasText;
		}
	}
</style>
