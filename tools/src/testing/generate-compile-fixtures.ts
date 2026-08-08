import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Tree } from '../validate/types.js';
import { defaultRepoRoot } from '../shared/paths.js';
import { minimalValidTree, stampFixtureUids, uidFor, writeTreeFixture } from './fixture-helpers.js';

const toolsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureRoot = path.join(toolsRoot, 'test/fixtures/compile');
const contentRoot = path.join(fixtureRoot, 'content');
const treesDir = path.join(contentRoot, 'trees');
const taxonomyDir = path.join(contentRoot, 'taxonomy');

mkdirSync(treesDir, { recursive: true });
mkdirSync(taxonomyDir, { recursive: true });

cpSync(path.join(defaultRepoRoot, 'content/taxonomy/domains.yaml'), path.join(taxonomyDir, 'domains.yaml'));
cpSync(path.join(defaultRepoRoot, 'content/taxonomy/facets.yaml'), path.join(taxonomyDir, 'facets.yaml'));
cpSync(path.join(defaultRepoRoot, 'content/taxonomy/map.yaml'), path.join(taxonomyDir, 'map.yaml'));

function writeCompileTree(name: string, mutate: (tree: Tree) => void, namespace: number): void {
  const tree = minimalValidTree({ id: name.replace(/\.yaml$/, '') });
  stampFixtureUids(tree, namespace);
  mutate(tree);
  writeTreeFixture(treesDir, name, tree);
}

writeCompileTree('transforms.yaml', (tree) => {
  tree.id = 'compile-transforms';
  tree.title = 'Compile Transform Fixture';
  tree.summary = 'Exercises every §7.3 compiler transformation.';
  tree.domain = 'home';
  tree.contentVersion = 3;
  tree.facets = ['practical'];

  tree.levels[0].milestones[0].detail = 'Author prose retained verbatim.';
  tree.levels[0].milestones[1].requires = [tree.levels[0].milestones[0].id];
  delete tree.levels[0].requirements;

  tree.levels[1].requirements = [
    { rule: 'any', milestones: [tree.levels[1].milestones[0].id, tree.levels[1].milestones[1].id] },
    {
      rule: 'n_of',
      n: 1,
      milestones: [tree.levels[1].milestones[2].id, tree.levels[1].milestones[3].id],
    },
  ];

  tree.mastery = [
    {
      id: 'capstone',
      uid: uidFor(90001),
      title: 'Capstone achievement',
      detail: 'Requires a milestone.',
      requires: [tree.levels[0].milestones[0].id],
    },
  ];

  tree.lineage = [
    {
      uid: uidFor(90002),
      op: 'split',
      into: [tree.levels[0].milestones[2].uid!, tree.levels[0].milestones[3].uid!],
      note: 'ledger order preserved',
    },
  ];
}, 900);

writeCompileTree('stable-a.yaml', (tree) => {
  tree.id = 'stable-a';
  tree.title = 'Stable A';
}, 910);

writeCompileTree('stable-b.yaml', (tree) => {
  tree.id = 'stable-b';
  tree.title = 'Stable B';
}, 920);

writeCompileTree('moved-dest.yaml', (tree) => {
  tree.id = 'moved-dest';
  tree.title = 'Moved destination';
}, 930);

writeCompileTree('moved-source.yaml', (tree) => {
  tree.id = 'moved-source';
  tree.title = 'Moved source';
  tree.lineage = [
    {
      uid: uidFor(94001),
      op: 'moved',
      into: ['moved-dest/' + uidFor(94001)],
    },
  ];
}, 940);

writeCompileTree('lineage-order.yaml', (tree) => {
  tree.id = 'lineage-order';
  tree.title = 'Lineage order';
  tree.lineage = [
    { uid: uidFor(95001), op: 'retired' },
    { uid: uidFor(95002), op: 'split', into: [tree.levels[0].milestones[0].uid!, tree.levels[0].milestones[1].uid!] },
  ];
}, 950);

writeCompileTree('dual-track.yaml', (tree) => {
  tree.id = 'dual-track';
  tree.title = 'Dual track defaults';
  tree.tracks = [
    { id: 'forge', title: 'Forge work' },
    { id: 'finish', title: 'Heat treat and finish' },
  ];
  tree.levels[0].milestones[1].track = 'finish';
  tree.levels[0].milestones[3].track = 'finish';
}, 960);

writeCompileTree('order-mixed.yaml', (tree) => {
  tree.id = 'order-mixed';
  tree.title = 'Mixed explicit and default order';
  tree.levels[1].milestones[0].order = 2;
  tree.levels[1].milestones[3].order = 0;
}, 970);

console.log(`Wrote compile fixtures under ${fixtureRoot}`);
