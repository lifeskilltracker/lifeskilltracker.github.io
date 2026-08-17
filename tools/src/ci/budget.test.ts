/**
 * §17.1's budget gate, tested the same way the S1 grep gate is: by proving it
 * fails. A size check that has only ever been run against a passing build is
 * indistinguishable from `exit 0`.
 *
 * The fixtures are synthetic build directories filled with **random bytes**,
 * because random bytes are incompressible: `incompressible()` below searches
 * for the raw size whose Brotli output is exactly the number the test asked
 * for, so a fixture can sit precisely on a budget boundary. Real chunks would
 * make every assertion a hostage to the bundler's output.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

import { BUDGETS, budgetCommand, measureBudget } from './budget.js';

const REPO_ROOT = resolve(__dirname, '../../..');

let sandbox: string | null = null;

afterEach(() => {
  if (sandbox !== null) rmSync(sandbox, { recursive: true, force: true });
  sandbox = null;
});

interface Fixture {
  /** Exact Brotli sizes for the modules the map route preloads. */
  firstPaintJs: number[];
  /**
   * A4's display face, in raw bytes. Written beside the stylesheet and referenced
   * from an `@font-face` rule, because that reference — not the file's presence —
   * is what makes it first-paint cost.
   */
  fontBytes?: number;
  /** Exact Brotli sizes for its stylesheets. */
  firstPaintCss?: number[];
  /**
   * Approximate Brotli sizes reachable from the tree route's node and nowhere
   * else — approximate because the node file also carries import statements,
   * and no test here needs that row to the byte.
   */
  treeRouteJs?: number[];
}

/**
 * Random bytes compress to *slightly more* than their own size, so asking for a
 * file of n bytes does not give a transfer of n bytes. This searches downward
 * for the raw size whose Brotli output is exactly `target`, which is what lets
 * the boundary test distinguish `>` from `>=`.
 */
function incompressible(target: number): Buffer {
  for (let raw = target; raw > target - 64 && raw > 0; raw -= 1) {
    const candidate = randomBytes(raw);
    if (brotliCompressSync(candidate).length === target) return candidate;
  }
  throw new Error(`no payload compresses to exactly ${target} B`);
}

/** A build directory shaped like adapter-static's, sized to order. */
function fakeBuild(fixture: Fixture): { buildDir: string; routeManifest: string } {
  sandbox = mkdtempSync(join(tmpdir(), 'lst-budget-'));
  const buildDir = join(sandbox, 'build');
  const immutable = join(buildDir, '_app', 'immutable');
  mkdirSync(join(immutable, 'chunks'), { recursive: true });
  mkdirSync(join(immutable, 'nodes'), { recursive: true });
  mkdirSync(join(immutable, 'assets'), { recursive: true });

  const preloads = fixture.firstPaintJs.map((bytes, index) => {
    const name = `chunks/first-${index}.js`;
    writeFileSync(join(immutable, name), incompressible(bytes));
    return name;
  });
  if (fixture.fontBytes !== undefined) {
    writeFileSync(join(immutable, 'assets', 'display.woff2'), randomBytes(fixture.fontBytes));
  }
  const fontRule =
    fixture.fontBytes === undefined
      ? ''
      : "@font-face{font-family:'D';src:url('./display.woff2') format('woff2');}";
  const styles = (fixture.firstPaintCss ?? [200]).map((bytes, index) => {
    const name = `assets/${index}.css`;
    // The rule goes in the first stylesheet only; the discovery walks them all.
    const rule = index === 0 ? Buffer.from(fontRule) : Buffer.alloc(0);
    writeFileSync(join(immutable, name), Buffer.concat([rule, incompressible(bytes)]));
    return name;
  });

  // The lazy node imports its own chunks statically; the closure walker is what
  // turns that into a number, so the fixture exercises the walk rather than
  // handing the checker one file.
  const lazy = (fixture.treeRouteJs ?? [1000]).slice();
  const nodeBytes = lazy.shift() ?? 0;
  const lazyChunks = lazy.map((bytes, index) => {
    const name = `lazy-${index}.js`;
    writeFileSync(join(immutable, 'chunks', name), incompressible(bytes));
    return name;
  });
  // The checker matches `from"…"`, which is what the bundler emits.
  const bindings = lazyChunks.map((name, index) => `import{a as x${index}}from"../chunks/${name}"`).join('\n');
  writeFileSync(
    join(immutable, 'nodes', '8.abcd1234.js'),
    Buffer.concat([Buffer.from(`${bindings}\n`), randomBytes(nodeBytes)]),
  );

  const links = [
    ...preloads.map((name) => `\t\t<link href="./_app/immutable/${name}" rel="modulepreload">`),
    ...styles.map((name) => `\t\t<link href="./_app/immutable/${name}" rel="stylesheet">`),
  ].join('\n');
  writeFileSync(join(buildDir, 'index.html'), `<!doctype html>\n<html>\n<head>\n${links}\n</head>\n</html>\n`);

  const routeManifest = join(sandbox, 'app.js');
  writeFileSync(routeManifest, 'export const dictionary = {\n\t\t"/": [2],\n\t\t"/s/[tree]": [8]\n\t};\n');

  return { buildDir, routeManifest };
}

