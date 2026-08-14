<script lang="ts">
	/**
	 * `/s/<treeId>` — the tree view with no panel open (§13.1).
	 *
	 * The body is `SkillPage.svelte` beside this file, shared with
	 * `/s/<treeId>/m/<slug>`: the two routes differ only in which milestone panel
	 * starts open, and duplicating a page to vary one prop is how the two drift.
	 */
	import SkillPage from './SkillPage.svelte';
	import type { SkillPageData } from './+page.js';

	let { data }: { data: SkillPageData } = $props();
</script>

<SkillPage {data} />
