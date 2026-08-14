// @vitest-environment jsdom

/**
 * §11.8's self-assessment flow, tested through a real mount (T15, S3).
 *
 * The estimate and the consequence arrive as callbacks the way the application
 * supplies them — from the real engine — so nothing here invents a prefix or a
 * level drop the engine would not produce.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { estimateMilestones, scoreSkill } from '$lib/scoring';
import { makeScoringTree, progressOf, uidOf, type LevelSpec } from '$lib/scoring/fixtures.js';
import type { CompiledTree, MilestoneState } from '$lib/types';
import AssessmentFlow from './AssessmentFlow.svelte';
import type { MilestoneIntent, UncheckConsequence } from './intents.js';
import { cleanup, click, render } from './test-harness.svelte.js';

afterEach(cleanup);

/** Four levels, three milestones each — small enough to read in an assertion. */
function tree(): CompiledTree {
	const levels: LevelSpec[] = [];
	for (let level = 1; level <= 4; level += 1) {
		levels.push({ level, milestones: [1, 2, 3].map((i) => `l${level}-m${i}`) });
	}
	const subject = makeScoringTree({ id: 'cooking', levels });
	// §11.10's sentences name the skill, so the fixture needs a real title.
	subject.title = 'Cooking';
	return subject;
}

interface MountOptions {
	states?: Record<string, MilestoneState>;
	onintent?: (intent: MilestoneIntent) => void;
	placementConsequence?: (selection: readonly string[]) => UncheckConsequence | null;
}

function mount(subject: CompiledTree, options: MountOptions = {}) {
	const progress = scoreSkill(subject, progressOf(subject, options.states ?? {}));
	return render(AssessmentFlow, {
		tree: subject,
		progress,
		estimate: (level: number) => estimateMilestones(subject, level),
		...options
	});
}

const button = (container: HTMLElement, action: string): HTMLButtonElement => {
	const found = container.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
	if (found === null) throw new Error(`no button for "${action}"`);
	return found;
};

const row = (container: HTMLElement, subject: CompiledTree, slug: string): HTMLLabelElement => {
	const found = container.querySelector<HTMLLabelElement>(
		`label[data-uid="${uidOf(subject, slug)}"]`
	);
	if (found === null) throw new Error(`no review row for "${slug}"`);
	return found;
};

const box = (container: HTMLElement, subject: CompiledTree, slug: string): HTMLInputElement =>
	row(container, subject, slug).querySelector('input')!;

/** Pick the coarse level the way a user does, through the real `<select>`. */
function chooseLevel(container: HTMLElement, level: number): void {
	const select = container.querySelector<HTMLSelectElement>('#coarse-level')!;
	select.value = String(level);
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('F30 — the estimator pre-checks a contiguous prefix', () => {
	it('ticks every milestone in levels 1..L and nothing above it', () => {
		const subject = tree();
		const { container } = mount(subject);

		chooseLevel(container, 2);
		click(button(container, 'estimate'));

		for (const slug of ['l1-m1', 'l1-m2', 'l1-m3', 'l2-m1', 'l2-m2', 'l2-m3']) {
			expect(box(container, subject, slug).checked).toBe(true);
		}
		for (const slug of ['l3-m1', 'l4-m3']) {
			expect(box(container, subject, slug).checked).toBe(false);
		}
	});

	it('announces every pre-checked milestone as pre-checked (§15.6)', () => {
		const subject = tree();
		const { container } = mount(subject);

		chooseLevel(container, 1);
		click(button(container, 'estimate'));

		// The marker is inside the label, so it is part of the checkbox's
		// accessible name rather than decoration.
		expect(row(container, subject, 'l1-m1').textContent).toContain('suggested');
		expect(row(container, subject, 'l1-m1').dataset.prechecked).toBe('true');
	});

	it('does not mark work the user really did as a suggestion', () => {
		const subject = tree();
		const { container } = mount(subject, { states: { 'l1-m1': 'complete' } });

		chooseLevel(container, 1);
		click(button(container, 'estimate'));

		expect(box(container, subject, 'l1-m1').checked).toBe(true);
		expect(row(container, subject, 'l1-m1').dataset.prechecked).toBe('false');
		expect(row(container, subject, 'l1-m2').dataset.prechecked).toBe('true');
	});

	it('makes each pre-check individually reversible without disturbing the others', () => {
		const subject = tree();
		const { container } = mount(subject);

		chooseLevel(container, 2);
		click(button(container, 'estimate'));
		click(box(container, subject, 'l2-m2'));

		expect(box(container, subject, 'l2-m2').checked).toBe(false);
		for (const slug of ['l1-m1', 'l1-m2', 'l1-m3', 'l2-m1', 'l2-m3']) {
			expect(box(container, subject, slug).checked).toBe(true);
		}
		// Corrected, so it is no longer the estimator's guess.
		expect(row(container, subject, 'l2-m2').dataset.prechecked).toBe('false');
	});

	it('accepting the estimate unmodified records exactly the prefix', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, { onintent: (intent) => intents.push(intent) });

		chooseLevel(container, 2);
		click(button(container, 'estimate'));
		click(button(container, 'save'));

		expect(intents.every((intent) => intent.kind === 'complete')).toBe(true);
		expect(intents.map((intent) => intent.uid).sort()).toEqual(
			estimateMilestones(subject, 2).sort()
		);
	});
});

