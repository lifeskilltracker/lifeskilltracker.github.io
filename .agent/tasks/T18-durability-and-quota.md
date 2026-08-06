# T18 — Durability, quota, and export prompting

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 1 |
| **Cluster** | runtime-io |
| **Blocked by** | T16 |
| **Blocks** | — |
| **Spec** | ARCHITECTURE §12.7, §17.4 |
| **PRD** | F39, R-18 |

## Goal

The app asks the browser to make its storage persistent, measures how much of the quota it
is using, and tells the user — factually, non-modally, and without nagging — when they
should take an export. After this task `navigator.storage.persist()` is requested on the
first successful write, `navigator.storage.estimate()` is polled on session start,
`lastExportAt` in `META` gates the prompt so a user who already exports is left alone, and
the `/data` route shows storage estimate, last export, content version, and app version.
A quota-failed write surfaces immediately and prompts an export rather than pretending to
have succeeded.

## Why this shape

**R-18** is the reason this task is mandatory rather than a nicety: Safari's ITP evicts
script-writable storage after seven days of non-use for non-installed sites, and
`navigator.storage.persist()` is effectively unavailable there. §12.1 states the same thing
from the other direction — eviction is not a differentiator between IndexedDB and
`localStorage`, so **no storage choice avoids it**, and the architecture must not pretend
one does. F39's export prompting is therefore the entire mitigation for the only
irreplaceable data in the system. §17.4 sharpens what the prompting is *for*: phase 1's
heavy user lands under 1 MB, far inside any quota, so in phase 1 this is about **eviction,
not exhaustion**. That is why the tone is specified as factual rather than alarming — the
honest message is "the browser can clear this and export is the only backup", not "you are
running out of space".

## Scope

**In scope**

- Requesting `navigator.storage.persist()` on the **first successful write**, recording the
  outcome, and never branching on it.
- Polling `navigator.storage.estimate()` on session start and exposing the result through
  `storageStatus()` (§14.5).
- All three export-prompt triggers of §12.7, evaluated against `META.lastExportAt` and the
  user's completion records.
- The prompt itself: **non-modal, dismissible, never blocking**, with §12.7's factual
  durability message.
- The `/data` route's storage-status panel: storage estimate, last export, content version,
  app version (§16.5).
- The §16.3 quota-failure branch: an IndexedDB write that fails on quota surfaces
  immediately, does not update the UI as though it succeeded, and prompts export.
- Dismissal state, so a dismissed prompt does not reappear within the same session.

**Out of scope**

- `export()` and `import()` themselves — **T16** (§12.6). This task decides *when* to
  suggest an export; T16 performs it and writes `lastExportAt`.
- The `META` store and `storageStatus()`'s plumbing — **T09** (§12.2, §14.5). This task
  consumes both.
- The orphan list on `/data` — **T17** (§12.5).
- A service worker, "add to home screen", or any install prompt. §12.7 notes Safari grants
  persistence effectively only to installed PWAs, but **PWA / offline hardening is Phase 2**
  (§16.4, `C2`), and so is anything that would chase that grant.
- Photo storage, downscaling, and the quota pressure that arrives with it — **Phase 2**,
  §12.8 and **R-06**. §17.4's ~75 MB row is phase 2's number, not a target to build against.
- Quota-driven eviction of *content*. Cache Storage holds content only and never shares a
  store with user data (§12.9); the Content Loader owns it (**T07**).
- Any telemetry about storage state. §16.5: none, ever, and an error reporter is user data
  leaving the device (N2).

## Deliverables

```
app/src/lib/state/durability.ts         persist() request, estimate() poll
app/src/lib/state/export-prompt.ts      the three §12.7 triggers, dismissal state
app/src/lib/components/ExportPrompt.svelte   non-modal, dismissible notice
app/src/lib/components/StorageStatus.svelte  the /data panel
app/src/lib/state/export-prompt.test.ts      one test per trigger, plus non-firing cases
app/src/lib/state/durability.test.ts         persist() outcomes; nothing depends on them
```

## Interface contract

The method this task consumes, verbatim from §14.5:

```ts
storageStatus(): Promise<{ usage: number; quota: number; lastExportAt?: string }>;
```

