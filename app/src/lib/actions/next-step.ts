/**
 * §6.4's candidate assembly — the shell's derived layer for the next-step card
 * (T32).
 *
 * **This is the only producer of that row.** The card needs three things at
 * once: a manifest entry (title, domain), a `SKILL` row (`lastActivityAt`), and
 * a scored bundle (F36's available set). §14.1 gives no module below this one
 * the right to hold all three — `lib/scoring` may not read the loader,
 * `lib/state` may not either, and components may reach neither — so the sequence
 * lives here, exactly as `domain-scores.ts` holds the manifest × `SKILL` join for
 * the map. A second assembler of this row is the drift T26/F4 closed at the
 * engine boundary, and the card and the map would disagree about what the user
 * did last.
 *
 * **It fetches bundles, and the map deliberately does not.** §3.3 requires the
 * world map to render before a single bundle is fetched, and it still does: this
 * runs after first paint, off the cold start, and the card shows §6.4's pending
 * line until it resolves. What it costs is one bundle per *started* skill, which
 * §7.4 has already pinned for offline use, and `loadTree` is memoized — so the
 * second pass over the same session is free.
 *
 * **One unreachable bundle must not take the card down.** §16.3's recurring rule
 * is that a read failure never becomes a silent success, but the failure here is
 * already surfaced by the page that needed the tree; the card's correct
 * behaviour is to select from the skills it could read rather than to vanish.
 */

import { scoreSkill } from '$lib/scoring';
import type { SkillRecord } from '$lib/state/types.js';
import type { CompiledTree, Manifest, TreeProgress } from '$lib/types';
import {
  selectNextStep,
  type NextStep,
  type NextStepCandidate,
} from '$lib/components/next-step.js';

/**
 * The two I/O halves, injected. `loadTree` is the Content Loader's and
 * `progressFor` is the User State Store's; naming them as an interface is what
 * lets the sequence be tested without a network or an IndexedDB.
 */
export interface NextStepSources {
  loadTree(treeId: string): Promise<CompiledTree>;
  progressFor(treeId: string): TreeProgress;
}

/**
 * One candidate per started skill the manifest still knows about.
 *
 * A `SKILL` row with no manifest entry is dropped, exactly as `joinDomainRows`
 * drops it (T26/F22): no manifest entry means no title and no domain, so there
 * is nothing to name. The record is untouched, and `/data` is where it is
 * reported.
 */
export async function nextStepCandidates(
  sources: NextStepSources,
  manifest: Manifest,
  skills: Record<string, SkillRecord>,
): Promise<NextStepCandidate[]> {
  const entries = new Map(manifest.trees.map((tree) => [tree.id, tree]));

  const assembled = await Promise.all(
    Object.values(skills).map(async (skill): Promise<NextStepCandidate | null> => {
      const entry = entries.get(skill.treeId);
      if (entry === undefined) return null;

      let tree: CompiledTree;
      try {
        tree = await sources.loadTree(skill.treeId);
      } catch {
        return null;
      }

      const { available } = scoreSkill(tree, sources.progressFor(skill.treeId));
      const byUid = new Map(tree.milestones.map((milestone) => [milestone.uid, milestone]));

      return {
        treeId: skill.treeId,
        skillTitle: entry.title,
        domain: entry.domain,
        lastActivityAt: skill.lastActivityAt,
        // `available` is already in document order, which is the order F36's
        // `.` shortcut promises — "the next thing", not the nearest thing.
        available: available.flatMap((uid) => {
          const milestone = byUid.get(uid);
          if (milestone === undefined) return [];
          // `id` is the slug (§5.3); `title` is the live one, not a frozen
          // snapshot, because this names something not yet done.
          return [{ uid, slug: milestone.id, title: milestone.title }];
        }),
      };
    }),
  );

  return assembled.filter((candidate): candidate is NextStepCandidate => candidate !== null);
}

/** §6.4's rule applied to those candidates. `null` renders the invitation. */
export async function assembleNextStep(
  sources: NextStepSources,
  manifest: Manifest,
  skills: Record<string, SkillRecord>,
): Promise<NextStep | null> {
  return selectNextStep(await nextStepCandidates(sources, manifest, skills));
}
