<script lang="ts">
	/**
	 * §6.1's sidebar — the application's primary navigation (T32, A6).
	 *
	 * It replaces the top nav bar, which was spending the map's vertical extent on
	 * five links. Four blocks, and **the order is the design**: the Player opens
	 * the app a few times a week because they finished something, so their session
	 * is land → see where I am → go to the thing → tick it → leave. Block 3 is that
	 * "go to the thing" and it is the most-used control in the application; every
	 * block above it is a cost paid on every visit, which is why there are only two
	 * and both are one line tall per row.
	 *
	 * **Everything it shows arrives as props.** §14.1 keeps components out of
	 * `lib/state` and §13.4 keeps them out of the Scoring Engine, so the band names
	 * in block 4 are resolved in `lib/actions` and handed over as text. That is not
	 * ceremony: a component that resolved its own band would be a second producer
	 * of a number the map also draws, and F35's whole complaint is two views of the
	 * same progress that quietly disagree.
	 *
	 * **Block 4 is redundant with the map on purpose.** The obvious edit is to
	 * delete it as duplicated information. N5 depends on it — F34 forbids the fill
	 * percentage appearing on the map at all, so the band name and the
	 * skills-started count have nowhere else to exist as text, and a focus-only
	 * announcement would hide them from everyone not using a screen reader.
	 *
	 * **The collapsed rail keeps every accessible name.** Labels become initials
	 * for the eye and move to `aria-label` for the reader, so collapsing changes
	 * what the sidebar costs in pixels and nothing about what it exposes. Block 4
	 * is the one thing the rail drops: it is prose, it has no glyph form, and a
	 * user who collapsed the chrome asked for exactly that.
	 */
	import { resolve } from '$app/paths';
	import type { DomainProgressRow, StartedSkillRow } from './next-step.js';
	import { initSidebarCollapse, sidebarCollapse } from './sidebar-collapse.svelte.js';
	import { attainmentLabel, bandTier } from './tiers.js';

	interface Props {
		/** The domain the camera is resting on at level 1, or `null` at level 0. */
		activeDomain?: string | null;
		domains: readonly { id: string; title: string }[];
		startedSkills: readonly StartedSkillRow[];
		domainProgress: readonly DomainProgressRow[];
		/** False while — or permanently after — §13.3's hydration branch. */
		hydrated: boolean;
	}

	let { activeDomain = null, domains, startedSkills, domainProgress, hydrated }: Props = $props();

	// Browser-only by construction: `$effect` does not run during the prerender
	// pass, which is where `localStorage` does not exist (§13.3).
	$effect(() => initSidebarCollapse());

	let collapsed = $derived(sidebarCollapse.collapsed);

	/**
	 * The rail's glyph. A leading substring of the label rather than a symbol, so
	 * WCAG 2.5.3's "label in name" holds — the visible text is contained in the
	 * accessible name — and so the rail needs no icon set, no sprite, and no
	 * second source of truth for what a destination is called.
	 */
	const initial = (label: string): string => label.slice(0, 1);

	const links = [
		{ id: '/', label: 'Map' },
		{ id: '/library', label: 'Library' },
		{ id: '/data', label: 'Data' },
		{ id: '/about', label: 'About' },
		{ id: '/contribute', label: 'Contribute' }
	] as const;

	function levelLabel(level: number): string {
		return attainmentLabel(level, level <= 0 ? null : bandTier(level));
	}

	/** §11.6's breadth channel as a sentence. Zero is a word, not a digit. */
	function startedLabel(started: number): string {
		if (started === 0) return 'No skills started';
		return `${started} skill${started === 1 ? '' : 's'} started`;
	}
</script>

