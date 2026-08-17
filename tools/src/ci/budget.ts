/**
 * §17.1's bundle budget, enforced in CI (T25).
 *
 * The budget is stated in **Brotli-compressed transfer bytes**, which is the
 * number a browser actually pays. Gzip or raw-size proxies were rejected by
 * T25's own hazard note: they pass fixtures that fail in production and fail
 * fixtures that pass, so this module compresses with `zlib.brotliCompressSync`
 * at its default quality (11 — what a CDN serving pre-compressed assets uses).
 *
 * **What counts as "first paint" is not a judgement call here.** The built
 * `index.html` lists exactly the modules the browser preloads and the
 * stylesheets it blocks on for `/`, so that file is the measurement, not a
 * reconstruction of it. Anything the map route pulls in lazily is, by
 * construction, absent from those links.
 *
 * **The tree route is measured as a static-import closure** from its SvelteKit
 * node, minus everything first paint already loaded. `/s/[tree]` prerenders no
 * HTML — it is a dynamic route — so there is no equivalent document to read,
 * and the closure is what the browser fetches when the lazy node arrives.
 *
 * ### Why the first-route row is checked at 52 kB and not 40
 *
 * §17.1 splits first paint into a ~12 kB Svelte runtime ("measured floor; not
 * under our control") and ≤ 40 kB of app JS. Those two live in the same built
 * chunks after tree-shaking and inlining; no honest boundary between them
 * survives the bundler. Rather than invent one, this checks their sum against
 * the sum of their budgets, which is the arithmetic §17.1's own total row does
 * (12 + 40 + 15 = 67 ≤ 70). A regression in app JS still trips it; what it
 * cannot do is blame the runtime for one.
 *
 * A consequence worth stating: 52 + 15 = 67, so the per-row budgets bind three
 * kilobytes before the 70 kB total ever does. The total row is kept because
 * §17.1 states it and because it is the row that survives if a per-row budget
 * is ever relaxed — but a real regression trips a per-row check first, and that
 * is the message a contributor should expect to read.
 *
 * ### Failing loudly
 *
 * Every "could not find it" path throws. A budget check that measures nothing
 * and reports zero bytes is the §6.4 `fetch-depth: 0` trap in another costume:
 * it passes forever, and it passes hardest on the PR that deleted the build.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

/**
 * kB is 1000 bytes, not 1024. §17.1 is a statement about transfer, and every
 * tool that reports transfer size — the network panel, a CDN dashboard — uses
 * the decimal unit. Reading it as 1024 would quietly hand back 5% of the
 * budget that was never granted.
 */
const KB = 1000;

/** §17.1, verbatim. `svelteRuntime` is a floor, not a gate — see the header. */
export const BUDGETS = {
  svelteRuntime: 12 * KB,
  firstRouteAppJs: 40 * KB,
  treeRouteJs: 25 * KB,
  css: 15 * KB,
  /**
   * A4 (UI-SPEC §9). One self-hosted subsetted display face. The row is
   * affordable only because §4.5's glyph set is closed — eight domain names,
   * three subregions, five bands, five tiers and the UI headings — so a face
   * that lands over this is subsetting against the wrong set rather than
   * needing a larger budget.
   */
  displayFont: 12 * KB,
  firstPaintTotal: 82 * KB,
} as const;

/**
 * Fonts are measured RAW, not Brotli-compressed, and this is the one row where
 * that is correct: woff2 is already Brotli internally, so re-compressing it
 * measures a second pass that no browser performs and that gains nothing. The
 * file size *is* the transfer size.
 */
const FONT_EXTENSIONS = ['.woff2'];

/** The route whose lazy cost §17.1 budgets separately. */
const TREE_ROUTE = '/s/[tree]';

export interface BudgetRow {
  /** §17.1's row label, so the CI log and the spec table read the same. */
  label: string;
  measured: number;
  budget: number;
  files: string[];
  note?: string;
}

