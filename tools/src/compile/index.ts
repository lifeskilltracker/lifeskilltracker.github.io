import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  defaultRepoRoot,
  staticContentDir,
  staticContentTreesDir,
  taxonomyDir,
  treesDir,
} from '../shared/paths.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR, EXIT_VALIDATION_FAILED } from '../shared/exit-codes.js';
import { readYamlFile } from '../shared/yaml-source.js';
import type { DomainsFile, FacetsFile, MapFile, Tree } from '../validate/types.js';
import { compileTreeBundle, CompileError } from './bundle.js';
import { contentHash } from './hash.js';
import { serializeJson } from './json.js';
import {
  buildManifest,
  bundleOutputFromCompiled,
  type CompiledBundleOutput,
  type Manifest,
  type NowFn,
} from './manifest.js';
import {
  assignPlacements,
  CELL_DIVISOR,
  emptyLedger,
  latticesFor,
  serializeLedger,
  type PlacementLedger,
} from './placement.js';
import { sortByAsciiUtf8 } from './sort.js';
import { assertValidCompiledOutput } from './validate-output.js';

export interface LoadedCompileTree {
  path: string;
  tree: Tree;
}

export interface CompileResult {
  repoRoot: string;
  outputDir: string;
  bundles: CompiledBundleOutput[];
  manifest: Manifest;
  manifestPath: string;
  validationIssues: ReturnType<typeof assertValidCompiledOutput>;
  /** §10.4's hole warnings, and §5.3's reflow warning. Reported, never blocking —
   *  a hole is an authoring smell, and M3 has already rejected the disconnection
   *  case at validate time. */
  warnings: string[];
  /** The ledger as it now stands, written when `write` is not false. */
  placement: PlacementLedger;
}

function resolveRepoRoot(repoRoot?: string): string {
  return repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
}

function assertContentTreesDir(repoRoot: string): void {
  const dir = treesDir(repoRoot);
  if (!existsSync(dir)) {
    throw new CompileError(`Missing content trees directory: ${dir}`, 'config');
  }
}

function listYamlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name) => path.join(dir, name));
}

function loadTrees(repoRoot: string): LoadedCompileTree[] {
  assertContentTreesDir(repoRoot);
  const files = sortByAsciiUtf8(listYamlFiles(treesDir(repoRoot)), (filePath) =>
    path.basename(filePath, path.extname(filePath)),
  );
  return files.map((filePath) => {
    const loaded = readYamlFile<Tree>(filePath);
    return { path: filePath, tree: loaded.data };
  });
}

function loadTaxonomy<T>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new CompileError(`Missing taxonomy file: ${filePath}`, 'config');
  }
  return readYamlFile<T>(filePath).data;
}

function ledgerPath(repoRoot: string): string {
  return path.join(taxonomyDir(repoRoot), 'placement.yaml');
}

/** An absent ledger is the first compile, not an error. */
function loadLedger(repoRoot: string): PlacementLedger {
  const filePath = ledgerPath(repoRoot);
  if (!existsSync(filePath)) {
    return emptyLedger();
  }
  return readYamlFile<PlacementLedger>(filePath).data ?? emptyLedger();
}

function compileBundles(trees: LoadedCompileTree[]): CompiledBundleOutput[] {
  return sortByAsciiUtf8(trees, (entry) => entry.tree.id).map(({ tree }) => {
    const bundle = compileTreeBundle(tree);
    const json = serializeJson(bundle);
    const hash = contentHash(json);
    return bundleOutputFromCompiled(tree.id, bundle, json, hash);
  });
}

function cleanupStaleBundles(outputTreesDir: string, keepFilenames: ReadonlySet<string>): void {
  if (!existsSync(outputTreesDir)) {
    return;
  }
  for (const name of readdirSync(outputTreesDir)) {
    if (!name.endsWith('.json')) {
      continue;
    }
    if (!keepFilenames.has(name)) {
      unlinkSync(path.join(outputTreesDir, name));
    }
  }
}

