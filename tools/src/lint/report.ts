import type { SourcePosition } from '../shared/yaml-source.js';

/** The seven §6.3 rules. Advisory, every one of them. */
export type LintRuleId =
  | 'vague-milestone'
  | 'professionalization-tier'
  | 'group-shape-drift'
  | 'track-overuse'
  | 'lonely-track'
  | 'level-pacing'
  | 'orphan-milestone';

export interface LintFinding {
  rule: LintRuleId;
  file: string;
  line: number;
  column: number;
  message: string;
}

/**
 * A finding carries no severity and no "fatal" flag, and that is deliberate:
 * §6.3 gives the linter no way to fail a merge, so there is nothing for a
 * severity to select between. Promoting a rule to a gate (R-04) is a change in
 * `lint/index.ts`'s exit wiring, not a field added here.
 */
export class LintReport {
  readonly findings: LintFinding[] = [];

  add(finding: LintFinding): void {
    this.findings.push(finding);
  }

  addAt(rule: LintRuleId, file: string, position: SourcePosition, message: string): void {
    this.add({ rule, file, line: position.line, column: position.column, message });
  }

  format(finding: LintFinding): string {
    return `${finding.file}:${finding.line}:${finding.column}: [${finding.rule}] ${finding.message}`;
  }

  /** Advisory output goes to stdout — stderr is where the gates write. */
  print(): void {
    for (const finding of this.findings) {
      console.log(this.format(finding));
    }
  }
}
