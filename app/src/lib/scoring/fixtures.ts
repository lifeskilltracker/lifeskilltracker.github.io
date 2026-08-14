/**
 * Hand-built trees for the §11.2–§11.4 example tests.
 *
 * Separate from `lib/layout/fixtures.ts` because the two engines need different
 * things: layout cares about cells and lanes and is happy with one default
 * `all` group per level, while scoring is mostly *about* the requirement groups
 * and needs `n_of`, mixed groups, and milestones shared across groups.
 *
 * Groups hold resolved `MilestoneRef`s, exactly as a compiled bundle does
 * (§7.3). A fixture that carried slugs there would type-check against a shape no
 * bundle has.
 */

import type { CompiledTree, MilestoneState, TreeProgress } from '$lib/types';

export interface GroupSpec {
  rule: 'all' | 'n_of';
  n?: number;
  /** Slugs; resolved to refs here, as `lst compile` does. */
  milestones: string[];
}

export interface LevelSpec {
  level: number;
  milestones: string[];
  /** Omitted means the §5.6 default: one `all` group over every milestone. */
  requirements?: GroupSpec[];
}

export interface TreeSpec {
  id?: string;
  contentVersion?: number;
  levels: LevelSpec[];
  /** Prerequisite edges, by slug. */
  requires?: Record<string, string[]>;
  /**
   * Declared track ids, in order (§5.5). Omitted means the single synthetic
   * column §8.2 step 2 gives a tree with no tracks — which is what every
   * scoring test wants, since tracks affect layout and nothing else.
   *
   * §15.2's `↑`/`↓` are defined as "same track", so a test for them needs a tree
   * where "same track" excludes something. That is the only reason this exists.
   */
  tracks?: string[];
  /** Slug → track id. A slug left out lands in the first declared track. */
  track?: Record<string, string>;
}

let fixtureCount = 0;

export function makeScoringTree(spec: TreeSpec): CompiledTree {
  const filled: LevelSpec[] = [];
  for (let level = 1; level <= 10; level += 1) {
    const declared = spec.levels.find((l) => l.level === level);
    filled.push(declared ?? { level, milestones: [] });
  }

  // `level.level`, not `level`: the milestone's own field is the level *number*
  // (§5.3). Carrying the spec object here made no difference to scoring, which
  // reads levels through the requirement groups, and produced a tree the Layout
  // Engine positioned as empty — found when T08 first rendered one of these.
  const flat = filled.flatMap((level) =>
    level.milestones.map((slug) => ({ slug, level: level.level })),
  );
  const indexOf = new Map(flat.map((m, i) => [m.slug, i]));
  const ref = (slug: string) => {
    const index = indexOf.get(slug);
    if (index === undefined) throw new Error(`fixture: unknown milestone "${slug}"`);
    return { index, slug };
  };

  const tracks = spec.tracks ?? [];
  const trackOf = (slug: string): { track: string; trackIndex: number } => {
    if (tracks.length === 0) return { track: '', trackIndex: 0 };
    const id = spec.track?.[slug] ?? tracks[0];
    return { track: id, trackIndex: Math.max(0, tracks.indexOf(id)) };
  };

  const milestones = flat.map(({ slug, level }, index) => ({
    id: slug,
    uid: `U${String(index).padStart(7, '0')}`,
    title: slug,
    level,
    ...trackOf(slug),
    order: index,
    requires: (spec.requires?.[slug] ?? []).map(ref),
  }));

  const levels = filled.map((level) => ({
    level: level.level,
    milestones: level.milestones.map(ref),
    requirements: (
      level.requirements ?? [{ rule: 'all' as const, milestones: level.milestones }]
    ).map((group) => ({
      rule: group.rule,
      ...(group.rule === 'n_of' ? { n: group.n } : {}),
      milestones: group.milestones.map(ref),
    })),
  }));

  return {
    schemaVersion: 1,
    contentVersion: spec.contentVersion ?? 1,
    id: spec.id ?? `scoring-fixture-${(fixtureCount += 1)}`,
    title: 'Fixture',
    summary: 'Scoring fixture',
    domain: 'home',
    provenance: { authors: [{ name: 'fixture' }], copyleftDerived: false },
    ...(tracks.length === 0
      ? {}
      : { tracks: tracks.map((id) => ({ id, title: id })) }),
    levels,
    milestones,
  } as unknown as CompiledTree;
}

export const uidOf = (tree: CompiledTree, slug: string): string =>
  tree.milestones.find((m) => m.id === slug)!.uid;

/** Builds a `TreeProgress` from slugs, so tests read in the vocabulary they were written in. */
export function progressOf(
  tree: CompiledTree,
  states: Record<string, MilestoneState>,
  grandfathered: TreeProgress['grandfathered'] = new Map(),
): TreeProgress {
  const milestones = new Map<string, MilestoneState>();
  for (const [slug, state] of Object.entries(states)) {
    milestones.set(uidOf(tree, slug), state);
  }
  return { milestones, grandfathered };
}

/**
 * §11.3's worked case: satisfied {1, 3, 4, 6}, one milestone short at level 2.
 * Every level holds four milestones in a single `all` group.
 */
export function scatteredTree(): CompiledTree {
  const levels: LevelSpec[] = [];
  for (let level = 1; level <= 10; level += 1) {
    levels.push({
      level,
      milestones: [1, 2, 3, 4].map((i) => `l${level}-m${i}`),
    });
  }
  return makeScoringTree({ id: 'cooking-scattered', levels });
}

/** Complete every milestone of the named levels, and all but one of level 2. */
export function scatteredProgress(tree: CompiledTree): TreeProgress {
  const states: Record<string, MilestoneState> = {};
  for (const level of [1, 3, 4, 6]) {
    for (const i of [1, 2, 3, 4]) states[`l${level}-m${i}`] = 'complete';
  }
  // One milestone short at level 2 — this is the whole point of the example.
  for (const i of [1, 2, 3]) states[`l2-m${i}`] = 'complete';
  return progressOf(tree, states);
}
