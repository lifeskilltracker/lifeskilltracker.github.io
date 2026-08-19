/**
 * §15.5 over the **composed** interface (T35).
 *
 * This exists because five tasks each honouring `prefers-reduced-motion`
 * individually can still compose into a page that does not. T30 built a camera
 * fly, T31 a layer fade, T32 a sidebar, T33 a filter dim, T34 a level camera and
 * T35 a reveal; each shipped with its own reduced-motion path and its own test.
 * None of those tests can see the others. This one runs them all in one browser,
 * with the media feature actually set, and enumerates them by name so a seventh
 * animation added later is a visible omission rather than a silent one.
 *
 * §15.5's rule is **"instant, not shorter"**, and its companion is that nothing
 * conveys information through motion alone — so removing all of it must lose
 * nothing. Both halves are checked: the motion is gone, and the information the
 * motion carried is still on the page as text or as an attribute.
 *
 * Unlike `manual-passes.mjs`, this script *does* read computed styles and class
 * names. That is not a lapse: a media-feature audit is a claim about rendering,
 * and there is no accessible-name form of "this element is still transitioning".
 *
 * Run with `npm run a11y:reduced-motion --workspace app` after `npm run build`.
 */

import { chromium } from 'playwright';
import { serve } from './server.mjs';

const BUILD = new URL('../build/', import.meta.url).pathname;
const TREE = 'piano';
const DOMAIN = 'making';

const results = [];
let failures = 0;

function check(subject, what, ok, detail = '') {
  results.push({ subject, ok });
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${what}${detail && !ok ? `\n         ${detail}` : ''}`);
}

/**
 * Every element that is still animating or transitioning, by selector. The
 * whole-page form of §15.5 — the one that catches the animation nobody
 * remembered to enumerate.
 */
async function stillMoving(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const animating = style.animationName !== 'none' && style.animationDuration !== '0s';
        const transitioning =
          style.transitionDuration !== '0s' && style.transitionProperty !== 'none';
        return animating || transitioning;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`)
      .slice(0, 8),
  );
}

const { server, origin } = await serve(BUILD);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
});

