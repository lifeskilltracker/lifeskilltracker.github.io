import { compileTreeBundle } from '../compile/bundle.js';
import { serializeJson } from '../compile/json.js';
import type { LineageEntry, Tree } from '../validate/types.js';
import type { Snapshot, TreeSnapshot } from './diff.js';

export interface AliasFix {
  /** Head file to patch. */
  file: string;
  /** The milestone or mastery entry, by its *current* slug. */
  slug: string;
  /** The baseline slug that must be recorded. */
  alias: string;
}

export interface BaselineFinding {
  check: number;
  treeId: string;
  message: string;
  fix?: AliasFix;
}

interface Entity {
  uid: string;
  slug: string;
  kind: 'milestone' | 'mastery';
  aliases: string[];
}

interface TreeIndex {
  byUid: Map<string, Entity>;
  bySlug: Map<string, Entity>;
}

function indexTree(tree: Tree): TreeIndex {
  const byUid = new Map<string, Entity>();
  const bySlug = new Map<string, Entity>();
  const record = (entity: Entity): void => {
    if (entity.uid) {
      byUid.set(entity.uid, entity);
    }
    bySlug.set(entity.slug, entity);
  };

  for (const level of tree.levels ?? []) {
    for (const milestone of level.milestones ?? []) {
      record({
        uid: milestone.uid ?? '',
        slug: milestone.id,
        kind: 'milestone',
        aliases: milestone.aliases ?? [],
      });
    }
  }
  for (const entry of tree.mastery ?? []) {
    record({ uid: entry.uid ?? '', slug: entry.id, kind: 'mastery', aliases: [] });
  }
  return { byUid, bySlug };
}

/**
 * Key order in YAML is not meaning, so check 6 compares ledger entries with
 * object keys sorted. Reordering `op:` above `uid:` is a formatting change and
 * must not read as an edit to an already-published disposition.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonical(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function lineageByUid(tree: Tree): Map<string, LineageEntry[]> {
  const map = new Map<string, LineageEntry[]>();
  for (const entry of tree.lineage ?? []) {
    const list = map.get(entry.uid);
    if (list) {
      list.push(entry);
    } else {
      map.set(entry.uid, [entry]);
    }
  }
  return map;
}

/** Check 1 — every published uid still exists, or the ledger says where it went. */
function check1(
  treeId: string,
  baseline: TreeIndex,
  head: TreeIndex,
  dispositions: Map<string, LineageEntry[]>,
): BaselineFinding[] {
  const findings: BaselineFinding[] = [];
  for (const [uid, entity] of baseline.byUid) {
    if (head.byUid.has(uid) || dispositions.has(uid)) {
      continue;
    }
    findings.push({
      check: 1,
      treeId,
      message: `uid ${uid} ("${entity.slug}") was published and is now gone with no lineage entry disposing of it`,
    });
  }
  return findings;
}

/**
 * Check 2 — a uid is never reattached to a different milestone.
 *
 * Detectable structurally in exactly one shape: the uid now carries a slug that
 * the baseline gave to *another* uid. A uid whose slug, title and level all
 * change but which still names the same achievement is indistinguishable from a
 * rewrite and must pass — that freedom is the entire point of D-05's uid/slug
 * split. The remaining case, a milestone silently redefined under a stable uid,
 * is **R-03** and no mechanism can catch it.
 */
