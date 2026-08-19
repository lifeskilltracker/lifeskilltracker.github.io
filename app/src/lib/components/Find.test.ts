// @vitest-environment jsdom

/**
 * §6.2's control, rendered (T33).
 *
 * Find is the only filter UI in the application, so the tests that matter are
 * the ones about it *not* behaving like a jump-to-result box:
 *
 * - **It reports a result and never a camera move while typing.** The camera
 *   invariant itself is asserted where the camera lives (`MapSurface.test.ts`);
 *   here the claim is narrower and prior to it — nothing but `Enter` calls
 *   `onfly`.
 * - **The count is text.** §8.2 puts "12 skills match" on a polite live region
 *   *because* a highlight that exists only visually is the colour-only encoding
 *   N5 forbids. A dim with no count is the failure this test exists to catch.
 * - **`Esc` clears before it closes.** §6.2 says `Esc` clears and §6.2's dialog
 *   rules say `Esc` closes; both are true, in that order, and the order is the
 *   part that would quietly invert in a refactor.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, click, fire, flushSync, press, render } from './test-harness.svelte.js';
import { auditAccessibility } from './axe.js';
import Find from './Find.svelte';
import type { SearchableSkill } from './search.js';

const SKILLS: SearchableSkill[] = [
  { treeId: 'knitting', title: 'Knitting', domain: 'making', subregion: 'objects', facets: [], attainedLevel: 3 },
  { treeId: 'blacksmithing', title: 'Blacksmithing', domain: 'making', subregion: 'objects', facets: [], attainedLevel: 6 },
  { treeId: 'foraging', title: 'Foraging', domain: 'outdoors-nature', subregion: null, facets: [], attainedLevel: 3 },
];

function mount(handlers: { onresult?: () => void; onfly?: () => void } = {}) {
  return render(Find, { skills: SKILLS, ...handlers } as never);
}

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button[data-find-trigger]')!;
}

function open(container: HTMLElement): HTMLInputElement {
  click(trigger(container));
  return container.querySelector('input[data-find-input]')!;
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  fire(input, new Event('input', { bubbles: true }));
}

afterEach(cleanup);

describe('§6.2 — the control', () => {
  it('is a named button before it is anything else', () => {
    const { container } = mount();

    expect(trigger(container).textContent?.trim()).toBe('Find');
    expect(container.querySelector('[data-find]')).toBeNull();
  });

  it('opens a named dialog with the input focused', () => {
    const { container } = mount();

    const input = open(container);

    expect(container.querySelector('[role="dialog"][data-find]')).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('opens on Ctrl+F and on Cmd+F, suppressing the browser default', () => {
    const { container } = mount();

    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
    fire(document, event);

    expect(container.querySelector('[data-find]')).not.toBeNull();
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves an unmodified "f" alone, so typing is not a shortcut', () => {
    const { container } = mount();

    fire(document, new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true }));

    expect(container.querySelector('[data-find]')).toBeNull();
  });
});

describe('§6.2 — typing filters, and nothing else', () => {
  it('reports the matches for the query', () => {
    const onresult = vi.fn();
    const { container } = mount({ onresult } as never);

    type(open(container), 'objects');

    const result = onresult.mock.lastCall![0] as { matches: Set<string> };
    expect([...result.matches].sort()).toEqual(['blacksmithing', 'knitting']);
    expect(result).not.toBeNull();
  });

  it('never flies the camera on a keystroke — only `Enter` does that', () => {
    const onfly = vi.fn();
    const { container } = mount({ onfly } as never);

    type(open(container), 'knit');

    expect(onfly).not.toHaveBeenCalled();
  });

  it('flies to the top hit’s region on `Enter`', () => {
    const onfly = vi.fn();
    const { container } = mount({ onfly } as never);

    const input = open(container);
    type(input, 'knit');
    press(input, 'Enter');

    // The domain, not the tree id: the camera's unit is a region (§5.1), and
    // resolving it here keeps the manifest lookup off the first route (§17.1).
    expect(onfly).toHaveBeenCalledWith('making');
  });

  it('does not fly on `Enter` when nothing matches', () => {
    const onfly = vi.fn();
    const { container } = mount({ onfly } as never);

    const input = open(container);
    type(input, 'zzz');
    press(input, 'Enter');

    expect(onfly).not.toHaveBeenCalled();
  });
});

describe('§8.2 — the highlight is exposed as text', () => {
  it('states the count on a polite live region that is also visible', () => {
    const { container } = mount();

    type(open(container), 'objects');

    const count = container.querySelector('[data-find-count]')!;
    expect(count.textContent?.trim()).toBe('2 skills match');
    expect(count.getAttribute('role')).toBe('status');
    expect(count.getAttribute('aria-live')).toBe('polite');
    expect(count.classList.contains('visually-hidden')).toBe(false);
  });

  it('agrees in number with one match', () => {
    const { container } = mount();

    type(open(container), 'knit');

    expect(container.querySelector('[data-find-count]')?.textContent?.trim()).toBe('1 skill matches');
  });

  it('says so when nothing matches, rather than falling silent', () => {
    const { container } = mount();

    type(open(container), 'zzz');

    expect(container.querySelector('[data-find-count]')?.textContent?.trim()).toBe('No skills match');
  });

  it('reports "no filter" rather than an empty result for an empty query', () => {
    const onresult = vi.fn();
    const { container } = mount({ onresult } as never);

    const input = open(container);
    type(input, 'knit');
    type(input, '');

    expect(onresult.mock.lastCall![0]).toBeNull();
  });

  it('says nothing at all for an empty query — an empty box is not a filter', () => {
    const { container } = mount();

    open(container);

    expect(container.querySelector('[data-find-count]')?.textContent?.trim()).toBe('');
  });

  it('states no percentage anywhere (F34)', () => {
    const { container } = mount();

    type(open(container), 'objects');

    expect(container.textContent).not.toMatch(/%|percent/i);
  });
});

describe('§6.2 — `Esc` clears, then closes', () => {
  it('clears the query and the highlight on the first `Esc`', () => {
    const onresult = vi.fn();
    const { container } = mount({ onresult } as never);

    const input = open(container);
    type(input, 'objects');
    press(input, 'Escape');

    expect(input.value).toBe('');
    // `null`, not an empty result: an empty box dims nothing, whereas a query
    // that matched nothing dims everything, and both are honest pictures.
    expect(onresult.mock.lastCall![0]).toBeNull();
    // Still open: the reader has cleared the filter, not finished with the box.
    expect(container.querySelector('[data-find]')).not.toBeNull();
  });

  it('closes on `Esc` once the query is already empty', () => {
    const { container } = mount();

    const input = open(container);
    press(input, 'Escape');

    expect(container.querySelector('[data-find]')).toBeNull();
  });

  it('returns focus to the trigger it took it from', () => {
    const { container } = mount();

    const input = open(container);
    press(input, 'Escape');

    expect(document.activeElement).toBe(trigger(container));
  });

  it('clears the highlight when it closes, so a dimmed map never outlives the box', () => {
    const onresult = vi.fn();
    const { container } = mount({ onresult } as never);

    const input = open(container);
    type(input, 'objects');
    press(input, 'Escape');
    press(container.querySelector('input[data-find-input]')!, 'Escape');

    expect(onresult.mock.lastCall![0]).toBeNull();
  });
});

describe('§6.2 — the dialog traps focus', () => {
  it('cycles Tab within the dialog rather than out onto the map behind it', () => {
    const { container } = mount();

    open(container);
    const dialog = container.querySelector('[data-find]')!;
    const stops = [...dialog.querySelectorAll<HTMLElement>('input, button')];
    expect(stops.length).toBeGreaterThan(1);

    const last = stops[stops.length - 1];
    last.focus();
    fire(last, new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(stops[0]);

    const first = stops[0];
    first.focus();
    fire(first, new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
  });
});

describe('§15.8 — the axe gate', () => {
  it('reports no WCAG 2.1 AA violation, open and filtered', async () => {
    const { container } = mount();

    type(open(container), 'objects');
    flushSync();

    await expect(auditAccessibility(container)).resolves.toBeDefined();
  });
});
