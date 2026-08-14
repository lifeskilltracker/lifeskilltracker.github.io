/**
 * The map's presentation mappings (§10.5, §10.7, §15.3) — everything the
 * renderer decides that is worth asserting without a DOM.
 *
 * Four of these exist because the numbers the component draws are *not* the
 * numbers it is given:
 *
 * - `fillRect` turns §11.6's unbounded-mapped-to-`[0,1)` fill into a clip
 *   rectangle rising from the region's base. A clip rather than opacity is what
 *   keeps a partly-filled region's outline and label at full strength (§10.5).
 * - `formatLastActivity` formats a stored timestamp and does nothing else.
 *   **No elapsed time is computed anywhere in this file** — D-20 ships a date,
 *   and the graded channel is R-20, phase 2.
 * - `isFogged` asks the *manifest*, never user state: F22 is about signalling
 *   forthcoming content and inviting contribution, which is a property of the
 *   library (§10.5).
 * - `regionAccessibleName` is §15.3's builder, and it announces fill by its
 *   **named band** — resolved through `bandFor`, the one resolver over the one
 *   ordered table (§11.6, T26/F18). No threshold appears in this module or in
 *   the component, so renaming a band or moving a boundary stays the one-line
 *   data edit F18 requires.
 *
 * The geometry helpers exist because `CompiledMapRegion.bounds` and `.label`
 * are optional in the generated type (the schema requires neither), while T12's
 * compiler always emits them. Deriving the fallback from the path is total, so
 * the component has no `undefined` branch to get wrong.
 */

import { bandFor } from '$lib/scoring';
import type { CompiledMapRegion, DomainId, DomainScore, Manifest } from '$lib/types';

/**
 * Below this container width, §10.7 substitutes the domain list for the map.
 * The number itself lives in `breakpoints.ts` with §15.7's other two, and is
 * re-exported here because this is where the map's callers already look.
 */
export { MAP_LIST_BELOW } from './breakpoints.js';

/** §10.7, F23 — selecting a region opens that domain's skill listing (T14's route). */
export function domainListingHref(domain: DomainId): string {
  return `/d/${domain}`;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Every coordinate in a compiled region path (§10.4 emits `M x,y L x,y … Z`,
 * one sub-path per loop). Parsing numbers rather than commands is deliberate:
 * a hole emits two sub-paths and both belong to the same region, so there is
 * nothing here that needs to know where one loop ends.
 */
function pointsOf(path: string): Array<{ x: number; y: number }> {
  const numbers = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}

function boundsOfPath(path: string): Box {
  const points = pointsOf(path);
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** The compiler's box when it emitted one; otherwise the path's own extent. */
export function regionBounds(region: CompiledMapRegion): Box {
  return region.bounds ?? boundsOfPath(region.path);
}

/** The compiler's label anchor when it emitted one; otherwise the path centroid. */
export function labelAnchor(region: CompiledMapRegion): { x: number; y: number } {
  if (region.label !== undefined) return region.label;
  return centroidOf(region.path);
}

export function centroidOf(path: string): { x: number; y: number } {
  const points = pointsOf(path);
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** The union of every region's box — the map's `viewBox` (§10.5). */
export function mapViewBox(regions: readonly CompiledMapRegion[]): Box {
  if (regions.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const boxes = regions.map(regionBounds);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * §10.5's clip rectangle: full width, rising from the region's base to
 * `fill × height`. `fill` is in `[0, 1)` by construction (§11.6) and is
 * clamped anyway — a component that trusted an out-of-range number would
 * paint outside its own region and over its neighbour.
 */
export function fillRect(bounds: Box, fill: number): Box {
  const fraction = Math.min(1, Math.max(0, fill));
  const height = bounds.height * fraction;
  return { x: bounds.x, y: bounds.y + bounds.height - height, width: bounds.width, height };
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  // §12.2 stores UTC; formatting in the reader's zone would move a late-evening
  // completion to the following day for half the world.
  timeZone: 'UTC',
});

/**
 * D-20's whole channel. It reads no clock and computes no elapsed time — the
 * only input is the stored stamp, so there is nothing here to decay.
 *
 * The year is carried even though §10.5's example is *"Last activity — 12
 * March"*: dropping it either loses the year outright or requires comparing
 * against today, and comparing against today is the time-since computation the
 * acceptance criteria forbid.
 */
export function formatLastActivity(lastActivityAt: string | null): string {
  if (lastActivityAt === null) return 'No activity yet';
  const at = new Date(lastActivityAt);
  if (Number.isNaN(at.getTime())) return 'No activity yet';
  return `Last activity — ${DATE_FORMAT.format(at)}`;
}

/** F35's count as a phrase; the bare integer renders beside the label (§10.5). */
export function breadthText(breadth: number): string {
  if (breadth === 0) return 'No skills started';
  return `${breadth} skill${breadth === 1 ? '' : 's'} started`;
}

/**
 * §10.5 — a domain is fogged when *the library* has no trees for it, not when
 * the user has not started any. Primary domain only, matching §11.6's score:
 * a tree listed under a secondary domain is not published content *for* that
 * domain in the sense F22 means.
 */
export function isFogged(manifest: Manifest, domain: DomainId): boolean {
  return !manifest.trees.some((tree) => tree.domain === domain);
}

/** §10.5's affordance, and the only text a fogged region shows. */
export const FOG_AFFORDANCE = 'No skills yet — contribute one';

/**
 * §15.3's accessible name, carrying every channel as text. Fill arrives as its
 * named band and never as a number: a raw percentage is what F34 refuses, and
 * §15.4 makes the band the redundant channel for a fill height that would
 * otherwise be colour and geometry alone.
 */
export function regionAccessibleName(
  title: string,
  score: DomainScore,
  fogged: boolean,
): string {
  if (fogged) return `${title}. No skills published yet — contribute one.`;
  return [
    `${title}.`,
    `${breadthText(score.breadth)}.`,
    `Fill: ${bandFor(score.fill)}.`,
    `${formatLastActivity(score.lastActivityAt)}.`,
  ].join(' ');
}
