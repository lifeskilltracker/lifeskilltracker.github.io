/**
 * §14.7's purity check over `lib/layout`, and the grep gate that is the
 * mechanical form of **S1**.
 *
 * The needles are assembled from fragments rather than written as literals so
 * that this file can be scanned along with every other one. A purity test that
 * has to exempt itself is a purity test with a hole in it, and this directory is
 * small enough that "every `.ts` file, no exceptions" is worth the small
 * awkwardness.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = fileURLToPath(new URL('.', import.meta.url));

/** Module specifiers `lib/layout` may never import (§14.1, §14.7). */
const FORBIDDEN_IMPORTS = [
  ['sve', 'lte'].join(''),
  ['$a', 'pp'].join(''),
  ['$lib/st', 'ate'].join(''),
  ['../st', 'ate'].join(''),
];

/**
 * The renderer never reads this field (F10), and S1's one-renderer promise is
 * only as good as the guarantee that nothing branches on it.
 */
const FORBIDDEN_TOKEN = ['arche', 'type'].join('');

function sources(): { name: string; text: string }[] {
  return readdirSync(DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(join(DIR, name), 'utf8') }));
}

describe('§14.7 — lib/layout is pure', () => {
  it('scans every .ts file in the directory, including this one', () => {
    const names = sources().map((s) => s.name);
    expect(names).toContain('purity.test.ts');
    expect(names).toContain('wide.ts');
    expect(names).toContain('index.ts');
    expect(names.length).toBeGreaterThanOrEqual(9);
  });

  it.each(FORBIDDEN_IMPORTS)('imports nothing from %s', (specifier) => {
    for (const { name, text } of sources()) {
      const patterns = [
        new RegExp(`from\\s+['"]${escapeRegExp(specifier)}`),
        new RegExp(`import\\s*\\(\\s*['"]${escapeRegExp(specifier)}`),
        new RegExp(`require\\s*\\(\\s*['"]${escapeRegExp(specifier)}`),
      ];
      for (const pattern of patterns) {
        expect(`${name}: ${pattern.test(text)}`).toBe(`${name}: false`);
      }
    }
  });

  it('reaches for no DOM or timing global', () => {
    // `performance.now` is allowed in a test file measuring the §17.3 budget;
    // the engine itself must have no clock (§8, "no randomness, no clock").
    const engineOnly = sources().filter((s) => !s.name.includes('.test.'));
    for (const { name, text } of engineOnly) {
      for (const global of ['document', 'window', 'localStorage', 'indexedDB', 'Date.now']) {
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
