export type {
  Tree,
  DomainsFile,
  FacetsFile,
  MapFile,
  ExportFileDocument,
} from './authored.js';
export type {
  CompiledTree,
  // The pieces of a bundle its consumers address directly: the Layout Engine
  // (§8) walks the flat milestone index and its slug refs.
  CompiledLevel,
  CompiledMilestone,
  // §9.6 renders mastery in its own panel, outside the grid (§5.7).
  MasteryEntry,
  MilestoneRef,
  RequirementGroup,
  // §5.4's ledger, retained verbatim by the compiler (§7.3) and consumed by
  // §12.5's migration pass (T17).
  LineageEntry,
  Manifest,
  // §10.5's renderer addresses one region at a time: it walks the taxonomy's
  // domain order and looks the geometry up, so the region type is part of the
  // surface even though `Manifest` already contains it (T13).
  CompiledMapRegion,
  // §5.9's locked domain ids (F20). T14 prerenders one `/d/<domainId>` per
  // member, so the union has a runtime counterpart in `lib/content/domains.ts`.
  ContentDomainId,
  // §5.9 / A7's taxonomy entry. `lib/styles` injects its per-theme palette as
  // `--domain-<id>`, which is the one seam between a content file and the
  // stylesheet — palettes are content and unknown at build time (D-03).
  CompiledDomain,
} from './compiled.js';
export type { Taxonomy, MovedIndex } from './aliases.js';
export type {
  DomainId,
  TierName,
  FrozenSatisfaction,
  MilestoneState,
  NodeState,
  TreeProgress,
  DomainSkillRow,
  DomainScore,
  ExportFile,
  OrphanReason,
  MigrationReport,
  ImportReport,
} from './contracts.js';
