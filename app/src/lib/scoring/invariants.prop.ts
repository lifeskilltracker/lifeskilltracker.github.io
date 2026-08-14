/**
 * Generators for arbitrary valid `CompiledTree` and `TreeProgress` values.
 *
 * **Exported, because T11b extends them** rather than writing its own — the two
 * halves of §11 must property-test against the same corpus or an invariant that
 * holds tree-locally and breaks under aggregation has nowhere to show up.
 *
 * `fast-check` is the choice this task makes (no property-testing library is
 * named anywhere in the architecture) and T11b inherits it. It is a
 * devDependency of `app/` only: `tools/` declares no application dependencies
 * (§4.2).
 */

import fc from 'fast-check';
import type {
  CompiledTree,
  DomainSkillRow,
  MilestoneState,
  Taxonomy,
  TreeProgress,
} from '$lib/types';
import { makeScoringTree, type GroupSpec, type LevelSpec } from './fixtures.js';

/** §5.3: four to eight milestones per level. */
const MILESTONES_PER_LEVEL = { min: 4, max: 8 };

/**
 * Requirement groups over one level's milestones: an `all` over the whole set,
 * or an `n_of` with a threshold inside the set's size, or both.
 */
function groupsFor(slugs: string[]): fc.Arbitrary<GroupSpec[]> {
  const all: GroupSpec = { rule: 'all', milestones: slugs };
  const nOf = fc
    .integer({ min: 1, max: slugs.length })
    .map((n): GroupSpec => ({ rule: 'n_of', n, milestones: slugs }));

  return fc.oneof(
    fc.constant<GroupSpec[]>([all]),
    nOf.map((g) => [g]),
    nOf.map((g) => [{ rule: 'all' as const, milestones: slugs.slice(0, 2) }, g]),
  );
}

/**
 * All ten levels are populated, always.
 *
 * T11a's acceptance criteria say "1–10 levels populated", but §5.3 fixes
 * `levels` at exactly ten entries of four to eight milestones each, so a tree
 * with an empty level is not a valid `CompiledTree` and no compiled bundle can
 * contain one. Generating them found a real consequence rather than a real bug:
 * an `all` group over zero milestones has `n = 0`, so `completed >= n` holds
 * vacuously and every empty level reads as satisfied. The engine is right to
 * have no defensive branch there — §14.3 makes it total over *valid* bundles,
 * and the group schema's `minItems: 1` is what guarantees `n >= 1`. The
 * generator is what was wrong.
 */
export function arbitraryTree(): fc.Arbitrary<CompiledTree> {
  return fc
    .constant(10)
    .chain((populatedLevels) =>
      fc
        .tuple(
          ...Array.from({ length: populatedLevels }, (_, i) =>
            fc
              .integer(MILESTONES_PER_LEVEL)
              .chain((count) => {
                const slugs = Array.from({ length: count }, (_, j) => `l${i + 1}-m${j}`);
                return groupsFor(slugs).map(
                  (requirements): LevelSpec => ({
                    level: i + 1,
                    milestones: slugs,
                    requirements,
                  }),
                );
              }),
          ),
        )
        .map((levels) => {
          // `requires` edges point strictly downward in the flat order, so the
          // graph is acyclic by construction (§6.2 rules 4–5).
          const requires: Record<string, string[]> = {};
          const flat = levels.flatMap((l) => l.milestones);
          flat.forEach((slug, index) => {
            if (index > 0 && index % 3 === 0) requires[slug] = [flat[index - 1]];
          });
          return makeScoringTree({ levels, requires });
        }),
    );
}

/** Arbitrary progress over a tree's uids, with an empty `grandfathered` map (T11b fills it). */
export function arbitraryProgress(tree: CompiledTree): fc.Arbitrary<TreeProgress> {
  const uids = tree.milestones.map((m) => m.uid);
  return fc
    .array(fc.constantFrom<MilestoneState>('complete', 'dismissed', null), {
      minLength: uids.length,
      maxLength: uids.length,
    })
    .map((states) => {
      const milestones = new Map<string, MilestoneState>();
      uids.forEach((uid, i) => {
        if (states[i] !== null) milestones.set(uid, states[i]);
      });
      return { milestones, grandfathered: new Map() };
    });
}

/** A tree paired with progress over its own uids. */
export function arbitraryTreeAndProgress(): fc.Arbitrary<[CompiledTree, TreeProgress]> {
  return arbitraryTree().chain((tree) =>
    arbitraryProgress(tree).map((progress): [CompiledTree, TreeProgress] => [tree, progress]),
  );
}

/** A boolean mask over a tree's uids, for invariant 6's dismissal mask. */
export function arbitraryDismissalMask(tree: CompiledTree): fc.Arbitrary<boolean[]> {
  return fc.array(fc.boolean(), {
    minLength: tree.milestones.length,
    maxLength: tree.milestones.length,
  });
}

/**
 * Applies a dismissal mask to the milestones that are **not complete**.
 * Dismissing a complete milestone would change its state rather than test the
 * invariant, which is about `dismissed` versus absent (§11.10).
 */
export function withDismissals(
  tree: CompiledTree,
  progress: TreeProgress,
  mask: boolean[],
): TreeProgress {
  const milestones = new Map(progress.milestones);
  tree.milestones.forEach((milestone, i) => {
    if (!mask[i]) return;
    if (milestones.get(milestone.uid) === 'complete') return;
    milestones.set(milestone.uid, 'dismissed');
  });
  return { ...progress, milestones };
}