**The behaviour, verbatim from ARCHITECTURE §12.7:**

> - On first successful write, request `navigator.storage.persist()`. Granted, it exempts
>   the origin from routine eviction. Chrome grants it on engagement signals; Safari
>   effectively does not outside installed PWAs. Request it, do not depend on it.
> - Poll `navigator.storage.estimate()` on session start.
> - **Prompt for export** — non-modal, dismissible, never blocking — when any of: no export
>   ever recorded and the user has ten or more completions; more than thirty days since the
>   last export with new activity since; estimated usage above 60% of quota.
> - The durability message is factual rather than alarming: browser storage can be cleared
>   by the browser, by private-mode expiry, or by the user, and export is the only backup.
>   `lastExportAt` lives in `META` so the prompt does not nag a user who is already
>   exporting.

The three triggers, restated as the disjunction the implementation must evaluate:

| # | Condition | Source |
|---|---|---|
| 1 | no export ever recorded **and** ≥ 10 completions | §12.7 |
| 2 | > 30 days since the last export **and** new activity since | §12.7 |
| 3 | estimated usage > 60% of quota | §12.7 |

The storage budget, verbatim from §17.4:

| Phase | Heavy user | Note |
|---|---|---|
| Phase 1 (no photos) | < 1 MB | 50 skills × 60 milestones ≈ 3,000 records at ~200 bytes, plus notes |
| Phase 2 (photos) | ~75 MB | ~150 kB per WebP × 500 photos (§12.8) |

> Phase 1 is far inside any browser's quota, so §12.7's prompting is about **eviction**, not
> exhaustion. Phase 2 is where `navigator.storage.estimate()` starts mattering and where the
> 60% warning threshold earns its place.

The §16.3 row this task implements, verbatim:

| Failure | Behaviour |
|---|---|
| IndexedDB write fails (quota) | Surface immediately, do not update the UI as though it succeeded, prompt export |

## Acceptance criteria

- [ ] A test asserts `navigator.storage.persist()` is called exactly once, after the first
      successful write of the session, and not on hydration or on session start alone.
- [ ] A test asserts the app behaves **identically** whether `persist()` resolves `true`,
      resolves `false`, rejects, or is `undefined` on the `navigator.storage` object — same
      writes, same prompts, no thrown error. "Request it, do not depend on it" must be
      mechanically true, not merely intended.
- [ ] A test asserts `navigator.storage.estimate()` is called on session start and that a
      missing `navigator.storage` degrades to `storageStatus()` returning zeroes rather than
      throwing.
- [ ] Trigger 1 fires: `META.lastExportAt` absent and 10 completions → prompt. Does not fire
      at 9 completions.
- [ ] Trigger 2 fires: `lastExportAt` 31 days ago with a `MILESTONE.at` newer than it →
      prompt. Does not fire at 31 days with **no** activity since, and does not fire at 29
      days with activity.
- [ ] Trigger 3 fires: `estimate()` reporting usage at 61% of quota → prompt. Does not fire
      at 59%.
- [ ] A test asserts the prompt does not fire when `lastExportAt` is recent and usage is low
      — the "does not nag a user who is already exporting" clause of §12.7.
