import { pathPosition } from './schema.js';
import type { ValidationContext } from './context.js';
import type { AxialTile, MapRegion } from './types.js';
import type { ValidationReport } from './report.js';

function tileKey(tile: AxialTile): string {
  return `${tile[0]},${tile[1]}`;
}

function hexNeighbors(tile: AxialTile): AxialTile[] {
  const [q, r] = tile;
  return [
    [q + 1, r],
    [q - 1, r],
    [q, r + 1],
    [q, r - 1],
    [q + 1, r - 1],
    [q - 1, r + 1],
  ];
}

function isContiguous(tiles: AxialTile[]): boolean {
  if (tiles.length <= 1) {
    return true;
  }
  const keys = new Set(tiles.map(tileKey));
  const start = tiles[0];
  const seen = new Set<string>([tileKey(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of hexNeighbors(current)) {
      const key = tileKey(neighbor);
      if (keys.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(neighbor);
      }
    }
  }
  return seen.size === keys.size;
}

function reportMapIssue(
  report: ValidationReport,
  _ctx: ValidationContext,
  filePath: string,
  jsonPath: Array<string | number>,
  rule: string,
  message: string,
): void {
  // Map rules are always reported — §6.2 read-vs-report: argv scopes reporting for
  // authored files, but taxonomy geometry must surface on tree-only invocations.
  const loaded = _ctx.map!;
  report.addAt(filePath, pathPosition(loaded, jsonPath), message, rule, { forceReport: true });
}

export function checkMapRules(ctx: ValidationContext, report: ValidationReport): void {
  if (!ctx.map || !ctx.domains) {
    return;
  }

  const mapPath = ctx.map.path;
  const regions = ctx.map.data.regions ?? [];
  const regionDomains = new Set(regions.map((region) => region.domain));

  for (const domainId of ctx.domainIds) {
    if (!regionDomains.has(domainId as MapRegion['domain'])) {
      reportMapIssue(
        report,
        ctx,
        mapPath,
        ['regions'],
        'M1',
        `domain "${domainId}" has no region in map.yaml`,
      );
    }
  }

  const tileCounts = new Map<string, number>();
  const tileLocations = new Map<string, Array<{ regionIndex: number; tileIndex: number }>>();
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region = regions[regionIndex];
    for (let tileIndex = 0; tileIndex < region.tiles.length; tileIndex += 1) {
      const tile = region.tiles[tileIndex];
      const key = tileKey(tile);
      tileCounts.set(key, (tileCounts.get(key) ?? 0) + 1);
      const locations = tileLocations.get(key) ?? [];
      locations.push({ regionIndex, tileIndex });
      tileLocations.set(key, locations);
    }
  }

  for (const [key, count] of tileCounts) {
    if (count <= 1) {
      continue;
    }
    const [first] = tileLocations.get(key)!;
    reportMapIssue(
      report,
      ctx,
      mapPath,
      ['regions', first.regionIndex, 'tiles', first.tileIndex],
      'M2',
      `tile [${key}] is claimed ${count} times`,
    );
  }

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region = regions[regionIndex];
    if (!isContiguous(region.tiles)) {
      reportMapIssue(
        report,
        ctx,
        mapPath,
        ['regions', regionIndex, 'tiles'],
        'M3',
        `region for domain "${region.domain}" is not contiguous under hex adjacency`,
      );
    }

    if (region.subregions && region.subregions.length > 0) {
      if (region.domain !== 'making') {
        reportMapIssue(
          report,
          ctx,
          mapPath,
          ['regions', regionIndex, 'subregions'],
          'M5',
          `subregions are only allowed under domain making`,
        );
      }

      const parentKeys = new Set(region.tiles.map(tileKey));
      const covered = new Map<string, number>();
      for (let subIndex = 0; subIndex < region.subregions.length; subIndex += 1) {
        const sub = region.subregions[subIndex];
        for (let tileIndex = 0; tileIndex < sub.tiles.length; tileIndex += 1) {
          const key = tileKey(sub.tiles[tileIndex]);
          covered.set(key, (covered.get(key) ?? 0) + 1);
          if (!parentKeys.has(key)) {
            reportMapIssue(
              report,
              ctx,
              mapPath,
              ['regions', regionIndex, 'subregions', subIndex, 'tiles', tileIndex],
              'M4',
              `subregion "${sub.id}" tile [${key}] is not part of the parent region`,
            );
          }
        }
      }

      for (const key of parentKeys) {
        const count = covered.get(key) ?? 0;
        if (count !== 1) {
          const tileIndex = region.tiles.findIndex((tile) => tileKey(tile) === key);
          reportMapIssue(
            report,
            ctx,
            mapPath,
            ['regions', regionIndex, 'tiles', tileIndex],
            'M4',
            count === 0
              ? `parent tile [${key}] is not covered by any subregion`
              : `parent tile [${key}] is covered by ${count} subregions`,
          );
        }
      }
    }
  }
}
