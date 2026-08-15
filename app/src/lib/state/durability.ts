/**
 * §12.7's two calls into the Storage API — and the discipline of not depending
 * on either (T18).
 *
 * **R-18 is the reason this file is small and defensive.** §19.3 accepts that
 * browser storage is not durable: Safari's ITP evicts script-writable storage
 * after seven days of non-use for non-installed sites, this affects IndexedDB
 * and `localStorage` equally (§12.1), and `persist()` is effectively unavailable
 * there outside an installed PWA. So `persist()` is a request that may be
 * granted, refused, unimplemented, or may throw, and **F39's export prompting is
 * the actual mitigation**, not this.
 *
 * Two properties are the whole file, and each is easy to lose:
 *
 * **Nothing branches on the persistence grant.** `persistOutcome` exists so
 * `/data` can state a fact, and for no other reader. An implementer who gates
 * the export prompt on a denied grant has built a prompt that stays silent on
 * exactly the browser where eviction is likeliest — Chrome grants persistence on
 * engagement, Safari does not, and Safari is where the seven-day cap bites.
 *
 * **Neither call may fail anything.** A rejected `persist()` must not fail the
 * write that triggered it, and a rejected or absent `estimate()` must degrade to
 * zeroes rather than putting `NaN` on `/data` and quietly making every
 * percentage comparison false.
 *
 * The navigator arrives through a getter rather than as a captured reference:
 * the module is imported in node, in jsdom, and in a browser, and the object
 * differs in all three.
 */

export interface StorageEstimateReading {
  usage: number;
  quota: number;
}

export interface StorageLike {
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

export interface NavigatorLike {
  storage?: StorageLike;
}

/**
 * What happened when persistence was requested. **Display only** (§16.5) — no
 * control flow anywhere may read this.
 *
 * - `granted` / `denied` — the browser answered.
 * - `unavailable` — no `navigator.storage.persist`, which is Safari's usual case.
 * - `failed` — the call threw. Indistinguishable from `denied` in effect, kept
 *   apart because "the browser said no" and "the call errored" are different
 *   things to read on `/data` in a system with no telemetry (§16.5).
 */
export type PersistOutcome = 'granted' | 'denied' | 'unavailable' | 'failed';

const ZERO: StorageEstimateReading = { usage: 0, quota: 0 };

const finite = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

export interface Durability {
  /** §12.7's answer, for `/data` to display. Null until the first write. */
  readonly persistOutcome: PersistOutcome | null;
  /** The last `estimate()` reading, or null before the session-start poll. */
  readonly lastEstimate: StorageEstimateReading | null;
  /** Called by every committed user-data write. Requests `persist()` once. */
  noteSuccessfulWrite(): Promise<void>;
  pollEstimate(): Promise<StorageEstimateReading>;
  /** Test seam: a fresh session. */
  reset(): void;
}

export function createDurability(
  getNavigator: () => NavigatorLike | undefined = () => globalThis.navigator,
): Durability {
  let outcome: PersistOutcome | null = null;
  let estimate: StorageEstimateReading | null = null;
  /**
   * The latch is a promise rather than a boolean, and it is assigned **before**
   * the first `await`. Writes to two different trees are not serialized against
   * each other (§12.4 gives each write its own transaction), so a boolean set
   * after the await would let two concurrent commits both request persistence —
   * which is harmless but is exactly the "exactly once" this claims.
   */
  let requested: Promise<void> | null = null;

  async function request(): Promise<void> {
    const storage = getNavigator()?.storage;
    if (typeof storage?.persist !== 'function') {
      outcome = 'unavailable';
      return;
    }
    try {
      outcome = (await storage.persist()) ? 'granted' : 'denied';
    } catch {
      // §12.7: request it, do not depend on it. A write must not fail because
      // the browser refused to discuss durability.
      outcome = 'failed';
    }
  }

  return {
    get persistOutcome(): PersistOutcome | null {
      return outcome;
    },

    get lastEstimate(): StorageEstimateReading | null {
      return estimate;
    },

    noteSuccessfulWrite(): Promise<void> {
      requested ??= request();
      return requested;
    },

    async pollEstimate(): Promise<StorageEstimateReading> {
      const storage = getNavigator()?.storage;
      if (typeof storage?.estimate !== 'function') {
        estimate = ZERO;
        return ZERO;
      }
      try {
        const reading = await storage.estimate();
        // Both fields are optional in the spec. Read as `undefined` they become
        // `NaN` through any arithmetic, and `NaN > 0.6` is false — a trigger
        // that never fires and never says why.
        estimate = { usage: finite(reading.usage), quota: finite(reading.quota) };
      } catch {
        estimate = ZERO;
      }
      return estimate;
    },

    reset(): void {
      outcome = null;
      estimate = null;
      requested = null;
    },
  };
}

export const durability = createDurability();
