import { loadValidationContext } from '../validate/context.js';
import { defaultRepoRoot } from '../shared/paths.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR } from '../shared/exit-codes.js';
import { createTreeLintContext } from './context.js';
import { LINT_RULES } from './rules/index.js';
import { LintReport, type LintFormat } from './report.js';

function resolveRepoRoot(repoRoot?: string): string {
  return repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
}

export interface LintOptions {
  repoRoot?: string;
  files?: string[];
}

export function runLint(options: LintOptions = {}): LintReport {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const files = options.files ?? [];
  const ctx = loadValidationContext(repoRoot, files);
  const report = new LintReport();

  for (const [filePath, loaded] of ctx.treeDocuments) {
    if (ctx.reportFiles != null && !ctx.reportFiles.has(filePath)) {
      continue;
    }
    const treeCtx = createTreeLintContext(loaded);
    for (const rule of LINT_RULES) {
      rule.run(treeCtx, report);
    }
  }

  return report;
}

/**
 * **The exit code is 0, always** — the single structural enforcement of D-15
 * and D-16. §6.3 gives the linter one job, annotating the PR, and explicitly
 * denies it the power to block a merge; a nonzero path added here is a bug in
 * this command, not a stricter reading of it. Promotion of an individual rule
 * to a gate (R-04) is a maintainer decision made on evidence and is the only
 * thing that may ever change this function.
 *
 * A crash is not a finding, so a tree that cannot be parsed still reports a
 * runtime error — the linter failing to run is not the linter passing.
 */
export function lintCommand(
  files: string[],
  repoRoot?: string,
  format: LintFormat = 'text',
): number {
  const root = resolveRepoRoot(repoRoot);
  try {
    runLint({ repoRoot: root, files }).print(format, root);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_RUNTIME_ERROR;
  }
  return EXIT_OK;
}

export { LintReport };
export type { LintFinding, LintFormat, LintRuleId } from './report.js';
