import { readFileSync } from 'node:fs';
import {
  Document,
  LineCounter,
  Node,
  Pair,
  Scalar,
  isMap,
  isPair,
  isSeq,
  parseDocument,
} from 'yaml';

export interface SourcePosition {
  line: number;
  column: number;
}

export interface ParsedYaml<T = unknown> {
  path: string;
  text: string;
  doc: Document;
  lineCounter: LineCounter;
  data: T;
}

export function readYamlFile<T = unknown>(filePath: string): ParsedYaml<T> {
  const text = readFileSync(filePath, 'utf8');
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: true });
  if (doc.errors.length > 0) {
    const first = doc.errors[0];
    throw new Error(`YAML parse error in ${filePath}: ${first.message}`);
  }
  return { path: filePath, text, doc, lineCounter, data: doc.toJSON() as T };
}

function offsetToPosition(lineCounter: LineCounter, offset: number | undefined): SourcePosition {
  if (offset === undefined) {
    return { line: 1, column: 1 };
  }
  const pos = lineCounter.linePos(offset);
  return { line: pos.line, column: pos.col };
}

function keyText(key: unknown): string | number {
  if (key instanceof Scalar) {
    return key.value as string | number;
  }
  return String(key);
}

export function nodeAtPath(root: Node | null, jsonPath: Array<string | number>): Node | null {
  let current: Node | null = root;
  for (const segment of jsonPath) {
    if (current == null) {
      return null;
    }
    if (typeof segment === 'number') {
      if (!isSeq(current)) {
        return null;
      }
      current = (current.items[segment] as Node | undefined) ?? null;
      continue;
    }
    if (!isMap(current)) {
      return null;
    }
    const pair = current.items.find((item): item is Pair => isPair(item) && keyText(item.key) === segment);
    current = (pair?.value as Node | undefined) ?? null;
  }
  return current;
}

export function positionAtPath(doc: Document, jsonPath: Array<string | number>, lineCounter?: LineCounter): SourcePosition {
  const node = nodeAtPath(doc.contents as Node | null, jsonPath);
  if (!node || node.range == null) {
    return { line: 1, column: 1 };
  }
  const counter = lineCounter ?? (doc as Document & { lineCounter?: LineCounter }).lineCounter;
  if (!counter) {
    return { line: 1, column: 1 };
  }
  return offsetToPosition(counter, node.range[0]);
}

export function positionForInstancePath(doc: Document, instancePath: string, lineCounter?: LineCounter): SourcePosition {
  return positionAtPath(doc, instancePathToSegments(instancePath), lineCounter);
}
export function instancePathToSegments(instancePath: string): Array<string | number> {
  if (!instancePath || instancePath === '/') {
    return [];
  }
  return instancePath
    .split('/')
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

export function findScalarPath(
  root: Node | null,
  predicate: (path: Array<string | number>, value: unknown) => boolean,
  currentPath: Array<string | number> = [],
): Array<string | number> | null {
  if (root == null) {
    return null;
  }
  if (root instanceof Scalar) {
    return predicate(currentPath, root.value) ? currentPath : null;
  }
  if (isMap(root)) {
    for (const item of root.items) {
      if (!isPair(item)) {
        continue;
      }
      const nextPath = [...currentPath, keyText(item.key)];
      const found = findScalarPath(item.value as Node, predicate, nextPath);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (isSeq(root)) {
    for (let index = 0; index < root.items.length; index += 1) {
      const found = findScalarPath(root.items[index] as Node, predicate, [...currentPath, index]);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