describe('F29 — placement is bulk completion and nothing else', () => {
	it('opens on what is already recorded rather than on an empty list', () => {
		const subject = tree();
		const { container } = mount(subject, { states: { 'l1-m2': 'complete' } });

		click(button(container, 'placement'));

		expect(box(container, subject, 'l1-m2').checked).toBe(true);
		expect(box(container, subject, 'l1-m1').checked).toBe(false);
	});

	it('emits one complete intent per newly ticked milestone and nothing else', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, {
			states: { 'l1-m2': 'complete' },
			onintent: (intent) => intents.push(intent)
		});

		click(button(container, 'placement'));
		click(box(container, subject, 'l1-m1'));
		click(button(container, 'save'));

		expect(intents).toEqual([{ kind: 'complete', uid: uidOf(subject, 'l1-m1') }]);
	});

	it('un-ticking a recorded milestone clears the record rather than inventing a state', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, {
			states: { 'l1-m2': 'complete' },
			onintent: (intent) => intents.push(intent)
		});

		click(button(container, 'placement'));
		click(box(container, subject, 'l1-m2'));
		click(button(container, 'save'));

		// §12.2: incomplete is the absence of a record, so `undo` — never a third
		// "estimated" or "unplaced" state.
		expect(intents).toEqual([{ kind: 'undo', uid: uidOf(subject, 'l1-m2') }]);
	});

	it('groups the list by level with a running count per level (§15.6)', () => {
		const subject = tree();
		const { container } = mount(subject);

		click(button(container, 'placement'));
		expect(container.querySelectorAll('fieldset[data-level]')).toHaveLength(4);
		expect(container.querySelector('[data-count="1"]')!.textContent).toContain('0 of 3');

		click(box(container, subject, 'l1-m1'));
		expect(container.querySelector('[data-count="1"]')!.textContent).toContain('1 of 3');
		expect(container.querySelector('[data-count="2"]')!.textContent).toContain('0 of 3');
	});

	it('is interruptible and resumable — the draft survives leaving the list', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, { onintent: (intent) => intents.push(intent) });

		click(button(container, 'placement'));
		click(box(container, subject, 'l3-m1'));
		click(button(container, 'pause'));

		expect(intents).toEqual([]);
		expect(container.querySelector('[data-draft]')).not.toBeNull();

		click(button(container, 'placement'));
		expect(box(container, subject, 'l3-m1').checked).toBe(true);
	});

	it('discarding a draft records nothing and forgets it', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, { onintent: (intent) => intents.push(intent) });

		click(button(container, 'placement'));
		click(box(container, subject, 'l3-m1'));
		click(button(container, 'discard'));
		click(button(container, 'placement'));

		expect(intents).toEqual([]);
		expect(box(container, subject, 'l3-m1').checked).toBe(false);
	});
});

