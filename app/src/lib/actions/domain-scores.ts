/**
 * The manifest × `SKILL` join, and the domain scores derived from it (T26/F4).
 *
 * **This is the only layer that can hold both halves.** `lib/scoring` may not
 * import the loader and `lib/state` may not either (§14.1), so the join of "what
 * domain is this tree in" (manifest) with "how far has the user got" (`SKILL`)
 * has exactly one home, and §3.3's sequence names it. It sits in `lib/actions`
 * rather than in the map route so that `/`, `/d/<domainId>` and `/library` share
 * one implementation and no page component imports the Scoring Engine (§13.4).
 *
 * It is a pure function of its two arguments — no runes, no store reads. The
 * caller wraps it in `$derived`, which is what keeps §13.2's rule that nothing
 * derivable is ever cached in reactive state.
 *
 * **A `SKILL` row with no manifest entry is dropped from the join and deleted
 * from nothing** (T26/F22, §16.3). No `domain` means no `DomainSkillRow`, so it
 * contributes to no score and no breadth count — but the record is intact in
 * IndexedDB, and `unmatched` is what lets `/data` say so. Silently discarding it
 * *and* forgetting it existed is the failure this shape rules out.
 */

import { bandFor, domainScores, tierFor } from '$lib/scoring';
import type { SkillRecord } from '$lib/state/types.js';
import type { DomainProgressRow, StartedSkillRow } from '$lib/components/next-step.js';
import type {
	DomainId,
	DomainScore,
	DomainSkillRow,
	Manifest,
	TierName,
	Taxonomy
} from '$lib/types';

export interface WorldScores {
	/** One row per started skill that the manifest still knows about. */
	readonly rows: readonly DomainSkillRow[];
	/** Total over the taxonomy — every domain has an entry (§11.6). */
	readonly scores: ReadonlyMap<DomainId, DomainScore>;
	/** Started skills the manifest has no entry for. Retained, never deleted. */
	readonly unmatched: readonly SkillRecord[];
}

export function joinDomainRows(
	manifest: Manifest,
	skills: Record<string, SkillRecord>
): { rows: DomainSkillRow[]; unmatched: SkillRecord[] } {
	const entries = new Map(manifest.trees.map((tree) => [tree.id, tree]));

	const rows: DomainSkillRow[] = [];
	const unmatched: SkillRecord[] = [];

	for (const skill of Object.values(skills)) {
		const entry = entries.get(skill.treeId);
		if (entry === undefined) {
			unmatched.push(skill);
			continue;
		}
		rows.push({
			treeId: skill.treeId,
			domain: entry.domain,
			// §12.3's denormalized level, which is why the map can render before a
			// single bundle is fetched (§3.3, §14.4).
			attainedLevel: skill.attainedLevel,
			lastActivityAt: skill.lastActivityAt
		});
	}

	return { rows, unmatched };
}

export function worldScores(manifest: Manifest, skills: Record<string, SkillRecord>): WorldScores {
	const { rows, unmatched } = joinDomainRows(manifest, skills);
	return { rows, unmatched, scores: domainScores(manifest.taxonomy, rows) };
}

/** What a listing card shows about one started skill (§13.4, F32). */
export interface Standing {
	readonly attainedLevel: number;
	readonly tier: TierName | null;
}

/**
 * The listing's per-skill standing, off §12.3's denormalized level — no bundle,
 * so `/library` and `/d/<domainId>` cost no fetches beyond the manifest (§3.3).
 *
 * A skill with no entry here has not been started, which a caller must not
 * confuse with an unhydrated store: `progress.hydrated` is the only thing that
 * distinguishes them, and the card is given it separately (§13.3, T26/F23).
 */
/**
 * §6.1 block 3 — the started skills, most recently active first (T32).
 *
 * The same recency order the next-step card selects on, and for the same reason:
 * the Player opened the application to get back to the thing they were doing, so
 * the thing they were doing goes at the top. Ties break by tree id, ascending, so
 * the list does not reshuffle between two renders that changed nothing —
 * `Object.values(progress.skills)` has whatever order IndexedDB handed back.
 *
 * Off §12.3's denormalized level, so the whole block costs no bundle fetch and is
 * on screen as soon as the manifest is (§3.3).
 */
export function startedSkillRows(
	manifest: Manifest,
	skills: Record<string, SkillRecord>
): StartedSkillRow[] {
	const entries = new Map(manifest.trees.map((tree) => [tree.id, tree]));

	const rows: StartedSkillRow[] = [];
	for (const skill of Object.values(skills)) {
		const entry = entries.get(skill.treeId);
		// T26/F22 again: no manifest entry, no title — the record is retained and
		// reported on `/data`, not rendered here under a made-up name.
		if (entry === undefined) continue;
		rows.push({ treeId: skill.treeId, title: entry.title, attainedLevel: skill.attainedLevel });
	}

	const activity = new Map(
		Object.values(skills).map((skill) => [skill.treeId, skill.lastActivityAt])
	);
	return rows.sort((a, b) => {
		const left = activity.get(a.treeId) ?? '';
		const right = activity.get(b.treeId) ?? '';
		if (left !== right) return left < right ? 1 : -1;
		return a.treeId < b.treeId ? -1 : a.treeId > b.treeId ? 1 : 0;
	});
}

/**
 * §6.1 block 4 — §11.6's band **name** and skills-started count, as text (T32).
 *
 * It lives here rather than in the sidebar because §13.4 keeps components out of
 * the Scoring Engine: `bandFor` is the engine's presentation mapping over `fill`,
 * and a component resolving its own band would be a second reader of a number
 * F34 forbids showing at all. The row carries no `fill` — see the type.
 *
 * Total over the taxonomy, in the taxonomy's own order, because `domainScores`
 * is (§11.6) and a domain missing from this block would read as a domain that
 * does not exist.
 */
export function domainProgressRows(
	taxonomy: Taxonomy,
	scores: ReadonlyMap<DomainId, DomainScore>
): DomainProgressRow[] {
	return taxonomy.domains.map((domain) => {
		const score = scores.get(domain.id);
		return {
			domain: domain.id,
			title: domain.title,
			band: bandFor(score?.fill ?? 0),
			started: score?.breadth ?? 0
		};
	});
}

export function standings(skills: Record<string, SkillRecord>): Map<string, Standing> {
	const out = new Map<string, Standing>();
	for (const skill of Object.values(skills)) {
		out.set(skill.treeId, {
			attainedLevel: skill.attainedLevel,
			tier: tierFor(skill.attainedLevel)
		});
	}
	return out;
}
