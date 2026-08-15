import { relative } from 'node:path';

import type { SourcePosition } from '../shared/yaml-source.js';

/**
 * How findings reach a reader. `text` is the terminal form; `github` is the
 * workflow-command form §6.5's advisory job uses (T25 — T22 deliberately left
 * the annotation mechanism to whoever wired the job).
 *
 * Native workflow commands were chosen over a reviewdog-style bot or the checks
 * API for one reason: `::warning` **cannot** fail a job. A bot posts through a
 * step that can fail on a bad token or a rate limit, and a step that can fail
 * on a PR with findings is indistinguishable, from the contributor's side, from
 * a linter that gates. D-15 says it never does.
 */
export type LintFormat = 'text' | 'github';

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

  /**
   * A GitHub workflow command, which the Actions runner turns into an inline
   * annotation on the PR diff.
   *
   * `file=` must be **repository-relative** or the annotation lands nowhere:
   * the runner resolves it against the workspace, and an absolute path from the
   * runner's own filesystem silently matches no file in the diff. Findings
   * carry absolute paths, so this is where they are made relative.
   *
   * The message is escaped per Actions' own rules — a raw `%`, CR, or LF ends
   * the command early and truncates the annotation.
   */
  formatGithub(finding: LintFinding, repoRoot: string): string {
    const file = relative(repoRoot, finding.file) || finding.file;
    const message = finding.message
      .replaceAll('%', '%25')
      .replaceAll('\r', '%0D')
      .replaceAll('\n', '%0A');
    return (
      `::warning file=${file},line=${finding.line},col=${finding.column},` +
      `title=lst lint (${finding.rule})::${message}`
    );
  }

  /** Advisory output goes to stdout — stderr is where the gates write. */
  print(format: LintFormat = 'text', repoRoot = process.cwd()): void {
    for (const finding of this.findings) {
      console.log(format === 'github' ? this.formatGithub(finding, repoRoot) : this.format(finding));
    }
  }
}
