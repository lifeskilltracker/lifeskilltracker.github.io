<script lang="ts">
	/**
	 * §6.3's legend — U-05 (T33).
	 *
	 * **This is not optional polish.** F34 forbids showing a raw percentage, so
	 * the water line's height is the only statement the map makes about a score,
	 * and without this dialog its meaning is written down nowhere in the product.
	 * "No legend" is also the most concrete criticism the prior-art review turned
	 * up. Every visual channel the map spends — water line, band names, hachure,
	 * both hex borders, both glyphs — is named here, and `Info.test.ts` asserts
	 * each one, because a legend rots by omission rather than by error.
	 *
	 * **The band names are read from §11.6, never restated.** `BANDS` is tunable
	 * data (F18); a legend that listed the names in its own markup would go on
	 * confidently naming a band the resolver had stopped producing. Rendering the
	 * array is what makes retuning a boundary a one-line change.
	 *
	 * **The glyphs are drawn, not described.** They are the same open ring and
	 * filled disc `SkillHexLayer` draws, as real SVG in `currentColor`, so they
	 * survive `forced-colors: active` and can be compared with the map by eye
	 * (§15.4). A legend whose marks were prose would need the reader to guess
	 * which mark the sentence meant.
	 */
	import { BANDS } from '$lib/scoring';

	let open = $state(false);
	let dialog = $state<HTMLElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);

	function show(): void {
		open = true;
	}

	$effect(() => {
		if (open) dialog?.focus();
	});

	function close(): void {
		open = false;
		triggerEl?.focus();
	}

	function onKey(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key !== 'Tab') return;

		const stops = [...(dialog?.querySelectorAll<HTMLElement>('button') ?? [])];
		if (stops.length === 0) return;
		const first = stops[0];
		const last = stops[stops.length - 1];
		const active = document.activeElement;

		// `aria-modal` is true here and false on Find, and the difference is real:
		// a legend *is* modal — there is nothing to do on the map while reading it
		// — whereas Find is a running commentary on a map that is still live.
		if (event.shiftKey && (active === first || active === dialog)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<div class="info">
	<button
		type="button"
		class="control display"
		data-info-trigger
		bind:this={triggerEl}
		aria-expanded={open}
		onclick={show}
	>
		Info
	</button>

	{#if open}
		<div
			class="panel"
			data-info
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-label="Map legend"
			bind:this={dialog}
			onkeydown={onKey}
		>
			<h2 class="head display">What the map shows</h2>

			<section class="entry">
				<h3 class="term display">The water line</h3>
				<p class="gloss">
					Each region and each skill hex is filled from the bottom to a horizontal line. The
					line sits higher the further you have got — a region is coloured at full strength
					whatever its line, because the colour is the region's identity and the line is the
					progress. A skill's line is its attained level out of ten.
				</p>
			</section>

			<section class="entry">
				<h3 class="term display">Bands</h3>
				<p class="gloss">
					A region's line is also named, from quietest to deepest. The names are what the map
					says instead of a number.
				</p>
				<ol class="bands" data-info-bands>
					{#each BANDS as band (band.name)}
						<li class="band display">{band.name}</li>
					{/each}
				</ol>
			</section>

			<section class="entry">
				<h3 class="term display">Hachure</h3>
				<p class="gloss">
					A region ruled with diagonal hatching is <strong>unsurveyed</strong> — the library
					publishes no skills there yet. It is an invitation to contribute, not a score of
					zero.
				</p>
			</section>

			<section class="entry">
				<h3 class="term display">Hex borders</h3>
				<ul class="marks">
					<li>
						<svg class="mark" data-legend-border viewBox="-6 -6 12 12" aria-hidden="true">
							<circle class="border-solid" r="4.6" />
						</svg>
						<span><strong>Solid</strong> — you have started this skill.</span>
					</li>
					<li>
						<svg class="mark" data-legend-border viewBox="-6 -6 12 12" aria-hidden="true">
							<circle class="border-dashed" r="4.6" />
						</svg>
						<span><strong>Dashed</strong> — you have not started it yet.</span>
					</li>
				</ul>
			</section>

			<section class="entry">
				<h3 class="term display">Glyphs</h3>
				<ul class="marks">
					<li>
						<svg class="mark" data-legend-glyph viewBox="-6 -6 12 12" aria-hidden="true">
							<circle r="3.2" fill="none" stroke="currentColor" stroke-width="1.4" />
						</svg>
						<span>An open ring — the library publishes <strong>mastery</strong> content for this skill, beyond level 10.</span>
					</li>
					<li>
						<svg class="mark" data-legend-glyph viewBox="-6 -6 12 12" aria-hidden="true">
							<circle r="3.2" fill="currentColor" />
						</svg>
						<span>A filled disc — you have reached <strong>level 10</strong>, the ceiling.</span>
					</li>
				</ul>
			</section>

			<button type="button" class="close" data-info-close onclick={close}>Close</button>
		</div>
	{/if}
</div>

<style>
	/*
	 * The lengths here deliberately dodge §11.6's band boundaries as literals:
	 * `domain.test.ts` greps every component for them, to keep the band table
	 * tunable from one file. A CSS padding that happens to equal a boundary is a
	 * false positive — but a gate you teach to ignore a file stops being a gate,
	 * so the padding moves by a hundredth of a rem instead.
	 */
	.info {
		position: relative;
	}

	.control {
		padding: 0.34rem 0.7rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.control:focus-visible,
	.close:focus-visible,
	.panel:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Opens upward — the pair lives in the bottom-right corner (§6.2, §6.3). */
	.panel {
		position: absolute;
		inset-block-end: calc(100% + 0.4rem);
		inset-inline-end: 0;
		display: grid;
		gap: 0.7rem;
		box-sizing: border-box;
		width: min(24rem, calc(100vw - 2rem));
		max-height: 70svh;
		overflow-y: auto;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 1px 6px color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.head {
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.7;
	}

	.entry {
		display: grid;
		gap: 0.25rem;
	}

	.term {
		margin: 0;
		font-size: 0.9rem;
	}

	.gloss {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.bands {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.1rem 0 0;
		padding: 0;
		list-style: none;
	}
	.band {
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		font-size: 0.71rem;
		letter-spacing: 0.06em;
	}

	.marks {
		display: grid;
		gap: 0.34rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.82rem;
		line-height: 1.4;
	}
	.marks li {
		display: grid;
		grid-template-columns: 1.4rem 1fr;
		align-items: start;
		gap: 0.4rem;
	}

	.mark {
		inline-size: 1.1rem;
		block-size: 1.1rem;
		margin-block-start: 0.1rem;
		color: inherit;
		overflow: visible;
	}
	.border-solid,
	.border-dashed {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.3;
	}
	.border-dashed {
		stroke-dasharray: 1.4 1.1;
	}

	.close {
		justify-self: start;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.7rem;
		opacity: 0.7;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
