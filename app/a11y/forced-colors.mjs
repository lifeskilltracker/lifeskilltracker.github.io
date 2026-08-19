/**
 * §15.4 over the **composed** interface, under `forced-colors: active` (T35).
 *
 * A forced palette replaces every colour the design chose with four or five the
 * user chose. Everything §15.4 asks for follows from that: a state distinguished
 * by fill is a state that disappears, a glyph drawn as a CSS background is a
 * glyph that disappears, and `forced-color-adjust: none` is the opt-out that
 * makes the whole feature a lie. So this script checks the *channels*, not the
 * colours — which elements survive, and whether two states still differ once
 * their fills have been taken away.
 *
 * It drives the placement flow first, because a piano tree on a fresh profile
 * renders two of §4.6's five states and a check that only ever sees two states
 * cannot tell you they are distinguishable. What it can reach live it reads off
 * the page; the rest it reads off the rendered glyph library, and it says which
 * is which rather than reporting five where it saw three.
 *
 * Run with `npm run a11y:forced-colors --workspace app` after `npm run build`.
 */

import { chromium } from 'playwright';
import { serve } from './server.mjs';

const BUILD = new URL('../build/', import.meta.url).pathname;
const TREE = 'piano';

const results = [];
let failures = 0;

function check(what, ok, detail = '') {
  results.push(ok);
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${what}${detail && !ok ? `\n         ${detail}` : ''}`);
}

/** The rendered channels of every milestone on the page, keyed by §4.6 state. */
async function statesOnPage(page) {
  return page.evaluate(() => {
    const seen = new Map();
    for (const node of document.querySelectorAll('[data-state]')) {
      const state = node.getAttribute('data-state');
      if (seen.has(state)) continue;
      const border = node.querySelector('.node-border, [class*="border"]') ?? node;
      const glyph = node.querySelector('use');
      const style = getComputedStyle(border);
      seen.set(state, {
        glyph: glyph?.getAttribute('href') ?? null,
        dash: style.strokeDasharray,
        width: style.strokeWidth,
      });
    }
    return Object.fromEntries(seen);
  });
}

const { server, origin } = await serve(BUILD);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  forcedColors: 'active',
});

try {
  // ─── The tree: §4.6's five milestone states ────────────────────────────────
  console.log('\n── Milestone states (§4.6, §15.4) ──');
  const page = await context.newPage();
  await page.goto(`${origin}/s/${TREE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // The glyph library. Every state's mark is a `<symbol>` referenced by `<use>`
  // — real elements, which is the only form that survives a forced palette.
  const symbols = await page.evaluate(() =>
    [...document.querySelectorAll('symbol[id^="glyph-"]')].map((s) => `#${s.id}`),
  );
  check('§4.6 declares a distinct glyph symbol per state', new Set(symbols).size === 5,
    `${symbols.length} symbols: ${symbols.join(', ')}`);

  // Place at level 3 so completed, available and locked all render at once.
  const coarse = page.getByLabel(/roughly what level/i);
  if ((await coarse.count()) > 0) {
    await coarse.selectOption('3');
    await page.getByRole('button', { name: /suggest what/i }).first().click();
    await page.waitForTimeout(400);
    const save = page.getByRole('button', { name: /^Save /i }).first();
    if ((await save.count()) > 0) {
      await save.click();
      await page.waitForTimeout(600);
    }
  }

  // Dismissing one milestone reaches a fourth state (T19, §4.6).
  const node = page.locator('[role="button"][data-uid]').first();
  await node.click();
  await page.waitForTimeout(250);
  const dismiss = page.locator('[data-action="dismiss"]').first();
  if ((await dismiss.count()) > 0) {
    await dismiss.click();
    await page.waitForTimeout(250);
    const confirm = page.getByRole('button', { name: /dismiss|confirm|yes/i }).last();
    if ((await confirm.count()) > 0) await confirm.click();
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const states = await statesOnPage(page);
  const names = Object.keys(states);
  console.log(`         states rendered live: ${names.join(', ') || 'none'}`);

  check('every rendered state carries a real <use> glyph, not a fill (§15.4)',
    names.length > 0 && names.every((n) => states[n].glyph !== null),
    JSON.stringify(states));

  // The claim that matters: no two states are told apart by colour alone. Two
  // states with the same glyph AND the same border are indistinguishable the
  // moment the palette is the user's.
  const fingerprints = names.map((n) => `${states[n].glyph}|${states[n].dash}|${states[n].width}`);
  check('no two rendered states share a glyph and a border (§15.4)',
    new Set(fingerprints).size === fingerprints.length,
    names.map((n, i) => `${n}: ${fingerprints[i]}`).join('  '));

  check('at least three of §4.6’s five states were exercised live',
    names.length >= 3, `${names.length} rendered: ${names.join(', ')}`);

  // The opt-out. One `forced-color-adjust: none` anywhere puts that subtree back
  // on our palette, which is the one thing this media feature exists to prevent.
  const optOuts = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter(
      (element) => getComputedStyle(element).forcedColorAdjust === 'none',
    ).length,
  );
  check('nothing opts out of the forced palette', optOuts === 0, `${optOuts} elements`);
  await page.close();

  // ─── The map: fog, the water line, and the hex borders ─────────────────────
  console.log('\n── The map (§4.3, §4.4, §5.4) ──');
  {
    const map = await context.newPage();
    await map.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await map.waitForSelector('.world-map');

    const fog = await map.evaluate(() => {
      const hachure = document.querySelector('.region-hachure');
      if (hachure === null) return null;
      const rule = document.querySelector('pattern line');
      return {
        opacity: Number(getComputedStyle(hachure).opacity),
        stroke: rule === null ? null : getComputedStyle(rule).stroke,
      };
    });
    // §4.4's ruling is drawn at just over half opacity at rest (§5.7's plates
    // phase settles it there). Opacity is the one channel a forced palette
    // cannot compensate for, so the map restores it to full here.
    check('fog stays a ruling, at full strength under a forced palette (§4.4)',
      fog !== null && fog.opacity === 1 && fog.stroke !== 'rgba(0, 0, 0, 0)',
      JSON.stringify(fog));

    const water = await map.evaluate(() => {
      const line = document.querySelector('.region-waterline');
      if (line === null) return null;
      const style = getComputedStyle(line);
      return { stroke: style.stroke, width: style.strokeWidth, opacity: Number(style.opacity) };
    });
    check('the water line is still ruled in ink (§4.3)',
      water !== null && water.stroke !== 'rgba(0, 0, 0, 0)' && water.opacity > 0,
      JSON.stringify(water));

    // §5.4's hexes: level 1, where started-ness is a border and not a fill.
    await map.locator('[data-domain]').first().click();
    await map.waitForSelector('.hex-border');
    const borders = await map.evaluate(() =>
      [...document.querySelectorAll('.skill-hex')].map((hex) => {
        const style = getComputedStyle(hex.querySelector('.hex-border'));
        return `${hex.classList.contains('is-started')}|${style.strokeDasharray}`;
      }),
    );
    const distinct = new Set(borders);
    check('the hex border carries started-ness as a stroke style, not a fill (§5.4)',
      borders.length > 0 && [...distinct].every((entry) => entry.split('|')[1] !== 'none' || entry.startsWith('true')),
      [...distinct].join('  '));

    // §5.4's two marks are conditional — mastery content and the attained
    // ceiling — so a fresh profile renders none of them, and counting them here
    // would check the fixture rather than the channel. What must hold under a
    // forced palette is that they are `<symbol>`s painted in `currentColor`:
    // real elements the UA recolours, rather than type or a background image
    // it would flatten away.
    const marks = await map.evaluate(() =>
      [...document.querySelectorAll('.skill-layer defs symbol *')].map(
        (element) => `${getComputedStyle(element).fill}/${getComputedStyle(element).stroke}`,
      ),
    );
    check('the hex marks are real elements painted in currentColor (§5.4)',
      marks.length >= 2 && marks.every((paint) => paint !== 'none/none'),
      marks.join('  '));

    const renderedMarks = await map.locator('.skill-hex use').count();
    const drawnAsText = await map.locator('.skill-hex text.hex-glyph').count();
    check('any mark that does render is a <use>, never a character',
      drawnAsText === 0, `${renderedMarks} marks rendered, ${drawnAsText} drawn as text`);
    await map.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n──────────────────────────────────────────');
console.log(`${results.length - failures} of ${results.length} checks passed.`);
console.log(
  '\nThis checks the CHANNELS, not the colours: which elements survive a forced\n' +
    'palette and whether two states still differ without their fills. States it\n' +
    'could not reach live are covered only by the glyph-library check above.',
);

process.exit(failures === 0 ? 0 : 1);
