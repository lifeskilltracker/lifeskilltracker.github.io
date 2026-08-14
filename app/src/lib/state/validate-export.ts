/**
 * `schema/export.schema.json`, hand-written for the client (§12.6, §16.3) — T16.
 *
 * **Why not Ajv.** §7.3 already refuses to ship a validator to the browser: it
 * would spend a real share of §17.1's 70 kB budget, and for *content* it would
 * re-prove what `lst compile` proved in CI. An import is the opposite case —
 * the file is genuinely untrusted, arriving from a user's disk years later —
 * so the check has to exist, but it does not have to arrive as a general
 * schema engine. This module is the narrow form, and `import.test.ts` runs the
 * real schema under Ajv over the same fixtures so the two cannot drift.
 *
 * **Reject whole, never partially apply** (§16.3). Nothing here writes; a caller
 * that validates after opening a transaction has already lost, because a read
 * failure that became a write is the one outcome §12 exists to prevent. The
 * error names the failing field's path, since "your file is invalid" is useless
 * to someone holding the only copy of their progress.
 *
 * **Two tolerances are deliberate and must not be tightened:**
 *
 * - An **unknown key on a milestone** is accepted and round-tripped. §12.8 turns
 *   the export into a ZIP carrying `photos/<uid>.webp` in phase 2, and this
 *   reservation is what keeps that from being a breaking `schemaVersion` bump
 *   (R-06). This cuts the opposite way from `tree.schema.json`, where §5.8 makes
 *   `additionalProperties: false` load-bearing — the two schemas have different
 *   jobs.
 * - `SKILL.lastActivityAt` and `MILESTONE.contentVersion` may be **absent**.
 *   T26/F19 and T26/F15 made both required; a file written before that is still
 *   a file someone is holding, and §5.10's migration path fills them in
 *   (`migrate-export.ts`). Absence is tolerated exactly once, on the way in.
 */

import type { ExportFile } from '$lib/types';
import {
  CURRENT_EXPORT_SCHEMA_VERSION,
  EXPORT_FORMAT,
  OLDEST_SUPPORTED_EXPORT_SCHEMA_VERSION,
} from './export-types.js';

export class ExportValidationError extends Error {
  /** The failing field, as a JSON path — `milestones[3].state`. */
  readonly path: string;

  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = 'ExportValidationError';
    this.path = path;
  }
}

/** §16.3: refuse a file from the future rather than guessing at it. */
export class ExportVersionError extends Error {
  readonly schemaVersionIn: number;

  constructor(schemaVersionIn: number) {
    super(
      `this file came from a newer version of the app (export schemaVersion ` +
        `${schemaVersionIn}; this app reads ${CURRENT_EXPORT_SCHEMA_VERSION}). ` +
        `Update the app and import it again — guessing at a format from the future ` +
        `would silently drop whatever it did not recognise.`,
    );
    this.name = 'ExportVersionError';
    this.schemaVersionIn = schemaVersionIn;
  }
}

type Row = Record<string, unknown>;

const isObject = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function required(row: Row, path: string, key: string): unknown {
  if (!(key in row) || row[key] === undefined) {
    throw new ExportValidationError(`${path}.${key}`, 'is required and missing');
  }
  return row[key];
}

function string(row: Row, path: string, key: string, { minLength = 1 } = {}): string {
  const value = required(row, path, key);
  if (typeof value !== 'string') {
    throw new ExportValidationError(`${path}.${key}`, `must be a string, got ${typeof value}`);
  }
  if (value.length < minLength) {
    throw new ExportValidationError(`${path}.${key}`, 'must not be empty');
  }
  return value;
}

function integer(row: Row, path: string, key: string, { minimum = 0, maximum = Infinity } = {}) {
  const value = required(row, path, key);
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ExportValidationError(`${path}.${key}`, `must be an integer, got ${typeof value}`);
  }
  if (value < minimum || value > maximum) {
    throw new ExportValidationError(`${path}.${key}`, `must be within ${minimum}..${maximum}`);
  }
  return value;
}

/**
 * Any parseable instant is accepted, not only §12.2's fixed form. The store
 * writes `toISOString()` and nothing else, but a file from another tool is not
 * the store, and `migrate-export.ts` normalizes on the way in — refusing a
 * timestamp we can read perfectly well would be refusing someone's data over
 * formatting.
 */
function timestamp(row: Row, path: string, key: string): string {
  const value = string(row, path, key);
  if (Number.isNaN(Date.parse(value))) {
    throw new ExportValidationError(`${path}.${key}`, `is not a readable date: "${value}"`);
  }
  return value;
}

function optionalTimestamp(row: Row, path: string, key: string): string | undefined {
  if (row[key] === undefined) return undefined;
  return timestamp(row, path, key);
}

function enumeration<T extends string>(
  row: Row,
  path: string,
  key: string,
  allowed: readonly T[],
): T {
  const value = string(row, path, key);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ExportValidationError(
      `${path}.${key}`,
      `must be one of ${allowed.join(', ')}; got "${value}"`,
    );
  }
  return value as T;
}

function array(document: Row, key: string): Row[] {
  const value = required(document, '$', key);
  if (!Array.isArray(value)) {
    throw new ExportValidationError(`$.${key}`, 'must be an array');
  }
  return value.map((entry, index) => {
    if (!isObject(entry)) {
      throw new ExportValidationError(`${key}[${index}]`, 'must be an object');
    }
    return entry;
  });
}

function noUnknownKeys(row: Row, path: string, allowed: readonly string[]): void {
  for (const key of Object.keys(row)) {
    if (!allowed.includes(key)) {
      throw new ExportValidationError(`${path}.${key}`, 'is not a field this format defines');
    }
  }
}

