/**
 * The Layout Engine (§8) — a pure function with no dependencies.
 *
 * No framework, no DOM, no I/O, no randomness, no clock. Given identical input
 * it returns identical output, on every machine and in every session, which is
 * the entire mechanism behind F13 and N11.
 *
 * Coordinates are **abstract units**, scaled to pixels by the renderer through
 * the SVG `viewBox`. The engine therefore never learns the screen size — only
 * which of two layout modes applies — which is what keeps it testable without a
 * browser.
 *
 * The signature deliberately excludes user state (§8.6, §14.1). Completing a
 * milestone must never trigger a re-layout.
 */

import type { CompiledTree } from '$lib/types';
import { memoKey, memoized } from './memo.js';
import { layoutNarrow } from './narrow.js';
import { layoutWide } from './wide.js';

export type Viewport = 'wide' | 'narrow';

export interface PositionedNode {
  uid: string;
  slug: string;
  level: number; // 1..10
  col: number; // track index
  lane: number; // index within the (level, track) cell
  x: number;
  y: number;
  w: number;
  h: number; // abstract units, not pixels
}

export interface RoutedEdge {
  fromUid: string;
  toUid: string;
  path: string; // SVG path `d`, in the same abstract units
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: RoutedEdge[];
  columns: { trackId: string; title: string; x: number; w: number }[];
  rows: { level: number; y: number; h: number }[];
  width: number;
  height: number;
  viewport: Viewport;
}

export function layoutTree(tree: CompiledTree, viewport: Viewport): TreeLayout {
  return memoized(memoKey(tree.id, tree.contentVersion, viewport), () =>
    viewport === 'wide' ? layoutWide(tree) : layoutNarrow(tree),
  );
}

export { clearLayoutCache } from './memo.js';
export * from './constants.js';
