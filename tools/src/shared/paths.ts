import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsSrcDir = path.dirname(fileURLToPath(import.meta.url));
export const defaultRepoRoot = path.resolve(toolsSrcDir, '../../..');

export function contentDir(repoRoot: string): string {
  return path.join(repoRoot, 'content');
}

export function treesDir(repoRoot: string): string {
  return path.join(contentDir(repoRoot), 'trees');
}

export function taxonomyDir(repoRoot: string): string {
  return path.join(contentDir(repoRoot), 'taxonomy');
}

export function staticContentDir(repoRoot: string): string {
  return path.join(repoRoot, 'app/static/content');
}

export function staticContentTreesDir(repoRoot: string): string {
  return path.join(staticContentDir(repoRoot), 'trees');
}

export function resolveRepoPath(repoRoot: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}
