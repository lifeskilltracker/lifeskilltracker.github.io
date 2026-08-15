// @vitest-environment jsdom

/**
 * §12.5's retired-achievements list (T17).
 *
 * "Orphans keep their frozen title, timestamp, and note ... and surface in a
 * retired achievements section rather than vanishing." Each of those four is
 * asserted, because dropping one is exactly the Forge failure §12.5 names.
 */

import { afterEach, describe, expect, it } from 'vitest';
import RetiredAchievements from './RetiredAchievements.svelte';
import { cleanup, render } from './test-harness.svelte.js';

afterEach(cleanup);

const ORPHANS = [
	{
		uid: 'h8dq37nc',
		treeId: 'cooking',
		title: 'Fry an egg',
		state: 'complete' as const,
		at: '2027-03-01T09:00:00.000Z',
		note: 'first one that did not break',
		reason: 'retired' as const
	},
	{
		uid: 'm3xk90ab',
		treeId: 'cooking',
		title: 'Taper a blade',
		state: 'complete' as const,
		at: '2027-04-02T10:00:00.000Z',
		reason: 'merged' as const
	}
];

describe('§12.5 — retired achievements', () => {
	it('lists every orphan with its title, date, note and reason', () => {
		const { container } = render(RetiredAchievements, { orphans: ORPHANS });

		const rows = [...container.querySelectorAll('[data-orphans] li')];
		expect(rows).toHaveLength(2);

		expect(rows[0].textContent).toContain('Fry an egg');
		expect(rows[0].textContent).toContain('2027-03-01T09:00:00.000Z');
		expect(rows[0].textContent).toContain('first one that did not break');
		expect(rows[0].getAttribute('data-reason')).toBe('retired');
		// §15.4: the reason is said in words, not encoded in an attribute alone.
		expect(rows[0].textContent).toContain('removed from the skill');

		// An accepted loss and a record the pass could not account for must not
		// read the same, which is why `merged` is its own reason (T26/F3).
		expect(rows[1].textContent).toContain('merged into a milestone you have not completed');
	});

	it('renders no link, because an orphan has no slug to link to', () => {
		// §12.2 omits `slug` deliberately: a retained one would resolve to nothing
		// while looking exactly like a slug that resolves.
		const { container } = render(RetiredAchievements, { orphans: ORPHANS });
		expect(container.querySelectorAll('[data-orphans] a')).toHaveLength(0);
	});
});