const REAL_BUILD = join(REPO_ROOT, 'app/build');

describe('§17.1 — the bundle budget gate', () => {
  // "When one is present" is a real condition, and it is false in CI. The
  // `app: test` job runs `npm test` off a bare `npm ci` with no build, so this
  // case throws there while passing on any machine with a stale `app/build` on
  // disk. Skipping is safe because this is not the gate: `npm run check:budget`
  // is, and it runs in `app: build` immediately after the build that produces
  // the directory. What is lost by skipping is a smoke check, not enforcement.
  it.skipIf(!existsSync(join(REAL_BUILD, 'index.html')))(
    'measures the real build when one is present',
    () => {
      // Not a size assertion: the numbers move with every dependency bump, and
      // pinning them here would make this suite the thing that fails. What it
      // proves is that the checker finds this repository's actual output rather
      // than throwing or measuring nothing.
      const report = measureBudget({
        buildDir: REAL_BUILD,
        routeManifest: join(REPO_ROOT, 'app/.svelte-kit/generated/client/app.js'),
      });
      expect(report.rows).toHaveLength(5);
      for (const row of report.rows) expect(row.measured).toBeGreaterThan(0);
    },
  );

  it('refuses to measure an absent build rather than passing vacuously', () => {
    // The behaviour the skip above relies on being deliberate. Without this,
    // a missing build would report zero bytes and every budget would pass.
    expect(() =>
      measureBudget({
        buildDir: join(REPO_ROOT, 'app/build-does-not-exist'),
        routeManifest: join(REPO_ROOT, 'app/.svelte-kit/generated/client/app.js'),
      }),
    ).toThrow(/run `npm run build`/);
  });

  it('passes a build inside every budget', () => {
    const fixture = fakeBuild({ firstPaintJs: [20_000, 15_000], firstPaintCss: [3_000], treeRouteJs: [8_000, 4_000] });
    expect(measureBudget(fixture).violations).toEqual([]);
  });

  it('fails when first paint exceeds the 82 kB total (A4)', () => {
    const fixture = fakeBuild({ firstPaintJs: [40_000, 28_000], firstPaintCss: [15_000] });
    const violations = measureBudget(fixture).violations.map((row) => row.label);
    expect(violations).toContain('Total first paint (JS + CSS + font)');
    expect(budgetCommand(fixture)).toBe(1);
  });

  /**
   * A4's row, and the two things about it that are easy to get wrong: the font is
   * found through the stylesheet rather than by globbing the build, and it is
   * measured raw because woff2 is already Brotli.
   */
  it('bills the display face to its own row, discovered from the stylesheet', () => {
    const fixture = fakeBuild({ firstPaintJs: [20_000], firstPaintCss: [3_000], fontBytes: 6_672 });
    const report = measureBudget(fixture);
    const font = report.rows.find((row) => row.label === 'Display face');
    expect(font?.measured).toBe(6_672);
    expect(font?.files).toEqual(['_app/immutable/assets/display.woff2']);
    expect(report.violations).toEqual([]);
  });

  it('fails a face one byte over its 12 kB row', () => {
    const fixture = fakeBuild({ firstPaintJs: [20_000], firstPaintCss: [3_000], fontBytes: 12_001 });
    expect(measureBudget(fixture).violations.map((row) => row.label)).toContain('Display face');
  });

  it('does not bill a font the stylesheet never references', () => {
    const fixture = fakeBuild({ firstPaintJs: [20_000], firstPaintCss: [3_000] });
    writeFileSync(join(fixture.buildDir, '_app', 'immutable', 'assets', 'stray.woff2'), randomBytes(9_000));
    const font = measureBudget(fixture).rows.find((row) => row.label === 'Display face');
    expect(font?.measured).toBe(0);
  });

  it('passes with every row exactly on its budget, and fails one byte over', () => {
    // The comparison is `>`, not `>=`: §17.1's rows all read "≤".
    const at = fakeBuild({ firstPaintJs: [52_000], firstPaintCss: [15_000], treeRouteJs: [1_000] });
    const report = measureBudget(at);
    expect(report.violations).toEqual([]);
    // 52 + 15 = 67, which is §17.1's own arithmetic and 3 kB inside the 70 kB
    // total. The total row is a backstop, not the binding constraint.
    expect(report.rows.find((row) => row.label.startsWith('Total'))?.measured).toBe(67_000);
    rmSync(sandbox as string, { recursive: true, force: true });
    sandbox = null;

    const over = fakeBuild({ firstPaintJs: [52_001], firstPaintCss: [15_000] });
    expect(measureBudget(over).violations.map((row) => row.label)).toContain(
      'App JS, first route (incl. Svelte runtime)',
    );
  });

  it('fails when the lazy tree route exceeds its own 25 kB', () => {
    const fixture = fakeBuild({ firstPaintJs: [10_000], treeRouteJs: [20_000, 6_000] });
    const violations = measureBudget(fixture).violations.map((row) => row.label);
    expect(violations).toContain('App JS, tree route (lazy)');
    // The route budget is separate from first paint's, which is still green.
    expect(violations).not.toContain('Total first paint (JS + CSS)');
  });

  it('fails when CSS alone exceeds 15 kB', () => {
    const fixture = fakeBuild({ firstPaintJs: [10_000], firstPaintCss: [15_001] });
    expect(measureBudget(fixture).violations.map((row) => row.label)).toContain('CSS, first route');
  });

  it('does not charge the tree route for chunks first paint already loaded', () => {
    const shared = fakeBuild({ firstPaintJs: [10_000], treeRouteJs: [5_000] });
    const report = measureBudget(shared);
    const lazyRow = report.rows.find((row) => row.label.startsWith('App JS, tree route'));
    expect(lazyRow?.files.some((file) => file.includes('first-'))).toBe(false);
  });

  it('checks the first-route row against the runtime floor plus app JS', () => {
    expect(BUDGETS.firstRouteAppJs + BUDGETS.svelteRuntime).toBe(52_000);
    const fixture = fakeBuild({ firstPaintJs: [52_001], firstPaintCss: [200] });
    expect(measureBudget(fixture).violations.map((row) => row.label)).toContain(
      'App JS, first route (incl. Svelte runtime)',
    );
  });

  it('throws rather than passing vacuously when there is no build', () => {
    sandbox = mkdtempSync(join(tmpdir(), 'lst-budget-'));
    expect(() =>
      measureBudget({ buildDir: join(sandbox as string, 'build'), routeManifest: join(sandbox as string, 'app.js') }),
    ).toThrow(/no .*index\.html/);
  });

  it('throws when the route manifest no longer names the tree route', () => {
    const fixture = fakeBuild({ firstPaintJs: [10_000] });
    writeFileSync(fixture.routeManifest, 'export const dictionary = { "/": [2] };\n');
    expect(() => measureBudget(fixture)).toThrow(/has no "\/s\/\[tree\]" route/);
  });

  it('throws when index.html preloads nothing', () => {
    const fixture = fakeBuild({ firstPaintJs: [10_000] });
    writeFileSync(join(fixture.buildDir, 'index.html'), '<!doctype html><html><head></head></html>\n');
    expect(() => measureBudget(fixture)).toThrow(/lists no modulepreload links/);
  });
});
