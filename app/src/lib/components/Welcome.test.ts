// @vitest-environment jsdom

/**
 * §6.5's welcome cartouche, rendered (PRD D25, UI-SPEC §12 Q4).
 *
 * This is the one surface in the application aimed squarely at the Curious
 * Browser (PRD §4.4) — someone who arrives once, intends to track nothing, and
 * decides in ten seconds whether they ever come back. So the tests here are
 * about the two ways it can fail that surviving a render would not catch: it
 * greets the wrong person, or it greets the right person twice.
 *
 * The gate itself lives in `welcome.ts` and is asserted there against every
 * input. What is asserted here is that the dialogue *uses* it, honours the
 * keyboard, and never leaves the flag unwritten.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { auditAccessibility } from './axe.js';
import { cleanup, click, press, render } from './test-harness.svelte.js';
import type { FeaturedCandidate } from './featured.js';
import Welcome from './Welcome.svelte';
import { WELCOME_FLAG } from './welcome.js';

const TREES: readonly FeaturedCandidate[] = [
  { id: 'piano', title: 'Piano', milestoneCount: 40 },
  { id: 'cooking', title: 'Cooking', milestoneCount: 73 },
];

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function mount(props: Partial<Parameters<typeof Welcome>[1]> = {}) {
  return render(Welcome, {
    trees: TREES,
    onpreview: () => {},
    onclose: () => {},
    ...props,
  } as never);
}

const dialog = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-welcome]');

describe('the cartouche', () => {
  it('is a modal dialogue with an accessible name', () => {
    const { container } = mount();
    const panel = dialog(container)!;
    expect(panel.getAttribute('role')).toBe('dialog');
    // Modal, unlike Find: there is nothing to do on the map behind it, and it
    // is asking for a decision rather than commentating on a live surface.
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('names the skill it is offering, rather than saying "a skill"', () => {
    // The destination is derived from the manifest (`featuredTreeId`), so the
    // button can say the real title — "Show me Cooking" is a concrete promise
    // where "Show me a skill" is an unlabelled door.
    const { container } = mount({
      trees: [{ id: 'smithing', title: 'Blacksmithing', milestoneCount: 12 }],
    });
    expect(dialog(container)!.textContent).toContain('Blacksmithing');
  });

  it('takes focus on open, so a screen reader hears it', () => {
    const { container } = mount();
    expect(document.activeElement).toBe(dialog(container));
  });

  it('says plainly that nothing is being stored', () => {
    // PRD §4.4: this visitor "never creates data" and has no intention of
    // starting. Saying so unprompted is what buys the next ten seconds.
    const { container } = mount();
    expect(dialog(container)!.textContent!.toLowerCase()).toContain('saved');
  });

  it('passes an axe audit', async () => {
    // The helper throws on a violation and returns the rules that passed, so
    // the assertion is that it resolved *and* actually exercised something —
    // an empty subtree would pass vacuously (§15.8).
    const { container } = mount();
    expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
  });
});

describe('once ever', () => {
  it('marks itself seen as it opens, not as it closes', () => {
    // A visitor who navigates away with the dialogue still on screen has been
    // greeted. Recording on close would greet them again on their next visit.
    mount();
    expect(localStorage.getItem(WELCOME_FLAG)).toBe('1');
  });
});

describe('leaving', () => {
  it('closes on Escape', () => {
    const onclose = vi.fn();
    const { container } = mount({ onclose });
    press(dialog(container)!, 'Escape');
    expect(onclose).toHaveBeenCalledOnce();
  });

  it('closes on the second button without navigating', () => {
    const onclose = vi.fn();
    const onpreview = vi.fn();
    const { container } = mount({ onclose, onpreview });
    click(container.querySelector('[data-welcome-dismiss]')!);
    expect(onclose).toHaveBeenCalledOnce();
    expect(onpreview).not.toHaveBeenCalled();
  });

  it('asks for the preview on the primary button, naming the skill it chose', () => {
    // The fullest ladder is the best advertisement — Cooking at 73 over Piano
    // at 40 — and the shell is told which, rather than deciding for itself.
    const onpreview = vi.fn();
    const { container } = mount({ onpreview });
    click(container.querySelector('[data-welcome-preview]')!);
    expect(onpreview).toHaveBeenCalledWith('cooking');
  });

  it('offers no preview button at all when the library is empty', () => {
    // Every domain fogged (§4.4) is a real state, and a button promising a skill
    // that does not exist is worse than a dialogue with one button.
    const { container } = mount({ trees: [] });
    expect(container.querySelector('[data-welcome-preview]')).toBeNull();
    expect(container.querySelector('[data-welcome-dismiss]')).not.toBeNull();
  });
});

describe('the keyboard cycle (§15.3)', () => {
  it('wraps Tab at the end rather than leaving for the map behind', () => {
    const { container } = mount();
    const stops = [...container.querySelectorAll<HTMLElement>('[data-welcome] button')];
    const last = stops[stops.length - 1];
    last.focus();
    press(dialog(container)!, 'Tab');
    expect(document.activeElement).toBe(stops[0]);
  });

  it('wraps Shift+Tab from the container back to the last stop', () => {
    const { container } = mount();
    const stops = [...container.querySelectorAll<HTMLElement>('[data-welcome] button')];
    press(dialog(container)!, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(stops[stops.length - 1]);
  });
});
