/**
 * §12.7's three export-prompt triggers, and the dismissals that re-arm them
 * (T18, T26/F15).
 *
 * Every case here is a boundary. §12.7 states the triggers as thresholds — ten
 * completions, thirty days, sixty percent — and a threshold implemented one step
 * out is a prompt that fires for the wrong user and is invisible in any test
 * that only checks the firing case. So each trigger is asserted firing on its
 * boundary and silent one step below it.
 *
 * The other half is F15's per-trigger dismissal. A single global "dismissed"
 * flag silences everything forever, and session-scoped memory re-prompts on
 * every reload — which is the nagging §12.7's `lastExportAt` sentence exists to
 * prevent. Each trigger re-arms on its own terms, so no timer is stored.
 */

import { describe, expect, it } from 'vitest';
import {
  COMPLETIONS_FOR_FIRST_PROMPT,
  QUOTA_PROMPT_PERCENT,
  QUOTA_REARM_STEP,
  STALE_EXPORT_DAYS,
  evaluateExportPrompt,
  recordDismissal,
  type Dismissals,
  type PromptInputs,
} from './export-prompt.js';

const NOW = '2026-08-15T12:00:00.000Z';

const daysBefore = (days: number, from: string = NOW): string =>
  new Date(Date.parse(from) - days * 24 * 60 * 60 * 1000).toISOString();

const inputs = (overrides: Partial<PromptInputs> = {}): PromptInputs => ({
  now: NOW,
  completions: 0,
  usage: 0,
  quota: 1_000_000,
  dismissals: {},
  ...overrides,
});

describe('trigger 1 — never exported, with real work recorded (§12.7)', () => {
  it('fires at ten completions with no export ever recorded', () => {
    expect(evaluateExportPrompt(inputs({ completions: COMPLETIONS_FOR_FIRST_PROMPT }))).toBe(
      'never-exported',
    );
  });

  it('does not fire at nine', () => {
    expect(
      evaluateExportPrompt(inputs({ completions: COMPLETIONS_FOR_FIRST_PROMPT - 1 })),
    ).toBeNull();
  });

  it('does not fire once an export exists, however many completions there are', () => {
    expect(
      evaluateExportPrompt(inputs({ completions: 500, lastExportAt: daysBefore(1) })),
    ).toBeNull();
  });

  /** F15: a one-time nudge. T2 takes over after thirty days. */
  it('never re-arms after a dismissal', () => {
    const dismissals = recordDismissal(
      'never-exported',
      inputs({ completions: 10 }),
      {},
    );

    expect(evaluateExportPrompt(inputs({ completions: 10, dismissals }))).toBeNull();
    expect(evaluateExportPrompt(inputs({ completions: 9000, dismissals }))).toBeNull();
  });
});

describe('trigger 2 — a stale export with new activity since (§12.7)', () => {
  const stale = (days: number, activity?: string): PromptInputs =>
    inputs({
      lastExportAt: daysBefore(days),
      ...(activity === undefined ? {} : { lastActivityAt: activity }),
    });

  it('fires at thirty-one days when there is activity newer than the export', () => {
    expect(
      evaluateExportPrompt(stale(STALE_EXPORT_DAYS + 1, daysBefore(2))),
    ).toBe('stale-export');
  });

  it('does not fire at thirty-one days with no activity since the export', () => {
    expect(
      evaluateExportPrompt(stale(STALE_EXPORT_DAYS + 1, daysBefore(STALE_EXPORT_DAYS + 5))),
    ).toBeNull();
  });

  it('does not fire at thirty-one days when there has been no activity at all', () => {
    expect(evaluateExportPrompt(stale(STALE_EXPORT_DAYS + 1))).toBeNull();
  });

  it('does not fire at twenty-nine days even with activity since', () => {
    expect(evaluateExportPrompt(stale(STALE_EXPORT_DAYS - 1, daysBefore(1)))).toBeNull();
  });

  /**
   * T26/F15: "new activity" is `lastActivityAt > lastExportAt`, string-compared
   * as ISO-8601 UTC (§12.2). F19 made `SKILL.lastActivityAt` a total,
   * forward-only watermark written on **every** mutation — un-completing
   * included — so a user who has been dismissing and re-ticking has unbacked-up
   * work like anyone else.
   */
  it('counts activity that completed nothing', () => {
    expect(
      evaluateExportPrompt(
        stale(STALE_EXPORT_DAYS + 1, daysBefore(1)) satisfies PromptInputs,
      ),
    ).toBe('stale-export');
  });

  /** F15: a dismissal costs one window; the next window re-arms it. */
  it('re-arms one window after a dismissal, not the next day', () => {
    const armed = stale(STALE_EXPORT_DAYS + 1, daysBefore(2));
    const dismissals = recordDismissal('stale-export', armed, {});

    const nextDay = { ...armed, now: daysBefore(-1), dismissals };
    expect(evaluateExportPrompt(nextDay)).toBeNull();

    const nextWindow = { ...armed, now: daysBefore(-(STALE_EXPORT_DAYS + 1)), dismissals };
    expect(evaluateExportPrompt(nextWindow)).toBe('stale-export');
  });

  it('goes quiet at the next export without needing the dismissal cleared', () => {
    const armed = stale(STALE_EXPORT_DAYS + 1, daysBefore(2));
    const dismissals = recordDismissal('stale-export', armed, {});

    const exported: PromptInputs = {
      ...armed,
      lastExportAt: daysBefore(0),
      lastActivityAt: daysBefore(2),
      dismissals,
    };
    expect(evaluateExportPrompt(exported)).toBeNull();
  });
});

