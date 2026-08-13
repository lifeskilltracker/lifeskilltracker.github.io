/**
 * §13.2's in-memory mirror of user state.
 *
 * Filled by `hydrate()` and refreshed by **every** writer on transaction commit
 * — not only §12.4's. `applyLineage`, `applyMoves` and `import` rewrite
 * `MILESTONE` rows wholesale, and a mirror updated by the milestone write path
 * alone would be stale in precisely the moments those passes exist for.
 *
 * `hydrated` sits beside `writable` because empty maps are the right answer for
 * an unstarted tree and a lie for an unhydrated store, and the caller cannot
 * otherwise tell them apart: under §13.3's failure branch every tree would
 * render as having no completions, which is the display-side twin of the
 * "read as empty, then wrote" failure `writable` guards against.
 */

import type { MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';

class ProgressMirror {
  skills = $state<Record<string, SkillRecord>>({});
  milestones = $state<Record<string, MilestoneRecord>>({});
  orphans = $state<Record<string, OrphanRecord>>({});

  /** False until `hydrate()` resolves, and after it rejects (§13.3). */
  hydrated = $state(false);

  /** Latched false for the whole session by a hydration failure (§13.3). */
  writable = $state(true);

  replace(next: {
    skills: Record<string, SkillRecord>;
    milestones: Record<string, MilestoneRecord>;
    orphans: Record<string, OrphanRecord>;
  }): void {
    this.skills = next.skills;
    this.milestones = next.milestones;
    this.orphans = next.orphans;
  }

  /** Test seam: a fresh mirror between cases. */
  reset(): void {
    this.skills = {};
    this.milestones = {};
    this.orphans = {};
    this.hydrated = false;
    this.writable = true;
  }
}

export const progress = new ProgressMirror();
