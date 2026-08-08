import { mkdirSync } from 'node:fs';
import path from 'node:path';

import type { Tree } from '../validate/types.js';
import {
  FIXTURE_ROOT,
  minimalValidTree,
  stampFixtureUids,
  uidFor,
  writeTreeFixture,
} from './fixture-helpers.js';

const treesDir = path.join(FIXTURE_ROOT, 'trees');
const idsDir = path.join(FIXTURE_ROOT, '../ids');
mkdirSync(treesDir, { recursive: true });
mkdirSync(idsDir, { recursive: true });

let namespace = 1;

function nextTree(id: string, mutate?: (tree: Tree) => void): Tree {
  const tree = minimalValidTree({ id });
  stampFixtureUids(tree, namespace);
  namespace += 1;
  mutate?.(tree);
  return tree;
}

function writeRule(id: string, mutate?: (tree: Tree) => void): void {
  writeTreeFixture(treesDir, `${id}.yaml`, nextTree(id, mutate));
}

writeRule('rule-01-pass');
writeRule('rule-01-fail', (tree) => {
  tree.levels[0].level = 2;
});

const rule2a = nextTree('rule-02-a');
const rule2b = nextTree('rule-02-b');
rule2b.levels[0].milestones[0].uid = rule2a.levels[0].milestones[0].uid!;
writeTreeFixture(treesDir, 'rule-02-a.yaml', rule2a);
writeTreeFixture(treesDir, 'rule-02-b.yaml', rule2b);

writeRule('rule-03-pass');
writeRule('rule-03-fail', (tree) => {
  tree.levels[1].milestones[0].requires = ['missing-slug'];
});

writeRule('rule-04-pass');
writeRule('rule-04-fail', (tree) => {
  tree.levels[0].milestones[0].requires = [tree.levels[0].milestones[1].id];
  tree.levels[0].milestones[1].requires = [tree.levels[0].milestones[0].id];
});

writeRule('rule-05-pass');
writeRule('rule-05-fail', (tree) => {
  tree.levels[0].milestones[0].requires = [tree.levels[1].milestones[0].id];
});

writeRule('rule-06-pass');
writeRule('rule-06-fail', (tree) => {
  tree.levels[0].requirements = [{ rule: 'all', milestones: [tree.levels[1].milestones[0].id] }];
});

writeRule('rule-07-pass');
writeRule('rule-07-fail', (tree) => {
  tree.levels[0].requirements = [
    { rule: 'n_of', n: 4, milestones: tree.levels[0].milestones.map((m) => m.id) },
  ];
});

writeRule('rule-08-pass');
writeRule('rule-08-fail', (tree) => {
  tree.levels[0].requirements = [{ rule: 'all', milestones: [tree.levels[0].milestones[0].id] }];
});

writeRule('rule-09-pass', (tree) => {
  tree.tracks = [{ id: 'main', title: 'Main' }];
});
writeRule('rule-09-fail', (tree) => {
  tree.tracks = [{ id: 'main', title: 'Main' }];
  tree.levels[0].milestones[0].track = 'missing-track';
});

writeRule('rule-10-pass', (tree) => {
  tree.secondaryDomains = ['mind'];
});
writeRule('rule-10-fail', (tree) => {
  tree.domain = 'not-a-domain' as never;
});
writeRule('rule-10-secondary-repeat', (tree) => {
  tree.domain = 'home';
  tree.secondaryDomains = ['home'];
});

writeRule('rule-11-pass', (tree) => {
  tree.domain = 'making';
  tree.subregion = 'objects';
});
writeRule('rule-11-fail', (tree) => {
  tree.domain = 'making';
  delete tree.subregion;
});

writeRule('rule-12-pass', (tree) => {
  tree.facets = ['practical'];
});
writeRule('rule-12-fail', (tree) => {
  tree.facets = ['missing-facet'];
});

writeRule('rule-13-pass');
writeRule('rule-13-fail', (tree) => {
  delete tree.provenance.copyleftDerived;
});

