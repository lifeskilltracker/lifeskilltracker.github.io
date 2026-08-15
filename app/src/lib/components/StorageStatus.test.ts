// @vitest-environment jsdom

/**
 * §16.5's storage panel on `/data` (T18).
 *
 * §16.5 fixes the list: "storage estimate, last export, content version, app
 * version". T26/F8 settles what "content version" means at this altitude —
 * there is no library-wide counter (§7.2, §16.1), so the manifest's `generated`
 * stamp is the thing a human can read to know which build they are looking at.
 *
 * The other rule here is about honesty rather than completeness. `usage` and
 * `quota` are browser estimates and deliberately imprecise, so the panel must
 * not present them as exact figures — and in phase 1 a heavy user is under 1 MB
 * against a quota in the hundreds (§17.4), which makes a percentage bar read as
 * a warning about nothing.
 */

import { afterEach, describe, expect, it } from 'vitest';
import StorageStatus from './StorageStatus.svelte';
import { cleanup, render } from './test-harness.svelte.js';

afterEach(cleanup);

const mount = (props: Record<string, unknown> = {}) =>
  render(StorageStatus, {
    usage: 512 * 1024,
    quota: 500 * 1024 * 1024,
    appVersion: '0.1.0',
    libraryBuilt: '2026-09-14T00:00:00.000Z',
    ...props,
  });

describe('§16.5’s four facts', () => {
  it('reports the storage estimate', () => {
    const { container } = mount();

    const text = container.querySelector('[data-storage]')!.textContent ?? '';
    expect(text).toContain('0.50 MB');
    expect(text).toContain('500.00 MB');
  });

  it('reports the last export, and says so plainly when there has never been one', () => {
    const { container } = mount();
    expect(container.querySelector('[data-last-export]')?.textContent).toContain(
      'never exported',
    );

    const withExport = mount({ lastExportAt: '2026-08-13T09:30:00.000Z' });
    expect(withExport.container.querySelector('[data-last-export]')?.textContent).toContain(
      '2026-08-13T09:30:00.000Z',
    );
  });

  it('reports the app version and the library build (T26/F8)', () => {
    const { container } = mount();
    const versions = container.querySelector('[data-versions]')!.textContent ?? '';

    expect(versions).toContain('0.1.0');
    expect(versions).toContain('2026-09-14T00:00:00.000Z');
    // There is no library-wide content counter to show (§7.2, §16.1).
    expect(versions).not.toContain('contentVersion');
  });
});

describe('the figures are estimates and are said to be', () => {
  it('marks the numbers as approximate', () => {
    const { container } = mount();

    expect(container.querySelector('[data-storage]')?.textContent?.toLowerCase()).toContain(
      'estimate',
    );
  });

  it('says nothing about the browser having granted persistence', () => {
    // §12.7: request it, do not depend on it. R-18 records that Safari
    // effectively never grants it outside an installed PWA, so a red "not
    // persistent" line would be a permanent alarm about a condition the user
    // cannot change and that F39's export already answers.
    const { container } = mount({ persistOutcome: 'denied' });

    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('denied');
    expect(text).not.toContain('not persistent');
  });

  it('degrades to a plain statement when the browser reports no figures', () => {
    // `durability.pollEstimate()` returns zeroes where there is no Storage API
    // (§12.7). "Using 0.00 MB of 0.00 MB" would read as an empty disk.
    const { container } = mount({ usage: 0, quota: 0 });

    const text = container.querySelector('[data-storage]')?.textContent ?? '';
    expect(text.toLowerCase()).toContain('could not tell');
    expect(text).not.toContain('0.00 MB');
  });
});
