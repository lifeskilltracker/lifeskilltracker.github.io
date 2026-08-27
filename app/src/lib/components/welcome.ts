/**
 * The welcome cartouche's gate (UI-SPEC §6.5 — PRD D25, §12 Q4).
 *
 * Pure, and separate from the dialogue for the same reason `reveal.ts` is
 * separate from the map: *whether to greet* is a decision with four inputs and
 * exactly one right answer, and an answer that could only be checked by mounting
 * a shell would not be checked at every input.
 *
 * The design is deliberately the reveal's, one step further on. §5.7 already
 * establishes a once-ever local flag for a first-load moment, and §5.7's last
 * clause — "it ends on the resting frame, so the welcome dialog opens over a
 * finished picture with nothing still in motion" — was written for this. So the
 * flag, its failure behaviour, and the delay all follow `reveal.ts` rather than
 * inventing a second convention beside it.
 *
 * **The one place they deliberately differ is reduced motion.** The reveal does
 * not play at all under `prefers-reduced-motion` because the reveal *is* motion.
 * A dialogue is not, and withholding the whole D25 feature from the users most
 * likely to need its explanation would be the accessibility argument run
 * backwards. It opens either way; only the delay changes.
 */

import { REVEAL_MS } from './reveal.js';

/** Its own key. Sharing the reveal's would tie two unrelated once-ever moments. */
export const WELCOME_FLAG = 'lst.welcome.seen';

export interface WelcomeConditions {
  /** §13.2's mirror has landed. Until it has, "no progress" is not yet a fact. */
  readonly hydrated: boolean;
  /** How many trees the user has a `SKILL` row for. */
  readonly startedSkills: number;
  /** Accepted, and deliberately unused — see the note above. */
  readonly reducedMotion?: boolean;
}

/**
 * Three conditions, all of which must hold.
 *
 * **Hydration first.** An unhydrated mirror reports zero started skills, which
 * is indistinguishable from a genuine first visit — deciding on it is §13.3's
 * "read as empty" bug in another costume, and here it would greet a returning
 * Player as a stranger every time their store was slow.
 *
 * **No progress.** The flag is local, so someone who imported an export onto a
 * new device (§14.5) arrives with a full mirror and no flag at all. They are not
 * the Curious Browser and must not be treated as one.
 *
 * **A store that works.** Without one the flag can never be recorded and the
 * dialogue would open on every visit forever. Silence is the better failure, and
 * it is the same call `shouldReveal` makes.
 */
export function shouldWelcome(conditions: WelcomeConditions): boolean {
  if (!conditions.hydrated) return false;
  if (conditions.startedSkills > 0) return false;
  try {
    const store = globalThis.localStorage;
    if (!store) return false;
    return store.getItem(WELCOME_FLAG) !== '1';
  } catch {
    return false;
  }
}

/**
 * Called when the dialogue *opens*, not when it closes — a visitor who navigates
 * away with it on screen has been greeted, and greeting them again on their next
 * visit is precisely the failure §6.5 names. There is no snooze.
 */
export function markWelcomed(): void {
  try {
    globalThis.localStorage?.setItem(WELCOME_FLAG, '1');
  } catch {
    // A blocked store costs the flag, and `shouldWelcome` already refuses to
    // greet without one, so nothing further is owed here.
  }
}

/**
 * How long to wait before opening.
 *
 * `REVEAL_MS` when the reveal is playing, so the cartouche lands on the resting
 * frame §5.7 goes to some trouble to arrive at; zero when it is not, which is
 * both the reduced-motion case and the returning visitor whose reveal flag is
 * already set — the map paints straight to the final frame and there is nothing
 * to wait for.
 */
export function welcomeDelayMs(revealPlaying: boolean): number {
  return revealPlaying ? REVEAL_MS : 0;
}