describe('§11.10 — a placement that lowers the level says so first', () => {
	function droppingConsequence(): UncheckConsequence {
		return { before: 3, after: 1, cleared: [1, 3] };
	}

	it('states the consequence and records nothing until it is confirmed', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, {
			states: { 'l1-m1': 'complete' },
			onintent: (intent) => intents.push(intent),
			placementConsequence: droppingConsequence
		});

		click(button(container, 'placement'));
		click(box(container, subject, 'l1-m1'));
		click(button(container, 'save'));

		expect(intents).toEqual([]);
		const notice = container.querySelector('[data-consequence]')!;
		expect(notice.textContent).toContain('drops Cooking from Level 3 to Level 1');
		// §11.10's mitigation, and the reason the drop is tolerable at all.
		expect(notice.textContent).toContain('Levels 1, 3 stay cleared');

		click(button(container, 'confirm'));
		expect(intents).toEqual([{ kind: 'undo', uid: uidOf(subject, 'l1-m1') }]);
	});

	it('cancelling the intercept leaves the draft intact', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, {
			states: { 'l1-m1': 'complete' },
			onintent: (intent) => intents.push(intent),
			placementConsequence: droppingConsequence
		});

		click(button(container, 'placement'));
		click(box(container, subject, 'l1-m1'));
		click(button(container, 'save'));
		click(button(container, 'cancel'));

		expect(intents).toEqual([]);
		expect(container.querySelector('[data-consequence]')).toBeNull();
		expect(box(container, subject, 'l1-m1').checked).toBe(false);
	});

	it('does not intercept a placement that only raises the level', () => {
		const subject = tree();
		const consequence = vi.fn(() => null);
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, {
			onintent: (intent) => intents.push(intent),
			placementConsequence: consequence
		});

		click(button(container, 'placement'));
		click(box(container, subject, 'l1-m1'));
		click(button(container, 'save'));

		expect(consequence).toHaveBeenCalledOnce();
		expect(intents).toHaveLength(1);
		expect(container.querySelector('[data-consequence]')).toBeNull();
	});
});

describe('§15.8 — the flow is operable by keyboard alone', () => {
	it('offers only natively focusable controls, with no synthetic tab stops', () => {
		const subject = tree();
		const { container } = mount(subject);
		click(button(container, 'placement'));

		const interactive = container.querySelectorAll('button, input, select, [tabindex]');
		expect(interactive.length).toBeGreaterThan(0);
		for (const element of interactive) {
			expect(['BUTTON', 'INPUT', 'SELECT']).toContain(element.tagName);
			expect(element.getAttribute('tabindex')).toBeNull();
		}
	});

	it('submits the review from the keyboard, without a pointer', () => {
		const subject = tree();
		const intents: MilestoneIntent[] = [];
		const { container } = mount(subject, { onintent: (intent) => intents.push(intent) });

		click(button(container, 'placement'));
		const checkbox = box(container, subject, 'l1-m1');
		checkbox.focus();
		// What Enter/Space on a checkbox produces in a browser.
		checkbox.click();

		container
			.querySelector('form[data-review]')!
			.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

		expect(intents).toEqual([{ kind: 'complete', uid: uidOf(subject, 'l1-m1') }]);
	});
});

describe('§3.2 — the flow has no write path of its own', () => {
	it('imports nothing from lib/state and names no storage API', () => {
		const source = readFileSync(
			join(process.cwd(), 'src/lib/components/AssessmentFlow.svelte'),
			'utf8'
		);
		for (const forbidden of [
			['$lib/st', 'ate'].join(''),
			['../st', 'ate'].join(''),
			['setMilestone', 'State'].join(''),
			['indexed', 'DB'].join('')
		]) {
			expect(`${forbidden}: ${source.includes(forbidden)}`).toBe(`${forbidden}: false`);
		}
	});
});
