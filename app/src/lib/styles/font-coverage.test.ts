/**
 * §4.5's closed glyph set, checked against the shipped subset.
 *
 * The set is **enumerated from the content files**, never from a list kept here.
 * A hand-written list is the failure mode this guards: it agrees with the font on
 * the day it is written and then a domain is renamed, the glyph it needed is not in
 * the subset, and the label renders in the fallback face with no error anywhere.
 * Deriving the set means adding a domain either passes or fails this test.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { woff2Codepoints } from './woff2-cmap.js';

const FONT = fileURLToPath(new URL('./alegreya-sc-subset.woff2', import.meta.url));
const REPO = new URL('../../../../', import.meta.url);

function readContent(relative: string): string {
	return readFileSync(fileURLToPath(new URL(relative, REPO)), 'utf8');
}

/** Every title and subregion title in the taxonomy — the labels the map draws. */
function taxonomyText(): string {
	const yaml = readContent('content/taxonomy/domains.yaml');
	return [...yaml.matchAll(/title:\s*(.+?)\s*(?:\}|$)/gm)].map((match) => match[1]).join('');
}

/**
 * §11.6's bands and §11.3's tiers, read from the engine rather than retyped. Both
 * are drawn in the display face (§4.5) and both are the kind of vocabulary F18
 * expects to be edited from real use.
 */
function engineNames(): string {
	const bands = readContent('app/src/lib/scoring/bands.ts');
	const levels = readContent('app/src/lib/scoring/levels.ts');
	const names = [
		...[...bands.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]),
		...[...levels.matchAll(/'(Novice|Apprentice|Journeyman|Expert|Master)'/g)].map((m) => m[1])
	];
	expect(names.length).toBeGreaterThan(5);
	return names.join('');
}

/** Digits, and the punctuation the labels above actually contain. */
const NUMERALS_AND_MARKS = "0123456789 &'’.,:%()–—/-";

/** Every character the display face is asked to draw, derived from content. */
function requiredCharacters(): Set<string> {
	const required = new Set(
		[taxonomyText(), engineNames(), NUMERALS_AND_MARKS].join('').split('')
	);
	// Both cases, because the face is set in small caps: a small-caps font maps
	// lowercase onto cap forms, so a label needs whichever half it is written in.
	for (const character of [...required]) {
		required.add(character.toUpperCase());
		required.add(character.toLowerCase());
	}
	return required;
}

describe('§4.5 — the display face covers the closed glyph set', () => {
	it('the set is small enough for the subsetting argument to hold', () => {
		// §4.5 argues the face is affordable because the set is closed and tiny.
		// If this ever runs away, the budget argument has quietly stopped being true.
		const required = requiredCharacters();
		expect(required.size).toBeLessThan(140);
		expect(required.size).toBeGreaterThan(40);
	});

	/**
	 * The real check. A glyph the subset lacks has no error path — that one label
	 * silently renders in the fallback face — so the cmap is the only place it can
	 * be caught.
	 */
	it('draws every character the content actually asks for', () => {
		const available = woff2Codepoints(readFileSync(FONT));
		const missing = [...requiredCharacters()]
			.filter((character) => !available.has(character.codePointAt(0)!))
			.sort();
		expect(missing).toEqual([]);
	});

	it('stays inside A4’s 12 kB row', () => {
		const bytes = readFileSync(FONT).length;
		expect(bytes).toBeLessThanOrEqual(12_000);
	});

	it('carries its licence beside it, as a self-hosted OFL face must', () => {
		const licence = readFileSync(
			fileURLToPath(new URL('./alegreya-sc-OFL.txt', import.meta.url)),
			'utf8'
		);
		expect(licence).toContain('SIL Open Font License');
	});
});
