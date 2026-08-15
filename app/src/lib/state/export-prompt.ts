/**
 * §12.7's export-prompt decision — pure, and deliberately so (T18).
 *
 * This module answers one question: *given what the store knows, should the app
 * suggest an export, and on account of which trigger?* It reads nothing, writes
 * nothing, and knows no clock; the caller in `lib/actions` gathers the inputs and
 * owns the persistence. That is what makes §12.7's three thresholds testable at
 * their boundaries, which is the only way a threshold is ever actually right.
 *
 * **The triggers do not consult the persistence grant.** R-18 is explicit that
 * `persist()` is effectively unavailable on Safari, which is also where eviction
 * is likeliest; a prompt that only fired when persistence had been denied would
 * be silent on Chrome and noisy nowhere useful. §12.7's three conditions are the
 * whole list, and `durability.persistOutcome` is display-only.
 *
 * **Dismissal is per-trigger and persisted** (T26/F15). One global flag in `META`
 * silences everything forever; session-scoped memory re-prompts on every reload,
 * which is the nagging §12.7's `lastExportAt` sentence exists to prevent. Each
 * trigger re-arms on its own terms, so no timer is stored anywhere:
 *
 * | Trigger | Re-arms |
 * |---|---|
 * | `never-exported` | Never — a one-time nudge, superseded by `stale-export` after thirty days |
 * | `stale-export`   | One window later. A dismissal costs one window; an export ends it outright |
 * | `quota-pressure` | Ten percentage points past the watermark stored at dismissal |
 */

/** §12.7's three conditions, in the order the spec lists them. */
export type ExportTrigger = 'never-exported' | 'stale-export' | 'quota-pressure';

export const COMPLETIONS_FOR_FIRST_PROMPT = 10;
export const STALE_EXPORT_DAYS = 30;
export const QUOTA_PROMPT_PERCENT = 60;
/** F15's watermark step: without it, dismissing at 61% silences 61–99%. */
export const QUOTA_REARM_STEP = 10;

/** The `META` key holding `Dismissals` (§12.2's key/value store). */
export const EXPORT_PROMPT_DISMISSALS_KEY = 'exportPromptDismissals';

/** What the user has already waved away, and on what terms (T26/F15). */
export interface Dismissals {
  /** `never-exported` was dismissed. One-time, so this never expires. */
  neverExported?: boolean;
  /** When `stale-export` was dismissed. Re-arms one window later. */
  staleExportDismissedAt?: string;
  /** Usage percentage at the moment `quota-pressure` was dismissed. */
  quotaWatermarkPercent?: number;
}

