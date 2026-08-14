<script lang="ts">
	/**
	 * `/s/<treeId>/m/<slug>` — the same skill page, arriving with a panel open.
	 *
	 * The only thing this route adds is *which* panel, and what to say when the
	 * slug named none (§13.1).
	 */
	import SkillPage from '../../SkillPage.svelte';
	import type { MilestonePageData } from './+page.js';

	let { data }: { data: MilestonePageData } = $props();

	let notice = $derived(
		data.page.tree === null || data.uid !== null
			? null
			: `This link points at “${data.slug}”, which is no longer part of this skill. The skill itself is below.`
	);
</script>

<SkillPage data={data.page} openUid={data.uid} {notice} />
