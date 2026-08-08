import { pathPosition } from '../schema.js';
import type { ValidationContext } from '../context.js';
import {
  liveHeadUidSet,
  sameTreeLiveUids,
  shouldReport,
} from '../context.js';
import type { LineageEntry, LineageOp } from '../types.js';
import type { ValidationReport } from '../report.js';

const UID_PATTERN = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{8}$/;

function reportLineageIssue(
  report: ValidationReport,
  ctx: ValidationContext,
  loadedPath: string,
  index: number,
  field: string | null,
  message: string,
): void {
  if (!shouldReport(ctx, loadedPath)) {
    return;
  }
  const loaded = ctx.treeDocuments.get(loadedPath)!;
  const jsonPath = field ? ['lineage', index, field] : ['lineage', index];
  report.addAt(loadedPath, pathPosition(loaded, jsonPath), message, 'rule 15');
}

function checkTargetResolvesInLiveHead(
  report: ValidationReport,
  ctx: ValidationContext,
  loadedPath: string,
  index: number,
  target: string,
  liveHead: Set<string>,
): void {
  if (!liveHead.has(target)) {
    reportLineageIssue(
      report,
      ctx,
      loadedPath,
      index,
      'into',
      `lineage target "${target}" does not resolve to a uid in the repository head`,
    );
  }
}

export function checkRule15Lineage(ctx: ValidationContext, report: ValidationReport): void {
  const liveHead = liveHeadUidSet(ctx);

  for (const loadedTree of ctx.trees) {
    const treeId = loadedTree.tree.id;
    const sameTreeUids = sameTreeLiveUids(ctx, treeId);
    const entries = loadedTree.tree.lineage ?? [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      validateLineageEntry(report, ctx, loadedTree.path, treeId, index, entry, liveHead, sameTreeUids);
    }
  }
}

function validateLineageEntry(
  report: ValidationReport,
  ctx: ValidationContext,
  loadedPath: string,
  treeId: string,
  index: number,
  entry: LineageEntry,
  liveHead: Set<string>,
  sameTreeUids: Set<string>,
): void {
  const into = entry.into ?? [];
  const op = entry.op as LineageOp;

  switch (op) {
    case 'split': {
      if (into.length < 2) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `split requires at least 2 into targets, found ${into.length}`,
        );
      }
      for (const target of into) {
        if (target.includes('/')) {
          reportLineageIssue(
            report,
            ctx,
            loadedPath,
            index,
            'into',
            `split target "${target}" must be a bare uid in this tree`,
          );
          continue;
        }
        if (!UID_PATTERN.test(target)) {
          reportLineageIssue(
            report,
            ctx,
            loadedPath,
            index,
            'into',
            `split target "${target}" must be an 8-character uid`,
          );
        }
        if (!sameTreeUids.has(target)) {
          reportLineageIssue(
            report,
            ctx,
            loadedPath,
            index,
            'into',
            `split target "${target}" must name a milestone or mastery uid in this tree`,
          );
        }
        checkTargetResolvesInLiveHead(report, ctx, loadedPath, index, target, liveHead);
      }
      break;
    }
    case 'merged': {
      if (into.length !== 1) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `merged requires exactly 1 into target, found ${into.length}`,
        );
      }
      for (const target of into) {
        if (target.includes('/')) {
          reportLineageIssue(
            report,
            ctx,
            loadedPath,
            index,
            'into',
            `merged target "${target}" must be a bare uid in this tree`,
          );
          continue;
        }
        if (!sameTreeUids.has(target)) {
          reportLineageIssue(
            report,
            ctx,
            loadedPath,
            index,
            'into',
            `merged target "${target}" must name a milestone or mastery uid in this tree`,
          );
        }
        checkTargetResolvesInLiveHead(report, ctx, loadedPath, index, target, liveHead);
      }
      break;
    }
    case 'retired': {
      if (into.length > 0) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `retired must not carry into targets`,
        );
      }
      break;
    }
    case 'moved': {
      if (into.length !== 1) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `moved requires exactly 1 into target, found ${into.length}`,
        );
        break;
      }
      const target = into[0];
      const parts = target.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `moved target "${target}" must be <treeId>/<uid>`,
        );
        break;
      }
      const [destTreeId, destUid] = parts;
      if (destTreeId === treeId) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `moved target must name a different tree than "${treeId}"`,
        );
      }
      if (!ctx.treeById.has(destTreeId)) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `moved target tree "${destTreeId}" does not exist in the repository`,
        );
      }
      if (destUid !== entry.uid) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `moved target uid "${destUid}" must equal the entry uid "${entry.uid}"`,
        );
      }
      if (!UID_PATTERN.test(destUid)) {
        reportLineageIssue(
          report,
          ctx,
          loadedPath,
          index,
          'into',
          `moved target uid "${destUid}" must be an 8-character uid`,
        );
      }
      checkTargetResolvesInLiveHead(report, ctx, loadedPath, index, destUid, liveHead);
      break;
    }
    default:
      reportLineageIssue(report, ctx, loadedPath, index, 'op', `unknown lineage op "${String(op)}"`);
  }
}