const DOCUMENT_KEYS = [
  'format',
  'schemaVersion',
  'exportedAt',
  'appVersion',
  'generated',
  'skills',
  'milestones',
  'orphans',
];
const SKILL_KEYS = [
  'treeId',
  'startedAt',
  'attainedLevel',
  'lastActivityAt',
  'contentVersionSeen',
  'grandfathered',
];
const ORPHAN_KEYS = ['uid', 'treeId', 'title', 'state', 'at', 'note', 'reason'];

/**
 * Reads the declared version before anything else, and refuses a newer one
 * **without validating the rest**: a file from the future may legitimately carry
 * fields this app has no rule for, and reporting them as invalid fields would
 * describe the wrong problem.
 */
export function readSchemaVersion(value: unknown): number {
  if (!isObject(value)) {
    throw new ExportValidationError('$', 'must be a JSON object');
  }
  if (value.format !== EXPORT_FORMAT) {
    throw new ExportValidationError(
      '$.format',
      `must be "${EXPORT_FORMAT}"; this does not look like a progress export`,
    );
  }
  const schemaVersion = integer(value, '$', 'schemaVersion', { minimum: 1 });
  if (schemaVersion > CURRENT_EXPORT_SCHEMA_VERSION) throw new ExportVersionError(schemaVersion);
  if (schemaVersion < OLDEST_SUPPORTED_EXPORT_SCHEMA_VERSION) {
    throw new ExportValidationError(
      '$.schemaVersion',
      `${schemaVersion} is older than this app can read ` +
        `(${OLDEST_SUPPORTED_EXPORT_SCHEMA_VERSION})`,
    );
  }
  return schemaVersion;
}

/**
 * Throws `ExportValidationError` on the first bad field. One error rather than a
 * list: the file is rejected whole either way, and the first failure is the one
 * a user can act on.
 */
export function validateExportFile(value: unknown): asserts value is ExportFile {
  readSchemaVersion(value);
  const document = value as Row;
  noUnknownKeys(document, '$', DOCUMENT_KEYS);

  timestamp(document, '$', 'exportedAt');
  string(document, '$', 'appVersion');
  timestamp(document, '$', 'generated');

  array(document, 'skills').forEach((skill, index) => {
    const path = `skills[${index}]`;
    noUnknownKeys(skill, path, SKILL_KEYS);
    string(skill, path, 'treeId');
    timestamp(skill, path, 'startedAt');
    integer(skill, path, 'attainedLevel', { minimum: 0, maximum: 10 });
    // T26/F19's tolerance: required since F19, absent in files written before.
    optionalTimestamp(skill, path, 'lastActivityAt');
    integer(skill, path, 'contentVersionSeen', { minimum: 1 });
    validateGrandfathered(skill.grandfathered, `${path}.grandfathered`);
  });

  array(document, 'milestones').forEach((milestone, index) => {
    const path = `milestones[${index}]`;
    // No `noUnknownKeys` here, and that is R-06's reservation, not an omission.
    pattern(milestone, path, 'uid', UID, 'a Crockford base32 uid (§5.4)');
    string(milestone, path, 'treeId');
    pattern(milestone, path, 'slug', SLUG, 'a slug (§5.3)');
    string(milestone, path, 'title');
    enumeration(milestone, path, 'state', ['complete', 'dismissed'] as const);
    timestamp(milestone, path, 'at');
    optionalString(milestone, path, 'note');
    // T26/F15's tolerance, for the same reason as `lastActivityAt` above.
    if (milestone.contentVersion !== undefined) {
      integer(milestone, path, 'contentVersion', { minimum: 1 });
    }
  });

  array(document, 'orphans').forEach((orphan, index) => {
    const path = `orphans[${index}]`;
    noUnknownKeys(orphan, path, ORPHAN_KEYS);
    pattern(orphan, path, 'uid', UID, 'a Crockford base32 uid (§5.4)');
    string(orphan, path, 'treeId');
    string(orphan, path, 'title');
    enumeration(orphan, path, 'state', ['complete', 'dismissed'] as const);
    timestamp(orphan, path, 'at');
    optionalString(orphan, path, 'note');
    enumeration(orphan, path, 'reason', ['retired', 'merged', 'unknown'] as const);
  });
}

/**
 * `common.schema.json`'s two identifier shapes. A uid is the join key every
 * merge rule below is written in terms of, so a malformed one cannot match
 * anything and is worth naming as the failing field rather than storing as a row
 * that will never be found again.
 */
const UID = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{8}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function pattern(row: Row, path: string, key: string, shape: RegExp, description: string): void {
  const value = string(row, path, key);
  if (!shape.test(value)) {
    throw new ExportValidationError(`${path}.${key}`, `must be ${description}; got "${value}"`);
  }
}

function optionalString(row: Row, path: string, key: string): void {
  if (row[key] === undefined) return;
  if (typeof row[key] !== 'string') {
    throw new ExportValidationError(`${path}.${key}`, 'must be a string when present');
  }
}

function validateGrandfathered(value: unknown, path: string): void {
  if (value === undefined) {
    throw new ExportValidationError(path, 'is required and missing');
  }
  if (!isObject(value)) {
    throw new ExportValidationError(path, 'must be an object keyed by level');
  }
  for (const [level, frozen] of Object.entries(value)) {
    const at = `${path}.${level}`;
    if (!isObject(frozen)) throw new ExportValidationError(at, 'must be an object');
    noUnknownKeys(frozen, at, ['uids', 'contentVersion']);
    const uids = required(frozen, at, 'uids');
    if (!Array.isArray(uids) || uids.some((uid) => typeof uid !== 'string' || !UID.test(uid))) {
      throw new ExportValidationError(`${at}.uids`, 'must be an array of Crockford base32 uids');
    }
    integer(frozen, at, 'contentVersion', { minimum: 1 });
  }
}
