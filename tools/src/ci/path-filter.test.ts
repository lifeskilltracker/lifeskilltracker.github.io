/**
 * §6.5's path filter, over real git repositories.
 *
 * This script decides whether `app: typecheck`, `app: test` and `app: build`
 * run at all, so a wrong answer in one direction wastes a runner and in the
 * other merges an unbuilt app behind a green tick. It is also the one piece of
 * the workflow that is plain shell rather than declarative YAML, which makes it
 * the one piece that can be tested here rather than only on a live PR.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const SCRIPT = join(REPO_ROOT, '.github/workflows/scripts/app-paths-changed.sh');

let sandbox: string | null = null;

afterEach(() => {
  if (sandbox !== null) rmSync(sandbox, { recursive: true, force: true });
  sandbox = null;
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'lst',
      GIT_AUTHOR_EMAIL: 'lst@example.invalid',
      GIT_COMMITTER_NAME: 'lst',
      GIT_COMMITTER_EMAIL: 'lst@example.invalid',
    },
  }).trim();
}

function commit(cwd: string, files: string[], message: string): string {
  for (const file of files) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), `${message}\n`);
  }
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

/** A repository with a base commit and one commit touching `files`. */
function repoWithChange(files: string[]): { cwd: string; base: string; head: string } {
  sandbox = mkdtempSync(join(tmpdir(), 'lst-filter-'));
  git(sandbox, 'init', '-q', '-b', 'main');
  const base = commit(sandbox, ['README.md'], 'base');
  const head = commit(sandbox, files, 'change');
  return { cwd: sandbox, base, head };
}

function run(cwd: string, env: Record<string, string>): { status: number; out: string } {
  try {
    const out = execFileSync('bash', [SCRIPT], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

function decide(files: string[]): string {
  const { cwd, base, head } = repoWithChange(files);
  const result = run(cwd, { BASE_SHA: base, HEAD_SHA: head });
  expect(result.status).toBe(0);
  return result.out.trim();
}

describe('§6.5 — the path filter', () => {
  it('skips the app jobs on a content-only PR — the S2 feedback loop', () => {
    expect(decide(['content/trees/cooking.yaml'])).toBe('app=false');
  });

  it('skips them for a docs-only or review-status change too', () => {
    expect(decide(['docs/CONTRIBUTING.md', 'content/REVIEW-STATUS.md'])).toBe('app=false');
  });

  it.each([
    ['app/src/routes/+page.svelte', 'the app itself'],
    ['schema/tree.schema.json', 'generated types depend on it'],
    ['tools/src/compile/index.ts', 'app: build runs lst compile'],
    ['package-lock.json', 'the dependency graph the build resolves'],
    ['eslint.config.js', 'the import rules §14.7 enforces'],
    ['.nvmrc', 'the Node version everything runs on'],
    ['.github/workflows/ci.yml', 'the gates themselves'],
  ])('runs them when %s changes (%s)', (file) => {
    expect(decide([file])).toBe('app=true');
  });

  it('runs them when a PR mixes content and app changes', () => {
    expect(decide(['content/trees/cooking.yaml', 'app/src/lib/layout/index.ts'])).toBe('app=true');
  });

  it('runs them when there is no base to diff against', () => {
    // workflow_dispatch. "Run everything" is the only safe reading of "I do not
    // know what changed".
    const { cwd } = repoWithChange(['content/trees/cooking.yaml']);
    expect(run(cwd, { BASE_SHA: '', HEAD_SHA: '' }).out).toContain('app=true');
  });

  it('fails loudly when the base commit is missing from the checkout', () => {
    // The shallow-checkout trap in its second costume: an unresolvable base
    // would otherwise diff to nothing and read as a content-only PR, silently
    // skipping every app gate on an app-only change.
    const { cwd, head } = repoWithChange(['app/src/routes/+page.svelte']);
    const result = run(cwd, { BASE_SHA: '0'.repeat(40), HEAD_SHA: head });
    expect(result.status).not.toBe(0);
    expect(result.out).toContain('fetch-depth: 0');
    expect(result.out).not.toContain('app=false');
  });
});
