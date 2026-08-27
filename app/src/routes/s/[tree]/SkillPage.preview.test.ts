// @vitest-environment jsdom

/**
 * §7.1's guided preview, on the page that runs it (PRD D25, UI-SPEC §12 Q4).
 *
 * The schedule is `preview-tour.ts` and the surface is `PreviewTour.svelte`.
 * What is only true here is the wiring, and the wiring carries the two
 * properties that make this answer to D25 defensible at all:
 *
 * **The tree is real and untouched.** Preview adds a camera script and three
 * labels. It writes nothing, fakes no progress, and leaves every control the
 * page already had exactly where it was — so "tick anything and it starts
 * tracking for real" is a statement of fact.
 *
 * **A visitor who takes the wheel keeps it.** The tour is a courtesy, not a
 * ride: the first scroll or key press ends it, because a camera that keeps
 * yanking the view back is worse than no tour at all.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundleFixture } from '$lib/content/fixtures/bundles.js';
import { cleanup, fire, flushSync, press, render } from '$lib/components/test-harness.svelte.js';
import { progress } from '$lib/state/progress.svelte.js';
import { store } from '$lib/state/store.js';
import type { CompiledTree } from '$lib/types';
import SkillPage from './SkillPage.svelte';
import type { SkillPageData } from './+page.js';

let counter = 0;

function tree(): CompiledTree {
  return bundleFixture({ id: `preview-${(counter += 1)}` }) as unknown as CompiledTree;
}

function pageData(bundle: CompiledTree): SkillPageData {
  return { treeId: bundle.id, tree: bundle, unavailable: null, reason: null, offline: false };
}

function stubMatchMedia(reduced: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
}

/** Lets the session open its bundle and the first tour stop land. */
async function settled(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
  }
}

beforeEach(async () => {
  progress.reset();
  progress.writable = true;
  progress.hydrated = true;
  stubMatchMedia(false);
  await store.close();
});

afterEach(async () => {
  cleanup();
  Reflect.deleteProperty(globalThis, 'matchMedia');
  // See the note in `SkillPage.camera.test.ts` — the session effect's teardown
  // warning is forwarded asynchronously and must be allowed to land.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const tour = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-preview-tour]');

describe('when the preview is off', () => {
  it('shows no tour, which is every ordinary visit to a skill', async () => {
    const { container } = render(SkillPage, { data: pageData(tree()) });
    await settled();
    expect(tour(container)).toBeNull();
  });
});

describe('when the preview is on', () => {
  it('shows the tour above the tree', async () => {
    const { container } = render(SkillPage, { data: pageData(tree()), preview: true });
    await settled();
    expect(tour(container)).not.toBeNull();
  });

  it('leaves the tree fully live — every camera control still there', async () => {
    // Preview is a script over the real page, not a separate read-only mode.
    const { container } = render(SkillPage, { data: pageData(tree()), preview: true });
    await settled();
    expect([...container.querySelectorAll('[data-camera]')]).toHaveLength(3);
  });

  it('names rungs taken from the tree, not from copy written here', async () => {
    const bundle = tree();
    const { container } = render(SkillPage, { data: pageData(bundle), preview: true });
    await settled();

    const first = bundle.milestones
      .filter((milestone) => milestone.level === 1)
      .sort((a, b) => a.order - b.order)[0];
    expect(tour(container)!.textContent).toContain(first.label ?? first.title);
  });

  it('marks a rung as the camera reaches it', async () => {
    const { container } = render(SkillPage, { data: pageData(tree()), preview: true });
    await settled();
    expect(tour(container)!.querySelector('[aria-current="step"]')).not.toBeNull();
  });

  // No axe audit here on purpose. `page-render.test.ts` already audits this
  // page whole, and `PreviewTour.test.ts` audits the markup this task adds;
  // a third full-page run costs the suite far more than it checks (§15.8).
});

describe('the visitor takes the wheel', () => {
  it('ends the tour on a key press', async () => {
    const { container } = render(SkillPage, { data: pageData(tree()), preview: true });
    await settled();
    expect(tour(container)!.querySelector('[aria-current="step"]')).not.toBeNull();

    press(container.querySelector('[data-camera]')!, 'ArrowDown');
    flushSync();
    // The bar stays — it is how they leave, and it still says nothing is saved.
    // What stops is the camera, and the mark that tracks it.
    expect(tour(container)!.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('ends the tour on a scroll', async () => {
    const { container } = render(SkillPage, { data: pageData(tree()), preview: true });
    await settled();

    fire(container.querySelector('.tree-camera')!, new Event('wheel', { bubbles: true }));
    flushSync();
    expect(tour(container)!.querySelector('[aria-current="step"]')).toBeNull();
  });
});

describe('under prefers-reduced-motion (§15.5)', () => {
  it('names all three rungs in text with no camera movement at all', async () => {
    // Removing the motion must lose nothing. The rungs are the information;
    // the glide is the decoration.
    stubMatchMedia(true);
    const bundle = tree();
    const { container } = render(SkillPage, { data: pageData(bundle), preview: true });
    await settled();

    const panel = tour(container)!;
    expect(panel).not.toBeNull();
    expect(panel.querySelectorAll('[data-rung]').length).toBeGreaterThan(0);
    // Nothing is "current", because nothing is moving.
    expect(panel.querySelector('[aria-current="step"]')).toBeNull();
  });
});