<div class="sidebar" data-sidebar data-collapsed={collapsed}>
	<div class="head">
		<!--
			Not a link. `Map` below already goes to `/`, and a second control to the
			same place costs every keyboard user a tab stop on every page — which is
			the budget §15.8's traversal is measured against.
		-->
		<p class="wordmark display">Life Skill Tracker</p>
		<button
			type="button"
			class="toggle"
			data-action="toggle-sidebar"
			aria-expanded={!collapsed}
			aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
			onclick={() => sidebarCollapse.toggle()}
		>
			<span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
		</button>
	</div>

	<!-- Block 1 — primary nav (§6.1). -->
	<nav data-block="nav" aria-label="Primary">
		<ul>
			{#each links as link (link.id)}
				<li>
					<a href={resolve(link.id)} aria-label={collapsed ? link.label : undefined}>
						{#if collapsed}
							<span class="glyph display" aria-hidden="true">{initial(link.label)}</span>
						{:else}{link.label}{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<!--
		Block 2 — the eight domains, and the cheapest "where am I" indicator there
		is. At level 1 the active region is marked here as well as on the map, so
		orientation survives a user who never looks at the map.
	-->
	<nav data-block="domains" aria-label="Domains">
		<ul>
			{#each domains as domain (domain.id)}
				<li>
					<a
						href={resolve('/d/[domain]', { domain: domain.id })}
						data-domain={domain.id}
						data-active={domain.id === activeDomain}
						aria-current={domain.id === activeDomain ? 'page' : undefined}
						aria-label={collapsed ? domain.title : undefined}
					>
						{#if collapsed}
							<span class="glyph display" aria-hidden="true">{initial(domain.title)}</span>
						{:else}{domain.title}{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Block 3 — why the Player opened the application (§6.1). -->
	<section data-block="skills" aria-labelledby="sidebar-skills">
		<h2 id="sidebar-skills" class="block-head display" class:visually-hidden={collapsed}>
			Your skills
		</h2>

		{#if startedSkills.length > 0}
			<ul>
				{#each startedSkills as skill (skill.treeId)}
					<li>
						<a
							href={resolve('/s/[tree]', { tree: skill.treeId })}
							data-tree={skill.treeId}
							aria-label={collapsed ? `${skill.title}, ${levelLabel(skill.attainedLevel)}` : undefined}
						>
							{#if collapsed}
								<span class="glyph display" aria-hidden="true">{initial(skill.title)}</span>
							{:else}
								<span class="skill-title">{skill.title}</span>
								<span class="standing tabular">{levelLabel(skill.attainedLevel)}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{:else if !hydrated}
			<!--
				§13.3 again: `progressFor` is total, so an unhydrated store and a
				first-time visitor both produce an empty list. Showing the invitation
				here would tell a returning Player they had started nothing.
			-->
			<p class="unknown" data-progress-unknown>
				Your progress has not been read on this device yet.
			</p>
		{:else if !collapsed}
			<!-- §6.1: an invitation, not a void. -->
			<p class="invitation" data-invitation>
				Nothing started yet. <a href={resolve('/library')}>Browse the library</a> and pick
				something you already do.
			</p>
		{/if}
	</section>

	<!--
		Block 4 — N5's numbers as text (§6.1). The rail drops it: it is prose with
		no glyph form, and the collapse is a request for less of exactly this.
	-->
	{#if !collapsed}
		<section data-block="progress" aria-labelledby="sidebar-progress">
			<h2 id="sidebar-progress" class="block-head display">Domain progress</h2>
			<ul>
				{#each domainProgress as row (row.domain)}
					<li data-domain={row.domain}>
						<span class="domain-title">{row.title}</span>
						<span class="band">{row.band}</span>
						<span class="started tabular">{startedLabel(row.started)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	/*
	 * The width comes from the shell (`--sidebar-width`), which also uses it to
	 * offset §6.4's card; the fallback is what keeps this component mountable on
	 * its own. Sticky and self-scrolling, so a long list of started skills scrolls
	 * inside the rail rather than dragging block 3 off the top of a laptop screen
	 * — which would defeat the block order this whole file is arranged around.
	 */
	.sidebar {
		position: sticky;
		top: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		box-sizing: border-box;
		width: var(--sidebar-width, 15rem);
		max-height: 100vh;
		max-height: 100dvh;
		padding: 0.75rem;
		overflow-y: auto;
		border-right: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
	}
	.sidebar[data-collapsed='true'] {
		padding: 0.75rem 0.4rem;
		gap: 0.9rem;
	}

	.head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.wordmark {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.2;
	}
	.sidebar[data-collapsed='true'] .wordmark {
		display: none;
	}
	.toggle {
		flex: none;
		min-width: 1.75rem;
		min-height: 1.75rem;
		border: 1px solid var(--rule);
		border-radius: 2px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.block-head {
		margin: 0 0 0.36rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		opacity: 0.7;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.16rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	nav a,
	[data-block='skills'] a[data-tree] {
		display: flex;
		flex-direction: column;
		padding: 0.3rem 0.4rem;
		border-radius: 2px;
		color: inherit;
		text-decoration: none;
	}
	nav a:hover,
	[data-block='skills'] a[data-tree]:hover {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	nav a:focus-visible,
	[data-block='skills'] a[data-tree]:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 1px;
	}

	/*
	 * §15.4 — the active domain is never colour alone. The rule on the inline
	 * edge and the weight change carry it where a palette does not, which is also
	 * what keeps it legible under forced-colors.
	 */
	[data-block='domains'] a[data-active='true'] {
		border-inline-start: 3px solid currentColor;
		padding-inline-start: calc(0.4rem - 3px);
		font-weight: 700;
	}

	.glyph {
		display: block;
		text-align: center;
		font-size: 0.95rem;
	}

	.standing {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	[data-block='progress'] li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 0.5rem;
		padding: 0.2rem 0.4rem;
		font-size: 0.8rem;
	}
	[data-block='progress'] .band {
		text-align: end;
		font-weight: 600;
	}
	[data-block='progress'] .started {
		grid-column: 1 / -1;
		font-size: 0.7rem;
		opacity: 0.75;
	}

	.invitation,
	.unknown {
		margin: 0;
		font-size: 0.8rem;
	}
	.unknown {
		font-style: italic;
	}

	/* Clipped, never `display: none` — a reader still needs the block's name. */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
