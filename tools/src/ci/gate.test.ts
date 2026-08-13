/**
 * §14.7's grep gate — the mechanical form of **S1** (T08).
 *
 * D-07 promises one renderer for linear, branching, and choice-based skills,
 * with no per-shape shells. That promise is worth exactly as much as the check
 * behind it, so this suite does not merely run the gate and watch it pass: it
 * plants a violation in a throwaway tree and proves the gate catches it. A
 * gate that has never failed is a gate nobody has tested.
 *
 * It lives in `tools/` because the scanned directories are under `app/src/lib/`
 * and a test naming the forbidden field would otherwise trip the very check it
 * covers.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const GATE = join(REPO_ROOT, 'tools/ci/check-archetype-free.sh');

const SCANNED = ['app/src/lib/layout', 'app/src/lib/scoring', 'app/src/lib/components'];

let sandbox: string | null = null;

afterEach(() => {
  if (sandbox !== null) rmSync(sandbox, { recursive: true, force: true });
  sandbox = null;
});

function run(root: string): { status: number; output: string } {
  try {
    // stderr is piped rather than inherited: the negative cases below make the
    // gate fail on purpose, and its complaint is the assertion, not noise.
    const output = execFileSync('bash', [GATE, root], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

/** A minimal tree with the three scanned directories present but empty. */
function emptyTree(): string {
  sandbox = mkdtempSync(join(tmpdir(), 'lst-gate-'));
  for (const dir of SCANNED) mkdirSync(join(sandbox, dir), { recursive: true });
  return sandbox;
}

describe('§14.7 — the S1 grep gate', () => {
  it('passes on this repository', () => {
    expect(run(REPO_ROOT).status).toBe(0);
  });

  it.each(SCANNED)('fails when %s branches on the shape field', (dir) => {
    const root = emptyTree();
    // Assembled from fragments so this file is not itself a match, the same
    // reason `lib/layout/purity.test.ts` assembles its needles.
    const field = ['arche', 'type'].join('');
    writeFileSync(join(root, dir, 'offender.ts'), `if (tree.${field} === 'modular') render();\n`);

    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('offender.ts');
  });

  it('passes on a tree where nothing mentions it', () => {
    const root = emptyTree();
    writeFileSync(join(root, SCANNED[0], 'fine.ts'), 'export const columns = 1;\n');

    expect(run(root).status).toBe(0);
  });
});
