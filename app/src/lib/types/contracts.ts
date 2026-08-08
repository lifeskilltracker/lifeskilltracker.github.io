import type { ExportFileDocument, FrozenSatisfaction as GeneratedFrozenSatisfaction } from './authored.js';

/** §14.4 — Scoring Engine domain vocabulary and rollups. */
export type DomainId = string;

export type TierName = 'Novice' | 'Apprentice' | 'Journeyman' | 'Expert' | 'Master';

/** §11.5 — a level's frozen satisfaction record (D-19). Authoritative shape from export.schema.json. */
export type FrozenSatisfaction = GeneratedFrozenSatisfaction;

/** One started skill joined from manifest entry × SKILL row (§14.4). */
export interface DomainSkillRow {
  readonly treeId: string;
  readonly domain: DomainId;
  readonly attainedLevel: number;
  readonly lastActivityAt: string;
}

/** One domain's three map channels (§14.4). */
export interface DomainScore {
  readonly domain: DomainId;
  readonly score: number;
  readonly fill: number;
  readonly breadth: number;
  readonly lastActivityAt: string | null;
}

/** §14.5 — export file on disk; consumer is users forever (§14.6). Authoritative shape from export.schema.json. */
export type ExportFile = ExportFileDocument;

/** §12.5 disposition reasons; more-specific wins on import (§12.6). */
export type OrphanReason = 'retired' | 'merged' | 'unknown';

/** §12.5 migration summary payload (§14.5). */
export interface MigrationReport {
  readonly treeId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly changed: boolean;
  readonly entries: ReadonlyArray<{
    readonly uid: string;
    readonly title: string;
    readonly op: 'split' | 'merged' | 'retired' | 'moved' | 'unknown';
    readonly outcome: 'rewritten' | 'orphaned' | 'unfrozen';
    readonly became: readonly string[];
  }>;
  readonly partialMerge: boolean;
  readonly attainedLevel: { readonly before: number; readonly after: number };
}

/** §12.6 import outcome summary (§14.5). */
export interface ImportReport {
  readonly mode: 'merge' | 'replace';
  readonly schemaVersionIn: number;
  readonly migrated: boolean;
  readonly skills: { readonly added: number; readonly updated: number };
  readonly milestones: { readonly added: number; readonly updated: number };
  readonly orphans: {
    readonly added: number;
    readonly updated: number;
    readonly droppedForLiveRecord: number;
  };
  readonly grandfatheredLevelsReplaced: number;
  readonly treesRewound: number;
  readonly skillsWithNoManifestEntry: number;
}
