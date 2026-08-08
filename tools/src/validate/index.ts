import { checkMapRules } from './map-rules.js';
import { loadValidationContext, type ValidationContext } from './context.js';
import { ValidationReport } from './report.js';
import { validateSchemaDocument } from './schema.js';
import { checkRule1Levels, checkRule2Identifiers, checkRule16MissingUids } from './rules/identifiers.js';
import { checkRule15Lineage } from './rules/lineage.js';
import {
  checkRule13Copyleft,
  checkRule14MasteryShape,
  checkRules9To12References,
} from './rules/references.js';
import { checkRules6To8Requirements } from './rules/requirements.js';
import { checkRules3To5Requires } from './rules/requires.js';
import { defaultRepoRoot } from '../shared/paths.js';
import { EXIT_OK, EXIT_VALIDATION_FAILED } from '../shared/exit-codes.js';

function resolveRepoRoot(repoRoot?: string): string {
  return repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
}

export interface ValidateOptions {
  repoRoot?: string;
  files?: string[];
}

export interface ValidateResult {
  report: ValidationReport;
  ctx: ValidationContext;
  exitIssues: ReturnType<ValidationReport['issuesForExit']>;
}

function runValidateOnContext(ctx: ValidationContext): ValidationReport {
  const report = new ValidationReport();

  for (const loaded of ctx.treeDocuments.values()) {
    validateSchemaDocument('tree', loaded, report);
  }
  if (ctx.domains) {
    validateSchemaDocument('domains', ctx.domains, report);
  }
  if (ctx.facets) {
    validateSchemaDocument('facets', ctx.facets, report);
  }
  if (ctx.map) {
    validateSchemaDocument('map', ctx.map, report);
  }

  checkRule1Levels(ctx, report);
  checkRule2Identifiers(ctx, report);
  checkRules3To5Requires(ctx, report);
  checkRules6To8Requirements(ctx, report);
  checkRules9To12References(ctx, report);
  checkRule13Copyleft(ctx, report);
  checkRule14MasteryShape(ctx, report);
  checkRule15Lineage(ctx, report);
  checkRule16MissingUids(ctx, report);
  checkMapRules(ctx, report);

  return report;
}

export function runValidate(options: ValidateOptions = {}): ValidateResult {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const files = options.files ?? [];
  const ctx = loadValidationContext(repoRoot, files);
  const report = runValidateOnContext(ctx);
  const exitIssues = report.issuesForExit(ctx);
  return { report, ctx, exitIssues };
}

export function validateCommand(files: string[], repoRoot?: string): number {
  const resolvedRoot = resolveRepoRoot(repoRoot);
  const { report, exitIssues } = runValidate({ repoRoot: resolvedRoot, files });
  report.print(exitIssues);
  return exitIssues.length > 0 ? EXIT_VALIDATION_FAILED : EXIT_OK;
}

export { ValidationReport };
export type { ValidationIssue } from './report.js';
