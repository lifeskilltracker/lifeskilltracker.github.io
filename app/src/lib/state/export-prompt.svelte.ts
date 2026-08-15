/**
 * Whether §12.7's export prompt is on screen, and why (T18).
 *
 * A fourth rune store beside the mirror, the content store, and `ui`. It is not
 * folded into `ui.notices` even though it renders in the same host: a notice is
 * transient by construction and carries no memory, while this one's dismissal is
 * **persisted per trigger in `META`** (T26/F15) and its `reason` is what the
 * dismissal is recorded against. Pushing it through the notice array would lose
 * the reason at exactly the moment it is needed.
 *
 * What is held here is only "is it up, and on account of what". The decision
 * lives in the pure `./export-prompt.js`, and the reading and writing live in
 * `lib/actions` — §14.1's rule that a cross-subsystem sequence has one home.
 */

import type { ExportTrigger } from './export-prompt.js';

/**
 * §16.3's quota row is a fourth reason to prompt, and it is deliberately not an
 * `ExportTrigger`: the three triggers are conditions §12.7 evaluates, while this
 * one is an event that already happened. It has no re-arming rule and nothing to
 * persist — the write failed, the user is told, and next session starts clean.
 */
export type PromptReason = ExportTrigger | 'write-failed';

class ExportPromptState {
  /** Null when nothing is on screen. */
  reason = $state<PromptReason | null>(null);

  get visible(): boolean {
    return this.reason !== null;
  }

  show(reason: PromptReason): void {
    this.reason = reason;
  }

  clear(): void {
    this.reason = null;
  }

  /** Test seam: a fresh session. */
  reset(): void {
    this.reason = null;
  }
}

export const exportPrompt = new ExportPromptState();
