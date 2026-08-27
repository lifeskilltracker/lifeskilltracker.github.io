<script lang="ts">
	/**
	 * §7.1's guided preview, as it appears (PRD D25, UI-SPEC §12 Q4).
	 *
	 * Presentational: it states what the visitor is looking at and names the three
	 * rungs. The camera is driven by `SkillPage`, which owns the tree.
	 *
	 * **The tree behind this is real, unstarted, and fully live.** No progress is
	 * fabricated and no data path changes — which is why the bar can say "tick
	 * anything and it starts tracking for real" and have it be true. That sentence
	 * is the conversion, and a preview that lied about it would have to be
	 * unwound at exactly the moment the visitor decided to trust the product.
	 *
	 * **The rungs are text, always.** Under `prefers-reduced-motion` there is no
	 * camera movement at all, so if the annotations lived on the moving view they
	 * would simply be gone — §15.5's rule is that removing all motion loses
	 * nothing, and this list is how that stays true.
	 */
	import type { PreviewAnnotation } from '$lib/actions/preview.js';

	interface Props {
		skillTitle: string;
		annotations: readonly PreviewAnnotation[];
		/** The rung the camera is holding, or `null` when nothing is gliding. */
		activeLevel: number | null;
		onexit: () => void;
	}

	let { skillTitle, annotations, activeLevel, onexit }: Props = $props();
</script>

<aside class="preview" data-preview-tour aria-label="Guided look at {skillTitle}">
	<p class="lede">
		A guided look at <strong>{skillTitle}</strong>. Nothing here is saved — tick anything and it
		starts tracking for real.
	</p>

	{#if annotations.length > 0}
		<!--
			An ordered list because the rungs *are* ordered, and the order is the
			whole point: this is what a ladder from "level 1" to "level 10" actually
			contains in this skill. §15.3's structure rule — a device that encodes
			something true rather than decorating.
		-->
		<ol class="rungs">
			{#each annotations as annotation (annotation.level)}
				<li
					class="rung"
					data-rung={annotation.level}
					data-active={activeLevel === annotation.level}
					aria-current={activeLevel === annotation.level ? 'step' : undefined}
				>
					<span class="level display">Level {annotation.level}</span>
					<span class="what">{annotation.title}</span>
				</li>
			{/each}
		</ol>
	{/if}

	<button type="button" class="exit display" data-preview-exit onclick={onexit}>
		Back to the map
	</button>
</aside>

<style>
	.preview {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.15rem;
		margin-block-end: 1rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
	}

	.lede {
		margin: 0;
		max-inline-size: 60ch;
	}

	.rungs {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: none;
	}

	.rung {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.3rem 0.5rem;
		border-inline-start: 3px solid transparent;
	}

	/*
	 * §15.4 / N5 — the active rung is marked by the rule *and* by `aria-current`,
	 * never by colour alone, and the border is a shape that survives
	 * `forced-colors: active`.
	 */
	.rung[data-active='true'] {
		border-inline-start-color: var(--ink);
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}

	.level {
		flex: 0 0 auto;
		inline-size: 5.5rem;
		font-size: 0.85rem;
	}

	.what {
		font-family: var(--font-body);
	}

	.exit {
		align-self: flex-start;
		font-size: 0.9rem;
		padding: 0.45rem 0.9rem;
		border: 1px solid var(--ink);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.exit:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		/*
		 * Nothing to disable here — the tour's motion is the camera, which
		 * `SkillPage` does not start under this query at all. Stated so the
		 * absence reads as a decision (§15.5).
		 */
		.rung {
			transition: none;
		}
	}
</style>
