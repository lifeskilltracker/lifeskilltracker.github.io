// @vitest-environment jsdom

/**
 * §6.4's card, rendered (T32).
 *
 * Three claims are worth a test each, and each is the sort that disappears in a
 * refactor without anything else failing:
 *
 * - **It is a landmark with a name** (§8.2). Without that, "reachable without
 *   traversing the map" is a sentence in a spec and nothing in the document.
 * - **It names one concrete milestone and opens it.** "Blacksmithing · Forge a J
 *   hook", linked at `/s/<treeId>/m/<slug>` — not a generic "continue" that
 *   drops the user at the top of a tree to find their own place.
 * - **Its three states are distinguishable.** `pending` must never render as the
 *   invitation: telling a returning Player to start something because their
 *   bundles have not been scored yet is the same class of lie as §13.3's "read
 *   as empty, then wrote".
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, click, render } from './test-harness.svelte.js';
import { auditAccessibility } from './axe.js';
import type { NextStepView } from './next-step.js';
import NextStepCard from './NextStepCard.svelte';

const STEP: NextStepView = {
  kind: 'step',
  step: {
    treeId: 'blacksmithing',
    skillTitle: 'Blacksmithing',
    domain: 'making',
    milestoneUid: 'U0J00000',
    milestoneSlug: 'forge-a-j-hook',
    milestoneTitle: 'Forge a J hook',
  },
};

function mount(view: NextStepView, ondismiss: () => void = () => {}) {
  return render(NextStepCard, { view, ondismiss });
}

afterEach(cleanup);

describe('§8.2 — the card is a landmark', () => {
  it('is a named complementary region, reachable without the map', () => {
    const { container } = mount(STEP);

    const card = container.querySelector('aside[data-next-step]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('aria-label')).toBe('Next step');
  });
});

describe('§6.4 — one milestone, named concretely', () => {
  it('reads "<skill> · <milestone>"', () => {
    const { container } = mount(STEP);

    const link = container.querySelector('[data-next-step-link]')!;
    expect(link.textContent?.replace(/\s+/g, ' ').trim()).toBe('Blacksmithing · Forge a J hook');
  });

  it('opens the milestone itself, not the top of the tree', () => {
    const { container } = mount(STEP);

    const link = container.querySelector('[data-next-step-link]')!;
    expect(link.getAttribute('href')).toBe('/s/blacksmithing/m/forge-a-j-hook');
    // The uid rides along because it is the stable identity; the slug is the URL.
    expect(link.getAttribute('data-uid')).toBe('U0J00000');
  });
});

describe('§6.4 — the states that are not a step', () => {
  it('invites a first-time visitor with a real action', () => {
    const { container } = mount({ kind: 'invitation' });

    const invitation = container.querySelector('[data-next-step-invitation]');
    expect(invitation).not.toBeNull();
    expect(invitation?.querySelector('a')?.getAttribute('href')).toBe('/library');
    expect(container.querySelector('[data-next-step-link]')).toBeNull();
  });

  it('says it is still looking rather than inviting, while progress is unread', () => {
    const { container } = mount({ kind: 'pending' });

    expect(container.querySelector('[data-next-step-pending]')).not.toBeNull();
    expect(container.querySelector('[data-next-step-invitation]')).toBeNull();
  });
});

describe('§6.4 — dismissal', () => {
  it('reports the dismissal rather than hiding itself', () => {
    // The card cannot own this: §6.4 scopes dismissal to the *session*, and the
    // card is torn down and rebuilt on every client-side navigation between `/`
    // and `/d/<domainId>`. A card that remembered its own dismissal would come
    // back on the next camera move.
    let dismissed = 0;
    const { container } = mount(STEP, () => (dismissed += 1));

    click(container.querySelector('[data-action="dismiss-next-step"]')!);

    expect(dismissed).toBe(1);
    expect(container.querySelector('[data-next-step]')).not.toBeNull();
  });
});

describe('§15.8 — the axe gate', () => {
  it('has no machine-detectable violation in any of its three states', async () => {
    for (const view of [STEP, { kind: 'invitation' } as const, { kind: 'pending' } as const]) {
      const { container } = mount(view);
      expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
    }
  });
});
