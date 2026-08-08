import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';

import { compileSchema, createValidator } from '../schema/load-schemas.js';

let compiledTreeValidator: ReturnType<typeof compileSchema> | null = null;
let manifestValidator: ReturnType<typeof compileSchema> | null = null;

function getCompiledTreeValidator(ajv: Ajv2020) {
  compiledTreeValidator ??= compileSchema(ajv, 'compiled-tree.schema.json');
  return compiledTreeValidator;
}

function getManifestValidator(ajv: Ajv2020) {
  manifestValidator ??= compileSchema(ajv, 'manifest.schema.json');
  return manifestValidator;
}

export interface OutputValidationIssue {
  artifact: string;
  message: string;
  errors: ErrorObject[];
}

function formatErrors(errors: ErrorObject[] | null | undefined): ErrorObject[] {
  return errors ?? [];
}

export function validateCompiledTree(
  bundle: unknown,
  artifact = 'compiled tree',
): OutputValidationIssue[] {
  const ajv = createValidator();
  const validate = getCompiledTreeValidator(ajv);
  if (validate(bundle)) {
    return [];
  }
  return [
    {
      artifact,
      message: `${artifact} failed schema/compiled-tree.schema.json validation`,
      errors: formatErrors(validate.errors),
    },
  ];
}

export function validateManifest(
  manifest: unknown,
  artifact = 'manifest.json',
): OutputValidationIssue[] {
  const ajv = createValidator();
  const validate = getManifestValidator(ajv);
  if (validate(manifest)) {
    return [];
  }
  return [
    {
      artifact,
      message: `${artifact} failed schema/manifest.schema.json validation`,
      errors: formatErrors(validate.errors),
    },
  ];
}

export function assertValidCompiledOutput(
  bundles: Array<{ treeId: string; bundle: unknown }>,
  manifest: unknown,
): OutputValidationIssue[] {
  const issues: OutputValidationIssue[] = [];
  for (const { treeId, bundle } of bundles) {
    issues.push(...validateCompiledTree(bundle, `tree "${treeId}"`));
  }
  issues.push(...validateManifest(manifest));
  return issues;
}
