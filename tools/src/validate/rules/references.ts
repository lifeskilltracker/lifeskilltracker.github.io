import { pathPosition } from '../schema.js';
import type { ValidationContext } from '../context.js';
import { shouldReport } from '../context.js';
import type { ValidationReport } from '../report.js';

function declaredTrackIds(tree: { tracks?: Array<{ id: string }> }): Set<string> {
  return new Set((tree.tracks ?? []).map((track) => track.id));
}

export function checkRules9To12References(ctx: ValidationContext, report: ValidationReport): void {
  for (const loaded of ctx.treeDocuments.values()) {
    if (!shouldReport(ctx, loaded.path)) {
      continue;
    }
    const trackIds = declaredTrackIds(loaded.data);

    for (let levelIndex = 0; levelIndex < loaded.data.levels.length; levelIndex += 1) {
      const level = loaded.data.levels[levelIndex];
      for (let milestoneIndex = 0; milestoneIndex < level.milestones.length; milestoneIndex += 1) {
        const milestone = level.milestones[milestoneIndex];
        if (milestone.track) {
          if (trackIds.size === 0) {
            report.addAt(
              loaded.path,
              pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'track']),
              `track "${milestone.track}" is not declared in tracks`,
              'rule 9',
            );
          } else if (!trackIds.has(milestone.track)) {
            report.addAt(
              loaded.path,
              pathPosition(loaded, ['levels', levelIndex, 'milestones', milestoneIndex, 'track']),
              `track "${milestone.track}" is not declared in tracks`,
              'rule 9',
            );
          }
        }
      }
    }

    if (!ctx.domainIds.has(loaded.data.domain)) {
      report.addAt(
        loaded.path,
        pathPosition(loaded, ['domain']),
        `domain "${loaded.data.domain}" does not exist in domains.yaml`,
        'rule 10',
      );
    }

    const secondary = loaded.data.secondaryDomains ?? [];
    for (let index = 0; index < secondary.length; index += 1) {
      const domain = secondary[index];
      if (!ctx.domainIds.has(domain)) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['secondaryDomains', index]),
          `secondary domain "${domain}" does not exist in domains.yaml`,
          'rule 10',
        );
      }
      if (domain === loaded.data.domain) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['secondaryDomains', index]),
          `primary domain "${loaded.data.domain}" must not appear in secondaryDomains`,
          'rule 10',
        );
      }
    }

    if (loaded.data.domain === 'making') {
      if (!loaded.data.subregion) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['domain']),
          `subregion is required when domain is making`,
          'rule 11',
        );
      } else if (!ctx.subregionIds.has(loaded.data.subregion)) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['subregion']),
          `subregion "${loaded.data.subregion}" is not declared for making in domains.yaml`,
          'rule 11',
        );
      }
    } else if (loaded.data.subregion) {
      report.addAt(
        loaded.path,
        pathPosition(loaded, ['subregion']),
        `subregion must not be present unless domain is making`,
        'rule 11',
      );
    }

    for (let index = 0; index < (loaded.data.facets ?? []).length; index += 1) {
      const facet = loaded.data.facets![index];
      if (!ctx.facetIds.has(facet)) {
        report.addAt(
          loaded.path,
          pathPosition(loaded, ['facets', index]),
          `facet "${facet}" does not exist in facets.yaml`,
          'rule 12',
        );
      }
    }
  }
}

export function checkRule13Copyleft(ctx: ValidationContext, report: ValidationReport): void {
  for (const loaded of ctx.treeDocuments.values()) {
    if (!shouldReport(ctx, loaded.path)) {
      continue;
    }
    if (loaded.data.provenance.copyleftDerived === undefined) {
      report.addAt(
        loaded.path,
        pathPosition(loaded, ['provenance']),
        'provenance.copyleftDerived must be present and answered',
        'rule 13',
      );
    }
  }
}

export function checkRule14MasteryShape(ctx: ValidationContext, report: ValidationReport): void {
  const forbidden = ['level', 'track', 'order', 'requirements'] as const;
  for (const loaded of ctx.treeDocuments.values()) {
    if (!shouldReport(ctx, loaded.path)) {
      continue;
    }
    for (let index = 0; index < (loaded.data.mastery ?? []).length; index += 1) {
      const entry = loaded.data.mastery![index] as unknown as Record<string, unknown>;
      for (const key of forbidden) {
        if (key in entry) {
          report.addAt(
            loaded.path,
            pathPosition(loaded, ['mastery', index, key]),
            `mastery entry must not carry ${key}`,
            'rule 14',
          );
        }
      }
    }
  }
}
