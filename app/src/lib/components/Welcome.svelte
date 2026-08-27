<script lang="ts">
	/**
	 * §6.5's welcome cartouche — U-12 (PRD D25, UI-SPEC §12 Q4).
	 *
	 * **The one modal in the application, and it is one on purpose.** Everything
	 * else that wants the user's attention stays in the flow of the document —
	 * §12.7's export prompt most deliberately, because a prompt people learn to
	 * close reflexively costs real data. That rule is aimed at *recurring*
	 * interruptions. This appears once in a visitor's life and never again, which
	 * is a different object, and D25's whole risk is the Curious Browser leaving
	 * without ever having looked at a ladder. A corner card would be skipped by
	 * the trained reflex that skips corner cards.
	 *
	 * **A cartouche, because a survey map already has one.** The title block ruled
	 * twice at the edge is where a real map states what it is, so the single
	 * interruption the app permits itself is also the element most native to §4.1's
	 * direction rather than a bootstrap panel dropped on top of it.
	 *
	 * **It is `role="dialog"` on a div rather than a native `<dialog>`.** The
	 * platform's modal would have brought its own focus trap, and it was the first
	 * choice; jsdom does not implement `showModal`, so a native dialogue would
	 * have made every assertion in `Welcome.test.ts` unreachable — including the
	 * two that matter most, which are about the keyboard. `Info` already
	 * establishes the hand-rolled shape, and the trap both now share lives in
	 * `focus-trap.ts` so there is one of it rather than two.
	 *
	 * **The flag is written on open** (`welcome.ts`). A visitor who navigates away
	 * with this on screen has been greeted, and greeting them again next visit is
	 * the failure §6.5 names. There is no snooze and no second chance.
	 */
	import { featuredTree, type FeaturedCandidate } from './featured.js';
	import { tabTarget } from './focus-trap.js';
	import { markWelcomed } from './welcome.js';

	interface Props {
		/**
		 * The library, as the manifest lists it. The cartouche chooses its own
		 * skill from this rather than being handed one, which is what keeps
		 * `featured.js` off the map's first paint (§17.1) — the shell does not need
		 * to know how the choice is made, only where to go once it is.
		 *
		 * Empty is a real state: every domain fogged (§4.4). The dialogue then
		 * drops to its second button rather than promising a skill that does not
		 * exist.
		 */
		trees: readonly FeaturedCandidate[];
		onpreview: (treeId: string) => void;
		onclose: () => void;
	}

	let { trees, onpreview, onclose }: Props = $props();

	let featured = $derived(featuredTree(trees));

	let panel = $state<HTMLElement | null>(null);

	/**
	 * Focus the dialogue itself rather than its first button, so a screen reader
	 * hears the label and the prose before it hears a control — this visitor has
	 * no idea yet what the application is, and "Show me Cooking" announced cold
	 * answers a question nobody has asked.
	 */
	$effect(() => {
		panel?.focus();
	});

	$effect(() => {
		markWelcomed();
	});

	function onkeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key !== 'Tab') return;

		const target = tabTarget(panel, document.activeElement, event.shiftKey);
		if (target === null) return;
		event.preventDefault();
		target.focus();
	}
</script>

<!--
	The scrim is presentational and deliberately not a click target. Dismissing a
	once-ever dialogue by a stray click on the backdrop is how a visitor loses it
	without ever reading it, and it can never be brought back.
-->
<div class="scrim" data-welcome-scrim aria-hidden="true"></div>

<div
	class="cartouche"
	data-welcome
	role="dialog"
	tabindex="-1"
	aria-modal="true"
	aria-labelledby="welcome-title"
	bind:this={panel}
	{onkeydown}
>
	<p class="rosette" aria-hidden="true">✳</p>

	<h2 class="head display" id="welcome-title">A survey of what you can do</h2>

	<p class="gloss">
		Each region is a domain of everyday skill. The colour says which domain it is — never how
		well you are doing. That is the ruled line across it, and yours are all still at the shore.
	</p>

	<div class="actions">
		{#if featured !== null}
			<button
				type="button"
				class="control display primary"
				data-welcome-preview
				onclick={() => onpreview(featured.id)}
			>
				Show me {featured.title}
			</button>
		{/if}
		<button type="button" class="control display" data-welcome-dismiss onclick={onclose}>
			Explore the map
		</button>
	</div>

	<p class="fine">Nothing is saved unless you ask for it.</p>
</div>

<style>
	/*
	 * §4.1's ground and ink throughout — every value here is a token. The one
	 * shape decision is the double rule, which is what makes this a cartouche
	 * rather than a card, and it costs an inset shadow rather than a second
	 * element.
	 */
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 10;
		background: color-mix(in srgb, var(--ink) 34%, transparent);
	}

	.cartouche {
		position: fixed;
		z-index: 11;
		inset-inline-start: 50%;
		inset-block-start: 50%;
		transform: translate(-50%, -50%);
		inline-size: min(30rem, calc(100vw - 2rem));
		box-sizing: border-box;
		padding: 1.75rem 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		text-align: center;
		background: var(--paper);
		color: var(--ink);
		border: 1px solid var(--ink);
		box-shadow:
			inset 0 0 0 0.3rem var(--paper),
			inset 0 0 0 0.36rem var(--ink),
			0 0.5rem 2rem color-mix(in srgb, var(--ink) 30%, transparent);
	}

	.rosette {
		margin: 0;
		line-height: 1;
		color: var(--ink);
		opacity: 0.5;
	}

	.head {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 500;
		text-wrap: balance;
	}

	.gloss {
		margin: 0;
		max-inline-size: 34ch;
		font-family: var(--font-body);
		/* Centred prose breaks raggedly at a fixed measure; this evens the lines. */
		text-wrap: pretty;
	}


	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}

	.control {
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--ink);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.control.primary {
		background: var(--ink);
		color: var(--paper);
	}

	/*
	 * §15.3 — a visible focus state that survives `forced-colors: active`, where
	 * the outline is one of the few things the user's own palette keeps.
	 */
	.control:focus-visible,
	.cartouche:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.fine {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.7;
	}
</style>
