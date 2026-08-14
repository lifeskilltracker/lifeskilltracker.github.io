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
  Manifest,
  // §10.5's renderer addresses one region at a time: it walks the taxonomy's
  // domain order and looks the geometry up, so the region type is part of the
  // surface even though `Manifest` already contains it (T13).
  CompiledMapRegion,
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
