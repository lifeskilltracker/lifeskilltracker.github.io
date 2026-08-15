/**
 * §12.7's export prompting, wired up (T18).
 *
 * It lives in `lib/actions` because it is a sequence across the store, the
 * §13.2 mirror, the Storage API, and §13.4's notice host — and §14.1 gives that
 * combination exactly one home. The decision itself is pure and lives in
 * `lib/state/export-prompt.js`; nothing here re-implements a threshold.
 *
 * **F39 is the whole mitigation for R-18, not a nicety.** §19.3 accepts that
 * browser storage is not durable — ITP evicts after seven days of non-use for
 * non-installed sites, IndexedDB and `localStorage` alike (§12.1), and
 * `persist()` is effectively unavailable on Safari. The only irreplaceable data
 * in the system has no account behind it and no telemetry watching it (§16.5,
 * R-15), so a prompt that never fires is a silent data-loss bug.
 *
 * **And it must not nag.** §12.7 puts `lastExportAt` in `META` precisely so a
 * user who already exports is left alone, and T26/F15 makes each dismissal
 * per-trigger and persistent for the same reason. The failure mode on this side
 * is a prompt that reappears every reload until it is reflexively ignored, which
 * costs the same data as never prompting at all.
 */

import {
  evaluateExportPrompt,
  recordDismissal,
  type ExportTrigger,
  type PromptInputs,
} from '$lib/state/export-prompt.js';
import { exportPrompt } from '$lib/state/export-prompt.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store as defaultStore, type UserStateStore } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';

/** The slice of §14.5 this sequence needs, so a test can hand it a real store. */
export type ExportPromptStore = Pick<
  UserStateStore,
  'storageStatus' | 'exportPromptDismissals' | 'recordExportPromptDismissal'
>;

export interface ExportPromptDeps {
  store: ExportPromptStore;
  /** ISO-8601 UTC. Injected so §12.7's thirty-day boundary is testable. */
  now: string;
}

const defaults = (deps: Partial<ExportPromptDeps>): ExportPromptDeps => ({
  store: deps.store ?? defaultStore,
  now: deps.now ?? new Date().toISOString(),
});

/**
 * §12.7 counts **completions**, not milestone rows. A dismissed milestone is the
 * user declining one (F46), which is not work they would grieve losing, and
 * counting it would trip the ten-completion trigger for someone who has recorded
 * almost nothing.
 */
function completionCount(): number {
  let count = 0;
  for (const record of Object.values(progress.milestones)) {
    if (record.state === 'complete') count += 1;
  }
  return count;
}

/**
 * The newest `SKILL.lastActivityAt` across every skill (T26/F15, F19).
 *
 * Compared as an ISO-8601 UTC string, which §12.2 guarantees and §11.7 already
 * relies on. Not a max over `MILESTONE.at`: F19 made `lastActivityAt` a total,
 * forward-only watermark written on every mutation, so it already dominates
 * every `at` in its tree, and consulting both would be redundant.
 */
function newestActivity(): string | undefined {
  let newest: string | undefined;
  for (const skill of Object.values(progress.skills)) {
    if (newest === undefined || skill.lastActivityAt > newest) newest = skill.lastActivityAt;
  }
  return newest;
}

async function gather(deps: ExportPromptDeps): Promise<PromptInputs> {
  // `storageStatus()` polls `navigator.storage.estimate()` through
  // `durability` (§12.7's session-start poll) and reads `META.lastExportAt` in
  // the same call, so the prompt and `/data` never disagree about either.
  const status = await deps.store.storageStatus();
  const dismissals = await deps.store.exportPromptDismissals();
  const lastActivityAt = newestActivity();

  return {
    now: deps.now,
    ...(status.lastExportAt === undefined ? {} : { lastExportAt: status.lastExportAt }),
    completions: completionCount(),
    ...(lastActivityAt === undefined ? {} : { lastActivityAt }),
    usage: status.usage,
    quota: status.quota,
    dismissals,
  };
}

/**
 * Evaluates §12.7's three triggers and puts the prompt on screen, or takes it
 * off. Called at session start, and again after an export so a user who has just
 * backed up is not still looking at a suggestion to back up.
 *
 * It never rejects. Nothing about a durability *reminder* is worth failing a
 * session over, and §16.3's rule that a read failure must never become a silent
 * success cuts the other way here — there is no write to be wrong about.
 *
 * A `write-failed` prompt is left alone: §16.3 raised it because a write really
 * did fail, and none of §12.7's three conditions is a statement about that.
 */
export async function refreshExportPrompt(
  overrides: Partial<ExportPromptDeps> = {},
): Promise<ExportTrigger | null> {
  const deps = defaults(overrides);

  let trigger: ExportTrigger | null;
  try {
    trigger = evaluateExportPrompt(await gather(deps));
  } catch {
    // A storage read that failed tells us nothing about whether to prompt, and
    // guessing "yes" would nag exactly the user whose browser is already unwell.
    return null;
  }

  if (exportPrompt.reason === 'write-failed') return trigger;
  if (trigger === null) exportPrompt.clear();
  else exportPrompt.show(trigger);
  return trigger;
}

/**
 * The user waved it away. Records the dismissal against **the trigger that
 * raised it** (T26/F15) and takes the prompt off screen.
 *
 * It does not write `lastExportAt`. That would be the app telling itself a
 * backup exists that does not, silencing every later trigger — the single worst
 * bug this file could contain.
 */
export async function dismissExportPrompt(
  overrides: Partial<ExportPromptDeps> = {},
): Promise<void> {
  const deps = defaults(overrides);
  const reason = exportPrompt.reason;
  if (reason === null) return;

  exportPrompt.clear();

  // §16.3's quota prompt is an event rather than a condition: there is no
  // re-arming rule to record, and next session starts clean.
  if (reason === 'write-failed') return;

  try {
    const inputs = await gather(deps);
    await deps.store.recordExportPromptDismissal(
      recordDismissal(reason, inputs, inputs.dismissals),
    );
  } catch {
    // Dismissal is a UI act first and a record second. A session that could not
    // write the record still gets its prompt closed; it returns next session,
    // which is the safe direction to fail in.
  }
}

/**
 * §16.3's quota row: "IndexedDB write fails (quota) — surface immediately, do
 * not update the UI as though it succeeded, prompt export."
 *
 * The middle clause is structural rather than handled here: §12.4 runs each
 * write in one transaction and refreshes §13.2's mirror only on commit, so a
 * failed write leaves the mirror — and therefore everything derived from it —
 * exactly as it was. What is left for this function is the other two clauses.
 *
 * The prompt is raised regardless of §12.7's triggers. A user whose writes are
 * failing needs an export whether or not they exported last week.
 */
export function reportWriteFailure(error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  ui.notify(
    'error',
    'That change was not saved. Your browser refused the write, so what is on screen ' +
      'is the last state that did save.',
    detail,
  );
  exportPrompt.show('write-failed');
}
