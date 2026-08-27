<script lang="ts">
	/**
	 * The same skill page, arriving with §7.1's guided tour running.
	 *
	 * The only thing this route adds is that one flag — duplicating a page to
	 * vary one prop is how the two drift, which is the reason `/s/<treeId>` and
	 * `/s/<treeId>/m/<slug>` already share this component.
	 */
	import SkillPage from '../SkillPage.svelte';
	import type { SkillPageData } from '../+page.js';

	let { data }: { data: SkillPageData } = $props();
</script>

<SkillPage {data} preview />
