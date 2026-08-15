/**
 * §12.5's cross-tree pass — `applyMoves`, at cold start, from the manifest
 * (T17, T26/F13).
 *
 * The per-tree fold in `lineage.ts` is the right shape for four of the five
 * dispositions and the wrong shape for `moved`: the entry sits in the *source*
 * tree's ledger while the record it re-homes is wanted by the *destination*
 * tree, so a user who never reopens the source tree never applies it. Worse,
 * `MILESTONE`'s primary key is the uid — a user whose record is invisible to the
 * destination tree simply re-ticks the milestone, and that write lands on the
 * same key, overwriting the original `at` and `note`. The manifest therefore
 * carries a library-wide `moved` map (§7.2) and this pass re-homes the record
 * before either tree is opened.
 *
 * **It is idempotent by construction and needs no seen-marker**: after
 * re-homing, the record's `treeId` is already the destination, so the entry no
 * longer matches.
 *
 * **It deliberately does not advance `contentVersionSeen` or recompute
 * `attainedLevel`.** Both need the source bundle, whose fetch is the entire
 * thing this pass avoids. Its reports therefore carry `fromVersion ===
 * toVersion` and `attainedLevel.before === after`, and §12.3's reconciliation on
 * the next open corrects the level — the staleness §12.3 already bounds.
 */

import type { MovedIndex } from '$lib/types';
import { STORES, type Database } from './db.js';
import type { MigrationEntry, MigrationReport } from './lineage-types.js';
import type { MilestoneRecord, SkillRecord } from './types.js';

/** One source tree's accumulated changes, before anything is written. */
interface SourcePlan {
  readonly treeId: string;
  readonly entries: MigrationEntry[];
  frozenChanged: boolean;
}

export async function applyMoves(
  handle: Database,
  moved: MovedIndex,
): Promise<readonly MigrationReport[]> {
  const uids = Object.keys(moved);
  if (uids.length === 0) return [];

  const tx = handle.transaction([STORES.milestone, STORES.skill], 'readwrite');

  try {
    const milestones = tx.objectStore(STORES.milestone);
    const skills = tx.objectStore(STORES.skill);

    // Every skill row, read once and mutated in memory. Re-reading per uid would
    // lose the previous uid's frozen-set cleanup when two moves leave the same
    // tree, because nothing is written back until the loop ends.
    const rows = new Map(
      ((await skills.getAll()) as SkillRecord[]).map((skill) => [skill.treeId, skill]),
    );

    const plans = new Map<string, SourcePlan>();
    const planFor = (treeId: string): SourcePlan => {
      const existing = plans.get(treeId);
      if (existing !== undefined) return existing;
      const plan: SourcePlan = { treeId, entries: [], frozenChanged: false };
      plans.set(treeId, plan);
      return plan;
    };

    for (const uid of uids) {
      const destination = moved[uid];
      const record = (await milestones.get(uid)) as MilestoneRecord | undefined;

      // The record follows the uid, exactly as the fold's `moved` row does:
      // state, `at` and `note` are untouched and only `treeId` changes.
      if (record !== undefined && record.treeId !== destination) {
        await milestones.put({ ...record, treeId: destination });
        planFor(record.treeId).entries.push({
          uid,
          title: record.title,
          op: 'moved',
          outcome: 'rewritten',
          became: [`${destination}/${uid}`],
        });
      }

      // The frozen sets are cleaned whichever side the record is on. §11.5
      // verifies a set by reading `progress[uid]` from *one tree's*
      // `TreeProgress`, so a uid that has moved out can never read `complete`
      // there again; leaving it makes the set permanently unverifiable and
      // silently revokes the grandfathering it exists to protect. Sweeping
      // every skill row but the destination's is also what makes a
      // half-applied pass self-correcting.
      for (const skill of rows.values()) {
        if (skill.treeId === destination) continue;
        if (!Object.values(skill.grandfathered).some((f) => f.uids.includes(uid))) continue;

        const next: SkillRecord['grandfathered'] = {};
        for (const [level, frozen] of Object.entries(skill.grandfathered)) {
          const kept = frozen.uids.filter((u) => u !== uid);
          // An emptied set is deleted: it then imposes no condition, and the
          // level stands on current evaluation alone (§12.5).
          if (kept.length > 0) next[Number(level)] = { ...frozen, uids: kept };
        }
        rows.set(skill.treeId, { ...skill, grandfathered: next });

        const plan = planFor(skill.treeId);
        plan.frozenChanged = true;
        if (!plan.entries.some((entry) => entry.uid === uid)) {
          plan.entries.push({
            uid,
            title: uid,
            op: 'moved',
            outcome: 'unfrozen',
            became: [`${destination}/${uid}`],
          });
        }
      }
    }

    for (const plan of plans.values()) {
      const skill = rows.get(plan.treeId);
      if (plan.frozenChanged && skill !== undefined) await skills.put(skill);
    }

    await tx.done;

    return [...plans.values()]
      .filter((plan) => plan.entries.length > 0)
      .map((plan) => {
        // The pass advances no tree's `contentVersionSeen`: it applies one
        // disposition drawn from the manifest rather than a tree's ledger, and
        // claiming otherwise would suppress the real migration when that tree is
        // next opened.
        const skill = rows.get(plan.treeId);
        const version = skill?.contentVersionSeen ?? 0;
        const level = skill?.attainedLevel ?? 0;
        return {
          treeId: plan.treeId,
          fromVersion: version,
          toVersion: version,
          changed: true,
          entries: plan.entries,
          partialMerge: false,
          attainedLevel: { before: level, after: level },
        };
      });
  } catch (error) {
    tx.done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      /* already settled */
    }
    throw error;
  }
}
