/**
 * §15.2's keyboard model as arithmetic over the Layout Engine's output (T20).
 *
 * Nodes are a single tab stop with roving `tabindex`; the arrows move within the
 * grid, so a tree of eighty milestones does not cost eighty tabs. The *decision*
 * about which node a key reaches is pure, which is what lets it be tested
 * against every row of §15.2's table without a DOM, and what keeps the component
 * free of index arithmetic mixed into event handlers.
 *
 * **Grid order is `(level, track, lane)` and it is one order for three jobs**:
 * document order, focus order, and §15.1's reading order. Splitting them is how
 * a keyboard user ends up traversing a sequence the screen reader announces in a
 * different order — and §8.5's narrow layout, which is the primary accessible
 * presentation at every viewport, already fixes level 1 first (F27).
 *
 * Two choices §15.2 leaves open, settled here:
 *
 * - `Home`/`End` are written as "level 1 / level 10", but a tree need not author
 *   all ten levels. They go to the **lowest and highest levels that hold nodes**,
 *   which is level 1 and level 10 for a complete tree and never dead keys for an
 *   incomplete one.
 * - `↑`/`↓` are "same track, level up / down". A track can have gaps, so they
 *   scan onward in that direction for the nearest level holding a node in the
 *   same track rather than stopping at the first empty level. **Which arrow means
 *   which level depends on the viewport**: §8.2 puts level 1 at the bottom in
 *   wide, and §8.5 puts it at the top in narrow, so a fixed mapping would send
 *   `↑` visually downward in one of the two. An arrow key that does not move
 *   focus the way the arrow points is worse than no arrow key.
 */

import type { NodeState } from '$lib/types';

/**
 * The four fields a key press needs, declared here rather than imported from
 * `$lib/layout`.
 *
 * §13.4 makes `TreeView` the only view-layer file that may name the Layout
 * Engine at all — enforced by `eslint.config.js` and `view-boundaries.test.ts` —
 * and the point of that rule is that nothing in the view layer can run a layout.
 * A structural type keeps the rule mechanically checkable instead of gaining an
 * exception, and `GridNode` satisfies it without a cast.
 */
export interface GridNode {
  readonly uid: string;
  readonly level: number;
  /** Track index (§8.2 step 2); 0 for a tree with no tracks and for narrow. */
  readonly col: number;
  /** Index within the `(level, col)` cell. */
  readonly lane: number;
}

/** Which of §8.2's two layouts is on screen — the arrows' sign depends on it. */
export type GridViewport = 'wide' | 'narrow';

/** The keys §15.2's table assigns to traversal, as opposed to activation. */
export type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | '.';

const GRID_KEYS = new Set<string>([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  '.',
]);

export function isGridKey(key: string): key is GridKey {
  return GRID_KEYS.has(key);
}

/**
 * `(level, track, lane)` — the one order (see the module note). Generic in the
 * node type, so the renderer gets its positions back rather than four fields.
 */
export function gridOrder<T extends GridNode>(nodes: readonly T[]): T[] {
  return [...nodes].sort((a, b) => a.level - b.level || a.col - b.col || a.lane - b.lane);
}

function withinLevel(ordered: readonly GridNode[], level: number): GridNode[] {
  return ordered.filter((node) => node.level === level);
}

/**
 * F36's shortcut. Document order, not proximity: the promise is "the next thing
 * you can do", and a nearest-neighbour search would send two presses in a
 * circle. It wraps, so the last available node leads back to the first.
 */
function nextAvailable(
  ordered: readonly GridNode[],
  states: ReadonlyMap<string, NodeState>,
  from: GridNode | undefined,
): GridNode | undefined {
  const available = ordered.filter((node) => states.get(node.uid) === 'available');
  if (available.length === 0) return undefined;
  if (from === undefined) return available[0];

  const start = ordered.indexOf(from);
  const after = available.find((node) => ordered.indexOf(node) > start);
  return after ?? available[0];
}

/**
 * The uid a key moves focus to, or `undefined` when the key moves nothing —
 * an edge of the grid, or a `.` with nothing available. The caller focuses the
 * result; nothing here touches the DOM.
 */
export function focusTarget(
  nodes: readonly GridNode[],
  states: ReadonlyMap<string, NodeState>,
  currentUid: string | null,
  key: GridKey,
  viewport: GridViewport,
): string | undefined {
  const ordered = gridOrder(nodes);
  if (ordered.length === 0) return undefined;

  const current = ordered.find((node) => node.uid === currentUid);

  if (key === '.') return nextAvailable(ordered, states, current)?.uid;

  if (key === 'Home') return ordered[0].uid;
  if (key === 'End') return withinLevel(ordered, ordered[ordered.length - 1].level)[0].uid;

  // Every remaining key is relative, so with nothing focused there is no answer
  // but the first node — which is where the single tab stop lands anyway.
  if (current === undefined) return ordered[0].uid;

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const row = withinLevel(ordered, current.level);
    const index = row.indexOf(current) + (key === 'ArrowRight' ? 1 : -1);
    return row[index]?.uid;
  }

  // Same track, nearest level in that direction that holds one (see the note).
  // Wide draws level 1 at the bottom, narrow at the top, so the sign flips.
  const upward = viewport === 'wide' ? 1 : -1;
  const step = key === 'ArrowUp' ? upward : -upward;
  const inTrack = ordered
    .filter((node) => node.col === current.col)
    .sort((a, b) => (a.level - b.level) * step);
  return inTrack.find((node) => (node.level - current.level) * step > 0)?.uid;
}
