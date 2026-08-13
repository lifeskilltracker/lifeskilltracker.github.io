/**
 * §8.4 edge routing.
 *
 * Rule 5 of §6.2 guarantees a prerequisite's level is at or below its
 * dependent's, so every edge points upward or sideways and never down.
 *
 * Crossings are accepted and never minimized (F15). A same-level target to the
 * *left* of its source produces a path crossing the nodes between them; that is
 * the trade §8.4 makes deliberately, not a defect to route around.
 *
 * Mastery achievements are absent by construction: this module ranges over
 * positioned milestone nodes only, and §6.2 rule 14 leaves a mastery entry with
 * no level, track, order, or cell — so it has no position, and an edge naming
 * one would have no endpoint (§8.2 step 7). §9.6 surfaces those prerequisites
 * as text instead.
 */

import type { CompiledTree } from '$lib/types';
import { ROW_GUTTER, SAME_LEVEL_BOW, SIDE_GUTTER_LANE } from './constants.js';
import type { PositionedNode, RoutedEdge } from './index.js';

interface EdgePair {
  source: PositionedNode;
  target: PositionedNode;
}

export interface RoutingResult {
  edges: RoutedEdge[];
  /** The busiest row's same-level edge count — the §8.1 side-channel constraint input. */
  maxSameLevelEdgesInOneRow: number;
}

export function routeEdges(
  tree: CompiledTree,
  nodesByUid: ReadonlyMap<string, PositionedNode>,
  channelX: number,
): RoutingResult {
  const pairs: EdgePair[] = [];
  for (const milestone of tree.milestones) {
    const target = nodesByUid.get(milestone.uid);
    if (target === undefined) continue;
    for (const ref of milestone.requires ?? []) {
      const source = nodesByUid.get(tree.milestones[ref.index].uid);
      if (source === undefined) continue;
      pairs.push({ source, target });
    }
  }

  // Ordering is derived from position alone, never from file position (§8.2 step 4).
  const positional = (p: EdgePair) => [
    p.target.level,
    p.target.col,
    p.target.lane,
    p.source.level,
    p.source.col,
    p.source.lane,
  ];
  pairs.sort((a, b) => {
    const pa = positional(a);
    const pb = positional(b);
    for (let i = 0; i < pa.length; i += 1) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return a.source.uid.localeCompare(b.source.uid);
  });

  const sameLevel = pairs.filter((p) => p.source.level === p.target.level);
  const crossLevel = pairs.filter((p) => p.source.level !== p.target.level);

  // Lanes are assigned per row, inside out, in (source lane, target lane) order.
  const byRow = new Map<number, EdgePair[]>();
  for (const pair of sameLevel) {
    const row = byRow.get(pair.source.level) ?? [];
    row.push(pair);
    byRow.set(pair.source.level, row);
  }

  const routed: RoutedEdge[] = crossLevel.map(routeAcrossRows);
  for (const row of byRow.values()) {
    row.sort((a, b) => a.source.lane - b.source.lane || a.target.lane - b.target.lane);
    row.forEach((pair, k) => routed.push(routeThroughSideChannel(pair, channelX, k)));
  }

  const maxSameLevelEdgesInOneRow = Math.max(
    0,
    ...[...byRow.values()].map((row) => row.length),
  );

  return { edges: routed, maxSameLevelEdgesInOneRow };
}

/**
 * Three orthogonal segments: out of the source's top edge, across the inter-row
 * gutter, into the target's bottom edge. The horizontal run sits on the row
 * boundary above the source, which is the centre of the `ROW_GUTTER` channel.
 */
function routeAcrossRows({ source, target }: EdgePair): RoutedEdge {
  const sx = source.x + source.w / 2;
  const tx = target.x + target.w / 2;
  const gutterY = source.y - ROW_GUTTER / 2;
  const targetBottom = target.y + target.h;
  return {
    fromUid: source.uid,
    toUid: target.uid,
    path: `M ${n(sx)} ${n(source.y)} V ${n(gutterY)} H ${n(tx)} V ${n(targetBottom)}`,
  };
}

/**
 * The same-level path: out of the source's right edge, right to its lane depth,
 * vertically by `SAME_LEVEL_BOW`, then left into the target's right edge.
 *
 * **The bow is the load-bearing part.** Both nodes share a row, so both legs
 * leave from the right edge at the same `y`; without the offset the outbound and
 * return legs are the same line and it renders as a single stroke that looks
 * like a data bug.
 */
function routeThroughSideChannel({ source, target }: EdgePair, channelX: number, lane: number): RoutedEdge {
  const laneX = channelX + lane * SIDE_GUTTER_LANE;
  const y = source.y + source.h / 2;
  return {
    fromUid: source.uid,
    toUid: target.uid,
    path: `M ${n(source.x + source.w)} ${n(y)} H ${n(laneX)} V ${n(y + SAME_LEVEL_BOW)} H ${n(target.x + target.w)}`,
  };
}

/** Trims float noise so paths are byte-stable across machines. */
function n(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}
