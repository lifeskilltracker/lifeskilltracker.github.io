import { defaultRepoRoot } from '../shared/paths.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR, EXIT_VALIDATION_FAILED } from '../shared/exit-codes.js';
import { applyAliasFixes } from './autofix.js';
import {
  checkPlacementLedger,
  checkTreePair,
  checkTreeSet,
  type BaselineFinding,
} from './checks.js';
import {
  BaselineUnavailableError,
  DEFAULT_BASELINE_REF,
  readBaselineLedger,
  readBaselineSnapshot,
  readHeadLedger,
  readHeadSnapshot,
} from './diff.js';

function resolveRepoRoot(repoRoot?: string): string {
  return repoRoot ?? process.env.LST_REPO_ROOT ?? defaultRepoRoot;
}

export interface BaselineOptions {
  repoRoot?: string;
  /** Baseline ref; §6.4 fixes it at the tip of `origin/main`. */
  against?: string;
  /** Apply check 4's alias patch to the working tree. */
  fix?: boolean;
}

export interface BaselineResult {
  ref: string;
  findings: BaselineFinding[];
  /** Files rewritten by `--fix`. */
  fixed: string[];
}

/**
 * §6.4 in full: nine checks, the baseline being the tip of `origin/main` and
 * the head being the PR merged into it.
 *
 * **Checks 1–7 range over trees present on both sides; check 8 ranges over the
 * set; check 9 ranges over the placement ledger.** The alternative reading — check 1 quantifying over every baseline uid
 * repository-wide — is not merely a different scope but a wrong one: under it a
 * `moved` uid would satisfy check 1 simply by existing in its destination tree,
 * and the `moved` disposition would never be needed at all.
 */
export function runBaseline(options: BaselineOptions = {}): BaselineResult {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const ref = options.against ?? DEFAULT_BASELINE_REF;

  const baseline = readBaselineSnapshot(repoRoot, ref);
  const head = readHeadSnapshot(repoRoot);

  const findings: BaselineFinding[] = [];
  for (const [treeId, before] of baseline) {
    const after = head.get(treeId);
    if (!after) {
      // Deletion is check 8's; checks 1–7 have nothing to diff against.
      continue;
    }
    findings.push(...checkTreePair(before, after));
  }
  findings.push(...checkTreeSet(baseline, head));
  findings.push(
    ...checkPlacementLedger(readBaselineLedger(repoRoot, ref), readHeadLedger(repoRoot)),
  );

  if (!options.fix) {
    return { ref, findings, fixed: [] };
  }

  const fixed = applyAliasFixes(
    findings.flatMap((finding) => (finding.fix ? [finding.fix] : [])),
  );
  return { ref, findings, fixed };
}

export function baselineCommand(options: BaselineOptions = {}): number {
  try {
    const result = runBaseline(options);
    for (const file of result.fixed) {
      console.log(`fixed: ${file}`);
    }

    // A fixed finding is no longer a violation, so re-run rather than reporting
    // what we just repaired — otherwise `--fix` could never exit 0.
    const remaining = result.fixed.length > 0 ? runBaseline({ ...options, fix: false }).findings : result.findings;

    for (const finding of remaining) {
      console.error(`[check ${finding.check}] ${finding.treeId}: ${finding.message}`);
    }
    return remaining.length > 0 ? EXIT_VALIDATION_FAILED : EXIT_OK;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof BaselineUnavailableError ? EXIT_VALIDATION_FAILED : EXIT_RUNTIME_ERROR;
  }
}

export { BaselineUnavailableError };
export type { BaselineFinding } from './checks.js';
