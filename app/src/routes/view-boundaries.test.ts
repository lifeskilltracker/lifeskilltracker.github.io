/**
 * §13.4's two view-layer rules, checked over the files themselves (T14, §14.7).
 *
 * `eslint.config.js` carries the same two rules and is the half that fires in
 * the editor. This is the half that fires in CI whether or not lint ran, and it
 * is worth having twice for the same reason §14.7 lists both a lint rule and a
 * grep gate: the constraint is architectural, and a config file is one `ignores`
 * entry away from silently covering nothing.
 *
 * The rules restated, because a test that only greps is a test whose reason is
 * lost the first time it fails:
 *
 * - **`TreeView` is the only view-layer file that names the Layout Engine**, and
 *   it names only its *type*. §8.6 requires that toggling a milestone never
 *   re-runs layout, and that is structural only if the renderer cannot call it.
 * - **No route imports the Scoring Engine.** Scores arrive as derived props;
 *   the derivations live in `lib/actions`, the one layer §14.1 lets hold both a
 *   manifest and a `SKILL` row (T26/F4).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...sourceFiles(path));
			continue;
		}
		if (!/\.(ts|svelte)$/.test(entry.name)) continue;
		// Fixtures and specs may build whatever they need to exercise a component.
		if (/\.(test|spec)\.ts$/.test(entry.name)) continue;
		out.push(path);
	}
	return out;
}

const relative = (path: string) => path.slice(SRC.length);

const VIEW_FILES = [
	...sourceFiles(join(SRC, 'routes')),
	...sourceFiles(join(SRC, 'lib', 'components'))
];

const importsFrom = (source: string, module: string): boolean =>
	new RegExp(`from ['"]\\$lib/${module}(/[^'"]*)?['"]`).test(source);

describe('§13.4 — the Layout Engine has one consumer', () => {
	it('found the view layer at all', () => {
		// A glob that matched nothing would make every assertion below vacuous.
		expect(VIEW_FILES.length).toBeGreaterThan(10);
	});

	it('is named by TreeView alone', () => {
		const consumers = VIEW_FILES.filter((path) =>
			importsFrom(readFileSync(path, 'utf8'), 'layout')
		).map(relative);

		expect(consumers).toEqual(['lib/components/TreeView.svelte']);
	});

	it('is named there as a type, so the renderer cannot run a layout', () => {
		const source = readFileSync(join(SRC, 'lib', 'components', 'TreeView.svelte'), 'utf8');

		expect(source).toMatch(/import type \{[^}]*\} from '\$lib\/layout'/);
		// No value import, which is the whole of it: a type cannot be called.
		expect(source).not.toMatch(/import \{[^}]*\} from '\$lib\/layout'/);
	});
});

describe('§13.4 — no route imports the Scoring Engine', () => {
	it('holds for every file under routes/', () => {
		const consumers = sourceFiles(join(SRC, 'routes'))
			.filter((path) => importsFrom(readFileSync(path, 'utf8'), 'scoring'))
			.map(relative);

		expect(consumers).toEqual([]);
	});
});
