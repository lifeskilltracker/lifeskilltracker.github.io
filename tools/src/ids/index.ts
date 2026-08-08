import { writeFileSync } from 'node:fs';
import {
  Pair,
  isMap,
  isPair,
  parseDocument,
  Scalar,
  YAMLMap,
  YAMLSeq,
  type Document,
} from 'yaml';

import { loadValidationContext, liveHeadUidSet, resolveInputFiles } from '../validate/context.js';
import { defaultRepoRoot } from '../shared/paths.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR, EXIT_USAGE } from '../shared/exit-codes.js';
import { generateCrockfordUid } from './crockford.js';

function keyText(key: unknown): string {
  return key instanceof Scalar ? String(key.value) : String(key);
}

function getMapItem(map: YAMLMap, key: string): unknown {
  const pair = map.items.find((item) => isPair(item) && keyText(item.key) === key);
  return isPair(pair) ? pair.value : undefined;
}

function setMapScalar(map: YAMLMap, key: string, value: string): void {
  const pair = map.items.find((item) => isPair(item) && keyText(item.key) === key);
  if (isPair(pair)) {
    if (pair.value instanceof Scalar) {
      pair.value.value = value;
      return;
    }
  }
  map.items.push(new Pair(key, new Scalar(value)));
}

function fillMissingUidsInDocument(doc: Document, existing: Set<string>): boolean {
  let changed = false;
  const root = doc.contents;
  if (!isMap(root)) {
    return false;
  }

  const levels = getMapItem(root, 'levels');
  if (levels instanceof YAMLSeq) {
    for (const levelNode of levels.items) {
      if (!isMap(levelNode)) {
        continue;
      }
      const milestones = getMapItem(levelNode, 'milestones');
      if (!(milestones instanceof YAMLSeq)) {
        continue;
      }
      for (const milestoneNode of milestones.items) {
        if (!isMap(milestoneNode)) {
          continue;
        }
        const uidNode = getMapItem(milestoneNode, 'uid');
        if (uidNode instanceof Scalar && uidNode.value) {
          existing.add(String(uidNode.value));
          continue;
        }
        const uid = generateCrockfordUid(existing);
        existing.add(uid);
        setMapScalar(milestoneNode, 'uid', uid);
        changed = true;
      }
    }
  }

  const mastery = getMapItem(root, 'mastery');
  if (mastery instanceof YAMLSeq) {
    for (const entryNode of mastery.items) {
      if (!isMap(entryNode)) {
        continue;
      }
      const uidNode = getMapItem(entryNode, 'uid');
      if (uidNode instanceof Scalar && uidNode.value) {
        existing.add(String(uidNode.value));
        continue;
      }
      const uid = generateCrockfordUid(existing);
      existing.add(uid);
      setMapScalar(entryNode, 'uid', uid);
      changed = true;
    }
  }

  return changed;
}

export interface IdsOptions {
  repoRoot?: string;
  files: string[];
}

export function runIds(options: IdsOptions): { changedFiles: string[] } {
  const repoRoot = options.repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
  const files = resolveInputFiles(repoRoot, options.files);
  if (files.length === 0) {
    throw new Error('no tree files provided');
  }

  const ctx = loadValidationContext(repoRoot, options.files);
  const existing = liveHeadUidSet(ctx);
  const changedFiles: string[] = [];

  for (const filePath of files) {
    const loaded = ctx.treeDocuments.get(filePath);
    if (!loaded) {
      throw new Error(`tree file not loaded: ${filePath}`);
    }
    const doc = parseDocument(loaded.text);
    const changed = fillMissingUidsInDocument(doc, existing);
    if (changed) {
      writeFileSync(filePath, doc.toString(), 'utf8');
      changedFiles.push(filePath);
    }
  }

  return { changedFiles };
}

export function idsCommand(files: string[], repoRoot?: string): number {
  const resolvedRoot = repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
  if (files.length === 0) {
    console.error('lst ids: at least one tree file is required');
    return EXIT_USAGE;
  }
  try {
    runIds({ repoRoot: resolvedRoot, files });
    return EXIT_OK;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_RUNTIME_ERROR;
  }
}
