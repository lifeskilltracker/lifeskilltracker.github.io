import type { DomainsFile, FacetsFile, MapFile, Tree } from '../validate/types.js';
import { compileMap, type CompiledMapRegion } from './map.js';
import { bundleRelativePath } from './hash.js';
import type { CompiledTree } from './bundle.js';
import { collectMovedMap } from './bundle.js';
import { sortByAsciiUtf8 } from './sort.js';

export interface CompiledBundleOutput {
  treeId: string;
  bundle: CompiledTree;
  json: string;
  hash: string;
  relativePath: string;
}

export interface ManifestTreeEntry {
  id: string;
  contentVersion: number;
  title: string;
  summary: string;
  domain: Tree['domain'];
  secondaryDomains?: Tree['secondaryDomains'];
  subregion?: Tree['subregion'];
  facets?: string[];
  archetype?: string;
  milestoneCount: number;
  authors: string[];
  bundle: string;
}

export interface Manifest {
  schemaVersion: 1;
  generated: string;
  taxonomy: {
    domains: DomainsFile['domains'];
    facets: FacetsFile['facets'];
    map: { regions: CompiledMapRegion[] };
  };
  trees: ManifestTreeEntry[];
  moved: Record<string, string>;
}

export type NowFn = () => Date;

function countMilestones(tree: Tree): number {
  return tree.levels.reduce((total, level) => total + level.milestones.length, 0);
}

function manifestTreeEntry(tree: Tree, bundlePath: string): ManifestTreeEntry {
  const entry: ManifestTreeEntry = {
    id: tree.id,
    contentVersion: tree.contentVersion,
    title: tree.title,
    summary: tree.summary,
    domain: tree.domain,
    milestoneCount: countMilestones(tree),
    authors: tree.provenance.authors.map((author) => author.name),
    bundle: bundlePath,
  };
  if (tree.secondaryDomains) {
    entry.secondaryDomains = tree.secondaryDomains;
  }
  if (tree.subregion) {
    entry.subregion = tree.subregion;
  }
  if (tree.facets) {
    entry.facets = tree.facets;
  }
  if (tree.archetype) {
    entry.archetype = tree.archetype;
  }
  return entry;
}

export function formatGeneratedTimestamp(now: Date): string {
  return now.toISOString();
}

export interface BuiltManifest {
  manifest: Manifest;
  /** §10.4's hole warnings. Non-blocking by design — see `map.ts`. */
  warnings: string[];
}

export function buildManifest(options: {
  bundles: CompiledBundleOutput[];
  trees: Tree[];
  domains: DomainsFile;
  facets: FacetsFile;
  map: MapFile;
  now?: NowFn;
}): BuiltManifest {
  const now = (options.now ?? (() => new Date()))();
  const treeById = new Map(options.trees.map((tree) => [tree.id, tree]));
  const trees = sortByAsciiUtf8(options.bundles, (bundle) => bundle.treeId).map((bundle) =>
    manifestTreeEntry(treeById.get(bundle.treeId)!, bundle.relativePath),
  );

  // §10.4: the manifest is the only place map geometry ships. The map renders
  // "from the manifest alone with no further fetch", which is what §3.3's
  // cold-load sequence requires — a per-region fetch would violate it however
  // reasonable it looked in isolation.
  const map = compileMap(options.map);

  return {
    manifest: {
      schemaVersion: 1,
      generated: formatGeneratedTimestamp(now),
      taxonomy: {
        domains: options.domains.domains,
        facets: options.facets.facets,
        map: { regions: map.regions },
      },
      trees,
      moved: collectMovedMap(options.trees),
    },
    warnings: map.warnings,
  };
}

export function bundleOutputFromCompiled(
  treeId: string,
  bundle: CompiledTree,
  json: string,
  hash: string,
): CompiledBundleOutput {
  return {
    treeId,
    bundle,
    json,
    hash,
    relativePath: bundleRelativePath(treeId, hash),
  };
}
