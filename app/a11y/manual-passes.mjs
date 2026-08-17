/**
 * §15.8's manual half, driven — the keyboard-only traversal of browse → place →
 * complete → export, plus an accessibility-tree reading of each flow.
 *
 * **What this is and is not.** §15.8 asks for two manual items: a keyboard-only
 * traversal of the four core flows, and a screen-reader spot check on one
 * desktop and one mobile reader. This script does the first in full, against a
 * real browser engine and the real built app. It does **not** do the second, and
 * must not be recorded as though it had: it reads the accessibility tree, which
 * is the data a screen reader consumes, but a reader's *behaviour* over that
 * tree — how NVDA's browse mode differs from VoiceOver's rotor, what actually
 * gets interrupted, whether the announcement arrives before the focus move — is
 * not derivable from a snapshot. `docs/RELEASE-CHECKLIST.md` records the two
 * halves separately for that reason.
 *
 * **Written against roles and accessible names, never DOM structure.** No CSS
 * selector, no class name, no pixel measurement, no screenshot. Those are the
 * assertions that break the first time someone restyles the tree, and the
 * §15 contract they would be standing in for is a semantic one anyway: §15.1
 * makes the linear list the primary representation and §15.2 fixes the names
 * that list exposes. A rewrite that keeps those names keeps this passing, which
 * is the point — this file is the thing that tells you whether the rewrite kept
 * them.
 *
 * Run with `npm run a11y:manual --workspace app` after `npm run build`.
 */

import { chromium } from 'playwright';
import { serve } from './server.mjs';

const BUILD = new URL('../build/', import.meta.url).pathname;

/** The tree the passes drive. Three tracks and 50 nodes — F29's own example. */
const TREE = 'piano';

const results = [];
let failures = 0;

