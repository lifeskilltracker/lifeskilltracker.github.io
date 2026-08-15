/**
 * `npm run check:budget` — the §17.1 gate `app: build` runs after `vite build`.
 *
 * It lives beside `check-archetype-free.sh` rather than inside the `lst` CLI on
 * purpose: §6.1's subcommand table is the *content* toolchain and is complete,
 * and this measures the app's build output. Adding a row there would make the
 * table say something untrue about what authors need.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { budgetCommand } from './budget.js';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../../..');

process.exit(
  budgetCommand({
    buildDir: resolve(repoRoot, 'app/build'),
    routeManifest: resolve(repoRoot, 'app/.svelte-kit/generated/client/app.js'),
  }),
);