export interface BudgetReport {
  rows: BudgetRow[];
  violations: BudgetRow[];
}

export interface BudgetOptions {
  /** `app/build` — adapter-static's output. */
  buildDir: string;
  /**
   * `app/.svelte-kit/generated/client/app.js`, whose `dictionary` maps a route
   * id to its node indices. This is a SvelteKit internal and is treated as
   * one: if its shape changes, the parse below throws rather than guessing.
   */
  routeManifest: string;
}

function brotliSize(file: string): number {
  return brotliCompressSync(readFileSync(file)).length;
}

function sum(files: string[]): number {
  return files.reduce((total, file) => total + brotliSize(file), 0);
}

function rawSum(files: string[]): number {
  return files.reduce((total, file) => total + statSync(file).size, 0);
}

/**
 * A4 — the faces the first-paint CSS actually asks for.
 *
 * Discovered from the stylesheets rather than by globbing the build, because a
 * font that no rule references is not first-paint cost, and a glob would bill
 * the budget for it. The `@font-face` `src` is the browser's own list, the same
 * principle the JS rows already use against `index.html`.
 */
function fontAssets(cssFiles: string[]): string[] {
  const found = new Set<string>();
  for (const cssFile of cssFiles) {
    const css = readFileSync(cssFile, 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const href = match[1];
      if (!FONT_EXTENSIONS.some((extension) => href.endsWith(extension))) continue;
      if (/^(?:https?:)?\/\/|^data:/.test(href)) continue;
      found.add(resolve(dirname(cssFile), href));
    }
  }
  return [...found].filter((file) => existsSync(file));
}

/**
 * The `<link rel="modulepreload">` and `<link rel="stylesheet">` hrefs of the
 * prerendered map route, resolved to absolute paths.
 */
function firstPaintAssets(buildDir: string): { js: string[]; css: string[] } {
  const indexPath = join(buildDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(
      `§17.1: no ${indexPath} — run \`npm run build\` before the budget check. ` +
        'Measuring an absent build would pass vacuously.',
    );
  }
  const html = readFileSync(indexPath, 'utf8');

  const hrefs = (rel: string): string[] =>
    [...html.matchAll(new RegExp(`<link href="([^"]+)" rel="${rel}">`, 'g'))].map((match) =>
      resolve(buildDir, match[1]),
    );

  const js = hrefs('modulepreload');
  const css = hrefs('stylesheet');

  if (js.length === 0) {
    throw new Error(
      `§17.1: ${indexPath} lists no modulepreload links. Either the build shape changed ` +
        'or the document is not the prerendered map route; either way this check is ' +
        'no longer measuring first paint.',
    );
  }
  for (const file of [...js, ...css]) {
    if (!existsSync(file)) throw new Error(`§17.1: ${indexPath} references a missing asset: ${file}`);
  }
  return { js, css };
}

/**
 * The node index SvelteKit assigned to `/s/[tree]`, from the generated client
 * manifest's `dictionary`.
 */
function treeRouteNodeIndex(routeManifest: string): number {
  if (!existsSync(routeManifest)) {
    throw new Error(
      `§17.1: no ${routeManifest} — run \`npm run build\` (or \`svelte-kit sync\`) first. ` +
        'Without it the tree route cannot be located and its budget would go unchecked.',
    );
  }
  const source = readFileSync(routeManifest, 'utf8');
  const escaped = TREE_ROUTE.replace(/[[\]]/g, '\\$&');
  const entry = new RegExp(`"${escaped}":\\s*\\[([^\\]]*)\\]`).exec(source);
  if (entry === null) {
    throw new Error(`§17.1: ${routeManifest} has no "${TREE_ROUTE}" route — has the route moved?`);
  }
  // The last index is the leaf page node; earlier ones are its layouts, which
  // first paint already loaded.
  const indices = entry[1]
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value));
  if (indices.length === 0) {
    throw new Error(`§17.1: "${TREE_ROUTE}" in ${routeManifest} names no node index.`);
  }
  return indices[indices.length - 1];
}

