// @vitest-environment jsdom

/**
 * §12.7's prompt (T18).
 *
 * "Non-modal, dismissible, never blocking" — §12.7 says it three ways in one
 * line, and the three are one requirement stated defensively because the failure
 * is so easy to write. A modal that interrupts a user mid-milestone converts a
 * durability reminder into the thing they close reflexively, which defeats the
 * only mitigation R-18 has.
 *
 * So most of this file asserts the **absence** of things: no dialog role, no
 * `aria-modal`, no stolen focus, no backdrop. Those are assertions about the
 * component's source as much as its DOM, because a `position: fixed` overlay
 * renders as an ordinary `<div>` and blocks the page all the same.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExportPrompt from './ExportPrompt.svelte';
import { DURABILITY_MESSAGE } from './durability-copy.js';
import { cleanup, click, render } from './test-harness.svelte.js';

afterEach(cleanup);

const SOURCE = readFileSync(
  join(process.cwd(), 'src/lib/components/ExportPrompt.svelte'),
  'utf8',
);

const mount = (props: Record<string, unknown> = {}) =>
  render(ExportPrompt, { ondismiss: () => {}, ...props });

/** Every ARIA role present, so absences can be asserted without naming them. */
const rolesIn = (root: ParentNode): (string | null)[] =>
  [...root.querySelectorAll('[role]')].map((node) => node.getAttribute('role'));

describe('what it says (§12.7)', () => {
  it('carries the durability message verbatim', () => {
    const { container } = mount();

    expect(container.textContent?.replace(/\s+/g, ' ')).toContain(DURABILITY_MESSAGE);
  });

  it('offers a way to the export rather than performing one', () => {
    // §12.6 owns the export (T16); this prompt suggests, and `/data` is where
    // the file is actually written.
    const { container } = mount();
    const link = container.querySelector<HTMLAnchorElement>('[data-action="go-to-export"]');

    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toContain('/data');
  });

  /**
   * §16.3's quota row prompts for the same reason but after a different event,
   * and saying so is the difference between "here is a reminder" and "the thing
   * you just did did not save".
   */
  it('names the failed write when that is why it is up', () => {
    const { container } = mount({ reason: 'write-failed' });

    expect(container.textContent?.toLowerCase()).toContain('could not be saved');
    expect(container.textContent?.replace(/\s+/g, ' ')).toContain(DURABILITY_MESSAGE);
  });
});

describe('it is dismissible (§12.7)', () => {
  it('calls back when the dismiss control is used', () => {
    const ondismiss = vi.fn();
    const { container } = mount({ ondismiss });

    click(container.querySelector('[data-action="dismiss-export-prompt"]')!);

    expect(ondismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves the dismissal to its owner rather than hiding itself', () => {
    // §14.1: a component takes values and emits intent. The persisted, per-
    // trigger record (T26/F15) lives behind `lib/actions`, and a component that
    // hid itself locally would put the on-screen state and the record it is
    // supposed to reflect in two places.
    const ondismiss = vi.fn();
    const { container } = mount({ ondismiss });

    click(container.querySelector('[data-action="dismiss-export-prompt"]')!);

    expect(container.querySelector('[data-export-prompt]')).not.toBeNull();
  });
});

describe('it is not a modal and does not block (§12.7)', () => {
  it('is a polite status region, not an alert and not a dialog', () => {
    const { container } = mount();
    const region = container.querySelector('[data-export-prompt]')!;

    // §15.2 allows one polite live region and no interrupting one anywhere.
    // The roles are read as values rather than matched as selector literals:
    // `TreeView.a11y.test.ts` greps the whole of `src/` for the interrupting
    // ones, and a test asserting their absence must not spell them out.
    expect(region.getAttribute('role')).toBe('status');
    expect(rolesIn(container)).toEqual(['status']);
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('declares no modality anywhere in its source', () => {
    expect(SOURCE).not.toContain('aria-modal');
    expect(SOURCE).not.toContain('role="dialog"');
    expect(SOURCE).not.toContain('showModal');
    expect(SOURCE).not.toContain('inert');
  });

  it('paints no overlay over the page', () => {
    // A full-viewport fixed layer blocks every click underneath it while
    // satisfying every DOM assertion above, so the styles are part of the
    // contract rather than decoration.
    expect(SOURCE).not.toMatch(/position:\s*fixed/);
    expect(SOURCE).not.toMatch(/position:\s*absolute/);
    expect(SOURCE).not.toMatch(/z-index/);
  });

  it('takes no focus when it appears', () => {
    const before = document.activeElement;

    mount();

    // Stealing focus mid-task is what "never blocking" rules out even without a
    // backdrop: the user is typing a note and the caret leaves.
    expect(document.activeElement).toBe(before);
  });

  it('traps nothing — it listens for no keys at all', () => {
    expect(SOURCE).not.toContain('onkeydown');
    expect(SOURCE).not.toContain('Escape');
    expect(SOURCE).not.toContain('focus()');
  });
});

/**
 * §12.7: "The durability message is factual rather than alarming." The wording
 * lives in one constant so this is a single readable assertion, and so the
 * component and its copy cannot drift apart about what the app says.
 */
describe('the durability message (§12.7)', () => {
  it('names all three ways the data can be lost', () => {
    expect(DURABILITY_MESSAGE).toContain('the browser');
    expect(DURABILITY_MESSAGE).toContain('private');
    expect(DURABILITY_MESSAGE).toContain('you clear');
  });

  it('says an export is the only backup', () => {
    expect(DURABILITY_MESSAGE.toLowerCase()).toContain('only backup');
  });

  /**
   * §17.4: a phase 1 heavy user lands under 1 MB against quotas measured in
   * hundreds of megabytes, so any copy implying "running out of room" is
   * factually wrong as well as alarming. Nothing in §12.7 is urgent either.
   */
  it('carries no urgency and no claim about running out of space', () => {
    const forbidden = [
      'urgent',
      'immediately',
      'warning',
      'danger',
      'running out',
      'act now',
      'at risk',
      'full',
      '!',
    ];
    for (const word of forbidden) {
      expect(DURABILITY_MESSAGE.toLowerCase()).not.toContain(word);
    }
  });
});