- [ ] A component test asserts `ExportPrompt.svelte` renders inline in the notice host
      (§13.4's `+layout.svelte`), is dismissible, and traps no focus — it must not be a
      modal and must not block interaction underneath.
- [ ] A test asserts dismissal suppresses the prompt for the remainder of the session and
      that dismissal is **not** persisted as an export — `lastExportAt` is untouched.
- [ ] A test asserts a completed export (T16) clears the prompt condition immediately by
      writing `lastExportAt`.
- [ ] A test asserts a quota-failed `setMilestoneState` leaves the in-memory mirror
      unchanged, surfaces an error to the user, and raises the export prompt — the §16.3
      row, and §16.3's recurring rule that a read or write failure never becomes a silent
      success.
- [ ] `StorageStatus.svelte` renders storage estimate, last export, content version, and app
      version, per §16.5's list of what `/data` must show.
- [ ] The durability copy is factual: a test asserts the rendered text names the three ways
      storage can be lost — cleared by the browser, private-mode expiry, cleared by the user
      — and that it contains no urgency wording. The wording lives in one string constant so
      this is a single readable assertion.
- [ ] `npx tsc --noEmit` and `npm run --workspace app check` pass.
- [ ] The axe gate (§15, **T20**) passes on `/data` with the prompt rendered.

## Verification

```bash
npm run --workspace app test -- durability export-prompt
npx tsc --noEmit
npm run --workspace app check
npm run --workspace app test:a11y -- /data     # §15.8, gated in T20
```

Passing looks like: each of the three triggers firing on its boundary and not one step
below it, the persist()-independence test green across all four outcomes, and the quota
branch leaving the UI honest.

## Notes and hazards

- **R-18 — browser storage is not durable, and nothing here changes that.** §19.3 records
  it as accepted: ITP evicts after seven days of non-use for non-installed sites, this
  affects IndexedDB and `localStorage` equally, and `persist()` is effectively unavailable
  on Safari. F39's export prompting **is** the mitigation. An implementer who reads
  `persist()` as a solution will build a prompt that only fires when persistence was denied;
  that is wrong. The prompt's triggers are the three in §12.7 and do not consult the
  persistence grant at all.
- **Trigger 3 effectively never fires in phase 1.** §17.4 puts a heavy user under 1 MB
  against quotas measured in hundreds of megabytes. Build it anyway — it is where the
  threshold "earns its place" in phase 2 (§12.8, **R-06**) — but do not treat a
  never-observed branch as dead code, and keep a unit test as its only proof of life.
- **Never blocking.** §12.7 says non-modal, dismissible, never blocking, three times over in
  one line. A modal that interrupts a user mid-milestone converts a durability reminder into
  the thing they close reflexively, which defeats it.
- **The message is about backup, not about space.** In phase 1 a user is never near quota,
  so any copy implying "running out of room" is factually wrong as well as alarming.
- **No install prompt, no PWA nudge.** §12.7 explains *why* Safari withholds persistence
  outside installed PWAs; it does not authorise chasing an install. §16.4 puts PWA work in
  phase 2.
- **Dismissal lives in `META`, per trigger** — see the T26/F15 amendments below. This
  reverses the guess recorded here previously (session-scoped memory), which would have
  re-prompted on every reload.
- `usage` and `quota` from `navigator.storage.estimate()` are browser estimates and are
  deliberately imprecise; do not present them as exact figures on `/data`.

## T26 amendments — 2026-08-06

**F15 answered both of this task's open spec-silences, and answered one of them against the
guess this doc had recorded.**

**Dismissal lives in `META`, keyed by trigger — not in session memory.** The note here
previously reasoned that `META` would silence the prompt permanently and so chose
session-scoped state. That reasoning was right about the hazard and wrong about the fix: a
single global flag in `META` silences everything forever, but session memory re-prompts on
every reload, which is the same nagging §12.7's `lastExportAt` sentence exists to prevent.
The resolution is a **per-trigger** record, and each trigger re-arms on its own terms, so no
timer is stored:

| Trigger | Condition | Phase | Re-arms |
|---|---|---|---|
| **T1** | No export ever recorded, ≥ 10 completions | 1 | Never — a one-time nudge, superseded by T2 after thirty days |
| **T2** | > 30 days since last export, with new activity since | 1 | Naturally: false at the next export, true at the next window. A dismissal costs one window |
| **T3** | Estimated usage > 60% of quota | **2** | Ten percentage points past a stored watermark |

T3's watermark is the non-obvious one: without it, dismissing at 61% silences the trigger
through 99%.

**"New activity since" is `lastActivityAt > lastExportAt`**, string-compared as ISO-8601
UTC (§12.2). Narrower than this doc's previous inference, which also considered
`MILESTONE.at`: F19 made `SKILL.lastActivityAt` a **total, forward-only watermark** written
on every mutation, so it already dominates every `MILESTONE.at` in that tree and checking
both is redundant. It is deliberately *activity* rather than *completions* — a user who has
been dismissing and re-ticking has unbacked-up work like anyone else.

**T3 is labelled phase 2 in the spec now**, so the existing note about not treating a
never-observed branch as dead code stands and is now backed by §12.7 itself rather than by
this doc's inference.
