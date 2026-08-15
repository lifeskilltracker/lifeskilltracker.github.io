/**
 * The `ORPHAN` store's write side, and the boundary that keeps it out of scoring
 * (§12.5, §12.2) — T17.
 *
 * T09 created the store and its shape; this module is the only code that puts
 * rows into it. Everything else reads: §12.6's export always carries orphans,
 * and `/data` lists them under "retired achievements".
 *
 * **Orphans never score, and the guarantee is structural rather than tested.**
 * `lib/scoring` takes `TreeProgress` (§14.4), which `progressFor` builds from
 * `MILESTONE` rows alone — so an orphan cannot reach the engine even by
 * accident, because there is no path along which it could arrive. `grep -rn
 * "orphan" app/src/lib/scoring` returning nothing is the check, and it stays
 * true only as long as this conversion is one-way: a record becomes an orphan,
 * never the reverse.
 *
 * **The conversion drops the slug and keeps everything else.** §12.2's `ORPHAN`
 * has no `slug` field on purpose — a slug is a live reference into a tree, and
 * an orphan is exactly the milestone that is no longer in one, so keeping it
 * would put a dead `/s/<treeId>/m/<slug>` link in the retired list. Title,
 * state, timestamp and note all survive, which is §12.5's Forge lesson: the pass
 * must carry everything attached to a milestone, not just the completion flag.
 */

import type { MilestoneRecord, OrphanRecord } from './types.js';
import type { OrphanReason } from './lineage-types.js';

export function toOrphan(record: MilestoneRecord, reason: OrphanReason): OrphanRecord {
  return {
    uid: record.uid,
    treeId: record.treeId,
    // The frozen snapshot (§12.2), never a title looked up in the current
    // bundle: the milestone this describes is gone from it.
    title: record.title,
    state: record.state,
    at: record.at,
    ...(record.note === undefined ? {} : { note: record.note }),
    reason,
  };
}
