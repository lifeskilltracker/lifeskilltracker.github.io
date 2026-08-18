/**
 * The app's cell → world conversion, checked against the shipped manifest
 * (§5.3, §5.4 — T31).
 *
 * **This is the test that makes the duplication safe.** `app/` may not import
 * `tools/`, so §10.2's conversion is written out in both workspaces; two copies
 * of a formula are two copies that can drift. The property that fails the moment
 * they do is containment: T29 assigns each tree a cell inside its own domain's
 * region, so if the app's arithmetic disagrees with the compiler's, some skill
 * hex lands outside the region it belongs to — and that is asserted here against
 * the real ledger and the real region paths, not against a fixture.
 *
 * It reads `static/content/manifest.json`, so it needs a compile first. CI
 * already orders it that way (`d7577f0`); locally, run `npm run build`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CELL_SIZE } from './camera.js';
import { cellCentre, skillHexPath, type Cell, type Point } from './skill-hex.js';

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../static/content/manifest.json', import.meta.url)), 'utf8'),
) as {
  taxonomy: { map: { regions: Array<{ domain: string; path: string }> } };
  trees: Array<{ id: string; domain: string; cell: Cell }>;
};

/**
 * Ray casting, even-odd, over every sub-path of a compiled region. Even-odd
 * rather than nonzero because §10.4 emits one sub-path per loop and a region
 * with a hole must count the hole as outside — which is the same rule the
 * browser applies to the rendered path.
 */
function contains(path: string, point: Point): boolean {
  let inside = false;
  for (const subpath of path.split('M').slice(1)) {
    const numbers = (subpath.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const points: Point[] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push({ x: numbers[i], y: numbers[i + 1] });

    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const a = points[i];
      const b = points[j];
      if (a.y > point.y !== b.y > point.y) {
        const x = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x);
        if (point.x < x) inside = !inside;
      }
    }
  }
  return inside;
}

describe('§10.2 — the conversion agrees with the compiler’s', () => {
  it('puts every published tree’s hex inside its own domain’s region', () => {
    const paths = new Map(manifest.taxonomy.map.regions.map((r) => [r.domain, r.path]));

    // The premise. A manifest with no placements would make the loop below pass
    // by iterating nothing, which is the one way this test can lie.
    expect(manifest.trees.length).toBeGreaterThan(0);

    for (const tree of manifest.trees) {
      const path = paths.get(tree.domain);
      expect(path, `no region for ${tree.domain}`).toBeDefined();
      expect(contains(path!, cellCentre(tree.cell)), `${tree.id} in ${tree.domain}`).toBe(true);
    }
  });

  it('places two trees in the same domain at different points', () => {
    // Guards the loop above against a conversion that collapsed every cell to
    // one point, which would sit inside the region and pass.
    const byDomain = new Map<string, Set<string>>();
    for (const tree of manifest.trees) {
      const p = cellCentre(tree.cell);
      const key = `${p.x},${p.y}`;
      const seen = byDomain.get(tree.domain) ?? new Set<string>();
      expect(seen.has(key), `${tree.id} collides with a sibling`).toBe(false);
      seen.add(key);
      byDomain.set(tree.domain, seen);
    }
  });
});

describe('the cell lattice itself', () => {
  it('puts the origin cell at the origin', () => {
    expect(cellCentre({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('steps one full cell width along a row', () => {
    const a = cellCentre({ q: 0, r: 0 });
    const b = cellCentre({ q: 1, r: 0 });
    expect(b.x - a.x).toBeCloseTo(CELL_SIZE * Math.sqrt(3), 6);
    expect(b.y).toBe(a.y);
  });

  it('staggers each row by half a cell, as a pointy-top lattice does', () => {
    const a = cellCentre({ q: 0, r: 0 });
    const b = cellCentre({ q: 0, r: 1 });
    expect(b.x - a.x).toBeCloseTo((CELL_SIZE * Math.sqrt(3)) / 2, 6);
    expect(b.y - a.y).toBeCloseTo(CELL_SIZE * 1.5, 6);
  });
});

describe('§5.4 — the hex is drawn inside its cell', () => {
  it('closes, and has the six corners of a hexagon', () => {
    const path = skillHexPath({ q: 0, r: 0 });
    expect(path.endsWith(' Z')).toBe(true);
    expect(path.match(/[ML]/g)).toHaveLength(6);
  });

  it('leaves a gap, so two adjacent skills do not tile into a honeycomb', () => {
    // The border channel — solid vs dashed — is unreadable at a shared seam, so
    // the gap is carrying §5.4's started/unstarted distinction, not decoration.
    const widthOf = (path: string): number => {
      const xs = (path.match(/(-?\d+(?:\.\d+)?),/g) ?? []).map((m) => Number(m.slice(0, -1)));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(widthOf(skillHexPath({ q: 0, r: 0 }))).toBeLessThan(CELL_SIZE * Math.sqrt(3));
  });
});
