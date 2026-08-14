/**
 * §11.6 and §11.7 — the contribution table, the bands, and the three domain
 * rollups, checked against the figures the architecture quotes.
 *
 * The quoted figures are load-bearing claims, not illustrations: "depth beats
 * breadth" (R-19) is a number in this file, and so are the two limits §11.6
 * admits to. Testing them here is what stops a future retune from moving the
 * product's argument without anyone noticing.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DomainSkillRow, Taxonomy } from '$lib/types';
import { CONTRIBUTION, K, contribution } from './table.js';
import { BANDS, bandFor } from './bands.js';
import { domainScores } from './domain.js';

const DIR = fileURLToPath(new URL('.', import.meta.url));
/** `app/src` — the band-threshold gate covers components, not just this engine. */
const SRC = fileURLToPath(new URL('../../', import.meta.url));

/** A taxonomy carrying only what `domainScores` reads: the domain ids. */
function taxonomyOf(...ids: string[]): Taxonomy {
  return {
    domains: ids.map((id) => ({
      id,
      title: id,
      blurb: '',
      palette: { base: '#000000', accent: '#ffffff' },
    })),
    facets: [],
    map: { regions: [] },
  } as unknown as Taxonomy;
}

let rowCount = 0;
function row(domain: string, attainedLevel: number, lastActivityAt = '2026-01-01T00:00:00.000Z'): DomainSkillRow {
  return { treeId: `t${(rowCount += 1)}`, domain, attainedLevel, lastActivityAt };
}

/** `fill` for a single skill at level L, the figure §11.6's table quotes. */
function loneFill(level: number): number {
  return domainScores(taxonomyOf('d'), [row('d', level)]).get('d')!.fill;
}

describe('§11.6 — the contribution table is data', () => {
  it('ships the ten normative integers and K', () => {
    expect(CONTRIBUTION).toEqual([8, 19, 32, 45, 60, 75, 91, 108, 125, 142]);
    expect(K).toBe(48);
  });

  it('reproduces Math.round(L ** 1.25 * 8) for L = 1..10 — provenance, not behaviour', () => {
    for (let level = 1; level <= 10; level += 1) {
      expect(contribution(level)).toBe(Math.round(level ** 1.25 * 8));
    }
  });

  it('contributes exactly 0 at level 0', () => {
    expect(contribution(0)).toBe(0);
  });
});

describe('§11.6 — score', () => {
  it('sums contribution(attainedLevel) over the domain rows', () => {
    const scores = domainScores(taxonomyOf('a'), [row('a', 1), row('a', 4)]);

    expect(scores.get('a')!.score).toBe(CONTRIBUTION[0] + CONTRIBUTION[3]);
  });

  it('counts a level-0 skill as 0', () => {
    const scores = domainScores(taxonomyOf('a'), [row('a', 0), row('a', 3)]);

    expect(scores.get('a')!.score).toBe(contribution(3));
  });

  it('reads the row’s primary domain only — a secondary domain scores nowhere', () => {
    // `DomainSkillRow` carries one domain by construction (§14.4). A row with a
    // stray `secondaryDomains` field must contribute to that domain's score
    // nowhere, which is what makes the row type's single field a real rule.
    const withSecondaries = { ...row('a', 5), secondaryDomains: ['b'] } as DomainSkillRow;
    const scores = domainScores(taxonomyOf('a', 'b'), [withSecondaries]);

    expect(scores.get('a')!.score).toBe(contribution(5));
    expect(scores.get('b')!.score).toBe(0);
    expect(scores.get('b')!.breadth).toBe(0);
  });

  it('raises a domain by exactly table[4] - table[1] when one skill moves 1 → 4 (§11.3)', () => {
    const before = domainScores(taxonomyOf('a'), [row('a', 1)]).get('a')!.score;
    const after = domainScores(taxonomyOf('a'), [row('a', 4)]).get('a')!.score;

    expect(after - before).toBe(CONTRIBUTION[3] - CONTRIBUTION[0]);
    expect(after - before).toBe(37);
  });
});