function check2(
  treeId: string,
  baseline: TreeIndex,
  head: TreeIndex,
  dispositions: Map<string, LineageEntry[]>,
): BaselineFinding[] {
  const findings: BaselineFinding[] = [];
  for (const [uid, before] of baseline.byUid) {
    const after = head.byUid.get(uid);
    if (!after) {
      continue;
    }
    if (after.kind !== before.kind) {
      findings.push({
        check: 2,
        treeId,
        message: `uid ${uid} moved from ${before.kind} "${before.slug}" to ${after.kind} "${after.slug}"; a uid names one achievement forever`,
      });
      continue;
    }
    if (after.slug === before.slug) {
      continue;
    }
    const previousOwner = baseline.bySlug.get(after.slug);
    if (!previousOwner || previousOwner.uid === uid) {
      continue;
    }
    const excused = (dispositions.get(uid) ?? []).concat(dispositions.get(previousOwner.uid) ?? []);
    if (excused.some((entry) => entry.op === 'split' || entry.op === 'moved')) {
      continue;
    }
    findings.push({
      check: 2,
      treeId,
      message: `uid ${uid} was "${before.slug}" and now names "${after.slug}", which the baseline gave to uid ${previousOwner.uid}`,
    });
  }
  return findings;
}

/**
 * Check 3 — a retired slug is never reused by a different uid.
 *
 * A slug counts as retired the moment it stops belonging to the uid that held
 * it: because the entry was removed, or because it was renamed and the old
 * value became an alias. Both are the same event from a deep link's point of
 * view, and §5.4's rule is protobuf's `reserved` — reuse makes an old export
 * bind silently to the wrong milestone.
 */
function check3(treeId: string, baseline: TreeIndex, head: TreeIndex): BaselineFinding[] {
  const retired = new Map<string, string>();
  const retire = (slug: string, uid: string): void => {
    if (!retired.has(slug)) {
      retired.set(slug, uid);
    }
  };

  for (const [uid, before] of baseline.byUid) {
    const after = head.byUid.get(uid);
    if (!after || after.slug !== before.slug) {
      retire(before.slug, uid);
    }
    for (const alias of before.aliases) {
      retire(alias, uid);
    }
  }
  for (const entity of head.byUid.values()) {
    for (const alias of entity.aliases) {
      retire(alias, entity.uid);
    }
  }

  const findings: BaselineFinding[] = [];
  for (const entity of head.byUid.values()) {
    const owner = retired.get(entity.slug);
    if (owner === undefined || owner === entity.uid) {
      continue;
    }
    findings.push({
      check: 3,
      treeId,
      message: `slug "${entity.slug}" was retired from uid ${owner} and is now used by uid ${entity.uid}; retired slugs are never reused (§5.4)`,
    });
  }
  return findings;
}

/** Check 4 — a changed slug keeps its old value in `aliases`. The auto-fixable one. */
function check4(
  treeId: string,
  baseline: TreeIndex,
  head: TreeIndex,
  headFile: string,
): BaselineFinding[] {
  const findings: BaselineFinding[] = [];
  for (const [uid, before] of baseline.byUid) {
    const after = head.byUid.get(uid);
    if (!after || after.slug === before.slug || after.aliases.includes(before.slug)) {
      continue;
    }
    findings.push({
      check: 4,
      treeId,
      message: `uid ${uid} was renamed "${before.slug}" → "${after.slug}" without recording the old slug in aliases`,
      fix: { file: headFile, slug: after.slug, alias: before.slug },
    });
  }
  return findings;
}

/**
 * Check 5 — compiled output moved, so `contentVersion` must have moved.
 *
 * This compile is a **comparison, not the compile gate** — §6.5's `content:
 * compile` job is the gate, and the redundancy is deliberate (§6.4, T26/F24).
 * A tree that fails to compile on either side is therefore left to that job
 * rather than reported twice with two different messages.
 */
export function compiledFingerprint(tree: Tree): string | null {
  try {
    const rest: Record<string, unknown> = { ...compileTreeBundle(tree) };
    delete rest.contentVersion;
    return serializeJson(rest);
  } catch {
    return null;
  }
}

function check5(treeId: string, baseline: Tree, head: Tree): BaselineFinding[] {
  const before = compiledFingerprint(baseline);
  const after = compiledFingerprint(head);
  if (before == null || after == null || before === after) {
    return [];
  }
  if (head.contentVersion > baseline.contentVersion) {
    return [];
  }
  return [
    {
      check: 5,
      treeId,
      message: `compiled output changed but contentVersion is still ${head.contentVersion}; set it to ${baseline.contentVersion + 1} (npx lst version)`,
    },
  ];
}

