/**
 * Test fixtures for the Layout Engine.
 *
 * Test-only, but co-located so `purity.test.ts` covers it too: a fixture that
 * reached for the DOM or `lib/state` would be as much of a §14.1 violation as
 * the engine doing it.
 *
 * Hand-writing a `CompiledTree` literal is impractical — §5.3 fixes `levels` at
 * exactly ten entries and each level at four to eight milestones, so the
 * generated tuple types make even a two-milestone example a hundred lines. This
 * builder takes the cells a test actually cares about and pads the rest.
 */

import type { CompiledLevel, CompiledMilestone, CompiledTree, MilestoneRef } from '$lib/types';

export interface MilestoneSpec {
  id: string;
  /** Display title. Defaults to the id — rewording it must move nothing (§8.3). */
  title?: string;
  level: number;
  /** Empty string for a tree with no tracks (§7.3 writes `''`). */
  track?: string;
  /** Defaults to declaration order within the cell. */
  order?: number;
  /** Slugs of prerequisites. */
  requires?: string[];
}

export interface TreeSpec {
  id?: string;
  contentVersion?: number;
  /** Declared left to right (§8.2 step 2). Omit for a single-column tree. */
  tracks?: { id: string; title: string }[];
  milestones: MilestoneSpec[];
}

/**
 * Distinguishes fixtures that do not name themselves. Two trees sharing an
 * `(id, contentVersion)` would collide in the §8.6 memo and the second would
 * silently receive the first one's layout.
 */
let anonymousFixtureCount = 0;

export function makeTree(spec: TreeSpec): CompiledTree {
  const tracks = spec.tracks ?? [];
  const trackIndexOf = (track: string): number => {
    const found = tracks.findIndex((t) => t.id === track);
    return found === -1 ? 0 : found;
  };
  const defaultTrack = tracks.length > 0 ? tracks[0].id : '';

  const declared: MilestoneSpec[] = spec.milestones.map((m) => ({
    ...m,
    track: m.track ?? defaultTrack,
  }));

  // Levels are *not* padded up to §5.3's four-milestone minimum. Filler would
  // have to land in some cell, and inflating a cell is exactly what the column
  // width and centring tests measure — a fixture must not move the thing under
  // test. A level with no milestones simply contributes no nodes; the ten rows
  // exist regardless (§8.2 step 1).
  const padded: MilestoneSpec[] = [];
  for (let level = 1; level <= 10; level += 1) {
    padded.push(...declared.filter((m) => m.level === level));
  }

  // `order` is explicit in every compiled bundle (§7.3); default it per cell.
  const cellCounters = new Map<string, number>();
  const milestones: CompiledMilestone[] = padded.map((m, index) => {
    const track = m.track ?? '';
    const cellKey = `${m.level}::${track}`;
    const next = cellCounters.get(cellKey) ?? 0;
    cellCounters.set(cellKey, next + 1);
    return {
      id: m.id,
      uid: uidFor(m.id, index),
      title: m.title ?? m.id,
      level: m.level,
      track,
      trackIndex: trackIndexOf(track),
      order: m.order ?? next,
      requires: [],
    };
  });

  const indexOfSlug = new Map(milestones.map((m, i) => [m.id, i]));
  padded.forEach((spec, i) => {
    const requires = spec.requires ?? [];
    milestones[i].requires = requires.map((slug): MilestoneRef => {
      const index = indexOfSlug.get(slug);
      if (index === undefined) throw new Error(`fixture: unknown requires target "${slug}"`);
      return { index, slug };
    });
  });

  const levels = Array.from({ length: 10 }, (_, i) => {
    const level = i + 1;
    const refs: MilestoneRef[] = milestones
      .map((m, index) => ({ m, index }))
      .filter(({ m }) => m.level === level)
      .map(({ m, index }) => ({ index, slug: m.id }));
    return {
      level,
      milestones: refs,
      // Resolved refs, not slugs — §7.3 resolves every slug reference to an
      // array index at compile time, and a fixture that carried slugs here
      // would let a consumer type-check against a shape no bundle has.
      requirements: [{ rule: 'all', milestones: refs }],
    } as unknown as CompiledLevel;
  });

  return {
    schemaVersion: 1,
    contentVersion: spec.contentVersion ?? 1,
    id: spec.id ?? `fixture-${(anonymousFixtureCount += 1)}`,
    title: 'Fixture',
    summary: 'Fixture tree',
    domain: 'making',
    subregion: 'objects',
    provenance: { authors: [{ name: 'fixture' }], copyleftDerived: false },
    ...(tracks.length > 0 ? { tracks } : {}),
    levels,
    milestones,
  } as unknown as CompiledTree;
}

/** Deterministic 8-character Crockford-shaped uid, so fixtures are reproducible. */
function uidFor(slug: string, index: number): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let hash = index + 1;
  for (const ch of slug) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[hash % 32];
    hash = Math.floor(hash / 32) + 7 * (i + 1);
  }
  return out;
}

/**
 * The §8.3 worked example: two tracks, `forge` peaking at three lanes and
 * `finishing` at two.
 */
export function forgeTree(): CompiledTree {
  return makeTree({
    id: 'smithing',
    tracks: [
      { id: 'forge', title: 'Forge' },
      { id: 'finishing', title: 'Finishing' },
    ],
    milestones: [
      { id: 'light-forge', level: 1, track: 'forge' },
      { id: 'draw-taper', level: 1, track: 'forge' },
      { id: 'quench', level: 1, track: 'finishing' },
      { id: 'forge-a-leaf', level: 2, track: 'forge', requires: ['light-forge'] },
      { id: 'punch', level: 2, track: 'forge' },
      { id: 'drift', level: 2, track: 'forge', requires: ['punch'] },
      { id: 'temper', level: 2, track: 'finishing', requires: ['quench'] },
      { id: 'hot-cut', level: 3, track: 'forge', requires: ['forge-a-leaf'] },
      { id: 'polish', level: 3, track: 'finishing' },
      { id: 'etch', level: 3, track: 'finishing', requires: ['polish'] },
    ],
  });
}
