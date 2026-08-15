import { effectiveTrack, milestoneSites, type LintRule } from '../context.js';

const MIN_MILESTONES = 3;

/**
 * Counts the *effective* track, so milestones that omit `track` land on the
 * first declared one exactly as the layout engine puts them there (§5.5). A
 * count taken from explicit `track:` fields alone would report the default
 * column as empty in every single-track-plus-one tree.
 */
export const lonelyTrack: LintRule = (ctx, report) => {
  const tracks = ctx.tree.tracks ?? [];
  if (tracks.length === 0) {
    return;
  }

  const counts = new Map<string, number>(tracks.map((track) => [track.id, 0]));
  for (const site of milestoneSites(ctx.tree)) {
    const trackId = effectiveTrack(ctx.tree, site.milestone);
    if (trackId != null && counts.has(trackId)) {
      counts.set(trackId, counts.get(trackId)! + 1);
    }
  }

  tracks.forEach((track, index) => {
    const count = counts.get(track.id) ?? 0;
    if (count >= MIN_MILESTONES) {
      return;
    }
    report.addAt(
      'lonely-track',
      ctx.file,
      ctx.positionAt(['tracks', index]),
      `track "${track.id}" holds ${count} milestone${count === 1 ? '' : 's'}; fewer than ${MIN_MILESTONES} is usually a modelling error`,
    );
  });
};
