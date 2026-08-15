import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createProgram } from './program.js';

const toolsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiledCliPath = path.join(toolsRoot, 'dist/cli.js');

describe('lst CLI', () => {
  it('identifies itself and exposes usage help without spawning a process', () => {
    const program = createProgram();

    expect(program.name()).toBe('lst');

    const help = program.helpInformation();

    expect(help).toContain('lst');
    expect(help).toMatch(/usage:/i);
  });

  it('registers validate and ids subcommands', () => {
    const program = createProgram();
    const names = program.commands.map((command) => command.name());
    expect(names).toContain('validate');
    expect(names).toContain('ids');
    expect(names).toContain('compile');
    expect(names).toContain('lint');
    expect(names).toContain('status');
    expect(names).toContain('new');
    expect(names).toContain('baseline');
    expect(names).toContain('version');
  });

  it('keeps validate free of git operations', () => {
    const validateDir = path.join(toolsRoot, 'src/validate');
    const forbidden = ['child_process', 'simple-git', 'exec('];
    for (const file of ['index.ts', 'map-rules.ts', 'context.ts', 'schema.ts', 'report.ts']) {
      const text = readFileSync(path.join(validateDir, file), 'utf8');
      for (const token of forbidden) {
        expect(text.includes(token)).toBe(false);
      }
    }
  });

  it('prints usage when invoked through a bin symlink with --help', () => {
    const binDir = mkdtempSync(path.join(tmpdir(), 'lst-bin-'));
    const symlinkPath = path.join(binDir, 'lst');

    symlinkSync(compiledCliPath, symlinkPath);

    const result = spawnSync(process.execPath, [symlinkPath, '--help'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/usage:/i);
    expect(result.stdout).toContain('lst');
  });
});