describe('§11.6 — fill, and the claims it makes', () => {
  it('is s / (s + K)', () => {
    const score = domainScores(taxonomyOf('a'), [row('a', 6)]).get('a')!.score;

    expect(loneFill(6)).toBeCloseTo(score / (score + K), 12);
  });

  it('reproduces the quoted lone-skill curve', () => {
    const quoted = [0.143, 0.284, 0.4, 0.484, 0.556, 0.61, 0.655, 0.692, 0.723, 0.747];
    for (let level = 1; level <= 10; level += 1) {
      expect(loneFill(level)).toBeCloseTo(quoted[level - 1], 3);
    }
  });

  it('lets one skill at L10 beat five at L2 — the depth premium (R-19)', () => {
    const deep = loneFill(10);
    const broad = domainScores(
      taxonomyOf('a'),
      Array.from({ length: 5 }, () => row('a', 2)),
    ).get('a')!.fill;

    expect(deep).toBeCloseTo(0.747, 3);
    expect(broad).toBeCloseTo(0.664, 3);
    expect(deep).toBeGreaterThan(broad);
  });

  it('admits its limit: ten at L2 outscores one at L9, and that is not a bug', () => {
    const ten = domainScores(
      taxonomyOf('a'),
      Array.from({ length: 10 }, () => row('a', 2)),
    ).get('a')!.fill;

    expect(ten).toBeCloseTo(0.798, 3);
    expect(loneFill(9)).toBeCloseTo(0.723, 3);
    expect(ten).toBeGreaterThan(loneFill(9));
  });

  it('never saturates: eight skills at L10 reach ≈0.959, still under 1', () => {
    const eight = domainScores(
      taxonomyOf('a'),
      Array.from({ length: 8 }, () => row('a', 10)),
    ).get('a')!.fill;

    expect(eight).toBeCloseTo(0.959, 3);
    expect(eight).toBeLessThan(1);
  });
});

describe('§14.4 — the returned map is total over the taxonomy', () => {
  it('returns an entry per domain, with empty domains fully zeroed', () => {
    const ids = ['making', 'mind', 'body', 'home', 'money', 'people', 'place', 'work'];
    const scores = domainScores(taxonomyOf(...ids), [row('mind', 3), row('home', 1)]);

    expect(scores.size).toBe(8);
    expect([...scores.keys()].sort()).toEqual([...ids].sort());
    for (const id of ids) {
      if (id === 'mind' || id === 'home') continue;
      expect(scores.get(id)).toEqual({
        domain: id,
        score: 0,
        fill: 0,
        breadth: 0,
        lastActivityAt: null,
      });
    }
  });

  it('ignores a row whose domain is in no taxonomy entry (T26/F22)', () => {
    const scores = domainScores(taxonomyOf('a'), [row('a', 2), row('ghost', 10)]);

    expect(scores.size).toBe(1);
    expect(scores.get('a')!.score).toBe(contribution(2));
  });
});

describe('§11.7 — breadth and recency', () => {
  it('counts started skills regardless of level', () => {
    const scores = domainScores(taxonomyOf('a'), [row('a', 0), row('a', 0), row('a', 7)]);

    expect(scores.get('a')!.breadth).toBe(3);
  });

  it('reports breadth without score when every skill sits at level 0', () => {
    const scores = domainScores(taxonomyOf('a'), [row('a', 0), row('a', 0)]);
    const domain = scores.get('a')!;

    // The two channels are independent: `Quiet` beside a started count of two.
    expect(domain.score).toBe(0);
    expect(domain.fill).toBe(0);
    expect(domain.breadth).toBe(2);
    expect(bandFor(domain.fill)).toBe(BANDS[0].name);
  });

  it('takes the maximum lastActivityAt over the domain rows', () => {
    const scores = domainScores(taxonomyOf('a'), [
      row('a', 1, '2026-03-12T09:00:00.000Z'),
      row('a', 2, '2025-11-01T23:59:59.999Z'),
      row('a', 0, '2026-03-11T10:00:00.000Z'),
    ]);

    expect(scores.get('a')!.lastActivityAt).toBe('2026-03-12T09:00:00.000Z');
  });

  it('is null only for a domain with no started skills (T26/F19)', () => {
    const scores = domainScores(taxonomyOf('a', 'b'), [row('a', 0)]);

    // A level-0 skill is still a started skill, so its date survives.
    expect(scores.get('a')!.lastActivityAt).not.toBeNull();
    expect(scores.get('b')!.lastActivityAt).toBeNull();
  });

  it('rejects any timestamp that is not §12.2’s fixed-precision UTC form', () => {
    // §12.2: "correct only if the format AND PRECISION never vary." Both halves
    // are load-bearing and both fail silently.
    //
    // Zone: `2026-03-12T09:00:00+02:00` sorts after `2026-03-12T10:00:00Z`
    // while being the earlier instant.
    expect(() =>
      domainScores(taxonomyOf('a'), [row('a', 1, '2026-03-12T09:00:00+02:00')]),
    ).toThrow(/§12\.2/);

    // Precision: `Z` (0x5A) sorts above `.` (0x2E), so a second-precision
    // stamp beats a later millisecond-precision one. The store never writes
    // one (`toISOString`), but an imported file could carry one — so the
    // engine refuses it rather than mis-ordering it.
    expect(() =>
      domainScores(taxonomyOf('a'), [
        row('a', 1, '2026-03-12T09:00:00.500Z'),
        row('a', 1, '2026-03-12T09:00:00Z'),
      ]),
    ).toThrow(/§12\.2/);

    const uniform = domainScores(taxonomyOf('a'), [
      row('a', 1, '2026-03-12T09:00:00.000Z'),
      row('a', 1, '2026-03-12T09:00:00.500Z'),
    ]);
    expect(uniform.get('a')!.lastActivityAt).toBe('2026-03-12T09:00:00.500Z');
  });
});

