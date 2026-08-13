/**
 * §14.7's purity check over `lib/scoring`, and the grep gate that is the
 * mechanical form of **S1**.
 *
 * The needles are assembled from fragments so that this file can be scanned
 * along with every other one — a purity test that has to exempt itself is a
 * purity test with a hole in it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = fileURLToPath(new URL('.', import.meta.url));

/**
 * `lib/scoring ⇢ lib/content` is a §14.1 forbidden edge in its own right: an
 * engine that did I/O would stop being testable as arithmetic.
 */
const FORBIDDEN_IMPORTS = [
  ['sve', 'lte'].join(''),
  ['$a', 'pp'].join(''),
  ['$lib/st', 'ate'].join(''),
  ['$lib/con', 'tent'].join(''),
  ['../st', 'ate'].join(''),
  ['../con', 'tent'].join(''),
];

/** The renderer never reads this field (F10); S1 is only as good as that guarantee. */
const FORBIDDEN_TOKEN = ['arche', 'type'].join('');

function sources(): { name: string; text: string }[] {
  return readdirSync(DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(join(DIR, name), 'utf8') }));
}

describe('§14.7 — lib/scoring is pure', () => {
  it('scans every .ts file in the directory, including this one', () => {
    const names = sources().map((s) => s.name);
    expect(names).toContain('purity.test.ts');
    expect(names).toContain('levels.ts');
    expect(names).toContain('index.ts');
  });

  it.each(FORBIDDEN_IMPORTS)('imports nothing from %s', (specifier) => {
    for (const { name, text } of sources()) {
      const patterns = [
        new RegExp(`from\\s+['"]${escapeRegExp(specifier)}`),
        new RegExp(`import\\s*\\(\\s*['"]${escapeRegExp(specifier)}`),
      ];
      for (const pattern of patterns) {
        expect(`${name}: ${pattern.test(text)}`).toBe(`${name}: false`);
      }
    }
  });

  it('reaches for no DOM, storage, or clock in the engine itself', () => {
    const engineOnly = sources().filter(
      (s) => !s.name.includes('.test.') && !s.name.includes('.prop.') && s.name !== 'fixtures.ts',
    );
    for (const { name, text } of engineOnly) {
      const globals = ['document', 'window', 'localSt' + 'orage', 'indexed' + 'DB', 'Date.now'];
      for (const global of globals) {
        expect(`${name}: ${text.includes(global)}`).toBe(`${name}: false`);
      }
    }
  });

  it('never mentions the S1 shape-discriminating field anywhere in the directory', () => {
    for (const { name, text } of sources()) {
      expect(`${name}: ${text.includes(FORBIDDEN_TOKEN)}`).toBe(`${name}: false`);
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