export interface PromptInputs {
  /** ISO-8601 UTC, injected rather than read, so the boundaries are testable. */
  now: string;
  /** `META.lastExportAt` (§12.6 writes it; §12.7 reads it). */
  lastExportAt?: string;
  /** `MILESTONE` rows in state `complete`. §12.7 counts completions, not records. */
  completions: number;
  /** The newest `SKILL.lastActivityAt` — F19's total, forward-only watermark. */
  lastActivityAt?: string;
  usage: number;
  quota: number;
  dismissals: Dismissals;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const daysBetween = (from: string, to: string): number =>
  (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;

/**
 * Usage as whole percentage points, or null when the browser gave no quota.
 * A zero quota is the degraded reading from `durability.pollEstimate()`, and
 * dividing by it would produce `NaN`, which compares false against every
 * threshold — a trigger that never fires and never says why.
 */
function usagePercent(inputs: PromptInputs): number | null {
  if (inputs.quota <= 0) return null;
  return (inputs.usage / inputs.quota) * 100;
}

/**
 * T26/F15: "new activity since" is `lastActivityAt > lastExportAt`, compared as
 * ISO-8601 UTC strings (§12.2 guarantees the format, and §11.7 already depends on
 * that comparison being lexicographic).
 *
 * Deliberately *activity* rather than *completions*, and deliberately not a max
 * over `MILESTONE.at`: F19 made `SKILL.lastActivityAt` a total, forward-only
 * watermark written on every mutation, so it already dominates every `at` in its
 * tree — and a user who has spent a month un-checking and re-checking has
 * unbacked-up work like anyone else.
 */
function activitySince(inputs: PromptInputs, lastExportAt: string): boolean {
  return inputs.lastActivityAt !== undefined && inputs.lastActivityAt > lastExportAt;
}

/**
 * The disjunction of §12.7, evaluated in the order the spec lists it. Returns
 * the trigger to attribute the prompt to, or null for silence.
 *
 * Triggers 1 and 2 are mutually exclusive by construction — one requires
 * `lastExportAt` absent and the other requires it present — so the ordering only
 * decides what a user who is both stale and near quota is told, and §12.7 gives
 * them the same message either way.
 */
export function evaluateExportPrompt(inputs: PromptInputs): ExportTrigger | null {
  const { dismissals, lastExportAt } = inputs;

  // 1 — no export ever recorded and ten or more completions.
  if (lastExportAt === undefined) {
    if (inputs.completions >= COMPLETIONS_FOR_FIRST_PROMPT && dismissals.neverExported !== true) {
      return 'never-exported';
    }
  } else if (
    // 2 — more than thirty days since the last export, with new activity since.
    daysBetween(lastExportAt, inputs.now) > STALE_EXPORT_DAYS &&
    activitySince(inputs, lastExportAt) &&
    (dismissals.staleExportDismissedAt === undefined ||
      daysBetween(dismissals.staleExportDismissedAt, inputs.now) > STALE_EXPORT_DAYS)
  ) {
    return 'stale-export';
  }

  // 3 — estimated usage above sixty percent. §12.7 labels this phase 2 (§17.4):
  // a phase 1 user is nowhere near it, and it is built so phase 2's photos
  // (§12.8, R-06) arrive to a threshold that already works.
  const percent = usagePercent(inputs);
  if (percent !== null && percent > QUOTA_PROMPT_PERCENT) {
    const watermark = inputs.dismissals.quotaWatermarkPercent;
    if (watermark === undefined || percent >= watermark + QUOTA_REARM_STEP) {
      return 'quota-pressure';
    }
  }

  return null;
}

/**
 * The `Dismissals` record to store after the user waves this prompt away.
 * Additive: dismissing one trigger must leave the other two armed, or F15's
 * per-trigger design collapses back into the single global flag it rejected.
 */
export function recordDismissal(
  trigger: ExportTrigger,
  inputs: PromptInputs,
  previous: Dismissals,
): Dismissals {
  switch (trigger) {
    case 'never-exported':
      return { ...previous, neverExported: true };
    case 'stale-export':
      return { ...previous, staleExportDismissedAt: inputs.now };
    case 'quota-pressure': {
      const percent = usagePercent(inputs);
      // A dismissal with no quota reading stores no watermark rather than a
      // zero, which would re-arm at 10% and prompt a user who is nowhere near.
      return percent === null
        ? previous
        : { ...previous, quotaWatermarkPercent: Math.floor(percent) };
    }
  }
}

/** Narrows an unknown `META` value; anything else is treated as no dismissals. */
export function readDismissals(value: unknown): Dismissals {
  if (typeof value !== 'object' || value === null) return {};
  const record = value as Record<string, unknown>;
  return {
    ...(record.neverExported === true ? { neverExported: true as const } : {}),
    ...(typeof record.staleExportDismissedAt === 'string'
      ? { staleExportDismissedAt: record.staleExportDismissedAt }
      : {}),
    ...(typeof record.quotaWatermarkPercent === 'number' &&
    Number.isFinite(record.quotaWatermarkPercent)
      ? { quotaWatermarkPercent: record.quotaWatermarkPercent }
      : {}),
  };
}
