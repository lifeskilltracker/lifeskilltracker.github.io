/**
 * §6.4's assembly — the layer that turns a manifest, a `SKILL` row and a scored
 * bundle into the one row the card renders (T32).
 *
 * `components/next-step.test.ts` covers the rule; this covers the join, which is
 * where the interesting failures are:
 *
 * - **A `SKILL` row the manifest has never heard of is dropped**, not rendered
 *   under an invented title (T26/F22). The record stays in IndexedDB and `/data`
 *   is where it is reported.
 * - **One unreachable bundle does not take the card down.** §16.3 forbids a read
 *   failure becoming a silent success, and it does not become one — the page that
 *   wanted that tree says so — but the card's job is to name a next action, and it
 *   can still do that from the skills it could read.
 * - **The available set is the engine's, not a guess.** Completing a milestone
 *   must move the card on, which is only true if this reads `scoreSkill` rather
 *   than "the first milestone of the attained level plus one".
 */

import { describe, expect, it } from 'vitest';
import { bundleFixture, manifestFixture } from '$lib/content/fixtures/bundles.js';
import type { SkillRecord } from '$lib/state/types.js';
import type { CompiledTree, Manifest, MilestoneState, TreeProgress } from '$lib/types';
import { assembleNextStep, nextStepCandidates, type NextStepSources } from './next-step.js';

const MANIFEST = manifestFixture([
  { id: 'cooking', bundle: 'trees/cooking.json' },
  { id: 'piano', bundle: 'trees/piano.json' },
]) as unknown as Manifest;

const TREES: Record<string, CompiledTree> = {
  cooking: bundleFixture({ id: 'cooking' }) as unknown as CompiledTree,
  piano: bundleFixture({ id: 'piano' }) as unknown as CompiledTree,
};

function skill(treeId: string, lastActivityAt: string, attainedLevel = 0): SkillRecord {
  return {
    treeId,
    startedAt: '2026-01-01T00:00:00.000Z',
    attainedLevel,
    lastActivityAt,
    contentVersionSeen: 1,
    grandfathered: {},
  };
}

function sources(options: {
  fail?: string;
  progress?: Record<string, ReadonlyMap<string, MilestoneState>>;
}): NextStepSources & { loads: string[] } {
  const loads: string[] = [];
  return {
    loads,
    loadTree: async (treeId) => {
      loads.push(treeId);
      if (options.fail === treeId) throw new Error(`tree unavailable: ${treeId}`);
      const tree = TREES[treeId];
      if (tree === undefined) throw new Error(`no fixture for ${treeId}`);
      return tree;
    },
    progressFor: (treeId): TreeProgress => ({
      milestones: options.progress?.[treeId] ?? new Map(),
      grandfathered: new Map(),
    }),
  };
}

describe('§6.4 — one candidate per started skill', () => {
  it('carries the manifest’s title and domain and the engine’s available set', async () => {
    const candidates = await nextStepCandidates(sources({}), MANIFEST, {
      cooking: skill('cooking', '2026-08-14T09:30:00.000Z'),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      treeId: 'cooking',
      skillTitle: 'cooking',
      domain: 'home',
      lastActivityAt: '2026-08-14T09:30:00.000Z',
    });
    // Nothing done, nothing required: every milestone is available, in document
    // order, and each carries the slug the card's deep link is built from.
    expect(candidates[0]?.available[0]).toEqual({
      uid: 'U0100000',
      slug: 'cooking-1-0',
      title: 'Milestone 1.0',
    });
  });

  it('drops a SKILL row the manifest has no entry for', async () => {
    const io = sources({});
    const candidates = await nextStepCandidates(io, MANIFEST, {
      cooking: skill('cooking', '2026-08-14T09:30:00.000Z'),
      knitting: skill('knitting', '2026-08-15T09:30:00.000Z'),
    });

    expect(candidates.map((candidate) => candidate.treeId)).toEqual(['cooking']);
    // And it was never fetched: there is no bundle to fetch.
    expect(io.loads).toEqual(['cooking']);
  });
});

describe('§16.3 — a bundle that cannot be read', () => {
  it('selects from the skills it could read rather than showing nothing', async () => {
    const step = await assembleNextStep(sources({ fail: 'cooking' }), MANIFEST, {
      cooking: skill('cooking', '2026-08-14T09:30:00.000Z'),
      piano: skill('piano', '2026-08-01T09:30:00.000Z'),
    });

    expect(step?.treeId).toBe('piano');
  });
});

describe('§6.4 — the card follows F36’s available set', () => {
  it('moves on once the milestone it named is complete', async () => {
    const skills = { cooking: skill('cooking', '2026-08-14T09:30:00.000Z') };

    const before = await assembleNextStep(sources({}), MANIFEST, skills);
    expect(before?.milestoneUid).toBe('U0100000');

    const after = await assembleNextStep(
      sources({ progress: { cooking: new Map([['U0100000', 'complete']]) } }),
      MANIFEST,
      skills,
    );
    expect(after?.milestoneUid).toBe('U0110000');
  });

  it('returns null when the user has started nothing', async () => {
    expect(await assembleNextStep(sources({}), MANIFEST, {})).toBeNull();
  });
});
