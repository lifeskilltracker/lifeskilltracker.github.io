import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';

import { treesDir } from '../shared/paths.js';
import { readYamlFile } from '../shared/yaml-source.js';
import type { PlacementLedger, Tree } from '../validate/types.js';

export const DEFAULT_BASELINE_REF = 'origin/main';

/**
 * The failure §6.4 spends a paragraph on: `actions/checkout` clones at depth 1,
 * `origin/main` does not exist, and every check below passes on nothing. It has
 * to be an error, because "passed" and "had nothing to compare" are the same
 * green tick to branch protection.
 */
export class BaselineUnavailableError extends Error {
  readonly ref: string;
  constructor(ref: string, cause: string) {
    super(
      `cannot resolve baseline ref "${ref}": ${cause}\n` +
        'CI needs fetch-depth: 0 (or an explicit fetch) — at depth 1 there is no origin/main ' +
        'and these checks would pass on nothing.',
    );
    this.name = 'BaselineUnavailableError';
    this.ref = ref;
  }
}

function git(repoRoot: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`git ${args.join(' ')}: ${result.error.message}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr.trim() };
}

export function resolveBaselineCommit(repoRoot: string, ref: string): string {
  const result = git(repoRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  if (result.status !== 0 || result.stdout.trim() === '') {
    throw new BaselineUnavailableError(ref, result.stderr || 'no such commit');
  }
  return result.stdout.trim();
}

export interface TreeSnapshot {
  id: string;
  /** Repository-relative for the baseline; absolute for the head. */
  path: string;
  tree: Tree;
}

export type Snapshot = Map<string, TreeSnapshot>;

function parseTree(text: string, where: string): Tree | null {
  const doc = parseDocument(text, { prettyErrors: true });
  if (doc.errors.length > 0) {
    throw new Error(`YAML parse error in ${where}: ${doc.errors[0].message}`);
  }
  const data = doc.toJSON() as Tree | null;
  // A file that is not a tree (or an empty one) is simply not our business.
  return data && typeof data === 'object' && Array.isArray(data.levels) ? data : null;
}

/** The tree files as of the baseline commit — read from git, never from disk. */
export function readBaselineSnapshot(repoRoot: string, ref: string): Snapshot {
  const commit = resolveBaselineCommit(repoRoot, ref);
  const listing = git(repoRoot, ['ls-tree', '-r', '--name-only', commit, '--', 'content/trees']);
  if (listing.status !== 0) {
    throw new BaselineUnavailableError(ref, listing.stderr || 'could not list content/trees');
  }

  const snapshot: Snapshot = new Map();
  for (const relative of listing.stdout.split('\n').map((line) => line.trim()).filter(Boolean)) {
    if (!relative.endsWith('.yaml') && !relative.endsWith('.yml')) {
      continue;
    }
    const shown = git(repoRoot, ['show', `${commit}:${relative}`]);
    if (shown.status !== 0) {
      throw new Error(`could not read ${relative} at ${ref}: ${shown.stderr}`);
    }
    const tree = parseTree(shown.stdout, `${ref}:${relative}`);
    if (tree) {
      snapshot.set(tree.id, { id: tree.id, path: relative, tree });
    }
  }
  return snapshot;
}

const LEDGER_PATH = 'content/taxonomy/placement.yaml';

function parseLedger(text: string, where: string): PlacementLedger | null {
  const doc = parseDocument(text, { prettyErrors: true });
  if (doc.errors.length > 0) {
    throw new Error(`YAML parse error in ${where}: ${doc.errors[0].message}`);
  }
  const data = doc.toJSON() as PlacementLedger | null;
  return data && typeof data === 'object' && Array.isArray(data.placements) ? data : null;
}

/**
 * The ledger as of the baseline commit. `null` when the baseline predates the
 * ledger — check 9 then has nothing to hold anyone to, which is the correct
 * reading of the very first commit that introduces it.
 */
export function readBaselineLedger(repoRoot: string, ref: string): PlacementLedger | null {
  const commit = resolveBaselineCommit(repoRoot, ref);
  const shown = git(repoRoot, ['show', `${commit}:${LEDGER_PATH}`]);
  if (shown.status !== 0) {
    return null;
  }
  return parseLedger(shown.stdout, `${ref}:${LEDGER_PATH}`);
}

export function readHeadLedger(repoRoot: string): PlacementLedger | null {
  const filePath = path.join(repoRoot, LEDGER_PATH);
  if (!existsSync(filePath)) {
    return null;
  }
  return readYamlFile<PlacementLedger>(filePath).data ?? null;
}

/**
 * The head is the working tree. In CI that is the merge commit `actions/checkout`
 * produces for a pull request — the PR *merged into* the baseline, which is the
 * thing §6.4 says to compare, not the PR branch on its own.
 */
export function readHeadSnapshot(repoRoot: string): Snapshot {
  const dir = treesDir(repoRoot);
  const snapshot: Snapshot = new Map();
  if (!existsSync(dir)) {
    return snapshot;
  }
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.yaml') && !name.endsWith('.yml')) {
      continue;
    }
    const filePath = path.join(dir, name);
    const loaded = readYamlFile<Tree>(filePath);
    if (loaded.data && Array.isArray(loaded.data.levels)) {
      snapshot.set(loaded.data.id, { id: loaded.data.id, path: filePath, tree: loaded.data });
    }
  }
  return snapshot;
}
