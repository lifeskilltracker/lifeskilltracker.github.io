import { Command } from 'commander';

import { idsCommand } from './ids/index.js';
import { validateCommand } from './validate/index.js';
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
    .command('compile')
    .description('YAML → JSON bundles + manifest (§7.1–§7.3)')
    .action(() => {
      process.exit(compileCommand());
    });

  return program;
}
