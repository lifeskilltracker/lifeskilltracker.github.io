/**
 * §8.5 — the narrow layout (F16).
 *
 * Same function, same input, one column. F16 is satisfied by a *parameter*, not
 * by a second code path over different data: nothing mobile-specific is
 * authored, computed, or stored.
 *
 * **Level 1 is at the TOP here, the opposite of wide** — the one place the two
 * modes disagree about direction. Wide is a spatial metaphor, a tree growing
 * upward. Narrow is a *reading order*, and §15 reuses it as the linear
 * presentation given to screen readers at every viewport; level 1 at the bottom
 * would run that order level 10 → level 1 and put visual order in opposition to
 * focus order on the one layout where they are the same list.
 */

import type { CompiledMilestone, CompiledTree } from '$lib/types';
import { ROW_HEIGHT, SLOT_HEIGHT, SLOT_WIDTH } from './constants.js';
import type { PositionedNode, TreeLayout } from './index.js';

const LEVELS = 10;
const ROW_INSET = (ROW_HEIGHT - SLOT_HEIGHT) / 2;

export function layoutNarrow(tree: CompiledTree): TreeLayout {
  const hasTracks = (tree.tracks ?? []).length > 0;
  const trackIndexOf = (m: CompiledMilestone) => (hasTracks ? m.trackIndex : 0);

  const ordered = [...tree.milestones].sort(
    (a, b) =>
      a.level - b.level ||
      trackIndexOf(a) - trackIndexOf(b) ||
      a.order - b.order ||
      a.id.localeCompare(b.id),
  );

  // `lane` keeps its §8.1 meaning — index within the (level, col) cell, which in
  // narrow is the index within the level. It is deliberately not a running index
  // over the whole stack: one field must not mean two things across two modes,
  // and the stack order is fully recovered as (level, lane).
  const laneCounters = new Map<number, number>();
  const nodes: PositionedNode[] = ordered.map((milestone, stackIndex) => {
    const lane = laneCounters.get(milestone.level) ?? 0;
    laneCounters.set(milestone.level, lane + 1);
    return {
      uid: milestone.uid,
      slug: milestone.id,
      level: milestone.level,
      col: 0,
      lane,
      x: 0,
      y: stackIndex * ROW_HEIGHT + ROW_INSET,
      w: SLOT_WIDTH,
      h: SLOT_HEIGHT,
    };
  });

  const width = SLOT_WIDTH;
  const height = nodes.length * ROW_HEIGHT;

  // Rows are the bands each level's run of nodes occupies, so they are no longer
  // equal height — §8.2's equal-row rule belongs to the wide algorithm.
  const rows: TreeLayout['rows'] = [];
  for (let level = 1; level <= LEVELS; level += 1) {
    const first = ordered.findIndex((m) => m.level === level);
    const count = ordered.filter((m) => m.level === level).length;
    rows.push({
      level,
      y: first === -1 ? 0 : first * ROW_HEIGHT,
      h: count * ROW_HEIGHT,
    });
  }

  return {
    nodes,
    // Prerequisites are surfaced by the renderer as text references (§9.5).
    edges: [],
    // One synthetic column, not an empty array, so `columns[node.col]` resolves
    // in both modes and §9 need not branch on viewport (§8.5).
    columns: [{ trackId: '', title: '', x: 0, w: width }],
    rows,
    width,
    height,
    viewport: 'narrow',
  };
}
