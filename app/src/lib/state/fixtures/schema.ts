/**
 * `schema/export.schema.json` under Ajv, **for tests only** (T16).
 *
 * The app does not ship a validator (§7.3, §17.1) — `validate-export.ts` is the
 * hand-written client check. This module exists so the two can be compared: the
 * schema is the contract §14.6 names, and a hand-written validator that drifted
 * from it would be a hand-written validator that accepts files the format does
 * not define, in the one place where the consumer is users forever.
 *
 * Ajv resolves here through the workspace root's `node_modules`, and no
 * non-test module imports this file — asserted by `import.test.ts`, since a
 * stray import would put a schema engine in the bundle.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

/** `app/` is the workspace root at test time; the schemas live beside it. */
const SCHEMA_DIR = join(process.cwd(), '..', 'schema');

const load = (name: string): object =>
  JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8')) as object;

export function exportSchemaValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(load('common.schema.json'));
  const validate = ajv.compile(load('export.schema.json'));

  return (value: unknown): { valid: boolean; errors: string } => ({
    valid: validate(value) === true,
    errors: (validate.errors ?? [])
      .map((error) => `${error.instancePath} ${error.message}`)
      .join('; '),
  });
}

export function loadExportFixture<T = unknown>(name: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'src/lib/state/fixtures/export', `${name}.json`), 'utf8'),
  ) as T;
}
