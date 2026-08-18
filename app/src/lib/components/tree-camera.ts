/**
 * The level camera (T34, UI-SPEC §7).
 *
 * **Pure. No DOM, no clock, no framework** — §14.1's rule for the engines,
 * applied here because the same reasoning holds: the camera's whole contract is
 * *which offset*, and an answer that could only be checked in a browser would
 * not be checked. `TreeView` supplies the scroll container and the frames; this
 * file supplies the number and the easing.
 *
 * **There is no zoom here and there must never be one.** §7 declines free pan
 * and zoom by name: §15.2's arrow grid and roving `tabindex` both assume stable
 * positions, and scaling milestone text in and out fights the one thing the tree
 * exists to do. If a tree feels too tall, the answer is another named anchor
 * below — a `CameraTarget` variant — not a scale factor.
 *
 * Offsets are in the Layout Engine's abstract units (§8.1), the same units the
 * `viewBox` maps onto the element box, so the component converts by one ratio
 * and this module never learns the screen size.
 */

import type { GridNode } from './keyboard-grid.js';

/**
 * The three fields the camera needs from a `TreeLayout`, declared structurally
 * rather than imported — exactly as `keyboard-grid.ts` declares `GridNode`, and
 * for the same reason.
 *
 * §13.4 makes `TreeView` the only view-layer file that may name the Layout
 * Engine at all, enforced by `eslint.config.js` and `view-boundaries.test.ts`,
 * and the point of that rule is that nothing in the view layer can run a layout.
 * A structural type keeps the rule mechanically checkable instead of gaining an
 * exception, and a real `TreeLayout` satisfies it without a cast.
 */
export interface CameraLayout {
  readonly rows: readonly { readonly level: number; readonly y: number }[];
  readonly nodes: readonly GridNode[];
}

/** Likewise for `SkillProgress`: the blocking level (§11.3) and F36's list. */
export interface CameraProgress {
  readonly blocker?: { readonly level: number };
  readonly available: readonly string[];
}

/**
 * The three named anchors §7 gives the camera. A closed union rather than a
 * level number: "the blocking level" and "the next available milestone" are the
 * answers the user actually wants, and resolving them at the call site would put
 * the same two derivations in every caller.
 */
export type CameraTarget =
  | { readonly kind: 'level'; readonly level: number } // 1–10
  | { readonly kind: 'blocking' }
  | { readonly kind: 'next-available' }; // the `.` shortcut's target

/** UI-SPEC §5.6's camera fly. */
export const GLIDE_MS = 420;

/**
 * §15.5, mechanically: reduce means the camera arrives with no intermediate
 * frames. Nothing is lost, because the camera conveys nothing the arrival does
 * not — the motion is orientation, never information.
 */
export function glideDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : GLIDE_MS;
}

/**
 * §5.6's easing. Second-derivative-continuous at both ends, which is what stops
 * a long jump from starting and stopping with a visible jerk — the failure that
 * makes a camera feel like a scroll bug rather than a movement.
 */
export function smootherstep(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Where the camera sits `elapsed` ms into a glide. `duration <= 0` arrives at once. */
export function glidePosition(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0) return to;
  return from + (to - from) * smootherstep(elapsed / duration);
}

/** The row whose band the camera parks at the top of the view. */
function rowFor(layout: CameraLayout, level: number): { level: number; y: number } | undefined {
  const rows = [...layout.rows].sort((a, b) => a.level - b.level);
  if (rows.length === 0) return undefined;
  // Clamped rather than missing: a tree need not author all ten levels (§15.2
  // settles `Home`/`End` the same way), and an anchor into a level that holds no
  // row would glide the view into blank paper.
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (level <= first.level) return first;
  if (level >= last.level) return last;
  return rows.find((row) => row.level === level) ?? last;
}

/**
 * The blocking level (§11.3). A tree with nothing left to block is finished, so
 * the camera goes to its deepest level — which is where a finished tree's user
 * is looking anyway.
 */
function blockingLevel(layout: CameraLayout, progress: CameraProgress): number {
  if (progress.blocker !== undefined) return progress.blocker.level;
  return layout.rows.reduce((deepest, row) => Math.max(deepest, row.level), 1);
}

/**
 * F36's target, resolved through the layout rather than through `available`'s
 * own order: the camera moves the *view*, so the milestone it should show is the
 * first one in the order the view draws — `(level, track, lane)`, §15.2's one
 * order for document, focus and reading alike.
 */
function nextAvailableLevel(layout: CameraLayout, progress: CameraProgress): number | undefined {
  const available = new Set(progress.available);
  if (available.size === 0) return undefined;
  const ordered = [...layout.nodes].sort(
    (a, b) => a.level - b.level || a.col - b.col || a.lane - b.lane,
  );
  return ordered.find((node) => available.has(node.uid))?.level;
}

/**
 * The scroll offset, in layout units, that brings `target`'s band to the top of
 * the view. Never negative: level 10 sits at y 0 in wide (§8.2) and the camera
 * has nowhere above it to go.
 */
export function anchorFor(
  target: CameraTarget,
  layout: CameraLayout,
  progress: CameraProgress,
): number {
  const level =
    target.kind === 'level'
      ? target.level
      : target.kind === 'blocking'
        ? blockingLevel(layout, progress)
        : // Nothing available means nothing to show; the blocking level is the
          // honest second answer, and it is what the `.` shortcut's own
          // "moves nothing" case leaves on screen anyway.
          (nextAvailableLevel(layout, progress) ?? blockingLevel(layout, progress));

  return Math.max(0, rowFor(layout, level)?.y ?? 0);
}
