export type DomainId =
  | 'mind'
  | 'body'
  | 'making'
  | 'home'
  | 'people'
  | 'work-money'
  | 'play'
  | 'outdoors-nature';

export type SubregionId = 'expression' | 'objects' | 'systems';

export type LineageOp = 'split' | 'merged' | 'retired' | 'moved';

export interface Milestone {
  id: string;
  uid?: string;
  title: string;
  /** Short form for the node box; the renderer falls back to `title` (T10). */
  label?: string;
  detail?: string;
  aliases?: string[];
  track?: string;
  order?: number;
  module?: string;
  requires?: string[];
}

export interface RequirementGroup {
  rule: 'all' | 'n_of' | 'any';
  n?: number;
  milestones: string[];
}

export interface AuthoredLevel {
  level: number;
  milestones: Milestone[];
  requirements?: RequirementGroup[];
}

export interface MasteryEntry {
  id: string;
  uid?: string;
  title: string;
  detail?: string;
  requires?: string[];
}

export interface LineageEntry {
  uid: string;
  op: LineageOp;
  into?: string[];
  note?: string;
}

export interface Track {
  id: string;
  title: string;
}

export interface Author {
  name: string;
  github?: string;
  /** §6.6: the original author has no role; later revisers append themselves. */
  role?: 'reviser';
  since?: string;
}

export interface Review {
  round: number;
  reviewer: string;
  date: string;
}

export interface Source {
  title: string;
  url?: string;
  adapted?: 'structure' | 'sequencing' | 'none';
}

export interface Provenance {
  authors: Author[];
  reviews?: Review[];
  sources?: Source[];
  copyleftDerived?: boolean;
}

export interface Tree {
  schemaVersion: number;
  contentVersion: number;
  id: string;
  title: string;
  summary: string;
  domain: DomainId;
  secondaryDomains?: DomainId[];
  subregion?: SubregionId;
  facets?: string[];
  archetype?: string;
  tracks?: Track[];
  provenance: Provenance;
  levels: AuthoredLevel[];
  mastery?: MasteryEntry[];
  lineage?: LineageEntry[];
}

export interface DomainsFile {
  schemaVersion: number;
  domains: Array<{
    id: DomainId;
    title: string;
    blurb?: string;
    /** §5.9, A7 — one authored pair per theme; nothing derives dark from light. */
    palette?: {
      light: { base: string; accent: string };
      dark: { base: string; accent: string };
    };
    subregions?: Array<{ id: SubregionId; title: string }>;
  }>;
}

export interface FacetsFile {
  schemaVersion: number;
  facets: Array<{ id: string; title: string; note?: string }>;
}

export type AxialTile = [number, number];

export interface MapRegion {
  domain: DomainId;
  tiles: AxialTile[];
  label?: { q: number; r: number };
  subregions?: Array<{ id: SubregionId; tiles: AxialTile[] }>;
}

export interface MapFile {
  schemaVersion: number;
  hexSize: number;
  regions: MapRegion[];
}

/** A sub-lattice cell, in its own axial coordinates at `hexSize / cellDivisor`. */
export interface Cell {
  readonly q: number;
  readonly r: number;
}

/** One committed assignment. `domain` is the tree's primary domain when it was placed. */
export interface Placement {
  tree: string;
  domain: DomainId;
  cell: Cell;
}

/**
 * `content/taxonomy/placement.yaml` (§5.3). Written by `lst compile` and never
 * hand-edited; `lst baseline` check 9 is what enforces that.
 */
export interface PlacementLedger {
  schemaVersion: number;
  /** Global and frozen at the first committed assignment (UI-SPEC Q2). */
  cellDivisor: number;
  placements: Placement[];
}

export interface LoadedTree {
  path: string;
  tree: Tree;
}

export interface MilestoneRef {
  treeId: string;
  treePath: string;
  level: number;
  milestone: Milestone;
  slug: string;
}

export interface MasteryRef {
  treeId: string;
  treePath: string;
  entry: MasteryEntry;
  slug: string;
}
