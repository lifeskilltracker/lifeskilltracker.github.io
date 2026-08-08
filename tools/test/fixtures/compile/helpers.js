import { cpSync, mkdtempSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
export function makeRepoFromFixtures() {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'lst-compile-'));
    cpSync(path.join(fixtureRoot, 'content'), path.join(repoRoot, 'content'), { recursive: true });
    return repoRoot;
}
export function makeEmptyLibraryRepo() {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'lst-compile-empty-'));
    cpSync(path.join(fixtureRoot, 'content/taxonomy'), path.join(repoRoot, 'content/taxonomy'), {
        recursive: true,
    });
    cpSync(path.join(fixtureRoot, 'content/trees'), path.join(repoRoot, 'content/trees'), {
        recursive: true,
    });
    const treesDir = path.join(repoRoot, 'content/trees');
    for (const name of readdirSync(treesDir)) {
        if (name.endsWith('.yaml') || name.endsWith('.yml')) {
            unlinkSync(path.join(treesDir, name));
        }
    }
    return repoRoot;
}