/**
 * Check 6 — the baseline ledger is a prefix of the head's.
 *
 * §12.5 folds the ledger in file order to compose dispositions across skipped
 * content versions, so an entry inserted mid-list, reordered, or edited in
 * place silently changes the migration outcome for every user who skipped a
 * version — and checks 1–5 all pass such a change.
 */
function check6(treeId: string, baseline: Tree, head: Tree): BaselineFinding[] {
  const before = baseline.lineage ?? [];
  const after = head.lineage ?? [];
  if (after.length < before.length) {
    return [
      {
        check: 6,
        treeId,
        message: `lineage lost entries: the baseline has ${before.length}, the head ${after.length}; the ledger is append-only and never pruned (§5.4)`,
      },
    ];
  }
  for (let index = 0; index < before.length; index += 1) {
    if (canonical(before[index]) === canonical(after[index])) {
      continue;
    }
    return [
      {
        check: 6,
        treeId,
        message: `lineage entry ${index} changed since the baseline (was ${canonical(before[index])}, now ${canonical(after[index])}); entries may only be appended`,
      },
    ];
  }
  return [];
}

/**
 * Check 7 — an appended entry disposes of something that was actually published.
 *
 * **Scoped to entries appended since the baseline, and that is load-bearing.**
 * The ledger is never pruned, so a `retired` uid is legitimately absent from the
 * baseline three releases later; re-evaluating the whole ledger would fail that
 * entry forever and block every future PR on the tree with no author action able
 * to clear it. Check 6 is what makes "the appended suffix" well defined.
 */
function check7(treeId: string, baseline: Tree, baselineIndex: TreeIndex, head: Tree): BaselineFinding[] {
  const appendedFrom = (baseline.lineage ?? []).length;
  const findings: BaselineFinding[] = [];
  (head.lineage ?? []).slice(appendedFrom).forEach((entry, offset) => {
    if (baselineIndex.byUid.has(entry.uid)) {
      return;
    }
    findings.push({
      check: 7,
      treeId,
      message: `new lineage entry ${appendedFrom + offset} disposes of uid ${entry.uid}, which was never published in this tree`,
    });
  });
  return findings;
}

/** Checks 1–7 range over trees present on both sides. */
export function checkTreePair(
  before: TreeSnapshot,
  after: TreeSnapshot,
): BaselineFinding[] {
  const treeId = before.id;
  const baselineIndex = indexTree(before.tree);
  const headIndex = indexTree(after.tree);
  const dispositions = lineageByUid(after.tree);

  return [
    ...check1(treeId, baselineIndex, headIndex, dispositions),
    ...check2(treeId, baselineIndex, headIndex, dispositions),
    ...check3(treeId, baselineIndex, headIndex),
    ...check4(treeId, baselineIndex, headIndex, after.path),
    ...check5(treeId, before.tree, after.tree),
    ...check6(treeId, before.tree, after.tree),
    ...check7(treeId, before.tree, baselineIndex, after.tree),
  ];
}

/**
 * Check 8 — every baseline tree id is present in the head. Trees are never
 * removed and never renamed (§5.3, §5.4).
 *
 * It is its own check rather than part of check 1 because the ledger cannot
 * dispose of its own file: check 1's escape hatch is "appears in `lineage`",
 * and `lineage` is a field of the file being deleted. Checks 1–7 diff a tree
 * against its own baseline version, so a tree the head no longer contains is
 * never visited — they do not fail on a deletion, they pass on nothing.
 */
export function checkTreeSet(baseline: Snapshot, head: Snapshot): BaselineFinding[] {
  const findings: BaselineFinding[] = [];
  for (const id of baseline.keys()) {
    if (head.has(id)) {
      continue;
    }
    findings.push({
      check: 8,
      treeId: id,
      message: `tree "${id}" was published and is absent from the head; trees are never removed and never renamed (§5.3)`,
    });
  }
  return findings;
}
