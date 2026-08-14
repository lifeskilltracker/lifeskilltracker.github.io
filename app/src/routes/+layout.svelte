<script lang="ts">
	/**
	 * The root layout (§13.4). Everything it does is in `Shell.svelte` beside it,
	 * which exists so the cold-start dependencies can be injected in a test —
	 * a route component may take only `data` and `children`.
	 */
	import Shell from './Shell.svelte';

	let { children } = $props();
</script>

<Shell {children} />