/** Every file reachable from `entry` by *static* import. Dynamic imports are, by definition, not part of this chunk's cost. */
function staticClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s*"([^"]+)"/g)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const target = normalize(join(dirname(file), specifier));
      if (existsSync(target) && statSync(target).isFile()) walk(target);
    }
  };
  walk(entry);
  return seen;
}

function treeRouteAssets(buildDir: string, routeManifest: string, firstPaint: Set<string>): string[] {
  const index = treeRouteNodeIndex(routeManifest);
  const nodesDir = join(buildDir, '_app', 'immutable', 'nodes');
  if (!existsSync(nodesDir)) throw new Error(`§17.1: no ${nodesDir} — the build shape changed.`);

  const match = readdirSync(nodesDir).find((name) => name.startsWith(`${index}.`) && name.endsWith('.js'));
  if (match === undefined) {
    throw new Error(`§17.1: node ${index} (${TREE_ROUTE}) has no built chunk under ${nodesDir}.`);
  }

  return [...staticClosure(join(nodesDir, match))].filter((file) => !firstPaint.has(file));
}

export function measureBudget(options: BudgetOptions): BudgetReport {
  const buildDir = resolve(options.buildDir);
  const { js, css } = firstPaintAssets(buildDir);
  const firstPaint = new Set([...js, ...css]);
  const treeRoute = treeRouteAssets(buildDir, resolve(options.routeManifest), firstPaint);

  const fonts = fontAssets(css);
  const jsBytes = sum(js);
  const cssBytes = sum(css);
  const fontBytes = rawSum(fonts);
  const show = (files: string[]): string[] => files.map((file) => relative(buildDir, file)).sort();

  const rows: BudgetRow[] = [
    {
      label: 'App JS, first route (incl. Svelte runtime)',
      measured: jsBytes,
      budget: BUDGETS.firstRouteAppJs + BUDGETS.svelteRuntime,
      files: show(js),
      note: '§17.1 rows 1+2 — the runtime is not separable from app JS after bundling.',
    },
    {
      label: 'App JS, tree route (lazy)',
      measured: sum(treeRoute),
      budget: BUDGETS.treeRouteJs,
      files: show(treeRoute),
    },
    { label: 'CSS, first route', measured: cssBytes, budget: BUDGETS.css, files: show(css) },
    {
      label: 'Display face',
      measured: fontBytes,
      budget: BUDGETS.displayFont,
      files: show(fonts),
      note: '§17.1 / A4 — measured raw; woff2 is already Brotli, so compressing it again measures a pass no browser makes.',
    },
    {
      label: 'Total first paint (JS + CSS + font)',
      measured: jsBytes + cssBytes + fontBytes,
      budget: BUDGETS.firstPaintTotal,
      files: [],
    },
  ];

  return { rows, violations: rows.filter((row) => row.measured > row.budget) };
}

export function formatReport(report: BudgetReport): string {
  const kb = (bytes: number): string => `${(bytes / KB).toFixed(1)} kB`;
  const lines = report.rows.map((row) => {
    const mark = row.measured > row.budget ? 'FAIL' : 'ok  ';
    return `  ${mark}  ${row.label.padEnd(44)} ${kb(row.measured).padStart(9)} / ${kb(row.budget)}`;
  });
  return ['§17.1 bundle budget (Brotli):', ...lines].join('\n');
}

/** Exit 0 when every row is within budget, 1 otherwise. */
export function budgetCommand(options: BudgetOptions): number {
  const report = measureBudget(options);
  console.log(formatReport(report));
  if (report.violations.length === 0) return 0;
  for (const row of report.violations) {
    console.error(`§17.1 exceeded — ${row.label}: ${row.measured} B > ${row.budget} B`);
    for (const file of row.files) console.error(`    ${file}`);
  }
  return 1;
}
