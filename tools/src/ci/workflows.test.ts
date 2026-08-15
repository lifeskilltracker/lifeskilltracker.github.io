/**
 * §6.5's job graph, asserted against the workflow files themselves.
 *
 * A workflow is only really exercised by a pull request, and the acceptance
 * criteria T25 can only check that way are listed in the task doc for a human
 * to run once the repository exists. Everything below is the half that does not
 * need a remote: the shape of the graph, and the four ways it has already been
 * got wrong on paper.
 *
 * These are regression tests for **decisions**, not for YAML formatting. Each
 * one corresponds to a hazard that produced a wrong workflow at some point in
 * this task's history: the workflow-level path filter that blocks every content
 * PR in Pending, the `content: compile` gate riding on a job that skips
 * (T26/F24), the depth-1 checkout that makes §6.4 pass on nothing (T26/F6), and
 * a deploy that could be triggered from a pull request.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(__dirname, '../../..');
const WORKFLOWS = join(REPO_ROOT, '.github/workflows');

interface Step {
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
  name?: string;
}
interface Job {
  name?: string;
  needs?: string | string[];
  if?: string;
  steps?: Step[];
  outputs?: Record<string, string>;
}
interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, Job>;
}

function load(file: string): { workflow: Workflow; source: string } {
  const source = readFileSync(join(WORKFLOWS, file), 'utf8');
  return { workflow: parse(source) as Workflow, source };
}

const ci = load('ci.yml');
const deploy = load('deploy.yml');

const jobNames = (workflow: Workflow): string[] =>
  Object.values(workflow.jobs).map((job) => job.name ?? '');

const needsOf = (job: Job): string[] =>
  job.needs === undefined ? [] : Array.isArray(job.needs) ? job.needs : [job.needs];

/** Every step of one job, flattened to the commands it runs. */
const runs = (job: Job): string =>
  (job.steps ?? []).map((step) => step.run ?? step.uses ?? '').join('\n');

