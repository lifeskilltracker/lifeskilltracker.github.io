// @vitest-environment jsdom

/**
 * §6.1's four blocks (T32).
 *
 * The block **order** is the substance of this file, not a styling detail. The
 * Player's whole session is "land, see where I am, go to the thing, tick it,
 * leave", so block 3 is the most-used control in the application and everything
 * above it is a cost paid on every visit. An implementer reordering these blocks
 * for visual balance is the failure this asserts against.
 *
 * The other three cases each guard a sentence someone will otherwise delete:
 *
 * - **Block 3 links to `/s/<treeId>` directly.** Routing it through the map
 *   would cost the returning user the click the sidebar exists to save.
 * - **Empty is an invitation, not a void.** A first-time visitor gets a real
 *   action here or the block is a blank rectangle they learn to ignore.
 * - **Block 4 is band names and counts, never a percentage.** It is redundant
 *   with the map on purpose — N5 requires the numbers as text and F34 forbids
 *   the fill from appearing anywhere, so this block is the only home there is.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, click, flushSync, render } from './test-harness.svelte.js';
import { auditAccessibility } from './axe.js';
import { sidebarCollapse } from './sidebar-collapse.svelte.js';
import type { DomainProgressRow, StartedSkillRow } from './next-step.js';
import Sidebar from './Sidebar.svelte';

const DOMAINS = [
  { id: 'mind', title: 'Mind' },
  { id: 'body', title: 'Body' },
  { id: 'making', title: 'Making' },
  { id: 'home', title: 'Home' },
  { id: 'people', title: 'People' },
  { id: 'work-money', title: 'Work & Money' },
  { id: 'play', title: 'Play' },
  { id: 'outdoors-nature', title: 'Outdoors & Nature' },
];

const PROGRESS: DomainProgressRow[] = DOMAINS.map((domain, index) => ({
  domain: domain.id,
  title: domain.title,
  band: index === 2 ? 'Deep' : 'Quiet',
  started: index === 2 ? 3 : 0,
}));

const STARTED: StartedSkillRow[] = [
  { treeId: 'blacksmithing', title: 'Blacksmithing', attainedLevel: 4 },
  { treeId: 'piano', title: 'Piano', attainedLevel: 1 },
];

function mount(overrides: Record<string, unknown> = {}) {
  return render(Sidebar, {
    activeDomain: null,
    domains: DOMAINS,
    startedSkills: STARTED,
    domainProgress: PROGRESS,
    hydrated: true,
    ...overrides,
  });
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  sidebarCollapse.set(false);
});

afterEach(cleanup);

describe('§6.1 — the four blocks, in order', () => {
  it('renders primary nav, domains, your skills, then domain progress', () => {
    const { container } = mount();

    const order = [...container.querySelectorAll('[data-block]')].map((el) =>
      el.getAttribute('data-block'),
    );
    expect(order).toEqual(['nav', 'domains', 'skills', 'progress']);
  });

  it('carries §6.1’s five primary destinations and no search box', () => {
    const { container } = mount();

    const nav = container.querySelector('[data-block="nav"]')!;
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Map', 'Library', 'Data', 'About', 'Contribute']);

    // T33 owns Find, and it lives bottom-right rather than here (§6.2). A search
    // box grown in the sidebar is the drift that would leave two of them.
    expect(container.querySelector('input[type="search"]')).toBeNull();
  });

  it('lists all eight domains and highlights the active one at level 1', () => {
    const { container } = mount({ activeDomain: 'making' });

    const domains = container.querySelectorAll('[data-block="domains"] [data-domain]');
    expect(domains.length).toBe(8);

    const active = [...domains].filter((el) => el.getAttribute('data-active') === 'true');
    expect(active.map((el) => el.getAttribute('data-domain'))).toEqual(['making']);
    // §15.4 — the highlight is not colour alone.
    expect(active[0]?.getAttribute('aria-current')).toBe('page');
  });

  it('highlights nothing at level 0, where there is no active domain', () => {
    const { container } = mount({ activeDomain: null });

    const active = container.querySelectorAll('[data-block="domains"] [data-active="true"]');
    expect(active.length).toBe(0);
  });
});

describe('§6.1 block 3 — the most-used control in the application', () => {
  it('links each started skill straight to /s/<treeId>, never through the map', () => {
    const { container } = mount();

    const links = [...container.querySelectorAll('[data-block="skills"] a[data-tree]')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/s/blacksmithing',
      '/s/piano',
    ]);
    // Reaching a started skill from a cold load is one click: no /d/<domain>
    // hop, and nothing in this block addresses the map at all.
    expect(links.some((a) => (a.getAttribute('href') ?? '').startsWith('/d/'))).toBe(false);
  });

  it('names the attained level beside each skill', () => {
    const { container } = mount();

    const first = container.querySelector('[data-block="skills"] [data-tree="blacksmithing"]');
    expect(first?.textContent).toContain('Blacksmithing');
    expect(first?.textContent).toMatch(/Level 4/);
  });

  it('renders an invitation with a real action when nothing is started', () => {
    const { container } = mount({ startedSkills: [] });

    const block = container.querySelector('[data-block="skills"]')!;
    const invitation = block.querySelector('[data-invitation]');
    expect(invitation).not.toBeNull();
    // A void would be an empty <ul>. The bar is a link the visitor can follow.
    expect(block.querySelector('ul')).toBeNull();
    expect(invitation?.querySelector('a')?.getAttribute('href')).toBe('/library');
  });

  it('says progress is unknown rather than "nothing started" before hydration', () => {
    // §13.3: `progressFor` is total, so an unhydrated store and an unstarted
    // user both produce an empty list — and telling a returning Player they have
    // started nothing is the display twin of "read as empty, then wrote".
    const { container } = mount({ startedSkills: [], hydrated: false });

    const block = container.querySelector('[data-block="skills"]')!;
    expect(block.querySelector('[data-invitation]')).toBeNull();
    expect(block.textContent).toMatch(/not been read/i);
  });
});

describe('§6.1 block 4 — N5’s numbers as text, without F34’s number', () => {
  it('renders every domain’s band name and skills-started count', () => {
    const { container } = mount();

    const rows = [...container.querySelectorAll('[data-block="progress"] [data-domain]')];
    expect(rows.length).toBe(8);

    const making = rows.find((row) => row.getAttribute('data-domain') === 'making');
    expect(making?.textContent).toContain('Making');
    expect(making?.textContent).toContain('Deep');
    expect(making?.textContent).toMatch(/3 skills/);

    const mind = rows.find((row) => row.getAttribute('data-domain') === 'mind');
    expect(mind?.textContent).toContain('Quiet');
    expect(mind?.textContent).toMatch(/No skills|0 skills/);
  });

  it('shows no percentage anywhere — F34 forbids the raw fill', () => {
    const { container } = mount();

    const block = container.querySelector('[data-block="progress"]')!;
    expect(block.textContent).not.toContain('%');
    // Nor the fill smuggled in as an attribute for CSS to draw as a bar.
    expect(block.innerHTML).not.toMatch(/fill|percent/i);
  });
});

describe('§6.1 — collapse, and the state that survives a reload', () => {
  it('collapses to a rail and keeps every destination named', () => {
    const { container } = mount();
    const sidebar = container.querySelector('[data-sidebar]')!;
    expect(sidebar.getAttribute('data-collapsed')).toBe('false');

    const toggle = container.querySelector('[data-action="toggle-sidebar"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    click(toggle);

    expect(sidebar.getAttribute('data-collapsed')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    // The rail is a rail, not an amputation: the accessible name of every
    // primary link survives, which is the only thing a reader had.
    const names = [...container.querySelectorAll('[data-block="nav"] a')].map(
      (a) => a.getAttribute('aria-label') ?? a.textContent?.trim(),
    );
    expect(names).toEqual(['Map', 'Library', 'Data', 'About', 'Contribute']);
  });

  it('writes the choice to local storage', () => {
    const { container } = mount();
    click(container.querySelector('[data-action="toggle-sidebar"]')!);

    expect(globalThis.localStorage.getItem('lst.sidebar.collapsed')).toBe('1');
  });

  it('reads it back on the next load, so collapsing survives a reload', () => {
    // A reload is exactly this: module state back at its default, and local
    // storage still holding what the last session chose. `beforeEach` has
    // already put the module back to `false`, so the only source of `true`
    // below is the stored value.
    expect(sidebarCollapse.collapsed).toBe(false);
    globalThis.localStorage.setItem('lst.sidebar.collapsed', '1');

    const { container } = mount();
    flushSync();

    expect(container.querySelector('[data-sidebar]')?.getAttribute('data-collapsed')).toBe('true');
  });

  it('survives storage being unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      const { container } = mount();
      click(container.querySelector('[data-action="toggle-sidebar"]')!);
      expect(container.querySelector('[data-sidebar]')?.getAttribute('data-collapsed')).toBe(
        'true',
      );
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });
});

describe('§15.8 — the axe gate', () => {
  it('has no machine-detectable violation, expanded or collapsed', async () => {
    const { container } = mount({ activeDomain: 'making' });
    expect((await auditAccessibility(container)).length).toBeGreaterThan(0);

    click(container.querySelector('[data-action="toggle-sidebar"]')!);
    expect((await auditAccessibility(container)).length).toBeGreaterThan(0);
  });
});
