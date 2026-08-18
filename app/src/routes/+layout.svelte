<script lang="ts">
	/**
	 * The root layout (§13.4, amendment A6). Everything it does is in
	 * `Shell.svelte` beside it, which exists so the cold-start dependencies can be
	 * injected in a test — a route component may take only `data` and `children`.
	 *
	 * There is no navigation landmark here and there must not be one: A6 moves
	 * primary navigation into §6.1's sidebar, which the shell renders, and a
	 * second one in this file would be the top bar growing back.
	 *
	 * The current path is read here rather than in the shell because this is the
	 * component SvelteKit actually routes. Passing it down keeps the shell
	 * mountable without a router, which is what makes §13.3's four branches
	 * testable at all.
	 */
	import { page } from '$app/state';
	import Shell from './Shell.svelte';

	let { children } = $props();

	let pathname = $derived(page.url?.pathname || '/');
</script>

<Shell {children} {pathname} />
