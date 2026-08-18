/**
 * §6.4's next-step selection, and the two sidebar row shapes beside it (T32).
 *
 * **Pure, and deliberately ignorant of where its inputs came from.** The card
 * needs three things the view layer may not reach for: a manifest entry (the
 * skill's title and domain), a `SKILL` row (its `lastActivityAt`), and a scored
 * bundle (F36's available set). §14.1 gives no single module below `lib/actions`
 * the right to hold all three, so the assembly lives in `lib/actions/next-step.ts`
 * and this file takes the finished candidate list. A second producer of this row
 * is exactly the drift T26/F4 closed at the engine boundary — there is one.
 *
 * **The tie-break is not decoration.** The card re-derives on every commit to
 * §13.2's mirror, and `Object.values(progress.skills)` has whatever order
 * IndexedDB handed back. Without an explicit ascending tie-break, two skills
 * finished in the same millisecond would swap the card's contents between
 * renders that changed nothing the user did.
 *
 * **A skill with an empty available set is skipped rather than named.** The card
 * promises a concrete action; a tree whose remaining milestones are all locked or
 * dismissed has none, so the rule falls through to the next-most-recent skill.
 * That is the difference between "do this next" and an empty box.
 *
 * §12 Q3's alternative rule — nearest-to-completion rather than most-recent — is
 * deliberately NOT implemented here, not even behind a flag. Recency is what the
 * spec fixed, and two selection rules in one file is how a question that was
 * supposed to be revisited stops being asked.
 */

import type { DomainId } from '$lib/types';

/** One F36-available milestone, already resolved out of a compiled bundle. */
export interface AvailableMilestone {
  readonly uid: string;
  /** §13.1's human-facing deep-link segment. Mutable upstream; never a key. */
  readonly slug: string;
  readonly title: string;
}

/** One started skill, as the shell assembles it (`lib/actions/next-step.ts`). */
export interface NextStepCandidate {
  readonly treeId: string;
  readonly skillTitle: string;
  readonly domain: DomainId;
  /** §12.2's forward-only watermark. ISO-8601 UTC — compared as a string. */
  readonly lastActivityAt: string;
  /** F36's available set in document order, resolved to titles and slugs. */
  readonly available: readonly AvailableMilestone[];
}

/**
 * What the card names. `milestoneSlug` is an addition to the task's interface
 * sketch and is load-bearing: §6.4 requires activating the card to *open the
 * milestone*, §13.1 addresses a milestone by slug rather than uid, and the uid
 * has no route. The uid is kept alongside it because it is the stable identity —
 * a slug can be renamed between two renders and the uid cannot.
 */
export interface NextStep {
  readonly treeId: string;
  readonly skillTitle: string;
  readonly milestoneUid: string;
  readonly milestoneSlug: string;
  readonly milestoneTitle: string;
  readonly domain: DomainId;
}

/**
 * What the card is showing. `pending` is not a spinner — it is the honest state
 * between "the manifest resolved" and "the started skills' bundles have been
 * scored", and it exists so the card never renders §6.4's invitation at a
 * returning user whose progress simply has not been read yet (§13.3).
 */
export type NextStepView =
  | { readonly kind: 'pending' }
  | { readonly kind: 'invitation' }
  | { readonly kind: 'step'; readonly step: NextStep };

/**
 * Most recent activity first; ties by tree id, ascending.
 *
 * Lexicographic on purpose. §12.2 fixes every stamp as `toISOString()`'s
 * `YYYY-MM-DDTHH:MM:SS.sssZ`, and `lib/scoring/domain.ts` asserts that format at
 * the one boundary where an imported file could break it — so parsing a `Date`
 * here would buy nothing and cost a timezone bug.
 */
function byRecencyThenId(a: NextStepCandidate, b: NextStepCandidate): number {
  if (a.lastActivityAt !== b.lastActivityAt) return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
  if (a.treeId === b.treeId) return 0;
  return a.treeId < b.treeId ? -1 : 1;
}

/**
 * The next available milestone (F36) in the skill with the most recent activity.
 * `null` when the user has started nothing, or when nothing they started has an
 * available milestone left — the caller renders the invitation.
 */
export function selectNextStep(candidates: readonly NextStepCandidate[]): NextStep | null {
  for (const candidate of [...candidates].sort(byRecencyThenId)) {
    const milestone = candidate.available[0];
    if (milestone === undefined) continue;
    return {
      treeId: candidate.treeId,
      skillTitle: candidate.skillTitle,
      domain: candidate.domain,
      milestoneUid: milestone.uid,
      milestoneSlug: milestone.slug,
      milestoneTitle: milestone.title,
    };
  }
  return null;
}

/**
 * Sidebar block 3 — a started tree with the level the user has reached, linking
 * straight to `/s/<treeId>`. §12.3's denormalized level, so the block costs no
 * bundle fetch and is on screen with the manifest.
 */
export interface StartedSkillRow {
  readonly treeId: string;
  readonly title: string;
  readonly attainedLevel: number;
}

/**
 * Sidebar block 4 — §11.6's band **name** and the skills-started count, as text.
 *
 * There is no `fill` field and there must never be one. F34 forbids showing the
 * raw number anywhere, which is precisely why N5 needs this block: the band name
 * is the only textual form the map's water line has, and a percentage smuggled
 * in beside it would make the block the thing F34 exists to prevent.
 */
export interface DomainProgressRow {
  readonly domain: DomainId;
  /** The taxonomy's display title, so the sidebar never re-derives one. */
  readonly title: string;
  readonly band: string;
  readonly started: number;
}