/* ------------------------------------------------------------------------- *
 * T11b — the aggregation half (§11.6, §11.7).
 *
 * These extend the generators above rather than standing beside them: the two
 * halves of §11 must property-test against the same corpus, or an invariant
 * that holds tree-locally and breaks under aggregation has nowhere to show up.
 * ------------------------------------------------------------------------- */

/** §5.9's eight domains. Only the ids matter — `domainScores` reads nothing else. */
const DOMAIN_IDS = ['making', 'mind', 'body', 'home', 'money', 'people', 'place', 'work'];

/** §12.2's fixed-precision UTC form, which §11.7's lexicographic `max` requires. */
export function isoAt(millis: number): string {
  return new Date(millis).toISOString();
}

const EPOCH = Date.UTC(2026, 0, 1);

function taxonomyOf(ids: readonly string[]): Taxonomy {
  return {
    domains: ids.map((id) => ({
      id,
      title: id,
      blurb: '',
      palette: { base: '#000000', accent: '#ffffff' },
    })),
    facets: [],
    map: { regions: [] },
  } as unknown as Taxonomy;
}

/** A taxonomy of one to eight of §5.9's domains. */
export function arbitraryTaxonomy(): fc.Arbitrary<Taxonomy> {
  return fc
    .integer({ min: 1, max: DOMAIN_IDS.length })
    .map((count) => taxonomyOf(DOMAIN_IDS.slice(0, count)));
}

/** Rows over a taxonomy's own domains, with valid attained levels and §12.2 dates. */
export function arbitraryDomainRows(
  taxonomy: Taxonomy,
): fc.Arbitrary<ReadonlyArray<DomainSkillRow>> {
  const ids = taxonomy.domains.map((d) => d.id);
  return fc.array(
    fc.tuple(
      fc.constantFrom(...ids),
      fc.integer({ min: 0, max: 10 }),
      fc.integer({ min: 0, max: 10_000_000 }),
    ),
    { maxLength: 20 },
  ).map((rows) =>
    rows.map(([domain, attainedLevel, offset], index) => ({
      treeId: `tree-${index}`,
      domain,
      attainedLevel,
      lastActivityAt: isoAt(EPOCH + offset * 60_000),
    })),
  );
}

/** A taxonomy paired with rows over its own domains. */
export function arbitraryTaxonomyAndRows(): fc.Arbitrary<
  [Taxonomy, ReadonlyArray<DomainSkillRow>]
> {
  return arbitraryTaxonomy().chain((taxonomy) =>
    arbitraryDomainRows(taxonomy).map(
      (rows): [Taxonomy, ReadonlyArray<DomainSkillRow>] => [taxonomy, rows],
    ),
  );
}

/**
 * Completes one incomplete milestone, chosen by a generated index. Returns the
 * progress unchanged when every milestone is already complete — the invariant
 * still holds there, trivially, and rejecting the case would bias the corpus
 * towards sparsely-completed trees.
 */
export function withOneMoreCompletion(
  tree: CompiledTree,
  progress: TreeProgress,
  pick: number,
): TreeProgress {
  const incomplete = tree.milestones.filter(
    (m) => progress.milestones.get(m.uid) !== 'complete',
  );
  if (incomplete.length === 0) return progress;

  const milestones = new Map(progress.milestones);
  milestones.set(incomplete[pick % incomplete.length].uid, 'complete');
  return { ...progress, milestones };
}

/**
 * A content revision that **only adds**: one new milestone appended to each
 * named level, joined into every requirement group that level already has.
 *
 * Appending to an `all` group is the case that would drop `attained` — an
 * `n_of` group keeps its threshold and stays satisfied on its own. New
 * milestones take new uids and are appended to the flat order, so every
 * existing uid and every existing ref index survives, exactly as a real
 * revision leaves them (§5.4, §12.5).
 */
export function withAddedMilestones(tree: CompiledTree, levels: readonly number[]): CompiledTree {
  const milestones = [...tree.milestones];
  const addedByLevel = new Map<number, { index: number; slug: string }>();

  for (const level of levels) {
    const index = milestones.length;
    const slug = `rev-l${level}-m${index}`;
    milestones.push({
      id: slug,
      uid: `R${String(index).padStart(7, '0')}`,
      title: slug,
      level,
      track: '',
      trackIndex: 0,
      order: index,
      requires: [],
    } as unknown as (typeof milestones)[number]);
    addedByLevel.set(level, { index, slug });
  }

  const revised = tree.levels.map((level) => {
    const added = addedByLevel.get(level.level);
    if (added === undefined) return level;
    return {
      ...level,
      milestones: [...level.milestones, added],
      requirements: level.requirements.map((group) => ({
        ...group,
        milestones: [...group.milestones, added],
      })),
    };
  });

  return {
    ...tree,
    contentVersion: tree.contentVersion + 1,
    levels: revised,
    milestones,
  } as CompiledTree;
}

/**
 * Freezes every currently-satisfied level exactly as T09 would: the level's
 * reported `satisfiedBy`, under the tree's current `contentVersion` (§11.5,
 * §12.4). The engine never performs this write — this helper stands in for the
 * store so invariant 7 can be a real test rather than a documented gap.
 */
export function frozenAs(
  progress: TreeProgress,
  contentVersion: number,
  levels: ReadonlyArray<{ level: number; satisfied: boolean; satisfiedBy: readonly string[] }>,
): TreeProgress {
  const grandfathered = new Map(progress.grandfathered);
  for (const level of levels) {
    if (!level.satisfied || level.satisfiedBy.length === 0) continue;
    grandfathered.set(level.level, { uids: [...level.satisfiedBy], contentVersion });
  }
  return { ...progress, grandfathered };
}
