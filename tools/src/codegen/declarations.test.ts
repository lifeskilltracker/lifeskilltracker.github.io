import { describe, expect, it } from 'vitest';

import {
  extractClosedIntersectionBody,
  findExportDeclaration,
  getExportDeclarationText,
  hasOpenIndexSignature,
  replaceExportDeclaration,
} from './declarations.js';

describe('declaration scanner', () => {
  it('finds and replaces a named export type with balanced delimiters', () => {
    const source = [
      'export type Foo = {',
      '  a: string;',
      '};',
      'export type Bar = { b: number };',
    ].join('\n');

    const next = replaceExportDeclaration(source, 'Foo', 'export type Foo = { a: string; c: boolean };');
    expect(next).toContain('c: boolean');
    expect(next).toContain('export type Bar = { b: number };');
  });

  it('extracts the closed body from an open intersection root', () => {
    const text = 'export type Tree = { [k: string]: unknown; } & { id: string; title: string; };';
    expect(extractClosedIntersectionBody(text)).toBe('id: string; title: string;');
  });

  it('detects open index signatures', () => {
    expect(hasOpenIndexSignature('{ [k: string]: any | undefined; }')).toBe(true);
    expect(hasOpenIndexSignature('{ id: string; title: string; }')).toBe(false);
  });

  it('finds interface declarations by name', () => {
    const source = 'export interface Tree { id: string; }';
    const range = findExportDeclaration(source, 'Tree');
    expect(range?.kind).toBe('interface');
    expect(getExportDeclarationText(source, 'Tree')).toBe(source);
  });
});
