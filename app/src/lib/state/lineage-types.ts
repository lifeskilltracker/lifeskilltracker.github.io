/**
 * §12.5's migration vocabulary, as `lib/state` uses it (T17).
 *
 * `MigrationReport` and `OrphanReason` are **not redeclared here**. T26/F3 typed
 * both in §14.5 alongside `ExportFile` and `ImportReport`, and §14.6 makes
 * `lib/types` the one place a cross-subsystem contract is declared — the report
 * crosses into `lib/actions` and the routes, so a second declaration beside the
 * implementation is exactly the drift §14.7 exists to prevent. They are
 * re-exported so a reader of this module finds them where they expect to, and
 * so `store.ts` imports the migration surface from one place.
 *
 * What *is* declared here is the fold's own shape — the plan a pure pass over
 * the ledger produces, before any of it reaches IndexedDB. §12.5's dispositions
 * are arithmetic over records; keeping them expressible without a transaction is
 * what lets the twelve table cells and F14's composition property be tested as
 * arithmetic rather than as database state.
 */

import type { MigrationReport, OrphanReason } from '$lib/types';
import type { MilestoneRecord, OrphanRecord } from './types.js';

export type { MigrationReport, OrphanReason };

/** One row of `MigrationReport.entries` (§14.5). */
export type MigrationEntry = MigrationReport['entries'][number];

/** §11.5's frozen record, as it is stored on `SKILL.grandfathered` (§12.2). */
export interface FrozenSets {
  [level: number]: { uids: string[]; contentVersion: number };
}

/**
 * What the fold was handed. `records` is every `MILESTONE` row under
 * consideration; the fold filters it to this tree itself, because §12.5's
 * working set is defined per-tree and a `moved` disposition takes a record out
 * of it by rewriting `treeId` rather than by deleting anything.
 */
export interface FoldState {
  readonly records: readonly MilestoneRecord[];
  readonly grandfathered: Readonly<FrozenSets>;
}

/**
 * The writes one fold implies, and nothing else. Note that an orphaned record
 * appears in **both** `orphans` and `deletes`: §12.5 forbids silent deletion,
 * and the pairing inside one transaction is what makes the deletion not silent.
 */
export interface FoldResult {
  /** `MILESTONE` rows to write — new successors, and records that changed tree. */
  readonly puts: readonly MilestoneRecord[];
  /** `MILESTONE` uids to remove — consumed predecessors and orphaned records. */
  readonly deletes: readonly string[];
  readonly orphans: readonly OrphanRecord[];
  readonly grandfathered: FrozenSets;
  readonly entries: readonly MigrationEntry[];
  /** R-16's accepted loss occurred somewhere in this pass (§12.5). */
  readonly partialMerge: boolean;
  /**
   * A record or a frozen set actually mutated — never "entries were evaluated"
   * (§14.5). §12.6's forced replay walks the whole ledger and usually changes
   * nothing, and a twelve-skill import must not produce twelve summaries.
   */
  readonly changed: boolean;
}

/** A ledger the compiler should never have emitted (T26/F21). */
export class LineageGrammarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LineageGrammarError';
  }
}

/** The report a pass that did nothing returns — no summary is shown for it. */
export function emptyReport(
  treeId: string,
  fromVersion: number,
  toVersion: number,
  attainedLevel: number,
): MigrationReport {
  return {
    treeId,
    fromVersion,
    toVersion,
    changed: false,
    entries: [],
    partialMerge: false,
    attainedLevel: { before: attainedLevel, after: attainedLevel },
  };
}
