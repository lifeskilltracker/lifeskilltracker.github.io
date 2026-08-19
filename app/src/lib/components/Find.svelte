<script lang="ts">
	/**
	 * §6.2's Find — U-07, and **the only filter UI in the application** (T33).
	 *
	 * **It highlights in place and does not move the camera.** That is the whole
	 * design, and it is what makes one control answer three different questions:
	 * "where is knitting", "what have I got in this area", "what is at level 3".
	 * A search that flew to its result would answer only the first, and would be
	 * the second control for a query the map can already express — out of budget
	 * by §3, which forbids a second affordance for one question.
	 *
	 * So this component reports a `SearchResult` upward on every keystroke and
	 * calls `onfly` on exactly one gesture: `Enter`. Nothing here touches a
	 * camera, a route, or the dim; the shell owns all three (§14.1).
	 *
	 * **The count is text, and visible** (§8.2). A highlight that exists only as a
	 * dim is precisely the colour-only encoding N5 forbids, and "12 skills match"
	 * is the channel that carries the filter state to a reader who cannot see it.
	 * It is one element that is both visible and `role="status"`, rather than a
	 * visible number and a duplicate hidden sentence, so the two cannot disagree.
	 *
	 * **Q5, resolved (2026-08-18): the highlight persists across camera moves.**
	 * Only `Esc` or an emptied query clears it. Find is a filter you keep on while
	 * you explore — dropping the highlight on entering a region would break
	 * "what have I got in this area" at the exact moment the reader arrives in the
	 * area. `Esc` therefore clears *before* it closes, and closing clears too, so
	 * a dimmed map can never outlive the box that dimmed it.
	 *
	 * **`Ctrl`/`Cmd`+`F` is scoped by mounting.** The handler is installed by this
	 * component, which the shell mounts only on the two routes that are the map,
	 * so the browser's own find is untouched on `/about`, `/library`, `/data` and
	 * every tree page. On the map the override is deliberate: U-07 asks for it by
	 * name, and a map is not a document you find text in.
	 */
	import type { DomainId } from '$lib/types';
	import { search, type SearchResult, type SearchableSkill } from './search.js';

	interface Props {
		/** The whole map's rows, from `lib/actions/searchable-skills.ts` (§14.1). */
		skills: readonly SearchableSkill[];
		/**
		 * Every keystroke, as the highlight the map should wear — `null` for "no
		 * filter". Find decides that rather than the shell, so the distinction
		 * between an empty box and a query matching nothing is made once, here,
		 * and travels off the first route with this chunk (§17.1).
		 */
		onresult?: (highlight: SearchResult | null) => void;
		/**
		 * `Enter` only — see the note above. It carries the top hit's **domain**,
		 * not its tree id, because the camera's unit is a region: there is no free
		 * camera (§5.1) and level 1 is as close as it comes to one skill. Resolving
		 * it here also keeps the manifest lookup off the first route (§17.1).
		 */
		onfly?: (domain: DomainId) => void;
	}

	let { skills, onresult, onfly }: Props = $props();

	let open = $state(false);
	let query = $state('');
	let dialog = $state<HTMLElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);

	const result = $derived(search(query, skills));

	/**
	 * An empty box is not a filter, and is not the same as a query that matched
	 * nothing: the first dims nothing, the second dims everything, and both are
	 * honest.
	 */
	function report(): void {
		onresult?.(query.trim() === '' ? null : result);
	}

	const count = $derived.by(() => {
		if (query.trim() === '') return '';
		const n = result.matches.size;
		if (n === 0) return 'No skills match';
		return n === 1 ? '1 skill matches' : `${n} skills match`;
	});

	function onInput(event: Event): void {
		query = (event.currentTarget as HTMLInputElement).value;
		report();
	}

	function show(): void {
		open = true;
	}

	// The input is bound after the block renders, so focus waits a microtask.
	$effect(() => {
		if (open) input?.focus();
	});

	function close(): void {
		query = '';
		report();
		open = false;
		triggerEl?.focus();
	}

	function onDialogKey(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			// Clear first, close second. A reader narrowing a query wants the box
			// back empty far more often than they want it gone.
			if (query !== '') {
				query = '';
				report();
				return;
			}
			close();
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const hit = skills.find((skill) => skill.treeId === result.top);
			if (hit !== undefined) onfly?.(hit.domain);
			return;
		}

		if (event.key === 'Tab') trap(event);
	}

	/**
	 * The trap is real focus management rather than `aria-modal`. The map behind
	 * is *not* inert — the count is a statement about it and the dim is happening
	 * on it — so telling assistive technology to ignore it would be a lie.
	 */
	function trap(event: KeyboardEvent): void {
		const stops = [...(dialog?.querySelectorAll<HTMLElement>('input, button') ?? [])];
		if (stops.length === 0) return;
		const first = stops[0];
		const last = stops[stops.length - 1];
		const active = document.activeElement;

		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function onDocumentKey(event: KeyboardEvent): void {
		if (event.key !== 'f' && event.key !== 'F') return;
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		event.preventDefault();
		if (!open) show();
		else input?.select();
	}

	$effect(() => {
		document.addEventListener('keydown', onDocumentKey);
		return () => document.removeEventListener('keydown', onDocumentKey);
	});
</script>

<div class="find">
	<button
		type="button"
		class="control display"
		data-find-trigger
		bind:this={triggerEl}
		aria-expanded={open}
		onclick={show}
	>
		Find
	</button>

	{#if open}
		<!--
			`tabindex="-1"` is the standard dialog affordance: programmatically
			focusable, never a tab stop. It is also what lets the keydown handler
			sit on the container rather than being repeated on each control.
		-->
		<div
			class="panel"
			data-find
			role="dialog"
			tabindex="-1"
			aria-label="Find skills"
			bind:this={dialog}
			onkeydown={onDialogKey}
		>
			<label class="label" for="find-input">Find a skill</label>
			<input
				id="find-input"
				type="text"
				class="input"
				data-find-input
				autocomplete="off"
				placeholder="knitting, outdoors, level 3"
				bind:this={input}
				value={query}
				oninput={onInput}
			/>
			<!--
				§8.2 — visible *and* announced, in one element. `polite`, and never
				assertive: this fires on every keystroke, and §15.2 forbids the app an
				assertive region for exactly this reason.
			-->
			<p class="count" data-find-count role="status" aria-live="polite">{count}</p>
			<button type="button" class="close" data-find-close onclick={close}>Close</button>
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
	.find {
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
	.input:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/*
	 * Above the trigger, not below it: the pair sits in the bottom-right corner
	 * and a panel opening downward would leave the viewport.
	 */
	.panel {
		position: absolute;
		inset-block-end: calc(100% + 0.4rem);
		inset-inline-end: 0;
		display: grid;
		gap: 0.3rem;
		box-sizing: border-box;
		width: 18rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 1px 6px color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.7;
	}

	.input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.34rem 0.45rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
	}

	.count {
		margin: 0;
		min-height: 1.2em;
		font-family: var(--font-data);
		font-size: 0.8rem;
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