describe('§6.5 — the CI job graph', () => {
  const GATING = [
    'content: validate',
    'content: baseline',
    'content: status',
    'content: compile',
    'app: typecheck',
    'app: test',
    'app: build',
  ];

  it('defines exactly the seven gating jobs and one advisory job', () => {
    expect(jobNames(ci.workflow).sort()).toEqual([...GATING, 'content: lint', 'setup'].sort());
  });

  it('runs six jobs in parallel from setup, with compile behind validate', () => {
    const jobs = ci.workflow.jobs;
    const byName = Object.fromEntries(Object.values(jobs).map((job) => [job.name, job]));

    for (const name of [
      'content: validate',
      'content: baseline',
      'content: status',
      'content: lint',
      'app: typecheck',
      'app: test',
    ]) {
      expect(needsOf(byName[name])).toEqual(['setup']);
    }
    // The whole point of T26/F24: compile hangs off validate alone, so it never
    // skips with the app jobs.
    expect(needsOf(byName['content: compile'])).toEqual(['content-validate']);
    expect(needsOf(byName['app: build'])).toEqual([
      'setup',
      'app-typecheck',
      'app-test',
      'content-compile',
    ]);
  });

  it('uses no always() and no skipped-result expression anywhere', () => {
    // After F24 nothing needs one, and reaching for one is the symptom that
    // the graph has been rewired back into the shape F24 removed.
    // Every conditional in the file, job-level and step-level. Matching the
    // raw source would also match the comment explaining why none of these
    // exist, which is a test that punishes documentation.
    const conditions = Object.values(ci.workflow.jobs).flatMap((job) => [
      job.if ?? '',
      ...(job.steps ?? []).map((step) => step.if ?? ''),
    ]);
    for (const condition of conditions) {
      expect(condition).not.toMatch(/always\(/);
      expect(condition).not.toMatch(/skipped/);
    }
  });

  it('filters paths with a job-level if, never on.pull_request.paths', () => {
    // The workflow-level form stops the run, its required checks never report,
    // and the PR waits in Pending forever.
    const on = ci.workflow.on as { pull_request?: Record<string, unknown> | null };
    expect(on.pull_request ?? {}).not.toHaveProperty('paths');
    expect(on.pull_request ?? {}).not.toHaveProperty('paths-ignore');

    const filtered = Object.values(ci.workflow.jobs)
      .filter((job) => typeof job.if === 'string')
      .map((job) => job.name);
    expect(filtered.sort()).toEqual(['app: build', 'app: test', 'app: typecheck']);
  });

  it('skips only the app jobs on a content-only PR', () => {
    // Restated as a property of the filter rather than of the job list: no
    // content job may carry the condition, whatever it is called later.
    for (const job of Object.values(ci.workflow.jobs)) {
      if ((job.name ?? '').startsWith('content:')) expect(job.if).toBeUndefined();
    }
  });

  it('checks out the baseline job at full depth', () => {
    // T26/F6: at actions/checkout's default depth of 1 there is no origin/main,
    // and every §6.4 check passes on nothing.
    const baseline = Object.values(ci.workflow.jobs).find((job) => job.name === 'content: baseline');
    const checkout = (baseline?.steps ?? []).find((step) => step.uses?.startsWith('actions/checkout'));
    expect(checkout?.with?.['fetch-depth']).toBe(0);
    expect(runs(baseline as Job)).toContain('lst baseline --against origin/main');
  });

  it('computes the path filter from a full-depth checkout too', () => {
    const setup = Object.values(ci.workflow.jobs).find((job) => job.name === 'setup');
    const checkout = (setup?.steps ?? []).find((step) => step.uses?.startsWith('actions/checkout'));
    expect(checkout?.with?.['fetch-depth']).toBe(0);
  });

  it('keeps the advisory linter incapable of failing the job', () => {
    const lint = Object.values(ci.workflow.jobs).find((job) => job.name === 'content: lint');
    const command = runs(lint as Job);
    expect(command).toContain('lst lint --format github');
    // No `tee`, no `grep`, no `wc -l`: a step that inspects the output and
    // exits on it is a gate, whatever the linter's own exit code is (D-15).
    expect(command).not.toMatch(/\|\s*(grep|wc|tee)/);
    expect(lint?.if).toBeUndefined();
  });

  it('runs every §14.7 enforcement check and the §17.1 budget in app: build', () => {
    const build = Object.values(ci.workflow.jobs).find((job) => job.name === 'app: build');
    const command = runs(build as Job);
    expect(command).toContain('npm run check:s1');
    expect(command).toContain('npm run gen:types');
    expect(command).toContain('git diff --exit-code -- app/src/lib/types');
    expect(command).toContain('npm run check:budget');
    expect(command).toContain('check-pages-output.sh');
    // Import rules, purity and the monotonicity property tests ride on the two
    // app jobs rather than here.
    expect(runs(Object.values(ci.workflow.jobs).find((job) => job.name === 'app: typecheck') as Job)).toContain(
      'npx eslint .',
    );
    expect(runs(Object.values(ci.workflow.jobs).find((job) => job.name === 'app: test') as Job)).toContain(
      'npm test',
    );
  });
});

describe('§16.2 / D-12 — the deploy workflow', () => {
  it('triggers on push to main and never on a pull request', () => {
    const on = deploy.workflow.on as { push?: { branches?: string[] }; pull_request?: unknown };
    expect(on.push?.branches).toEqual(['main']);
    expect(on).not.toHaveProperty('pull_request');
  });

  it('sets the base path from the deploy environment and verifies the artifact', () => {
    const build = deploy.workflow.jobs.build;
    const command = runs(build);
    // BASE_PATH reaches `vite build` as step-level `env:`, which is why this
    // one reads the source rather than the flattened commands.
    expect(deploy.source).toMatch(/BASE_PATH:\s*\$\{\{\s*steps\.base\.outputs\.path\s*\}\}/);
    expect(command).toContain('check-pages-output.sh');
    expect(command).toContain('actions/upload-pages-artifact');
  });

  it('does not cancel a deploy in flight', () => {
    expect(deploy.source).toMatch(/cancel-in-progress:\s*false/);
  });
});
