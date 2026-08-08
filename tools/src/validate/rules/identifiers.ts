import { pathPosition } from '../schema.js';
import type { ValidationContext } from '../context.js';
import { shouldReport } from '../context.js';
import type { ValidationReport } from '../report.js';

export function checkRule1Levels(ctx: ValidationContext, report: ValidationReport): void {
  for (const loaded of ctx.treeDocuments.values()) {
    if (!shouldReport(ctx, loaded.path)) {
      continue;
    }
    const levels = loaded.data.levels ?? [];
    const seen = new Set<number>();
    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index];
      const expected = index + 1;
      if (level.level !== expected) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['levels', index, 'level']),
          `levels must be exactly 1–10 in order; expected level ${expected}, found ${level.level}`,
          'rule 1',
        );
      }
      if (seen.has(level.level)) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['levels', index, 'level']),
          `level ${level.level} appears more than once`,
          'rule 1',
        );
      }
      seen.add(level.level);
    }
    if (levels.length !== 10) {
      report.addAt(
        loaded.path,
        pathPosition(loaded, ['levels']),
        `tree must have exactly 10 levels, found ${levels.length}`,
        'rule 1',
      );
    }
    for (let expected = 1; expected <= 10; expected += 1) {
      if (!seen.has(expected)) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['levels']),
          `missing level ${expected}`,
          'rule 1',
        );
      }
    }
  }
}

export function checkRule2Identifiers(ctx: ValidationContext, report: ValidationReport): void {
  for (const loaded of ctx.treeDocuments.values()) {
    const slugCounts = new Map<string, number>();
    for (const level of loaded.data.levels ?? []) {
      for (const milestone of level.milestones ?? []) {
        slugCounts.set(milestone.id, (slugCounts.get(milestone.id) ?? 0) + 1);
      }
    }
    for (const [slug, count] of slugCounts) {
      if (count > 1 && shouldReport(ctx, loaded.path)) {
        const levelIndex = loaded.data.levels.findIndex((level) =>
          level.milestones.some((m) => m.id === slug),
        );
        const milestoneIndex = loaded.data.levels[levelIndex]?.milestones.findIndex((m) => m.id === slug) ?? 0;
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'id']),
          `milestone slug "${slug}" is duplicated within the tree`,
          'rule 2',
        );
      }
    }
  }

  const uidLocations = new Map<string, Array<{ path: string; jsonPath: Array<string | number>; label: string }>>();
  for (const loaded of ctx.treeDocuments.values()) {
    for (let levelIndex = 0; levelIndex < (loaded.data.levels ?? []).length; levelIndex += 1) {
      const level = loaded.data.levels[levelIndex];
      for (let milestoneIndex = 0; milestoneIndex < level.milestones.length; milestoneIndex += 1) {
        const milestone = level.milestones[milestoneIndex];
        if (!milestone.uid || milestone.uid.trim() === '') {
          continue;
        }
        const list = uidLocations.get(milestone.uid) ?? [];
        list.push({
          path: loaded.path,
          jsonPath: ['levels', levelIndex, 'milestones', milestoneIndex, 'uid'],
          label: milestone.id,
        });
        uidLocations.set(milestone.uid, list);
      }
    }
    for (let masteryIndex = 0; masteryIndex < (loaded.data.mastery ?? []).length; masteryIndex += 1) {
      const entry = loaded.data.mastery![masteryIndex];
      if (!entry.uid || entry.uid.trim() === '') {
        continue;
      }
      const list = uidLocations.get(entry.uid) ?? [];
      list.push({
        path: loaded.path,
        jsonPath: ['mastery', masteryIndex, 'uid'],
        label: entry.id,
      });
      uidLocations.set(entry.uid, list);
    }
  }

  for (const [uid, locations] of uidLocations) {
    if (locations.length <= 1) {
      continue;
    }
    for (const location of locations) {
      if (!shouldReport(ctx, location.path)) {
        continue;
      }
      report.addAt(
        location.path,
        pathPosition(ctx.treeDocuments.get(location.path)!, location.jsonPath),
        `uid "${uid}" is duplicated across the repository (${locations.map((l) => l.label).join(', ')})`,
        'rule 2',
      );
    }
  }
}

export function checkRule16MissingUids(ctx: ValidationContext, report: ValidationReport): void {
  for (const loaded of ctx.treeDocuments.values()) {
    if (!shouldReport(ctx, loaded.path)) {
      continue;
    }
    const missing: string[] = [];
    for (let levelIndex = 0; levelIndex < (loaded.data.levels ?? []).length; levelIndex += 1) {
      const level = loaded.data.levels[levelIndex];
      for (let milestoneIndex = 0; milestoneIndex < level.milestones.length; milestoneIndex += 1) {
        const milestone = level.milestones[milestoneIndex];
        if (!milestone.uid || milestone.uid.trim() === '') {
          missing.push(milestone.id);
          report.addAt(
            loaded.path,
            pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'id']),
            `milestone "${milestone.id}" is missing uid`,
            'rule 16',
          );
        }
      }
    }
    for (let masteryIndex = 0; masteryIndex < (loaded.data.mastery ?? []).length; masteryIndex += 1) {
      const entry = loaded.data.mastery![masteryIndex];
      if (!entry.uid || entry.uid.trim() === '') {
        missing.push(entry.id);
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['mastery', masteryIndex, 'id']),
          `mastery entry "${entry.id}" is missing uid`,
          'rule 16',
        );
      }
    }
    if (missing.length > 0) {
      report.addAt(
        loaded.path,
        pathPosition(loaded, ['id']),
        `missing uid on: ${missing.join(', ')}`,
        'rule 16',
      );
    }
  }
}
