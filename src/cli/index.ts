/**
 * CLI program setup
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '../index.js';
import { createGenerateCommand } from './commands/generate.js';
import { createPreviewCommand } from './commands/preview.js';
import { createListCommand } from './commands/list.js';
import { createSourceCommand } from './commands/source.js';

/**
 * Create the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('auto-sui-skills')
    .description('Auto-generate Claude skills from Sui Move contracts')
    .version(VERSION, '-V, --version', 'Display version number');

  // Add commands
  program.addCommand(createGenerateCommand());
  program.addCommand(createPreviewCommand());
  program.addCommand(createListCommand());
  program.addCommand(createSourceCommand());

  // Custom help
  program.addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.gray('# Generate skill from a specific module')}
  $ auto-sui-skills generate 0xdee9::clob_v2 -n mainnet

  ${chalk.gray('# Generate skill from entire package')}
  $ auto-sui-skills generate 0xdee9 -n mainnet -o ./skills/deepbook

  ${chalk.gray('# Preview without saving')}
  $ auto-sui-skills preview 0x2::coin -n mainnet

  ${chalk.gray('# List modules in a package')}
  $ auto-sui-skills list 0xdee9 -n mainnet

  ${chalk.gray('# Download source code for a module')}
  $ auto-sui-skills source 0xdee9::clob_v2 -n mainnet

  ${chalk.gray('# Download all source code to files')}
  $ auto-sui-skills source 0xdee9 -n mainnet -f file -o ./deepbook-source

${chalk.cyan('More info:')}
  Repository: https://github.com/example/auto-sui-skills
  `);

  return program;
}

/**
 * Run the CLI
 */
export async function run(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

export * from './commands/index.js';
