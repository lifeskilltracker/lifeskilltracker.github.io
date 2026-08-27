// @vitest-environment jsdom

/**
 * §6.5's welcome wired into the shell (PRD D25, UI-SPEC §12 Q4).
 *
 * The dialogue's own behaviour is `Welcome.test.ts`; its gate is
 * `welcome.test.ts`. What is only true at this level is *who it is shown to and
 * where* — and each claim below is a way the feature could be built with both of
 * those suites green and still be wrong in the product:
 *
 * - it greets a first-time visitor **on the map**, and nowhere else;
 * - it does **not** greet someone whose mirror already has progress;
 * - closing it is final for the session as well as for the flag, because the
 *   shell's derivations re-run constantly and a dialogue that reopened on the
 *   next re-render would be unclosable.
 */

import 'fake-indexeddb/auto';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, click, flushSync, render } from '$lib/components/test-harness.svelte.js';
import type { ColdStartContent, ColdStartStore } from '$lib/actions/cold-start.js';
import type { NextStepSources } from '$lib/actions/next-step.js';
import { manifestFixture } from '$lib/components/fixtures.js';
import { REVEAL_MS } from '$lib/components/reveal.js';
import { WELCOME_FLAG } from '$lib/components/welcome.js';
import { content } from '$lib/content/store.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { sidebarCollapse } from '$lib/components/sidebar-collapse.svelte.js';
import { ui } from '$lib/state/ui.svelte.js';
import type { Manifest } from '$lib/types';
import Shell from './Shell.svelte';

const MANIFEST: Manifest = manifestFixture();

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

/** The cartouche is a chunk, for the same reason and on the same seam as §6.2's. */
beforeAll(async () => {
  await import('$lib/components/Welcome.svelte');
});

/** Lets the cold start, the derivations and the lazy chunk land. */
async function ticks(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
  }
}

/**
 * The cartouche waits out §5.7's reveal before opening, so every assertion that
 * expects to see it has to cross `REVEAL_MS` first. Real timers rather than fake
 * ones: the shell's path to the dialogue runs through a dynamic `import()`, and
 * a faked clock does not advance a module resolution.
 */
async function settled(): Promise<void> {
  await ticks();
  await new Promise((resolve) => setTimeout(resolve, REVEAL_MS));
  await ticks();
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

const welcome = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-welcome]');

beforeEach(() => {
  progress.reset();
  progress.writable = true;
  ui.reset();
  content.reset();
  globalThis.localStorage?.clear();
  sidebarCollapse.set(false);
});

afterEach(cleanup);

describe('who gets greeted', () => {
  it('greets a first-time visitor on the world map', async () => {
    const { container } = mount('/');
    await settled();
    expect(welcome(container)).not.toBeNull();
  });

  it('does not greet a visitor who already has progress', async () => {
    // The flag is local, so this is the returning Player on a new device, or
    // one who has just imported an export. They are not the Curious Browser.
    progress.skills = { cooking: { treeId: 'cooking', level: 3 } } as never;
    const { container } = mount('/');
    await settled();
    expect(welcome(container)).toBeNull();
  });

  it('holds until the reveal has finished (§5.7)', async () => {
    // §5.7 ends "on the resting frame — plates at open strength, hachure
    // settled, labels set, camera at rest — so the welcome dialog opens over a
    // finished picture with nothing still in motion". Opening early would land
    // the one modal in the application on top of a moving map.
    const { container } = mount('/');
    await ticks();
    expect(welcome(container)).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, REVEAL_MS));
    await ticks();
    expect(welcome(container)).not.toBeNull();
  });

  it('does not greet twice', async () => {
    localStorage.setItem(WELCOME_FLAG, '1');
    const { container } = mount('/');
    await settled();
    expect(welcome(container)).toBeNull();
  });

  it('stays off routes that are not the map', async () => {
    // §6.5 puts it over the finished map. On `/about` there is no map to open
    // over, and the dialogue would be a modal in front of a prose page.
    const { container } = mount('/about');
    await settled();
    expect(welcome(container)).toBeNull();
  });
});

describe('closing is final', () => {
  it('does not reopen when the shell re-derives', async () => {
    // Every derivation in the shell re-runs on any progress or manifest change.
    // A gate that consulted only the flag would be satisfied by `markWelcomed`,
    // but a gate that consulted only reactive state would reopen forever.
    const { container } = mount('/');
    await settled();
    click(container.querySelector('[data-welcome-dismiss]')!);
    flushSync();
    expect(welcome(container)).toBeNull();

    progress.skills = { ...progress.skills };
    await settled();
    expect(welcome(container)).toBeNull();
  });
});
