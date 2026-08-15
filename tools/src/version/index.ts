import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMap, isPair, parseDocument, Scalar } from 'yaml';

import { compiledFingerprint } from '../baseline/checks.js';
import {
  BaselineUnavailableError,
  DEFAULT_BASELINE_REF,
  readBaselineSnapshot,
  readHeadSnapshot,
} from '../baseline/diff.js';
import { defaultRepoRoot, resolveRepoPath } from '../shared/paths.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR, EXIT_VALIDATION_FAILED } from '../shared/exit-codes.js';

function resolveRepoRoot(repoRoot?: string): string {
  return repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
}

export interface VersionOptions {
  repoRoot?: string;
  against?: string;
}

export interface VersionBump {
  treeId: string;
  from: number;
  to: number;
}

export interface VersionResult {
  ref: string;
  bumped: VersionBump[];
}

function setContentVersion(filePath: string, value: number): void {
  const doc = parseDocument(readFileSync(filePath, 'utf8'));
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error(`${filePath} is not a mapping`);
  }
  const pair = root.items.find(
    (item) => isPair(item) && item.key instanceof Scalar && item.key.value === 'contentVersion',
  );
  if (isPair(pair) && pair.value instanceof Scalar) {
    pair.value.value = value;
  } else {
    doc.set('contentVersion', value);
  }
  writeFileSync(filePath, doc.toString(), 'utf8');
}

/**
 * §6.1's companion writer to §6.4 check 5, and it lives beside `lst baseline`
 * because it needs the identical comparison: compile both sides, elide
 * `contentVersion`, and bump only where the remaining bytes moved.
 *
 * It mirrors `lst ids` exactly — the tool writes the value locally, CI refuses
 * the merge without it (§5.4, §6.4). It is not itself a gate: `lst baseline` is.
 */
export function runVersion(options: VersionOptions = {}, files: string[] = []): VersionResult {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const ref = options.against ?? DEFAULT_BASELINE_REF;

  const baseline = readBaselineSnapshot(repoRoot, ref);
  const head = readHeadSnapshot(repoRoot);
  const scope =
    files.length > 0
      ? new Set(files.map((file) => path.resolve(resolveRepoPath(repoRoot, file))))
      : null;

  const bumped: VersionBump[] = [];
  for (const [treeId, after] of head) {
    if (scope != null && !scope.has(path.resolve(after.path))) {
      continue;
    }
    const before = baseline.get(treeId);
    // A tree that has never been merged has no published version to move past.
    if (!before) {
      continue;
    }
    const wasCompiled = compiledFingerprint(before.tree);
    const isCompiled = compiledFingerprint(after.tree);
    if (wasCompiled == null || isCompiled == null || wasCompiled === isCompiled) {
      continue;
    }
    if (after.tree.contentVersion > before.tree.contentVersion) {
      continue;
    }
    const to = before.tree.contentVersion + 1;
    setContentVersion(after.path, to);
    bumped.push({ treeId, from: after.tree.contentVersion, to });
  }

  return { ref, bumped };
}

export function versionCommand(files: string[], options: VersionOptions = {}): number {
  try {
    const result = runVersion(options, files);
    for (const bump of result.bumped) {
      console.log(`${bump.treeId}: contentVersion ${bump.from} → ${bump.to}`);
    }
    return EXIT_OK;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof BaselineUnavailableError ? EXIT_VALIDATION_FAILED : EXIT_RUNTIME_ERROR;
  }
}
