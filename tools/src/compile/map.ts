/**
 * §10.2 and §10.4 — the hex maths and the region-union algorithm.
 *
 * **The hex grid has no runtime existence.** D-08's whole point: authors place
 * tiles, the compiler unions them into one path per domain, and what ships is
 * eight SVG paths in the manifest. Rendering individual hexagons instead — the
 * alternative §10.4 rejects — gives every region a visible internal honeycomb,
 * N hit targets instead of one, and no silhouette. The grid survives only as an
 * authoring convenience, because a human can specify an irregular blob without
 * drawing béziers and tessellation without gaps is guaranteed by construction.
 * All of this maths therefore costs **zero runtime bytes**.
 *
 * **No hex library** (§10.2). Pointy-top axial coordinates, six corners at
 * 30° + 60°·i, and that is the entire dependency surface.
 *
 * What this module does *not* do is validate. §10.3's five geometry invariants
 * are `lst validate`'s rules M1–M5 (T26/F17), and they run at validate time on
 * every PR that touches `map.yaml` — which `lst compile` does not, because
 * §6.5's path filter can skip it. The one thing left here is §10.4's **hole
 * warning**, and it is a warning precisely because M3 rejects disconnection
 * first: a hole and a two-piece region both produce two loops, so loop count
 * cannot discriminate and this module must not try.
 */

import type { AxialTile, MapFile, MapRegion, SubregionId } from '../validate/types.js';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompiledMapRegion {
  domain: MapRegion['domain'];
  /** One or more closed sub-paths. More than one means a hole (§10.4). */
  path: string;
  label: Point;
  bounds: Bounds;
  subregions?: Array<{ id: SubregionId; path: string }>;
}

export interface CompiledMap {
  regions: CompiledMapRegion[];
  warnings: string[];
}

const SQRT3 = Math.sqrt(3);

/** Emitted coordinate precision. Three decimals is well under a device pixel at any zoom. */
const EMIT_DECIMALS = 3;

/**
 * Vertex-grid snapping precision (§10.4 step 1). Adjacent hexes compute their
 * shared corners through different arithmetic and land a few ULPs apart; keys
 * built at this precision make them identical, which is what lets step 2
 * recognise an interior edge at all.
 */
const SNAP_DECIMALS = 6;

/** §10.2's conversion, verbatim: x = size × √3 × (q + r/2), y = size × 3/2 × r. */
export function axialToPixel(tile: AxialTile, size: number): Point {
  const [q, r] = tile;
  return {
    x: size * SQRT3 * (q + r / 2),
    y: size * 1.5 * r,
  };
}

/** The six corners of a pointy-top hexagon, at 30° + 60°·i (§10.2). */
export function hexCorners(center: Point, size: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((30 + 60 * i) * Math.PI) / 180;
    return {
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    };
  });
}

function snap(value: number): number {
  return Number(value.toFixed(SNAP_DECIMALS));
}

function vertexKey(point: Point): string {
  // `+ 0` normalizes -0 to 0, which would otherwise key a shared corner twice.
  return `${snap(point.x) + 0},${snap(point.y) + 0}`;
}

