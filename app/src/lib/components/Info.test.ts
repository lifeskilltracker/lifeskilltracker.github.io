// @vitest-environment jsdom

/**
 * §6.3's legend, rendered (T33).
 *
 * **Info is on the critical path for F34's honesty.** F34 forbids showing a raw
 * percentage, so the water line's height is the *only* statement the map makes
 * about a score — and if the legend ships thin, the map shows a quantity whose
 * meaning is written down nowhere, which is worse than showing the number would
 * have been. "No legend" is also the most concrete criticism the prior-art
 * review turned up. So the tests here are coverage tests: every visual channel
 * the map spends has to be named.
 *
 * **The band names are asserted against `BANDS`, not against a list written out
 * here.** §11.6's boundaries are tunable data, and retuning one must not require
 * editing the legend — a legend that drifted from the resolver would be a lie
 * told confidently.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, click, press, render } from './test-harness.svelte.js';
import { auditAccessibility } from './axe.js';
import { BANDS } from '$lib/scoring';
import Info from './Info.svelte';

function mount() {
  return render(Info, {} as never);
}

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button[data-info-trigger]')!;
}

function open(container: HTMLElement): HTMLElement {
  click(trigger(container));
  return container.querySelector('[data-info]')!;
}

const text = (container: HTMLElement): string =>
  container.querySelector('[data-info]')!.textContent!.replace(/\s+/g, ' ');

afterEach(cleanup);

describe('§6.3 — the control', () => {
  it('is a named button, and the legend is closed until asked for', () => {
    const { container } = mount();

    expect(trigger(container).textContent?.trim()).toBe('Info');
    expect(container.querySelector('[data-info]')).toBeNull();
  });

  it('opens a named dialog', () => {
    const { container } = mount();

    const dialog = open(container);

    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Map legend');
  });
});

describe('§6.3 — every channel the map spends is named', () => {
  it('explains the water line', () => {
    const { container } = mount();
    open(container);

    expect(text(container)).toMatch(/water line/i);
  });

  it('names all five bands, read from §11.6 rather than restated', () => {
    const { container } = mount();
    open(container);

    expect(BANDS.length).toBe(5);
    for (const band of BANDS) {
      expect(text(container), band.name).toContain(band.name);
    }
  });

  it('explains hachure as unsurveyed ground', () => {
    const { container } = mount();
    open(container);

    expect(text(container)).toMatch(/hachure/i);
  });

  it('explains both hex border styles', () => {
    const { container } = mount();
    open(container);

    expect(text(container)).toMatch(/solid/i);
    expect(text(container)).toMatch(/dashed/i);
  });

  it('explains both glyphs — the mastery ring and the level-10 disc', () => {
    const { container } = mount();
    open(container);

    const legend = text(container);
    expect(legend).toMatch(/mastery/i);
    expect(legend).toMatch(/level 10|ceiling/i);
    // Each glyph is drawn, not merely described: a legend whose marks are prose
    // cannot be compared against the map by eye.
    expect(container.querySelectorAll('[data-info] svg[data-legend-glyph]').length).toBe(2);
  });
});

describe('F34 — no raw percentage', () => {
  it('states no percentage and no number-out-of-a-hundred anywhere', () => {
    const { container } = mount();
    open(container);

    expect(text(container)).not.toMatch(/%|per ?cent/i);
  });
});

describe('§6.3 — the dialog', () => {
  it('closes on `Esc` and returns focus to the trigger', () => {
    const { container } = mount();

    const dialog = open(container);
    press(dialog, 'Escape');

    expect(container.querySelector('[data-info]')).toBeNull();
    expect(document.activeElement).toBe(trigger(container));
  });

  it('closes on its own close button', () => {
    const { container } = mount();

    open(container);
    click(container.querySelector('[data-info-close]')!);

    expect(container.querySelector('[data-info]')).toBeNull();
  });

  it('traps Tab inside itself', () => {
    const { container } = mount();

    const dialog = open(container);
    const stops = [...dialog.querySelectorAll<HTMLElement>('button')];
    expect(stops.length).toBeGreaterThan(0);

    const last = stops[stops.length - 1];
    last.focus();
    press(last, 'Tab');

    expect(document.activeElement).toBe(stops[0]);
  });
});

describe('§15.8 — the axe gate', () => {
  it('reports no WCAG 2.1 AA violation with the legend open', async () => {
    const { container } = mount();
    open(container);

    await expect(auditAccessibility(container)).resolves.toBeDefined();
  });
});
