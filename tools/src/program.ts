import { Command } from 'commander';

import { baselineCommand } from './baseline/index.js';
import { idsCommand } from './ids/index.js';
import { lintCommand } from './lint/index.js';
import { newCommand } from './new/index.js';
import { statusCommand } from './status/index.js';
import { validateCommand } from './validate/index.js';
import { versionCommand } from './version/index.js';
import { compileCommand } from './compile/index.js';

export function createProgram(): Command {
  const program = new Command()
    .name('lst')
    .description('Life Skill Tracker content toolchain')
    .version('0.0.0');

  program
    .command('validate')
    .description('Schema + semantic validation for trees and taxonomy (§6.1)')
    .argument('[files...]', 'tree or taxonomy files to report errors for')
    .action((files: string[]) => {
      process.exit(validateCommand(files));
    });

  program
    .command('ids')
    .description('Fill missing uid values in tree files in place (§5.4)')
    .argument('[files...]', 'tree files to update')
    .action((files: string[]) => {
      process.exit(idsCommand(files));
    });

  program
    .command('baseline')
    .description('uid immutability and contentVersion vs. the baseline ref (§6.4)')
    .option('--against <ref>', 'baseline ref to compare against', 'origin/main')
    .option('--fix', "apply check 4's alias patch to the working tree", false)
    .action((options: { against: string; fix: boolean }) => {
      process.exit(baselineCommand({ against: options.against, fix: options.fix }));
    });

  program
    .command('version')
    .description('Bump contentVersion in place where compiled output changed (§6.1)')
    .argument('[files...]', 'tree files to consider; defaults to every tree')
    .option('--against <ref>', 'baseline ref to compare against', 'origin/main')
    .action((files: string[], options: { against: string }) => {
      process.exit(versionCommand(files, { against: options.against }));
    });

  program
    .command('lint')
    .description('Advisory coherence and style warnings (§6.3) — never gates')
    .argument('[files...]', 'tree files to lint; defaults to every tree')
    .action((files: string[]) => {
      process.exit(lintCommand(files));
    });

  program
    .command('status')
    .description('Regenerate content/REVIEW-STATUS.md from provenance (§6.6)')
    .action(() => {
      process.exit(statusCommand());
    });

  program
    .command('new')
    .description('Scaffold a tree skeleton from the §5.3 template')
    .argument('<id>', 'tree id — the slug that becomes content/trees/<id>.yaml')
    .action((id: string) => {
      process.exit(newCommand(id));
    });

  program
    .command('compile')
    .description('YAML → JSON bundles + manifest (§7.1–§7.3)')
    .action(() => {
      process.exit(compileCommand());
    });

  return program;
}