function pointOf(key: string): Point {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * §10.4 steps 1–3: expand tiles to corners on a shared vertex grid, discard
 * every edge appearing twice, and chain the survivors into closed loops.
 *
 * Returns one `M … Z` path per loop. A well-formed region yields exactly one; a
 * ring yields two, and so does a region in two pieces — see the module note on
 * why this function does not try to tell them apart.
 */
export function unionTiles(tiles: readonly AxialTile[], size: number): string[] {
  // Step 1 + 2. An edge is keyed by its endpoint pair, ordered so that the two
  // tiles sharing it produce the same key from opposite directions.
  const edges = new Map<string, [string, string]>();
  const seenTwice = new Set<string>();

  for (const tile of tiles) {
    const corners = hexCorners(axialToPixel(tile, size), size);
    for (let i = 0; i < 6; i += 1) {
      const a = vertexKey(corners[i]);
      const b = vertexKey(corners[(i + 1) % 6]);
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (edges.has(key)) {
        // Interior: shared by two tiles. Note a tile listed twice inside one
        // region discards both copies of all six of its edges and vanishes
        // silently — which is why M2 counts the multiset, not the set.
        edges.delete(key);
        seenTwice.add(key);
      } else if (!seenTwice.has(key)) {
        edges.set(key, [a, b]);
      }
    }
  }

  // Step 3. Adjacency over the surviving edges, then walk each loop.
  const adjacency = new Map<string, string[]>();
  for (const [a, b] of edges.values()) {
    (adjacency.get(a) ?? adjacency.set(a, []).get(a)!).push(b);
    (adjacency.get(b) ?? adjacency.set(b, []).get(b)!).push(a);
  }

  const remaining = new Set(edges.keys());
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const paths: string[] = [];
  while (remaining.size > 0) {
    const [first] = remaining;
    const [start, second] = edges.get(first)!;
    remaining.delete(first);

    const loop = [start, second];
    let previous = start;
    let current = second;

    for (;;) {
      const next = (adjacency.get(current) ?? []).find(
        (candidate) => candidate !== previous && remaining.has(edgeKey(current, candidate)),
      );
      if (next === undefined) break;
      remaining.delete(edgeKey(current, next));
      previous = current;
      current = next;
      if (next === start) break;
      loop.push(next);
    }

    paths.push(toPath(loop.map(pointOf)));
  }

  return paths;
}

function toPath(points: readonly Point[]): string {
  const at = (point: Point) =>
    `${round(point.x, EMIT_DECIMALS)},${round(point.y, EMIT_DECIMALS)}`;
  const [head, ...rest] = points;
  return `M ${at(head)}${rest.map((point) => ` L ${at(point)}`).join('')} Z`;
}

function round(value: number, decimals: number): number {
  return Number((value + 0).toFixed(decimals));
}

/** §10.4 step 4 — the label anchor. The centroid of the tile centres, unless authored. */
function labelFor(region: MapRegion, size: number): Point {
  if (region.label !== undefined) {
    return axialToPixel([region.label.q, region.label.r], size);
  }
  const centres = region.tiles.map((tile) => axialToPixel(tile, size));
  return {
    x: round(centres.reduce((sum, c) => sum + c.x, 0) / centres.length, EMIT_DECIMALS),
    y: round(centres.reduce((sum, c) => sum + c.y, 0) / centres.length, EMIT_DECIMALS),
  };
}

/** §10.4 step 4 — the bounding box, for hit-testing and zoom. Over corners, not centres. */
function boundsFor(tiles: readonly AxialTile[], size: number): Bounds {
  const corners = tiles.flatMap((tile) => hexCorners(axialToPixel(tile, size), size));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x: round(x, EMIT_DECIMALS),
    y: round(y, EMIT_DECIMALS),
    width: round(Math.max(...xs) - x, EMIT_DECIMALS),
    height: round(Math.max(...ys) - y, EMIT_DECIMALS),
  };
}

/**
 * Compiles every authored region into `manifest.taxonomy.map`. Authored order
 * is preserved: it is the order a human chose, and paint order is the only
 * thing it affects.
 */
export function compileMap(map: MapFile): CompiledMap {
  const warnings: string[] = [];
  const size = map.hexSize;

  const regions = map.regions.map((region) => {
    const loops = unionTiles(region.tiles, size);
    if (loops.length > 1) {
      warnings.push(
        `map.yaml: region for domain "${region.domain}" produced ${loops.length} closed ` +
          `loops — a hole, most likely an authoring mistake (§10.4). Both sub-paths were emitted.`,
      );
    }

    const compiled: CompiledMapRegion = {
      domain: region.domain,
      path: loops.join(' '),
      label: labelFor(region, size),
      bounds: boundsFor(region.tiles, size),
    };

    if (region.subregions !== undefined && region.subregions.length > 0) {
      // Subregions render as interior grouping lines (§10.6), so each gets its
      // own path over its own tiles. Their union is the parent's tile set
      // exactly — M4 is what guarantees that, not this code.
      compiled.subregions = region.subregions.map((sub) => ({
        id: sub.id,
        path: unionTiles(sub.tiles, size).join(' '),
      }));
    }

    return compiled;
  });

  return { regions, warnings };
}
