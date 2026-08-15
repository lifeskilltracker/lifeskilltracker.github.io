import type { LintRule } from '../context.js';

const MAX_TRACKS = 4;

/** `docs/RESEARCH.md` §3: past four columns, the skill wants splitting. */
export const trackOveruse: LintRule = (ctx, report) => {
  const tracks = ctx.tree.tracks ?? [];
  if (tracks.length <= MAX_TRACKS) {
    return;
  }
  report.addAt(
    'track-overuse',
    ctx.file,
    ctx.positionAt(['tracks']),
    `${tracks.length} tracks; more than ${MAX_TRACKS} usually means the skill should be split into separate trees`,
  );
};