writeRule('rule-14-pass', (tree) => {
  let max = 0;
  for (const level of tree.levels) {
    for (const milestone of level.milestones) {
      max = Math.max(max, Number.parseInt(milestone.uid!.slice(3), 10));
    }
  }
  tree.mastery = [{ id: 'mastery-a', uid: uidFor(max + 1), title: 'Mastery' }];
});
writeRule('rule-14-fail', (tree) => {
  let max = 0;
  for (const level of tree.levels) {
    for (const milestone of level.milestones) {
      max = Math.max(max, Number.parseInt(milestone.uid!.slice(3), 10));
    }
  }
  tree.mastery = [
    { id: 'mastery-a', uid: uidFor(max + 1), title: 'Mastery', track: 'main' } as never,
  ];
});

writeRule('rule-16-pass');
writeRule('rule-16-fail', (tree) => {
  delete tree.levels[0].milestones[0].uid;
});

const destTree = nextTree('dest-tree');
writeTreeFixture(treesDir, 'dest-tree.yaml', destTree);
const destUid = destTree.levels[0].milestones[0].uid!;

writeRule('rule-15-split-empty', (tree) => {
  tree.lineage = [{ uid: tree.levels[0].milestones[0].uid!, op: 'split', into: [] }];
});

writeRule('rule-15-split-one', (tree) => {
  tree.lineage = [
    { uid: tree.levels[0].milestones[0].uid!, op: 'split', into: [tree.levels[0].milestones[1].uid!] },
  ];
});

writeRule('rule-15-merged-two', (tree) => {
  tree.lineage = [
    {
      uid: tree.levels[0].milestones[0].uid!,
      op: 'merged',
      into: [tree.levels[0].milestones[1].uid!, tree.levels[0].milestones[2].uid!],
    },
  ];
});

writeRule('rule-15-retired-into', (tree) => {
  tree.lineage = [{ uid: tree.levels[0].milestones[0].uid!, op: 'retired', into: [tree.levels[0].milestones[1].uid!] }];
});

writeRule('rule-15-moved-bare', (tree) => {
  tree.lineage = [{ uid: tree.levels[0].milestones[0].uid!, op: 'moved', into: [tree.levels[0].milestones[1].uid!] }];
});

writeRule('rule-15-moved-same-tree', (tree) => {
  const uid = tree.levels[0].milestones[0].uid!;
  tree.lineage = [{ uid, op: 'moved', into: [`${tree.id}/${uid}`] }];
});

writeRule('rule-15-moved-missing-tree', (tree) => {
  const uid = tree.levels[0].milestones[0].uid!;
  tree.lineage = [{ uid, op: 'moved', into: [`missing-tree/${uid}`] }];
});

writeRule('rule-15-moved-wrong-uid', (tree) => {
  const uid = tree.levels[0].milestones[0].uid!;
  tree.lineage = [{ uid, op: 'moved', into: [`dest-tree/${tree.levels[0].milestones[1].uid!}`] }];
});

writeRule('rule-15-moved-missing-live-head', (tree) => {
  const inventedUid = 'abcdefgh';
  tree.lineage = [{ uid: inventedUid, op: 'moved', into: [`dest-tree/${inventedUid}`] }];
});

writeRule('rule-15-split-foreign-uid', (tree) => {
  tree.lineage = [{ uid: tree.levels[0].milestones[0].uid!, op: 'split', into: [destUid, tree.levels[0].milestones[1].uid!] }];
});

writeRule('rule-15-merged-foreign-uid', (tree) => {
  tree.lineage = [{ uid: tree.levels[0].milestones[0].uid!, op: 'merged', into: [destUid] }];
});

writeRule('rule-15-split-pass', (tree) => {
  tree.lineage = [
    {
      uid: tree.levels[0].milestones[0].uid!,
      op: 'split',
      into: [tree.levels[0].milestones[1].uid!, tree.levels[0].milestones[2].uid!],
    },
  ];
});

writeRule('rule-15-moved-pass', (tree) => {
  tree.lineage = [{ uid: destUid, op: 'moved', into: [`dest-tree/${destUid}`] }];
});

const draft = minimalValidTree({ id: 'draft-no-uids' });
for (const level of draft.levels) {
  for (const milestone of level.milestones) {
    delete milestone.uid;
  }
}
writeTreeFixture(idsDir, 'draft-no-uids.yaml', draft);

console.log('Generated validate and ids fixtures.');
