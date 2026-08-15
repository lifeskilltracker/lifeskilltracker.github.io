/**
 * The §5.3 skeleton. Structure only — `lst new` produces the shape an author
 * would otherwise retype, and nothing else: no content, no `provenance.authors`
 * they did not write, and deliberately **no `uid:` lines**, because §5.4's
 * authoring flow has the author write a whole tree without them and then run
 * `lst ids`. A scaffold that pre-filled uids would invent identifiers for
 * milestones nobody has written yet, and uids are immutable once merged.
 *
 * It passes layer 1 as written and fails rule 16 as written, which is exactly
 * the state §6.2 describes a draft being in.
 */

const LEVELS = 10;

/** The §6.2 lower bound (F8); an author adds up to eight. */
const MILESTONES_PER_LEVEL = 4;

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function titleFromId(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function levelBlock(level: number): string {
  const milestones = Array.from({ length: MILESTONES_PER_LEVEL }, (_, index) => {
    const slug = `level-${level}-milestone-${index + 1}`;
    return [
      `      - id: ${slug}`,
      "        title: 'TODO: an achievement with an observable completion condition'",
    ].join('\n');
  });
  return [`  - level: ${level}`, '    milestones:', ...milestones].join('\n');
}

export function renderTreeScaffold(id: string): string {
  const title = titleFromId(id);
  return `# ${title} — scaffolded by \`lst new\`.
# Replace every TODO, then run: lst ids → lst validate → lst lint (§6.7).
schemaVersion: 1
contentVersion: 1

id: ${id}
title: ${title}
summary: >
  TODO: a sentence or two for the library listing, in the words someone
  browsing for this skill would use.

domain: mind                 # TODO: one primary domain from content/taxonomy/domains.yaml
# secondaryDomains: []       # discoverability only — contributes no score
# subregion: objects         # required iff \`domain: making\`, forbidden otherwise
# facets: []                 # all must exist in content/taxonomy/facets.yaml
# archetype: single-track    # single-track | dual-track | modular — UI label only

# tracks:                    # omit entirely for a single-column skill
#   - id: core
#     title: Core

provenance:
  authors:
    - { name: TODO Your Name, github: TODO-your-handle }
  copyleftDerived: false     # TODO: F45 has no default — answer it deliberately

# Ten levels, 4–8 milestones each (F7, F8). Prerequisites and requirement
# groups are written with slugs, so the draft is complete before \`lst ids\` runs.
levels:
${Array.from({ length: LEVELS }, (_, index) => levelBlock(index + 1)).join('\n\n')}

# mastery:                   # optional, unbounded, excluded from every score
#   - id: a-signature-piece
#     title: 'TODO: the achievement that is not a level'

lineage: []                  # append-only; grows when structure changes (§5.4)
`;
}
