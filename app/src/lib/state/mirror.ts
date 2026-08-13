/**
 * The shared mirror rebuild (§13.2, T26/F23).
 *
 * **Every writer calls this on commit, not only §12.4's.** T16's `import` and
 * T17's `applyLineage` / `applyMoves` must import this helper rather than
 * duplicating the logic: nothing in the task graph expresses "these three
 * implement one invariant", and the failure is silent — stale progress on the
 * first paint after a migration.
 *
 * It runs *after* the transaction resolves. Reactive state updating before the
 * commit would mean an optimistic UI displaying a completion the write then
 * failed to persist, which is lying about the one thing that must not be lied
 * about (§12.4).
 */

import type { Database } from './db.js';
import { STORES } from './db.js';
import { progress } from './progress.svelte.js';
import type { MilestoneRecord, OrphanRecord, SkillRecord } from './types.js';

function byKey<T, K extends keyof T>(rows: T[], key: K): Record<string, T> {
  const out: Record<string, T> = {};
  for (const row of rows) out[String(row[key])] = row;
  return out;
}

export async function refreshProgressMirror(db: Database): Promise<void> {
  const [skills, milestones, orphans] = await Promise.all([
    db.getAll(STORES.skill) as Promise<SkillRecord[]>,
    db.getAll(STORES.milestone) as Promise<MilestoneRecord[]>,
    db.getAll(STORES.orphan) as Promise<OrphanRecord[]>,
  ]);

  progress.replace({
    skills: byKey(skills, 'treeId'),
    milestones: byKey(milestones, 'uid'),
    orphans: byKey(orphans, 'uid'),
  });
}
