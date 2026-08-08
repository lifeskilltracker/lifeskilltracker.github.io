import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { generateTypes } from './gen-types.js';
import { hasOpenIndexSignature } from './codegen/postprocess.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const authoredPath = path.join(repoRoot, 'app/src/lib/types/authored.d.ts');
const compiledPath = path.join(repoRoot, 'app/src/lib/types/compiled.d.ts');

describe('gen:types (T02)', () => {
  it('generates authored.d.ts and compiled.d.ts', async () => {
    await generateTypes();
    expect(readFileSync(authoredPath, 'utf8')).toContain('export interface Tree');
    expect(readFileSync(compiledPath, 'utf8')).toContain('export interface CompiledTree');
    expect(readFileSync(compiledPath, 'utf8')).toContain('export interface Manifest');
    expect(readFileSync(compiledPath, 'utf8')).not.toContain('eslint-disable');
    expect(readFileSync(authoredPath, 'utf8')).toContain(
      'eslint-disable @typescript-eslint/no-explicit-any',
    );
  });

  it('is idempotent when run twice', async () => {
    await generateTypes();
    const firstAuthored = readFileSync(authoredPath, 'utf8');
    const firstCompiled = readFileSync(compiledPath, 'utf8');

    await generateTypes();
    expect(readFileSync(authoredPath, 'utf8')).toBe(firstAuthored);
    expect(readFileSync(compiledPath, 'utf8')).toBe(firstCompiled);
  });

  it('post-processes away never[] tuples and open root index signatures', async () => {
    await generateTypes();
    const authored = readFileSync(authoredPath, 'utf8');
    const compiled = readFileSync(compiledPath, 'utf8');

    expect(authored).not.toContain('= never[]');
    expect(compiled).not.toContain('= never[]');
    expect(authored).toMatch(/export interface Tree \{/);
    expect(compiled).toMatch(/export interface CompiledTree \{/);
    expect(authored).toContain('export type Levels = [');
    expect(authored).toContain('export type AxialTile = [number, number]');
    expect(authored).toContain("rule: 'any'");
    expect(authored).toContain('export type ContentDomainId =');
    expect(authored).toContain('export type ContentNonMakingDomainId =');
    expect(authored).not.toContain('export type DomainId =');
    expect(authored).toContain("'outdoors-nature'");
    expect(compiled).not.toContain('export type DomainId =');
    expect(authored).not.toMatch(/export type RequirementGroup = \{\s*\[k: string\]:/);
    expect(hasOpenIndexSignature(authored.match(/export type Domain =[\s\S]*?;/)?.[0] ?? '')).toBe(
      false,
    );
    expect(compiled).toContain('moved: Record<string, string>');
    expect(compiled).toContain('CompiledTree.milestones when kind is milestone');
    expect(compiled).toContain('required in compiled output');
    expect(compiled).not.toMatch(/export type CompiledDomain = \{\s*\[k: string\]:/);
  });
});
