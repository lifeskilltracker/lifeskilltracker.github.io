import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';

import type { Tree } from '../validate/types.js';
import { defaultRepoRoot } from '../shared/paths.js';

const BASE_AUTHORS = [{ name: 'Fixture Author' }];

export const FIXTURE_ROOT = path.resolve(defaultRepoRoot, 'tools/test/fixtures/validate');

export const FIXTURE_REPO = FIXTURE_ROOT;

export function fixturePath(...segments: string[]): string {
  return path.join(FIXTURE_ROOT, ...segments);
}

export function uidFor(index: number): string {
  return `aaa${String(index).padStart(5, '0')}`;
}

export function stampFixtureUids(tree: Tree, namespace: number): void {
  let counter = namespace * 50;
  for (const level of tree.levels) {
    for (const milestone of level.milestones) {
      milestone.uid = uidFor(counter++);
    }
  }
  for (const entry of tree.mastery ?? []) {
    entry.uid = uidFor(counter++);
  }
}

export function minimalValidTree(overrides: Partial<Tree> & { id: string }): Tree {
  const levels = Array.from({ length: 10 }, (_, levelIndex) => {
    const level = levelIndex + 1;
    let milestoneCounter = levelIndex * 4;
    return {
      level,
      milestones: Array.from({ length: 4 }, (_, milestoneIndex) => {
        milestoneCounter += 1;
        const id = `l${level}-m${milestoneIndex + 1}`;
        return {
          id,
          uid: uidFor(milestoneCounter),
          title: `Level ${level} milestone ${milestoneIndex + 1}`,
        };
      }),
    };
  });

  return {
    schemaVersion: 1,
    contentVersion: 1,
    title: overrides.title ?? `Fixture ${overrides.id}`,
    summary: overrides.summary ?? 'Validate fixture tree.',
    domain: 'home',
    provenance: {
      authors: BASE_AUTHORS,
      copyleftDerived: false,
    },
    levels,
    ...overrides,
  };
}

export function writeTreeFixture(dir: string, name: string, tree: Tree): string {
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  writeFileSync(filePath, stringify(tree), 'utf8');
  return filePath;
}
