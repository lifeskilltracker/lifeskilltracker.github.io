/**
 * §12.7's two browser calls (T18).
 *
 * Almost every assertion here is about **not depending on the answer**. R-18
 * records that browser storage is not durable and that `persist()` is
 * effectively unavailable on Safari; §12.7's instruction is "request it, do not
 * depend on it". That is a claim about the shape of the code, and the only way
 * to hold it is to run the same sequence against every outcome the browser can
 * produce — granted, denied, thrown, and absent — and assert nothing downstream
 * moved.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createDurability,
  type NavigatorLike,
  type PersistOutcome,
  type StorageLike,
} from './durability.js';

const navigatorWith = (storage: NavigatorLike['storage']): NavigatorLike => ({ storage });

describe('persist() on the first successful write (§12.7)', () => {
  it('is not requested until a write succeeds', async () => {
    const persist = vi.fn(async () => true);
    const durability = createDurability(() => navigatorWith({ persist }));

    // Session start and hydration touch neither of these.
    await durability.pollEstimate();

    expect(persist).not.toHaveBeenCalled();
    expect(durability.persistOutcome).toBeNull();
  });

  it('is requested exactly once however many writes follow', async () => {
    const persist = vi.fn(async () => true);
    const durability = createDurability(() => navigatorWith({ persist }));

    await durability.noteSuccessfulWrite();
    await durability.noteSuccessfulWrite();
    await durability.noteSuccessfulWrite();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(durability.persistOutcome).toBe('granted');
  });

  it('requests once when writes overlap rather than once per write', async () => {
    // The write path is serialized per tree but not across trees, so two
    // milestones can commit concurrently; a latch set after the await would
    // request twice.
    const persist = vi.fn(async () => true);
    const durability = createDurability(() => navigatorWith({ persist }));

    await Promise.all([durability.noteSuccessfulWrite(), durability.noteSuccessfulWrite()]);

    expect(persist).toHaveBeenCalledTimes(1);
  });

  /**
   * The acceptance criterion §12.7's sentence turns into: four outcomes, one
   * behaviour. Nothing may throw, and nothing may read differently afterwards
   * except the recorded outcome itself — which exists for `/data` to display and
   * for nothing to branch on.
   */
  const outcomes: [string, StorageLike, PersistOutcome][] = [
    ['granted', { persist: () => Promise.resolve(true) }, 'granted'],
    ['denied', { persist: () => Promise.resolve(false) }, 'denied'],
    ['rejected', { persist: () => Promise.reject(new Error('SecurityError')) }, 'failed'],
    ['absent', {}, 'unavailable'],
  ];

  it.each(outcomes)('survives persist() %s and still reports the estimate', async (_label, storage, expected) => {
    const estimate = vi.fn(async () => ({ usage: 1024, quota: 4096 }));
    const durability = createDurability(() => navigatorWith({ ...storage, estimate }));

    await expect(durability.noteSuccessfulWrite()).resolves.toBeUndefined();

    expect(durability.persistOutcome).toBe(expected);
    await expect(durability.pollEstimate()).resolves.toEqual({ usage: 1024, quota: 4096 });
  });

  it('records "unavailable" when there is no navigator.storage at all', async () => {
    const durability = createDurability(() => undefined);

    await expect(durability.noteSuccessfulWrite()).resolves.toBeUndefined();

    expect(durability.persistOutcome).toBe('unavailable');
  });
});

describe('estimate() on session start (§12.7)', () => {
  it('reads usage and quota and keeps the last reading', async () => {
    const estimate = vi.fn(async () => ({ usage: 500, quota: 1000 }));
    const durability = createDurability(() => navigatorWith({ estimate }));

    expect(durability.lastEstimate).toBeNull();
    const reading = await durability.pollEstimate();

    expect(estimate).toHaveBeenCalledTimes(1);
    expect(reading).toEqual({ usage: 500, quota: 1000 });
    expect(durability.lastEstimate).toEqual({ usage: 500, quota: 1000 });
  });

  it('degrades to zeroes rather than throwing when the API is missing', async () => {
    const durability = createDurability(() => undefined);

    await expect(durability.pollEstimate()).resolves.toEqual({ usage: 0, quota: 0 });
  });

  it('degrades to zeroes when the browser reports partial figures', async () => {
    // Both fields are optional in the spec, and a quota of `undefined` read as
    // NaN would put "NaN MB" on `/data` and make every percentage comparison
    // false — a trigger that silently never fires.
    const durability = createDurability(() => navigatorWith({ estimate: async () => ({}) }));

    await expect(durability.pollEstimate()).resolves.toEqual({ usage: 0, quota: 0 });
  });

  it('degrades to zeroes when estimate() rejects', async () => {
    const durability = createDurability(() =>
      navigatorWith({
        estimate: async () => {
          throw new Error('NotAllowedError');
        },
      }),
    );

    await expect(durability.pollEstimate()).resolves.toEqual({ usage: 0, quota: 0 });
  });
});
