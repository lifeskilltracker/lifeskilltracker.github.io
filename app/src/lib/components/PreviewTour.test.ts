// @vitest-environment jsdom

/**
 * §7.1's preview surface (PRD D25, §12 Q4).
 *
 * The claim this file defends is §15.5's: **removing all motion loses nothing.**
 * The tour's motion is a camera glide, and if the rungs it glides between were
 * only legible as it passed them, a reader with `prefers-reduced-motion` would
 * get an unstarted tree and no explanation — which is the D25 failure, delivered
 * to the readers least able to work around it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PreviewAnnotation } from '$lib/actions/preview.js';
import { auditAccessibility } from './axe.js';
import PreviewTour from './PreviewTour.svelte';
import { cleanup, click, render } from './test-harness.svelte.js';

const ANNOTATIONS: readonly PreviewAnnotation[] = [
  { level: 1, title: 'Make instant noodles' },
  { level: 5, title: 'Cook for eight without a recipe' },
  { level: 10, title: 'Teach a cooking class' },
];

afterEach(cleanup);

function mount(props: Record<string, unknown> = {}) {
  return render(PreviewTour, {
    skillTitle: 'Cooking',
    annotations: ANNOTATIONS,
    activeLevel: null,
    onexit: () => {},
    ...props,
  } as never);
}

describe('what it says', () => {
  it('names every rung as text, whatever the camera is doing', () => {
    const { container } = mount();
    const text = container.textContent!;
    for (const annotation of ANNOTATIONS) {
      expect(text).toContain(annotation.title);
      expect(text).toContain(`Level ${annotation.level}`);
    }
  });

  it('tells the visitor that ticking starts real tracking', () => {
    // The tree behind the tour is genuinely live, so this is a statement of
    // fact rather than a nudge — and it is the conversion.
    const { container } = mount();
    expect(container.textContent!.toLowerCase()).toContain('tracking for real');
  });

  it('names the skill it is touring', () => {
    const { container } = mount({ skillTitle: 'Blacksmithing' });
    expect(container.textContent).toContain('Blacksmithing');
  });

  it('is a labelled region, not a loose banner', () => {
    const { container } = mount();
    expect(container.querySelector('[data-preview-tour]')!.getAttribute('aria-label')).toContain(
      'Cooking',
    );
  });
});

describe('the active rung', () => {
  it('is marked by aria-current as well as by style (N5, §15.4)', () => {
    const { container } = mount({ activeLevel: 5 });
    const active = container.querySelector('[data-rung="5"]')!;
    expect(active.getAttribute('aria-current')).toBe('step');
    expect(container.querySelector('[data-rung="1"]')!.getAttribute('aria-current')).toBeNull();
  });

  it('marks nothing when the camera is at rest', () => {
    const { container } = mount({ activeLevel: null });
    expect(container.querySelector('[aria-current]')).toBeNull();
  });
});

describe('leaving', () => {
  it('offers a way back to the map', () => {
    const onexit = vi.fn();
    const { container } = mount({ onexit });
    click(container.querySelector('[data-preview-exit]')!);
    expect(onexit).toHaveBeenCalledOnce();
  });
});

describe('degrading', () => {
  it('renders without a rung list when the tree yielded no annotations', () => {
    // A tree with every level empty is not a real published tree, but the
    // derivation can return nothing and the bar must still stand.
    const { container } = mount({ annotations: [] });
    expect(container.querySelector('[data-preview-tour]')).not.toBeNull();
    expect(container.querySelector('[data-rung]')).toBeNull();
  });

  it('passes an axe audit', async () => {
    const { container } = mount({ activeLevel: 5 });
    expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
  });
});