describe('trigger 3 — estimated usage above sixty percent (§12.7, phase 2)', () => {
  const at = (percent: number, dismissals: Dismissals = {}): PromptInputs =>
    inputs({
      lastExportAt: daysBefore(1),
      lastActivityAt: daysBefore(2),
      usage: percent * 10_000,
      quota: 1_000_000,
      dismissals,
    });

  it('fires at sixty-one percent', () => {
    expect(evaluateExportPrompt(at(QUOTA_PROMPT_PERCENT + 1))).toBe('quota-pressure');
  });

  it('does not fire at fifty-nine percent', () => {
    expect(evaluateExportPrompt(at(QUOTA_PROMPT_PERCENT - 1))).toBeNull();
  });

  it('does not fire exactly at the threshold — §12.7 says above', () => {
    expect(evaluateExportPrompt(at(QUOTA_PROMPT_PERCENT))).toBeNull();
  });

  it('does not fire when the browser reports no quota at all', () => {
    // §12.7's degraded reading (T18's `durability`): zeroes, not a division by
    // zero that yields NaN and compares false everywhere in silence.
    expect(evaluateExportPrompt(inputs({ usage: 0, quota: 0, lastExportAt: daysBefore(1) }))).toBeNull();
  });

  /**
   * F15's watermark is the non-obvious one: without it, dismissing at 61%
   * silences the trigger through 99%.
   */
  it('re-arms ten percentage points past the dismissal watermark', () => {
    const dismissals = recordDismissal('quota-pressure', at(61), {});

    expect(evaluateExportPrompt(at(61, dismissals))).toBeNull();
    expect(evaluateExportPrompt(at(65, dismissals))).toBeNull();
    expect(evaluateExportPrompt(at(61 + QUOTA_REARM_STEP, dismissals))).toBe('quota-pressure');
  });
});

describe('the user who is already exporting is left alone (§12.7)', () => {
  it('says nothing when the last export is recent and usage is low', () => {
    expect(
      evaluateExportPrompt(
        inputs({
          completions: 400,
          lastExportAt: daysBefore(2),
          lastActivityAt: daysBefore(1),
          usage: 100_000,
          quota: 1_000_000,
        }),
      ),
    ).toBeNull();
  });

  it('says nothing to a user with no export and almost no work', () => {
    expect(evaluateExportPrompt(inputs({ completions: 1 }))).toBeNull();
  });
});

describe('a dismissal records one trigger and never touches the others', () => {
  it('leaves the other two armed', () => {
    const dismissals = recordDismissal('never-exported', inputs({ completions: 10 }), {});

    expect(dismissals.neverExported).toBe(true);
    expect(dismissals.staleExportDismissedAt).toBeUndefined();
    expect(dismissals.quotaWatermarkPercent).toBeUndefined();
  });

  it('preserves dismissals already recorded', () => {
    const first = recordDismissal('never-exported', inputs({ completions: 10 }), {});
    const second = recordDismissal(
      'quota-pressure',
      inputs({ usage: 700_000, quota: 1_000_000, dismissals: first }),
      first,
    );

    expect(second.neverExported).toBe(true);
    expect(second.quotaWatermarkPercent).toBe(70);
  });
});
