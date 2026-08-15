import { readFileSync, writeFileSync } from 'node:fs';
import { isMap, isPair, isSeq, parseDocument, Pair, Scalar, YAMLSeq, type Document } from 'yaml';

import type { AliasFix } from './checks.js';

function keyText(key: unknown): string {
  return key instanceof Scalar ? String(key.value) : String(key);
}

function get(node: unknown, key: string): unknown {
  if (!isMap(node)) {
    return undefined;
  }
  const pair = node.items.find((item) => isPair(item) && keyText(item.key) === key);
  return isPair(pair) ? pair.value : undefined;
}

function scalarValue(node: unknown, key: string): string | undefined {
  const value = get(node, key);
  return value instanceof Scalar ? String(value.value) : undefined;
}

/** Every milestone and mastery node in the document, in file order. */
function entryNodes(doc: Document): unknown[] {
  const nodes: unknown[] = [];
  const levels = get(doc.contents, 'levels');
  if (isSeq(levels)) {
    for (const level of levels.items) {
      const milestones = get(level, 'milestones');
      if (isSeq(milestones)) {
        nodes.push(...milestones.items);
      }
    }
  }
  const mastery = get(doc.contents, 'mastery');
  if (isSeq(mastery)) {
    nodes.push(...mastery.items);
  }
  return nodes;
}

/**
 * §6.4 calls check 4 "the one CI can auto-fix by pushing a commit to the PR",
 * so the patch is generated here and applied to the working tree; actually
 * landing the commit needs push credentials and belongs to T25's workflow.
 *
 * The edit is made through the YAML AST rather than by re-serializing the whole
 * document, because a tree file carries authored comments and an author whose
 * comments were eaten by a bot commit would rightly stop trusting the bot.
 */
export function applyAliasFixes(fixes: readonly AliasFix[]): string[] {
  const byFile = new Map<string, AliasFix[]>();
  for (const fix of fixes) {
    const list = byFile.get(fix.file);
    if (list) {
      list.push(fix);
    } else {
      byFile.set(fix.file, [fix]);
    }
  }

  const written: string[] = [];
  for (const [file, fileFixes] of byFile) {
    const doc = parseDocument(readFileSync(file, 'utf8'));
    let changed = false;

    for (const fix of fileFixes) {
      const node = entryNodes(doc).find((entry) => scalarValue(entry, 'id') === fix.slug);
      if (!isMap(node)) {
        continue;
      }
      const aliases = get(node, 'aliases');
      if (isSeq(aliases)) {
        const present = aliases.items.some(
          (item) => item instanceof Scalar && String(item.value) === fix.alias,
        );
        if (!present) {
          aliases.items.push(new Scalar(fix.alias));
          changed = true;
        }
        continue;
      }
      const seq = new YAMLSeq<Scalar>();
      seq.items.push(new Scalar(fix.alias));
      node.items.push(new Pair(new Scalar('aliases'), seq));
      changed = true;
    }

    if (changed) {
      writeFileSync(file, doc.toString(), 'utf8');
      written.push(file);
    }
  }
  return written;
}
