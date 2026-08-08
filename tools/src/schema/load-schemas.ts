import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const schemaDir = path.join(repoRoot, 'schema');

const SCHEMA_FILES = [
  'common.schema.json',
  'tree.schema.json',
  'domains.schema.json',
  'facets.schema.json',
  'map.schema.json',
  'export.schema.json',
  'compiled-tree.schema.json',
  'manifest.schema.json',
] as const;

export function loadSchema(name: string): object {
  const raw = readFileSync(path.join(schemaDir, name), 'utf8');
  return JSON.parse(raw) as object;
}

export function createValidator(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const file of SCHEMA_FILES) {
    ajv.addSchema(loadSchema(file));
  }
  return ajv;
}

export function compileSchema(ajv: Ajv2020, name: string) {
  const schema = loadSchema(name);
  const id = (schema as { $id?: string }).$id;
  if (id && ajv.getSchema(id)) {
    const compiled = ajv.getSchema(id);
    if (!compiled) {
      throw new Error(`Failed to retrieve compiled schema for ${name}`);
    }
    return compiled;
  }
  return ajv.compile(schema);
}

export function loadJsonFixture<T = unknown>(relativePath: string): T {
  const raw = readFileSync(path.join(repoRoot, relativePath), 'utf8');
  return JSON.parse(raw) as T;
}

export function loadYamlFixture<T = unknown>(relativePath: string): T {
  const raw = readFileSync(path.join(repoRoot, relativePath), 'utf8');
  return parseYaml(raw) as T;
}

export function validateFixture(
  validate: ReturnType<Ajv2020['compile']>,
  data: unknown,
): boolean {
  return validate(data) === true;
}
