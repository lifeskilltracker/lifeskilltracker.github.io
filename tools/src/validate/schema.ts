import { createValidator, compileSchema } from '../schema/load-schemas.js';
import {
  instancePathToSegments,
  positionAtPath,
  positionForInstancePath,
} from '../shared/yaml-source.js';
import type { ValidationReport } from './report.js';
import type { ParsedYaml } from '../shared/yaml-source.js';

const ajv = createValidator();

const validators = {
  tree: compileSchema(ajv, 'tree.schema.json'),
  domains: compileSchema(ajv, 'domains.schema.json'),
  facets: compileSchema(ajv, 'facets.schema.json'),
  map: compileSchema(ajv, 'map.schema.json'),
} as const;

export type SchemaKind = keyof typeof validators;

export function validateSchemaDocument(
  kind: SchemaKind,
  loaded: ParsedYaml<unknown>,
  report: ValidationReport,
): boolean {
  const validate = validators[kind];
  const ok = validate(loaded.data);
  if (ok) {
    return true;
  }
  for (const error of validate.errors ?? []) {
    const instancePath = error.instancePath ?? '';
    const position = positionForInstancePath(loaded.doc, instancePath, loaded.lineCounter);
    const params = error.params ? ` (${JSON.stringify(error.params)})` : '';
    report.add({
      file: loaded.path,
      line: position.line,
      column: position.column,
      rule: 'schema',
      message: `${error.message ?? 'schema validation failed'} at ${instancePath || '/'}${params}`,
    });
  }
  return false;
}

export function pathPosition(loaded: ParsedYaml<unknown>, jsonPath: Array<string | number>) {
  return positionAtPath(loaded.doc, jsonPath, loaded.lineCounter);
}

export function segmentsFromInstancePath(instancePath: string): Array<string | number> {
  return instancePathToSegments(instancePath);
}
