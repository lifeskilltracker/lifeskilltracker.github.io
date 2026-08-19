// @vitest-environment jsdom

/**
 * §6.2 and §6.3 wired into the shell (T33).
 *
 * Three claims, and each of them is about *where* the two controls live rather
 * than about what they do — which the component tests already cover.
 *
 * **They ride the map, and only the map.** `Ctrl`/`Cmd`+`F` is the browser's
 * everywhere else in the application, and the way that promise is kept is by not
 * mounting the handler off the map. A test that only checked the controls appear
 * would let them leak onto `/about` and quietly break find-in-page there.
 *
 * **The dim reaches the map.** Find reports a result and the shell owns the
 * highlight; a wiring that dropped the result on the floor would leave every
 * component test passing and the feature not working.
 *
 * **Q5, resolved (2026-08-18): the highlight persists across a camera move.**
 * Asserted here rather than in `MapSurface.test.ts` because persistence is a
 * claim about who *owns* the state — the shell, which survives the navigation —
 * and it is only true at this level.
 */

import 'fake-indexeddb/auto';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, click, fire, flushSync, render } from '$lib/components/test-harness.svelte.js';
import type { ColdStartContent, ColdStartStore } from '$lib/actions/cold-start.js';
import type { NextStepSources } from '$lib/actions/next-step.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { ui } from '$lib/state/ui.svelte.js';
import { sidebarCollapse } from '$lib/components/sidebar-collapse.svelte.js';
import { manifestFixture } from '$lib/components/fixtures.js';
import type { Manifest } from '$lib/types';
import Shell from './Shell.svelte';

const MANIFEST: Manifest = manifestFixture();

/**
 * The next-step card is not what these tests are about; a real empty progress
 * keeps it quiet without printing an unhandled rejection over the run.
 */
const SOURCES: NextStepSources = {
  loadTree: () => Promise.reject(new Error('no bundles in this test')),
  progressFor: () => ({ milestones: new Map(), grandfathered: new Map() }),
};

const children = createRawSnippet(() => ({ render: () => '<p>the page</p>' }));

function loaderStub(): ColdStartContent {
  return {
    loadManifest: async () => {
      content.setManifest(MANIFEST, false);
      return MANIFEST;
    },
    isOffline: () => false,
  };
}

function storeStub(): ColdStartStore {
  return {
    get hydrated() {
      return progress.hydrated;
    },
    recordManifest: async () => undefined,
    hydrate: async () => {
      progress.hydrated = true;
    },
    applyMoves: async () => [],
  };
}

/**
 * The controls are a chunk (§17.1), so the shell reaches them through an
 * `import()`. Priming the module registry once makes that resolution
 * deterministic here: under Vite the *first* resolution includes transforming
 * the module, which no number of ticks reliably outwaits, and how long a chunk
 * takes to arrive is not what any of these tests is about.
 */
beforeAll(async () => {
  await import('$lib/components/MapControls.svelte');
});

async function settled(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
  }
}

function mount(pathname = '/') {
  return render(Shell, {
    children,
    pathname,
    contentLoader: loaderStub(),
    userStore: storeStub(),
    nextStepSources: SOURCES,
  });
}

function type(container: HTMLElement, value: string): void {
  const input = container.querySelector<HTMLInputElement>('input[data-find-input]')!;
  input.value = value;
  fire(input, new Event('input', { bubbles: true }));
}

beforeEach(() => {
  progress.reset();
  progress.writable = true;
  ui.reset();
  content.reset();
  globalThis.localStorage?.clear();
  sidebarCollapse.set(false);
});

afterEach(cleanup);

describe('§6.2, §6.3 — the pair rides the map', () => {
  it('mounts Find and Info on the world map', async () => {
    const { container } = mount('/');
    await settled();

    expect(container.querySelector('[data-find-trigger]')).not.toBeNull();
    expect(container.querySelector('[data-info-trigger]')).not.toBeNull();
  });

  it('mounts them at level 1 too', async () => {
    const { container } = mount('/d/making');
    await settled();

    expect(container.querySelector('[data-find-trigger]')).not.toBeNull();
  });

  it('mounts neither off the map, so find-in-page is the browser’s there', async () => {
    const { container } = mount('/about');
    await settled();

    expect(container.querySelector('[data-find-trigger]')).toBeNull();
    expect(container.querySelector('[data-info-trigger]')).toBeNull();
  });
});

describe('§6.2 — the query reaches the map', () => {
  it('dims the regions holding no match', async () => {
    const { container } = mount('/');
    await settled();

    click(container.querySelector('[data-find-trigger]')!);
    type(container, 'making');
    flushSync();

    const making = container.querySelector('.region[data-domain="making"]')!;
    const mind = container.querySelector('.region[data-domain="mind"]')!;
    expect(making.classList.contains('is-unmatched')).toBe(false);
    expect(mind.classList.contains('is-unmatched')).toBe(true);
  });

  it('dims nothing before a query is typed', async () => {
    const { container } = mount('/');
    await settled();

    click(container.querySelector('[data-find-trigger]')!);
    flushSync();

    expect(container.querySelectorAll('.is-unmatched').length).toBe(0);
  });
});

describe('Q5 — the highlight persists across a camera move', () => {
  it('survives entering a domain', async () => {
    const mounted = mount('/');
    await settled();

    click(mounted.container.querySelector('[data-find-trigger]')!);
    type(mounted.container, 'making');
    flushSync();

    mounted.props.pathname = '/d/making';
    await settled();

    expect(mounted.container.querySelectorAll('.is-unmatched').length).toBeGreaterThan(0);
    // And the count is still on the page, which is what stops a persisting dim
    // from reading as a rendering fault (§8.2).
    expect(mounted.container.querySelector('[data-find-count]')?.textContent).toMatch(/match/);
  });
});
