import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { defaultRepoRoot, treesDir } from '../shared/paths.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR, EXIT_USAGE } from '../shared/exit-codes.js';
import { renderTreeScaffold, SLUG_PATTERN } from './template.js';

function resolveRepoRoot(repoRoot?: string): string {
  return repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
}

export interface NewOptions {
  id: string;
  repoRoot?: string;
}

export function runNew(options: NewOptions): { path: string } {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  if (!SLUG_PATTERN.test(options.id)) {
    throw new Error(`"${options.id}" is not a slug (${SLUG_PATTERN.source})`);
  }

  const dir = treesDir(repoRoot);
  const filePath = path.join(dir, `${options.id}.yaml`);
  // A tree id is immutable and never reused (§5.3), so an existing file is
  // never something to overwrite — it is the answer to whether this id is free.
  if (existsSync(filePath)) {
    throw new Error(`${filePath} already exists; tree ids are never reused (§5.3)`);
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, renderTreeScaffold(options.id), 'utf8');
  return { path: filePath };
}

export function newCommand(id: string, repoRoot?: string): number {
  if (!id) {
    console.error('lst new: a tree id is required');
    return EXIT_USAGE;
  }
  if (!SLUG_PATTERN.test(id)) {
    console.error(`lst new: "${id}" is not a slug (${SLUG_PATTERN.source})`);
    return EXIT_USAGE;
  }
  try {
    const created = runNew({ id, repoRoot: resolveRepoRoot(repoRoot) });
    console.log(`${created.path}\nnext: npx lst ids ${created.path}`);
    return EXIT_OK;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_RUNTIME_ERROR;
  }
}

export { renderTreeScaffold };
