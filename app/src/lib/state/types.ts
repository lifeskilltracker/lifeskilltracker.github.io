/**
 * The record shapes of §12.2's object stores.
 *
 * Two properties of that diagram are load-bearing and easy to lose:
 *
 * **Incomplete is the absence of a record.** `state` is `complete` or
 * `dismissed`; there is no row for an untouched milestone. Writing one would
 * multiply the store by an order of magnitude to represent nothing.
 *
 * **`slug` and `title` are frozen snapshots**, written at completion time and
 * never refreshed. They exist so a human can read an export and understand what
 * was accomplished, so an orphaned record stays meaningful, and so there is a
 * debugging surface in a system with no telemetry. A snapshot that followed
 * upstream edits would not be a record of what the user did.
 *
 * **Every timestamp here is ISO-8601 UTC with a `Z`.** §11.7 rolls recency up as
 * a lexicographic `max` inside a pure engine, so a local-offset or
 * variable-precision value sorts wrongly with no error anywhere.
 */

import type { FrozenSatisfaction } from '$lib/types';

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface SkillRecord {
  treeId: string;
  startedAt: string;
  attainedLevel: number;
  /** Forward-only watermark. Three writers only — see §12.2. Never a max over `at`. */
  lastActivityAt: string;
  /** This tree's own authored version (§5.3). An import may lower it (§12.6). */
  contentVersionSeen: number;
  /** D-19's frozen satisfaction, per level. `{}` until a level is satisfied. */
  grandfathered: Record<number, FrozenSatisfaction>;
}

export interface MilestoneRecord {
  uid: string;
  treeId: string;
  /** Frozen at completion time. */
  slug: string;
  /** Frozen at completion time. */
  title: string;
  state: 'complete' | 'dismissed';
  at: string;
  note?: string;
  /** Provenance, not an input — nothing branches on it (§12.2, T26/F15). */
  contentVersion: number;
}

/**
 * §12.5's disposition record. **No `slug` field**, deliberately: a slug is a live
 * reference and an orphan is exactly the milestone that no longer exists, so
 * keeping one invites a dead link out of the retired-achievements list.
 */
export interface OrphanRecord {
  uid: string;
  treeId: string;
  title: string;
  state: 'complete' | 'dismissed';
  at: string;
  note?: string;
  reason: 'retired' | 'merged' | 'unknown';
}

export const LAST_EXPORT_AT_KEY = 'lastExportAt';
