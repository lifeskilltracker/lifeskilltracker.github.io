// @vitest-environment jsdom

/**
 * §12.5's one dismissible summary, and R-16 stated in the UI rather than only in
 * the spec (T17).
 *
 * With no telemetry (§16.5, R-15) this component is the only channel through
 * which a user learns that a content release touched their records, so "renders
 * at all", "renders once", and "does not render for nothing" are three separate
 * assertions rather than one.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MigrationReport } from '$lib/types';
import MigrationSummary from './MigrationSummary.svelte';
import { cleanup, click, render } from './test-harness.svelte.js';

afterEach(cleanup);

function report(over: Partial<MigrationReport> = {}): MigrationReport {
	return {
		treeId: 'cooking',
		fromVersion: 1,
		toVersion: 2,
		changed: true,
		entries: [
			{
				uid: 'q4np8w2r',
				title: 'Sharpen a knife',
				op: 'split',
				outcome: 'rewritten',
				became: ['m3xk90ab', 'v8t2ncq5']
			}
		],
		partialMerge: false,
		attainedLevel: { before: 2, after: 2 },
		...over
	};
}

describe('§12.5 — the summary', () => {
	it('renders exactly once for a migration that changed something', () => {
		const { container } = render(MigrationSummary, {
			report: report(),
			ondismiss: () => undefined
		});

		expect(container.querySelectorAll('[data-migration-summary]')).toHaveLength(1);
		expect(container.querySelectorAll('[data-migration-entries] li')).toHaveLength(1);
		expect(container.textContent).toContain('Sharpen a knife');
	});

	it('renders nothing at all for a report that changed nothing', () => {
		// §12.6's forced replay walks the whole ledger and usually mutates
		// nothing; a twelve-skill import must not produce twelve summaries.
		const { container } = render(MigrationSummary, {
			report: report({ changed: false, entries: [] }),
			ondismiss: () => undefined
		});

		expect(container.querySelector('[data-migration-summary]')).toBeNull();
	});

	it('is dismissible', () => {
		const ondismiss = vi.fn();
		const { container } = render(MigrationSummary, { report: report(), ondismiss });

		click(container.querySelector('[data-action="dismiss-migration"]')!);

		expect(ondismiss).toHaveBeenCalledTimes(1);
	});

	it('names R-16’s loss and points at the retired achievements', () => {
		const { container } = render(MigrationSummary, {
			report: report({
				partialMerge: true,
				entries: [
					{
						uid: 'm3xk90ab',
						title: 'Taper a blade',
						op: 'merged',
						outcome: 'orphaned',
						became: []
					}
				],
				attainedLevel: { before: 3, after: 2 }
			}),
			ondismiss: () => undefined
		});

		const loss = container.querySelector('[data-partial-merge]')!;
		expect(loss.textContent).toContain('no longer count towards your level');
		// The predecessors survive as orphans, and the sentence has to say where.
		expect(loss.querySelector('a')?.getAttribute('href')).toContain('/data');
		expect(loss.textContent).toContain('retired achievements');
	});

	it('states a rank change rather than leaving it to be discovered', () => {
		// §11.10: a migration is the one path that changes a rank with no user
		// action, so it is the one that most needs saying out loud.
		const { container } = render(MigrationSummary, {
			report: report({ attainedLevel: { before: 4, after: 2 } }),
			ondismiss: () => undefined
		});

		expect(container.querySelector('[data-rank-change]')?.textContent).toContain('2');
		expect(container.querySelector('[data-rank-change]')?.textContent).toContain('4');
	});

	it('says nothing about the rank when the rank did not move', () => {
		const { container } = render(MigrationSummary, {
			report: report(),
			ondismiss: () => undefined
		});

		expect(container.querySelector('[data-rank-change]')).toBeNull();
	});
});
