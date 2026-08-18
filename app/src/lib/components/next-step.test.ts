/**
 * §6.4's selection rule, as arithmetic (T32).
 *
 * The rule is one sentence — "the next available milestone in the skill with the
 * most recent activity, ties broken by tree id" — and every clause in it is a
 * separate way to be wrong, so each gets its own case:
 *
 * - **Recency wins**, and it is a lexicographic comparison over §12.2's ISO-8601
 *   UTC stamps, not a `Date` parse. The store only ever writes `toISOString()`.
 * - **Ties break by tree id, ascending.** Not for elegance: the card is
 *   re-derived on every mirror commit, and a selection that depended on
 *   `Object.values` order would move under the user between two renders that
 *   changed nothing.
 * - **A skill with nothing available is not a next step.** F36's available set is
 *   empty for a tree whose remaining milestones are locked or dismissed, and the
 *   card promises a concrete action — so the rule falls through to the next-most
 *   recent skill rather than naming a milestone the user cannot do.
 * - **Nothing started is `null`**, and the caller renders §6.4's invitation. It
 *   is not an error and it is not an empty card.
 */

import { describe, expect, it } from 'vitest';
import {
  selectNextStep,
  type NextStepCandidate,
  type AvailableMilestone,
} from './next-step.js';

function milestone(n: number): AvailableMilestone {
  return { uid: `U010000${n}`, slug: `milestone-${n}`, title: `Milestone ${n}` };
}

function candidate(
  treeId: string,
  lastActivityAt: string,
  available: readonly AvailableMilestone[] = [milestone(1), milestone(2)],
): NextStepCandidate {
  return {
    treeId,
    skillTitle: treeId,
    domain: 'making',
    lastActivityAt,
    available,
  };
}

describe('§6.4 — the most recent skill wins', () => {
  it('picks the next available milestone in the most recently active skill', () => {
    const step = selectNextStep([
      candidate('cooking', '2026-08-01T10:00:00.000Z'),
      candidate('blacksmithing', '2026-08-14T09:30:00.000Z', [
        { uid: 'U0J00000', slug: 'forge-a-j-hook', title: 'Forge a J hook' },
      ]),
      candidate('piano', '2026-07-02T11:00:00.000Z'),
    ]);

    expect(step).toEqual({
      treeId: 'blacksmithing',
      skillTitle: 'blacksmithing',
      domain: 'making',
      milestoneUid: 'U0J00000',
      milestoneSlug: 'forge-a-j-hook',
      milestoneTitle: 'Forge a J hook',
    });
  });

  it('compares stamps lexicographically, so a later day beats an earlier one', () => {
    const step = selectNextStep([
      candidate('a', '2026-09-01T00:00:00.000Z'),
      candidate('b', '2026-10-01T00:00:00.000Z'),
    ]);

    expect(step?.treeId).toBe('b');
  });

  it('takes the FIRST available milestone, which is document order (F36)', () => {
    const step = selectNextStep([
      candidate('cooking', '2026-08-01T10:00:00.000Z', [milestone(7), milestone(3)]),
    ]);

    expect(step?.milestoneUid).toBe('U0100007');
  });
});

describe('§6.4 — ties break by tree id, ascending', () => {
  it('is stable across renders when two skills carry the same stamp', () => {
    const stamp = '2026-08-14T09:30:00.000Z';
    const rows = [candidate('woodwork', stamp), candidate('cooking', stamp)];

    expect(selectNextStep(rows)?.treeId).toBe('cooking');
    // The same set in the other order must produce the same answer — the whole
    // point of the tie-break. `Object.values(progress.skills)` has no order the
    // caller controls.
    expect(selectNextStep([...rows].reverse())?.treeId).toBe('cooking');
  });

  it('does not mutate the array it was given', () => {
    const stamp = '2026-08-14T09:30:00.000Z';
    const rows = [candidate('woodwork', stamp), candidate('cooking', stamp)];
    selectNextStep(rows);

    expect(rows.map((row) => row.treeId)).toEqual(['woodwork', 'cooking']);
  });
});

describe('§6.4 — a skill with nothing available is skipped', () => {
  it('falls through to the next-most-recent skill', () => {
    // Everything left in `cooking` is dismissed or locked, so F36's available
    // set is empty and there is no concrete action to name.
    const step = selectNextStep([
      candidate('cooking', '2026-08-14T09:30:00.000Z', []),
      candidate('piano', '2026-08-01T10:00:00.000Z'),
    ]);

    expect(step?.treeId).toBe('piano');
  });

  it('returns null when every started skill has an empty available set', () => {
    expect(
      selectNextStep([
        candidate('cooking', '2026-08-14T09:30:00.000Z', []),
        candidate('piano', '2026-08-01T10:00:00.000Z', []),
      ]),
    ).toBeNull();
  });
});

describe('§6.4 — nothing started', () => {
  it('returns null rather than an empty step', () => {
    expect(selectNextStep([])).toBeNull();
  });
});