function writeOutputs(
  repoRoot: string,
  bundles: CompiledBundleOutput[],
  manifest: Manifest,
  ledger: PlacementLedger,
): { manifestPath: string; outputDir: string } {
  writeFileSync(ledgerPath(repoRoot), serializeLedger(ledger), 'utf8');

  const outputDir = staticContentDir(repoRoot);
  const outputTreesDir = staticContentTreesDir(repoRoot);
  mkdirSync(outputTreesDir, { recursive: true });

  const keepFilenames = new Set<string>();
  for (const bundle of bundles) {
    const filename = path.basename(bundle.relativePath);
    keepFilenames.add(filename);
    writeFileSync(path.join(outputTreesDir, filename), bundle.json, 'utf8');
  }

  cleanupStaleBundles(outputTreesDir, keepFilenames);

  const manifestPath = path.join(outputDir, 'manifest.json');
  writeFileSync(manifestPath, serializeJson(manifest), 'utf8');
  return { manifestPath, outputDir };
}

export interface CompileOptions {
  repoRoot?: string;
  write?: boolean;
  now?: NowFn;
}

export function runCompile(options: CompileOptions = {}): CompileResult {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const trees = loadTrees(repoRoot);
  const domains = loadTaxonomy<DomainsFile>(path.join(taxonomyDir(repoRoot), 'domains.yaml'));
  const facets = loadTaxonomy<FacetsFile>(path.join(taxonomyDir(repoRoot), 'facets.yaml'));
  const map = loadTaxonomy<MapFile>(path.join(taxonomyDir(repoRoot), 'map.yaml'));

  const bundles = compileBundles(trees);

  // §10.4 steps 5–7. The ledger is read before the manifest is built because a
  // committed assignment is an input to compilation, not an output of it.
  const placement = assignPlacements(
    loadLedger(repoRoot),
    trees.map((entry) => ({ id: entry.tree.id, domain: entry.tree.domain })),
    latticesFor(map, CELL_DIVISOR),
  );

  const { manifest, warnings } = buildManifest({
    bundles,
    trees: trees.map((entry) => entry.tree),
    domains,
    facets,
    map,
    cells: new Map(placement.ledger.placements.map((entry) => [entry.tree, entry.cell])),
    now: options.now,
  });

  if (placement.reflowed.length > 0) {
    warnings.push(
      `content/taxonomy/placement.yaml: the region tiles changed, so ${placement.reflowed.length} ` +
        `skill(s) had to reflow — ${placement.reflowed.join(', ')}. Their positions on the map ` +
        'have moved and anyone who had memorised them will not find them where they were ' +
        '(§5.3 names this as the one place N11 is knowingly traded).',
    );
  }

  const validationIssues = assertValidCompiledOutput(
    bundles.map((bundle) => ({ treeId: bundle.treeId, bundle: bundle.bundle })),
    manifest,
  );

  if (validationIssues.length > 0) {
    return {
      repoRoot,
      outputDir: staticContentDir(repoRoot),
      bundles,
      manifest,
      manifestPath: path.join(staticContentDir(repoRoot), 'manifest.json'),
      validationIssues,
      warnings,
      placement: placement.ledger,
    };
  }

  if (options.write !== false) {
    writeOutputs(repoRoot, bundles, manifest, placement.ledger);
  }

  return {
    repoRoot,
    outputDir: staticContentDir(repoRoot),
    bundles,
    manifest,
    manifestPath: path.join(staticContentDir(repoRoot), 'manifest.json'),
    validationIssues,
    warnings,
    placement: placement.ledger,
  };
}

function printValidationIssues(issues: ReturnType<typeof assertValidCompiledOutput>): void {
  for (const issue of issues) {
    console.error(issue.message);
    for (const error of issue.errors) {
      console.error(`  ${error.instancePath || '/'} ${error.message ?? ''}`.trim());
    }
  }
}

export function compileCommand(repoRoot?: string): number {
  try {
    const result = runCompile({ repoRoot, write: true });
    if (result.validationIssues.length > 0) {
      printValidationIssues(result.validationIssues);
      return EXIT_VALIDATION_FAILED;
    }
    // §10.4's hole warning is printed and does not change the exit code: it is
    // far more likely an authoring mistake than an intention, but the spec asks
    // for a warning, and a gate here would be stricter than it asks for.
    for (const warning of result.warnings) {
      console.warn(warning);
    }
    return EXIT_OK;
  } catch (error) {
    if (error instanceof CompileError) {
      console.error(error.message);
      return error.code === 'config' ? EXIT_RUNTIME_ERROR : EXIT_VALIDATION_FAILED;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_RUNTIME_ERROR;
  }
}

export { CompileError };
