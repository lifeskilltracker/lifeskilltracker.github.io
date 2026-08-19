<script lang="ts">
	/**
	 * §6.2 and §6.3's corner — Find and Info, side by side, bottom-right (T33).
	 *
	 * **It exists to be one chunk.** §17.1's first-route budget was at 51.6 of
	 * 52.0 kB when this task started, and Find carries a matcher, a dialog and a
	 * document-level key handler while Info carries the whole legend. Neither is
	 * needed to paint the map, and a visitor who never opens either should not pay
	 * for them. The shell `import()`s this one file, so both controls, the matcher
	 * and the legend are a single chunk fetched on the first route the map is on
	 * — not on the entry graph.
	 *
	 * It is also the one place the corner's geometry is stated. §6.4's card is
	 * bottom-left and this pair is bottom-right; two components positioning
	 * themselves independently would collide the first time either grew.
	 */
	import { searchableSkills, type SkillMirror } from '$lib/actions/searchable-skills.js';
	import type { DomainId, Manifest } from '$lib/types';
	import Find from './Find.svelte';
	import Info from './Info.svelte';
	import type { SearchResult } from './search.js';

	interface Props {
		/**
		 * The projection is built *here*, inside the chunk, rather than being
		 * handed down as rows. `searchable-skills.ts` carries a kilobyte of field
		 * classification whose only reader is a test, and deriving the rows in the
		 * shell dragged all of it onto the entry graph — 171 B over §17.1's 52 kB
		 * first-route budget. `lib/actions` is still where the manifest × `SKILL`
		 * join lives (§14.1); this only moves the *call* behind the `import()`.
		 *
		 * `null` until the cold start resolves a manifest.
		 */
		manifest: Manifest | null;
		/** §13.4 — the mirror arrives as a prop; no component reads `lib/state`. */
		skills: SkillMirror;
		/** Every keystroke, already reduced to "what the map should wear". */
		onresult?: (highlight: SearchResult | null) => void;
		/** `Enter` on the top hit's region. The shell owns the route, so it flies. */
		onfly?: (domain: DomainId) => void;
	}

	let { manifest, skills, onresult, onfly }: Props = $props();

	const rows = $derived(manifest === null ? [] : searchableSkills(manifest, skills));
</script>

<div class="map-controls" data-map-controls>
	<Info />
	<Find skills={rows} {onresult} {onfly} />
</div>

<style>
	/*
	 * Fixed rather than absolute, and offset from the corner by the same 1rem the
	 * next-step card uses, so the two corners read as a pair of shelves rather
	 * than as two unrelated widgets.
	 */
	.map-controls {
		position: fixed;
		z-index: 2;
		inset-inline-end: 1rem;
		inset-block-end: 1rem;
		display: flex;
		gap: 0.4rem;
		align-items: flex-end;
	}
</style>
