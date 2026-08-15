// @vitest-environment jsdom

/**
 * §15's gate over `/data`, with §12.7's prompt on screen (T18, T20).
 *
 * `/data` is the page a user reaches when something has gone wrong — a degraded
 * session sends them here, §16.3's cold-start failure screen links here, and it
 * is the only place an export can be taken. §15.8's axe run is a gate rather
 * than a certificate ("roughly a third of real issues"), so the assertions
 * either side of it are the ones about §12.7's actual requirement: the prompt is
 * a polite status region, it is not a dialog, and it does not sit between the
 * user and the export button it is pointing at.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditAccessibility } from '$lib/components/axe.js';
import { cleanup, render } from '$lib/components/test-harness.svelte.js';
import { manifestFixture } from '$lib/content/fixtures/bundles.js';
import { content } from '$lib/content/store.svelte.js';
import { DB_NAME } from '$lib/state/db.js';
import { durability } from '$lib/state/durability.js';
import { exportPrompt } from '$lib/state/export-prompt.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { Manifest } from '$lib/types';
import ExportPrompt from '$lib/components/ExportPrompt.svelte';
import DataPage from './+page.svelte';

const MANIFEST = manifestFixture([
  { id: 'cooking', bundle: 'trees/cooking.abc.json' },
]) as unknown as Manifest;

beforeEach(async () => {
  progress.reset();
  progress.writable = true;
  progress.hydrated = true;
  content.reset();
  content.setManifest(MANIFEST, false);
  ui.reset();
  exportPrompt.reset();
  durability.reset();
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: { estimate: async () => ({ usage: 5 * 1024 * 1024, quota: 500 * 1024 * 1024 }) },
    configurable: true,
  });
  await store.close();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

afterEach(cleanup);

describe('§15.8’s axe gate on `/data`', () => {
  it('passes with the storage panel rendered', async () => {
    const { container } = render(DataPage, {});
    await vi.waitFor(() => {
      expect(container.querySelector('[data-storage]')).not.toBeNull();
    });

    const passes = await auditAccessibility(container);

    // A green run over an empty subtree proves nothing; this is the check that
    // axe actually had something to look at.
    expect(passes.length).toBeGreaterThan(0);
  });

  it('passes with §12.7’s prompt rendered alongside it', async () => {
    const { container } = render(DataPage, {});
    await vi.waitFor(() => {
      expect(container.querySelector('[data-storage]')).not.toBeNull();
    });
    // The prompt lives in the shell's notice host in the app; rendering it into
    // the same subtree is what puts both under one axe run, which is the
    // combination §15.8 gates.
    render(ExportPrompt, { ondismiss: () => {}, reason: 'never-exported' });

    await expect(auditAccessibility(document.body)).resolves.toBeDefined();
  });
});

describe('§15.2 — one polite region, and no interrupting one', () => {
  it('adds no assertive live region and no dialog', async () => {
    const { container } = render(DataPage, {});
    await vi.waitFor(() => {
      expect(container.querySelector('[data-storage]')).not.toBeNull();
    });
    render(ExportPrompt, { ondismiss: () => {}, reason: 'never-exported' });

    // Read as values rather than named in a selector: `TreeView.a11y.test.ts`
    // greps all of `src/` for the interrupting roles, and this file must not be
    // the thing that trips its own gate.
    const roles = [...document.body.querySelectorAll('[role]')].map((node) =>
      node.getAttribute('role'),
    );
    expect(roles).not.toContain('alert');
    expect(roles).not.toContain('alertdialog');
    expect(document.body.querySelector('[aria-modal]')).toBeNull();
    expect(document.body.querySelector('dialog')).toBeNull();
  });

  it('leaves the export button reachable with the prompt up (§12.7, never blocking)', async () => {
    const { container } = render(DataPage, {});
    await vi.waitFor(() => {
      expect(container.querySelector('[data-storage]')).not.toBeNull();
    });
    render(ExportPrompt, { ondismiss: () => {}, reason: 'never-exported' });

    const button = container.querySelector<HTMLButtonElement>('[data-action="export"]')!;
    button.focus();

    // Nothing inert, nothing aria-hidden, nothing stealing focus back.
    expect(document.activeElement).toBe(button);
    expect(button.closest('[aria-hidden="true"]')).toBeNull();
    expect(button.closest('[inert]')).toBeNull();
  });
});