describe('§3.3, §14.4 — the map renders before any bundle is fetched', () => {
  it('never names a compiled tree in domain.ts', () => {
    // The contractual property, in the only form a test can hold it: no tree
    // type in the signature, no loader import. `purity.test.ts` holds the
    // import half over the whole directory; this holds the signature half,
    // which is the one that would silently reintroduce the dependency.
    const text = readFileSync(`${DIR}domain.ts`, 'utf8');

    expect(text).not.toContain('CompiledTree');
    expect(text).not.toMatch(/from\s+['"]\$lib\/content/);
  });

  it('scores fifty skills in under 1 ms (§17.3)', () => {
    const ids = ['making', 'mind', 'body', 'home', 'money', 'people', 'place', 'work'];
    const taxonomy = taxonomyOf(...ids);
    const skills = Array.from({ length: 50 }, (_, i) => row(ids[i % ids.length], (i % 10) + 1));

    const samples: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const start = performance.now();
      domainScores(taxonomy, skills);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);

    expect(samples[Math.floor(samples.length / 2)]).toBeLessThan(1);
  });
});

describe('§11.6 — bands are one table and one resolver', () => {
  it('ships an ascending table starting at 0, every bound inside [0, 1)', () => {
    expect(BANDS.length).toBeGreaterThan(0);
    expect(BANDS[0].from).toBe(0);
    for (const [i, band] of BANDS.entries()) {
      expect(band.from).toBeGreaterThanOrEqual(0);
      expect(band.from).toBeLessThan(1);
      if (i > 0) expect(band.from).toBeGreaterThan(BANDS[i - 1].from);
    }
  });

  it('resolves half-open [from, next) at every boundary', () => {
    expect(bandFor(0)).toBe(BANDS[0].name);
    expect(bandFor(0.9999)).toBe(BANDS[BANDS.length - 1].name);

    for (const [i, band] of BANDS.entries()) {
      expect(bandFor(band.from)).toBe(band.name);
      if (i > 0) {
        // Just below a boundary is still the band beneath it.
        expect(bandFor(band.from - 1e-9)).toBe(BANDS[i - 1].name);
      }
    }
  });

  it('puts one skill taken all the way in the top band — the R-19 landmark', () => {
    expect(bandFor(loneFill(10))).toBe(BANDS[BANDS.length - 1].name);
    expect(BANDS[BANDS.length - 1].name).toBe('Deep');
  });

  it('names the five §11.6 bands in order', () => {
    expect(BANDS.map((b) => b.name)).toEqual([
      'Quiet',
      'Emerging',
      'Moderate',
      'Active',
      'Deep',
    ]);
  });

  it('types the band name as string, so a rename is a one-line data edit', () => {
    // If `name` were a closed union this would not compile.
    const renamed: (typeof BANDS)[number]['name'] = 'Dormant';
    expect(renamed).toBe('Dormant');
  });

  it('keeps every numeric band threshold inside bands.ts', () => {
    // The mechanical form of "one table, one resolver, no thresholds in
    // components" — T13 and T20 both consume `bandFor`, and the day one of them
    // inlines a boundary as a literal the table stops being tunable.
    // Matched with a trailing-digit guard, so §11.6's quoted fill figures
    // (0.556, 0.723) are not mistaken for the boundaries they sit beside.
    const thresholds = BANDS.slice(1).map((b) => ({
      literal: String(b.from),
      pattern: new RegExp(`${String(b.from).replace('.', '\\.')}(?!\\d)`),
    }));
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      if (file.endsWith('/bands.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const { literal, pattern } of thresholds) {
        if (pattern.test(text)) offenders.push(`${relative(SRC, file)}: ${literal}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the band out of DomainScore', () => {
    const text = readFileSync(`${DIR}domain.ts`, 'utf8');

    expect(text).not.toMatch(/\bband\b/i);
    const only = domainScores(taxonomyOf('a'), [row('a', 3)]).get('a')!;
    expect(Object.keys(only).sort()).toEqual(
      ['breadth', 'domain', 'fill', 'lastActivityAt', 'score'],
    );
  });
});

/** Every `.ts` and `.svelte` file under `app/src`, so the gate covers components too. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.svelte') ? [path] : [];
  });
}