try {
  // ─── 1. The reveal (T35, §5.7) ─────────────────────────────────────────────
  //
  // "Skipped, not shortened" is the whole rule here, so the assertion is that no
  // animation was ever *started* — sampled across the window the reveal would
  // have occupied, not checked once after it would have finished.
  console.log('\n── 1. The first-load reveal (T35) ──');
  {
    const page = await context.newPage();
    // A pristine profile: the once-ever flag is what suppresses the reveal on
    // every load but the first, and a suppressed reveal would pass this check
    // for the wrong reason.
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    let everRevealed = false;
    for (let i = 0; i < 16; i += 1) {
      everRevealed ||= (await page.locator('[data-revealing]').count()) > 0;
      await page.waitForTimeout(100);
    }
    check('reveal', 'the reveal never starts under reduce (§5.7, §15.5)', !everRevealed);

    // And the frame it skipped to is the resting one, not a blank map: the plate
    // is at open strength and the lettering is fully set.
    const resting = await page.evaluate(() => {
      const plate = document.querySelector('.region-plate:not(.is-hachured)');
      const label = document.querySelector('.region-label');
      if (plate === null || label === null) return null;
      return {
        plate: Number(getComputedStyle(plate).fillOpacity),
        label: Number(getComputedStyle(label).opacity),
        dash: getComputedStyle(document.querySelector('.region-outline')).strokeDashoffset,
      };
    });
    check(
      'reveal',
      'the map paints the resting frame directly (§5.7)',
      resting !== null && resting.plate > 0.5 && resting.label === 1 && resting.dash === '0px',
      JSON.stringify(resting),
    );

    check('reveal', 'nothing on the map route is in motion', (await stillMoving(page)).length === 0,
      (await stillMoving(page)).join(', '));
    await page.close();
  }

  // ─── 2. The camera fly (T30, §5.6) ─────────────────────────────────────────
  console.log('\n── 2. The map camera fly (T30) ──');
  {
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    const box = () => page.locator('.world-map').getAttribute('viewBox');
    const world = await box();

    await page.locator(`[data-domain="${DOMAIN}"]`).first().click();
    await page.waitForSelector('[data-map-surface][data-level="1"]');
    const immediately = await box();
    await page.waitForTimeout(600);
    const settled = await box();

    check('fly', 'the camera arrives at level 1 in one frame, not over 420 ms (§5.6)',
      immediately === settled && immediately !== world,
      `world ${world} / immediate ${immediately} / settled ${settled}`);

    // §15.5's second half: the fly carried "where the camera went", and §8.2
    // already states it in words. Removing the motion must not remove that.
    const announcement = (await page.locator('[data-map-announcement]').textContent()) ?? '';
    check('fly', 'the camera move is still announced in words (§8.2)', announcement.trim().length > 0,
      JSON.stringify(announcement));

    // ─── 3. The skill-layer fade (T31, §5.6) ─────────────────────────────────
    console.log('\n── 3. The skill hex layer (T31) ──');
    await page.waitForSelector('.skill-hex');
    check('hexes', 'the hex layer does not fade in (§5.6)',
      (await stillMoving(page)).length === 0, (await stillMoving(page)).join(', '));

    // ─── 4. The filter dim (T33, §6.2) ───────────────────────────────────────
    console.log('\n── 4. The Find filter dim (T33) ──');
    await page.keyboard.press('Control+f');
    await page.keyboard.type('pia');
    await page.waitForTimeout(200);
    const dimmed = await page.evaluate(() => {
      const unmatched = document.querySelector('.is-unmatched');
      if (unmatched === null) return null;
      const style = getComputedStyle(unmatched);
      return { opacity: Number(style.opacity), transition: style.transitionDuration };
    });
    check('find', 'the dim applies instantly and still dims (§6.2, §15.5)',
      dimmed !== null && dimmed.opacity < 1 && dimmed.transition === '0s',
      JSON.stringify(dimmed));
    await page.keyboard.press('Escape');
    await page.close();
  }

  // ─── 5. The water line (§10.5) and the focus dim (§5.5) ────────────────────
  console.log('\n── 5. The water line and the focus dim (T30) ──');
  {
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    const durations = await page.evaluate(() => {
      const of = (selector) => {
        const element = document.querySelector(selector);
        return element === null ? 'absent' : getComputedStyle(element).transitionDuration;
      };
      return { water: of('.region-waterline'), region: of('.region') };
    });
    check('water', 'the water line does not animate to its height (§10.5)',
      durations.water === '0s' || durations.water === 'absent', JSON.stringify(durations));

    await page.locator('.region').first().hover();
    check('focus', 'the focus dim applies instantly (§5.5)', durations.region === '0s',
      JSON.stringify(durations));
    await page.close();
  }

  // ─── 6. The tree level camera (T34, §7) ────────────────────────────────────
  console.log('\n── 6. The tree level camera (T34) ──');
  {
    const page = await context.newPage();
    await page.goto(`${origin}/s/${TREE}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.tree-camera');

    // The first control ("Blocking level") is the one that always has somewhere
    // to go on this tree; "Level 10" clamps to the top on a tree with fewer
    // levels, and a camera that did not move proves nothing about how it moves.
    const control = page.locator('[data-camera]').first();
    const before = await page.locator('.tree-camera').evaluate((element) => element.scrollTop);
    await control.click();
    // One frame. A glide would still be near its start here; an instant move is
    // already finished.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const immediately = await page.locator('.tree-camera').evaluate((element) => element.scrollTop);
    await page.waitForTimeout(500);
    const settled = await page.locator('.tree-camera').evaluate((element) => element.scrollTop);

    check('tree-camera', 'the level camera jumps rather than glides (§15.5)',
      immediately === settled && immediately !== before,
      `before ${before} / immediate ${immediately} / settled ${settled}`);

    // The anchor is reflected as an attribute, which is the information the
    // glide was carrying — a reader that never sees the scroll still gets it.
    const anchor = await page.locator('.tree-camera').getAttribute('data-camera-anchor');
    check('tree-camera', 'where the camera points is still readable as data (§15.4)',
      anchor !== null && anchor !== '', String(anchor));

    check('tree-camera', 'nothing on the tree route is in motion',
      (await stillMoving(page)).length === 0, (await stillMoving(page)).join(', '));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n──────────────────────────────────────────');
console.log(`${results.length - failures} of ${results.length} checks passed.`);
console.log(
  '\nSix animations are enumerated here: the reveal, the map camera fly, the skill\n' +
    'layer, the Find dim, the water line and focus dim, and the tree level camera.\n' +
    'An animation added to any of these surfaces belongs on this list.',
);

process.exit(failures === 0 ? 0 : 1);