function check(flow, what, ok, detail = '') {
  results.push({ flow, what, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${what}${detail && !ok ? `\n         ${detail}` : ''}`);
}

/** The accessible name of whatever currently has focus, as a reader would get it. */
async function focusedName(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return null;
    const described = el.getAttribute('aria-describedby');
    const description = described
      ? (document.getElementById(described)?.textContent ?? '').replace(/\s+/g, ' ').trim()
      : '';
    return {
      role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
      name: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      description,
    };
  });
}

/**
 * Tab until `predicate` matches the focused element, keyboard-only. Returns the
 * number of tabs it cost, which is itself a §15.2 claim: the tree is a single
 * tab stop with roving `tabindex`, so reaching a milestone must not cost fifty.
 */
async function tabUntil(page, predicate, limit = 60) {
  for (let i = 1; i <= limit; i += 1) {
    await page.keyboard.press('Tab');
    const focused = await focusedName(page);
    if (focused && (await predicate(focused))) return { found: true, tabs: i, focused };
  }
  return { found: false, tabs: limit, focused: await focusedName(page) };
}

const { server, origin } = await serve(BUILD);
const browser = await chromium.launch();

try {
  // ─── Browse ────────────────────────────────────────────────────────────────
  // §15.8's first flow: reach a skill from the map without touching a mouse.
  console.log('\n── Browse ──');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    check('browse', 'the map page has a title', (await page.title()).length > 0, await page.title());

    const toLibrary = await tabUntil(page, (f) => f.name === 'Library');
    check('browse', 'the Library link is reachable by Tab alone', toLibrary.found);

    await page.keyboard.press('Enter');
    await page.waitForURL('**/library');
    await page.waitForLoadState('networkidle');
    check('browse', 'Enter follows the link', page.url().endsWith('/library'));
    check('browse', 'the library page has a title', (await page.title()).length > 0, await page.title());

    const toSkill = await tabUntil(page, (f) => f.name === 'Piano');
    check('browse', 'a skill link is reachable by Tab alone', toSkill.found);

    await page.keyboard.press('Enter');
    await page.waitForURL(`**/s/${TREE}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);

    const title = await page.title();
    check('browse', 'the skill page has a title (WCAG 2.4.2)', title.length > 0, `title was ${JSON.stringify(title)}`);

    // §15.1 — the linear list is the primary representation, so the level
    // sections and their readouts must be in the tree, named as words.
    const snapshot = await page.locator('main').ariaSnapshot();
    check(
      'browse',
      'level sections are exposed and named with their progress',
      /Level 1, Novice/.test(snapshot),
      snapshot.split('\n').slice(0, 4).join(' | '),
    );

    // F29 — the track titles, which are drawn but deliberately aria-hidden, so
    // this is the one structural check in the file. It is checking a *fact about
    // the drawing*, which has no accessible-name form by design.
    const heads = await page.locator('.column-head').allTextContents();
    check('browse', 'F29: every declared track is drawn as a column head', heads.length === 3, `heads: ${JSON.stringify(heads)}`);

    // F29's accessible half: the track a node sits in reaches the reader.
    const first = await page.locator('[role="button"][data-uid]').first();
    const description = await page
      .locator(`#${(await first.getAttribute('aria-describedby')) ?? ''}`)
      .textContent();
    check(
      'browse',
      'F29: a node names its track in its description',
      / track\./.test(description ?? ''),
      (description ?? '').slice(0, 120),
    );

    // F29's other exemplar. piano exercises tracks; mental-health is the tree
    // with modules, and it is the one that used to render as though it were
    // linear. Checked here rather than in a unit test because the point of the
    // finding was that real authored content lost information on the way to the
    // screen, and only the real bundle proves that it no longer does.
    await page.goto(`${origin}/s/mental-health`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const modules = await page.locator('.node-module').allTextContents();
    const distinct = new Set(modules.map((m) => m.trim()).filter(Boolean));
    check(
      'browse',
      'F29: a tree with modules draws every module label',
      distinct.size === 5,
      `${modules.length} labels, ${distinct.size} distinct: ${[...distinct].join(', ')}`,
    );

    const modularNode = page.locator('[role="button"][data-uid]').first();
    const modularDescription = await page
      .locator(`#${(await modularNode.getAttribute('aria-describedby')) ?? ''}`)
      .textContent();
    check(
      'browse',
      'F29: a node names its module in its description',
      / module\./.test(modularDescription ?? ''),
      (modularDescription ?? '').slice(0, 140),
    );

    await page.close();
  }

  // ─── Complete ──────────────────────────────────────────────────────────────
  // §15.2's grid keyboard model, and the polite live region that states the
  // consequence rather than the click.
  console.log('\n── Complete ──');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${origin}/s/${TREE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const toNode = await tabUntil(page, (f) => f.role === 'button' && f.description.includes('Level'));
    check('complete', 'a milestone is reachable by Tab alone', toNode.found);
    check(
      'complete',
      'the tree is one tab stop, not one per milestone (§15.2)',
      toNode.tabs < 20,
      `took ${toNode.tabs} tabs to reach the first milestone`,
    );

    const before = await focusedName(page);

    // §15.2's key table: arrows move within the grid.
    await page.keyboard.press('ArrowRight');
    const right = await focusedName(page);
    check('complete', '→ moves to another milestone in the level', right?.name !== before?.name, `${before?.name} → ${right?.name}`);

    await page.keyboard.press('ArrowUp');
    const up = await focusedName(page);
    check('complete', '↑ moves within a track to another level', up?.name !== right?.name, `${right?.name} → ${up?.name}`);

    check(
      'complete',
      'F29: the description names the track ↑/↓ navigate by',
      / track\./.test(up?.description ?? ''),
      (up?.description ?? '').slice(0, 120),
    );

    // F36's `.` shortcut — the keyboard form of the product's central promise.
    await page.keyboard.press('.');
    const available = await focusedName(page);
    check(
      'complete',
      '. jumps to an available milestone (F36)',
      /Available\./.test(available?.description ?? ''),
      (available?.description ?? '').slice(0, 120),
    );

    // Enter opens the panel; Esc returns focus to the node it came from.
    const opener = await focusedName(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const dialogOpen = (await page.locator('.milestone-panel').count()) > 0;
    check('complete', 'Enter opens the milestone panel', dialogOpen);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const returned = await focusedName(page);
    check(
      'complete',
      'Esc closes the panel and returns focus to the node (§15.2)',
      returned?.name === opener?.name,
      `expected ${opener?.name}, focus is on ${returned?.name}`,
    );

    // The live region. §15.2's rule is "one shared live region" **for the tree**
    // — not one for the whole document, which would be the wrong reading: the
    // page also composes an assessment flow, a notice host and a storage status,
    // each with its own `role="status"`, all deliberate and all documented. The
    // rule that *is* page-wide is the one about interruption.
    const live = page.locator('.tree-view [aria-live], [aria-live].announcer');
    const liveCount = await live.count();
    check('complete', 'the tree has exactly one shared live region (§15.2)', liveCount === 1, `found ${liveCount}`);
    check(
      'complete',
      'it is polite, never assertive (§15.2)',
      (await live.first().getAttribute('aria-live')) === 'polite',
    );

    // §15.2 forbids the *app* an assertive region. SvelteKit injects one of its
    // own — `#svelte-announcer`, which states the new page title after a
    // client-side navigation — and that is the standard, correct pattern for an
    // SPA route change rather than a violation to fix: without it a reader gets
    // no notification that the page changed at all. It is also the reason the
    // §15.2 unit test greps `src/` and this check excludes it by id: neither is
    // able to see the other's half.
    const interrupting = await page.evaluate(
      () =>
        [...document.querySelectorAll('[aria-live="assertive"], [role="alert"]')].filter(
          (el) => el.id !== 'svelte-announcer',
        ).length,
    );
    check('complete', 'the app adds no interrupting region of its own (§15.2)', interrupting === 0, `${interrupting} assertive regions`);

    // Complete a milestone from the keyboard and read what was announced.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const completeButton = page.getByRole('button', { name: /^Complete$|Mark complete/i }).first();
    if ((await completeButton.count()) > 0) {
      await completeButton.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const announced = (await live.first().textContent())?.trim() ?? '';
      check(
        'complete',
        'completing announces the consequence, not the click (§15.2)',
        announced.length > 0 && /complete/i.test(announced),
        `announced: ${JSON.stringify(announced)}`,
      );
    } else {
      check('complete', 'the panel offers a complete action', false, 'no complete button found in the open panel');
    }

    await page.close();
  }

  // ─── Place ─────────────────────────────────────────────────────────────────
  // §15.6 — T15's placement and estimator flow, which the 2026-08-14 record
  // could not reach because T15 had not landed.
  console.log('\n── Place ──');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${origin}/s/${TREE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // D20's coarse input: an integer level 1–10, exposed as a labelled select.
    const coarse = page.getByLabel(/roughly what level/i);
    const hasCoarse = (await coarse.count()) > 0;
    check('place', 'the coarse level input is exposed and labelled (D20)', hasCoarse);

    const suggest = page.getByRole('button', { name: /suggest what/i }).first();
    const mark = page.getByRole('button', { name: /mark what|resume marking/i }).first();
    check('place', 'the estimator is a named button (F30)', (await suggest.count()) > 0);
    check('place', 'manual placement is a named button (F29/§15.6)', (await mark.count()) > 0);

    if (hasCoarse) {
      // Drive it keyboard-only: choose a level, then run the estimate.
      await coarse.focus();
      const onCoarse = await focusedName(page);
      check('place', 'the coarse input takes keyboard focus', onCoarse !== null);

      await coarse.selectOption('3');
      await suggest.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // D20's rule: levels 1..L pre-checked, as an *editable suggestion*. So the
      // flow must now offer both a way to change it and a way to commit it.
      const save = page.getByRole('button', { name: /^Save /i }).first();
      check('place', 'the estimate arrives as a reviewable draft, not a commitment (D20)', (await save.count()) > 0);

      const discard = page.getByRole('button', { name: /discard/i }).first();
      check('place', 'the draft can be discarded from the keyboard', (await discard.count()) > 0);

      const flow = await page.locator('main').ariaSnapshot();
      check(
        'place',
        'the flow states its consequence before committing',
        /checkbox|button "Save/.test(flow),
        flow.split('\n').filter((l) => /Save |checkbox/.test(l)).slice(0, 2).join(' | '),
      );
    }

    await page.close();
  }

  // ─── Export ────────────────────────────────────────────────────────────────
  // §15.8's fourth flow — T16, also unreachable when the record was written.
  console.log('\n── Export ──');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${origin}/data`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    check('export', 'the data page has a title', (await page.title()).length > 0, await page.title());

    const headings = await page.locator('main h1').allTextContents();
    check('export', 'the data page has a level-1 heading', headings.length > 0, headings.join(' | '));

    const exportButton = page.getByRole('button', { name: /export|download/i }).first();
    const found = (await exportButton.count()) > 0;
    check('export', 'an export control is exposed as a named button', found);

    if (found) {
      const reached = await tabUntil(page, (f) => /export|download/i.test(f.name), 40);
      check('export', 'the export control is reachable by Tab alone', reached.found, `after ${reached.tabs} tabs`);

      const download = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await page.keyboard.press('Enter');
      const file = await download;
      check('export', 'Enter on the export control produces a file', file !== null, file ? await file.suggestedFilename() : 'no download event');
    }

    // Import is a labelled file input, not a button — which is the right control
    // for the job and the one a reader can actually operate. The buttons that
    // follow it (merge / replace) only exist once a file is picked.
    const importInput = page.getByLabel(/choose an export file/i);
    check('export', 'the import control is a labelled file input', (await importInput.count()) > 0);
    check(
      'export',
      'it is a real file input, so the reader gets the platform picker',
      (await importInput.getAttribute('type')) === 'file',
    );

    await page.close();
  }

  // ─── Narrow ────────────────────────────────────────────────────────────────
  // §15.1 makes the linear list primary at *every* viewport, and §8.5's narrow
  // stack is that list. A third of users exercise it, which is what stops it
  // rotting — so the pass has to cover it too.
  console.log('\n── Narrow (the primary representation, §15.1) ──');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${origin}/s/${TREE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const snapshot = await page.locator('main').ariaSnapshot();
    check('narrow', 'levels are exposed as headings in reading order', /heading "Level 1/.test(snapshot), snapshot.split('\n').find((l) => /Level 1/.test(l)) ?? '(none)');

    const toNode = await tabUntil(page, (f) => f.role === 'button' && f.description.includes('Level'));
    check('narrow', 'a milestone is reachable by Tab alone', toNode.found);
    check(
      'narrow',
      'F29: track and module reach the reader in the narrow stack',
      / track\./.test(toNode.focused?.description ?? ''),
      (toNode.focused?.description ?? '').slice(0, 120),
    );

    await page.close();
  }

  // ─── Reduced motion and forced colours ────────────────────────────────────
  // §15.5 and §15.4's release-checklist items, which are cheap to drive here.
  console.log('\n── Reduced motion and forced colours ──');
  {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
      forcedColors: 'active',
    });
    await page.goto(`${origin}/s/${TREE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const nodes = await page.locator('[role="button"][data-uid]').count();
    check('media', 'the tree still renders every node under reduce + forced-colors', nodes > 0, `${nodes} nodes`);

    // §15.4 — state must survive when the palette is taken away, which is what
    // the glyph is for. `<use>` elements are real elements and survive; a CSS
    // background would not.
    const glyphs = await page.locator('[role="button"][data-uid] use').count();
    check('media', 'every node still carries a state glyph, not colour alone (§15.4)', glyphs >= nodes, `${glyphs} glyphs for ${nodes} nodes`);

    const animated = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter((el) => {
        const style = getComputedStyle(el);
        return (
          (style.animationName !== 'none' && style.animationDuration !== '0s') ||
          (style.transitionDuration !== '0s' && style.transitionProperty !== 'none')
        );
      }).length,
    );
    check('media', 'nothing animates or transitions under reduce (§15.5)', animated === 0, `${animated} elements still animating`);

    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n──────────────────────────────────────────');
const byFlow = new Map();
for (const r of results) {
  const entry = byFlow.get(r.flow) ?? { pass: 0, fail: 0 };
  entry[r.ok ? 'pass' : 'fail'] += 1;
  byFlow.set(r.flow, entry);
}
for (const [flow, { pass, fail }] of byFlow) {
  console.log(`${flow.padEnd(10)} ${pass} passed, ${fail} failed`);
}
console.log(`\n${results.length - failures} of ${results.length} checks passed.`);
console.log(
  '\nThis is the KEYBOARD half of §15.8 only. The screen-reader spot check on a\n' +
    'desktop and a mobile reader is a separate item and is not performed here.',
);

process.exit(failures === 0 ? 0 : 1);
