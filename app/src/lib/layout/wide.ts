/**
 * §8.2 — the wide algorithm, normative.
 *
 * No layout algorithm runs. Positions are arithmetic over declared semantics —
 * level, track, order, slug — which is the whole mechanism behind F13 and N11.
 *
 * `layoutWide` is total: a compiled bundle is valid by construction because §6.2
 * and §7.3 have already made it so, so there is no defensive branch, no `try`,
 * and no fallback path here (§14.3).
 */

import type { CompiledMilestone, CompiledTree } from '$lib/types';
import { COLUMN_GUTTER, ROW_HEIGHT, SIDE_GUTTER, SLOT_HEIGHT, SLOT_WIDTH } from './constants.js';
import { routeEdges } from './edges.js';
import type { PositionedNode, TreeLayout } from './index.js';

const LEVELS = 10;

/** Vertical inset that centres a node in its row, leaving half the gutter each side. */
const ROW_INSET = (ROW_HEIGHT - SLOT_HEIGHT) / 2;

export function layoutWide(tree: CompiledTree): TreeLayout {
  const tracks = tree.tracks ?? [];
  const hasTracks = tracks.length > 0;

  // Step 2. Tracks in declared order; a tree with no `tracks` gets one
  // synthetic column, marked by an empty `trackId` so §9 draws no header.
  const columnHeads = hasTracks
    ? tracks.map((t) => ({ trackId: t.id, title: t.title }))
    : [{ trackId: '', title: '' }];

  const columnOf = (m: CompiledMilestone): number => (hasTracks ? m.trackIndex : 0);

  // Steps 3 and 4. Cells grouped by (level, column), lanes sorted by
  // (order, slug) — total, and with no reference to file position.
  const cells = new Map<string, CompiledMilestone[]>();
  const cellKey = (level: number, col: number) => `${level}::${col}`;
  for (const milestone of tree.milestones) {
    const key = cellKey(milestone.level, columnOf(milestone));
    const cell = cells.get(key) ?? [];
    cell.push(milestone);
    cells.set(key, cell);
  }
  for (const cell of cells.values()) {
    cell.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  // Step 5. A column is as wide as its busiest cell. A declared track with no
  // milestones still occupies one slot rather than collapsing to nothing — the
  // `lonely-track` lint (§6.3) is what flags that, not the geometry.
  const columnWidths = columnHeads.map((_, col) => {
    let maxLanes = 1;
    for (let level = 1; level <= LEVELS; level += 1) {
      maxLanes = Math.max(maxLanes, cells.get(cellKey(level, col))?.length ?? 0);
    }
    return maxLanes * SLOT_WIDTH;
  });

  const columns: TreeLayout['columns'] = [];
  let x = 0;
  columnHeads.forEach((head, col) => {
    columns.push({ ...head, x, w: columnWidths[col] });
    x += columnWidths[col] + COLUMN_GUTTER;
  });

  const lastColumn = columns[columns.length - 1];
  const columnsExtent = lastColumn.x + lastColumn.w;
  const width = columnsExtent + SIDE_GUTTER;
  const height = LEVELS * ROW_HEIGHT;

  // Step 1. Level 1 at the BOTTOM, ascending upward. All rows equal height.
  const rowY = (level: number) => (LEVELS - level) * ROW_HEIGHT;
  const rows: TreeLayout['rows'] = Array.from({ length: LEVELS }, (_, i) => ({
    level: i + 1,
    y: rowY(i + 1),
    h: ROW_HEIGHT,
  }));

  // Step 6. Nodes are centred within their column, so a cell of two and a cell
  // of three in the same column share a centre line (§8.3).
  const nodes: PositionedNode[] = [];
  for (let level = 1; level <= LEVELS; level += 1) {
    columnHeads.forEach((_, col) => {
      const cell = cells.get(cellKey(level, col)) ?? [];
      const column = columns[col];
      const offset = (column.w - cell.length * SLOT_WIDTH) / 2;
      cell.forEach((milestone, lane) => {
        nodes.push({
          uid: milestone.uid,
          slug: milestone.id,
          level,
          col,
          lane,
          x: column.x + offset + lane * SLOT_WIDTH,
          y: rowY(level) + ROW_INSET,
          w: SLOT_WIDTH,
          h: SLOT_HEIGHT,
        });
      });
    });
  }

  // Step 7, scoped to positioned milestones.
  const nodesByUid = new Map(nodes.map((node) => [node.uid, node]));
  const { edges } = routeEdges(tree, nodesByUid, columnsExtent);

  return { nodes, edges, columns, rows, width, height, viewport: 'wide' };
}
