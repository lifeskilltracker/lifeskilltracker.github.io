import type { ValidationContext } from './context.js';
import type { SourcePosition } from '../shared/yaml-source.js';

export interface ValidationIssue {
  file: string;
  line: number;
  column: number;
  rule?: string;
  message: string;
  /** When true, issue affects exit/print even if file is outside argv report scope. */
  forceReport?: boolean;
}

export class ValidationReport {
  readonly issues: ValidationIssue[] = [];

  add(issue: ValidationIssue): void {
    this.issues.push(issue);
  }

  addAt(
    file: string,
    position: SourcePosition,
    message: string,
    rule?: string,
    options?: { forceReport?: boolean },
  ): void {
    this.add({
      file,
      line: position.line,
      column: position.column,
      message,
      rule,
      forceReport: options?.forceReport,
    });
  }

  hasErrors(): boolean {
    return this.issues.length > 0;
  }

  /** Issues scoped to argv for tree/taxonomy files explicitly passed. */
  filtered(reportFiles: ReadonlySet<string> | null): ValidationIssue[] {
    if (reportFiles == null) {
      return [...this.issues];
    }
    return this.issues.filter(
      (issue) => issue.forceReport === true || reportFiles.has(issue.file),
    );
  }

  /** Issues that gate exit — includes forced map/taxonomy geometry failures. */
  issuesForExit(ctx: ValidationContext): ValidationIssue[] {
    return this.filtered(ctx.reportFiles);
  }

  formatIssue(issue: ValidationIssue): string {
    const prefix = issue.rule ? `[${issue.rule}] ` : '';
    return `${issue.file}:${issue.line}:${issue.column}: ${prefix}${issue.message}`;
  }

  print(issues: ValidationIssue[]): void {
    for (const issue of issues) {
      console.error(this.formatIssue(issue));
    }
  }
}
