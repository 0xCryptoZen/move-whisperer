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
import { createServeCommand } from './commands/serve.js';
import { createHistoryCommand } from './commands/history.js';
import { createTxCommand } from './commands/tx.js';

/**
 * Create the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('move-whisperer')
    .description('MoveWhisperer - The AI that speaks Move')
    .version(VERSION, '-V, --version', 'Display version number');

  // Add commands
  program.addCommand(createGenerateCommand());
  program.addCommand(createPreviewCommand());
  program.addCommand(createListCommand());
  program.addCommand(createSourceCommand());
  program.addCommand(createServeCommand());
  program.addCommand(createHistoryCommand());
  program.addCommand(createTxCommand());

  // Custom help
  program.addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.gray('# Generate skill from a specific module')}
  $ move-whisperer generate 0xdee9::clob_v2 -n mainnet

  ${chalk.gray('# Generate skill from entire package')}
  $ move-whisperer generate 0xdee9 -n mainnet -o ./skills/deepbook

  ${chalk.gray('# Preview without saving')}
  $ move-whisperer preview 0x2::coin -n mainnet

  ${chalk.gray('# List modules in a package')}
  $ move-whisperer list 0xdee9 -n mainnet

  ${chalk.gray('# Download source code for a module')}
  $ move-whisperer source 0xdee9::clob_v2 -n mainnet

  ${chalk.gray('# Download all source code to files')}
  $ move-whisperer source 0xdee9 -n mainnet -f file -o ./deepbook-source

  ${chalk.gray('# Start local server for web UI')}
  $ move-whisperer serve --port 3456

  ${chalk.gray('# Start server and open browser')}
  $ move-whisperer serve --open

  ${chalk.gray('# View package version history')}
  $ move-whisperer history 0xdee9 -n mainnet

  ${chalk.gray('# Compare two versions')}
  $ move-whisperer history 0xdee9 --compare 1:2

  ${chalk.gray('# Compare with decompiled source')}
  $ move-whisperer history 0xdee9 --compare latest:previous --decompile

  ${chalk.gray('# Analyze a transaction')}
  $ move-whisperer tx 0xabc123... -n mainnet

  ${chalk.gray('# Analyze transaction with verbose output')}
  $ move-whisperer tx 0xabc123... -n mainnet --verbose

  ${chalk.gray('# Output transaction analysis as JSON')}
  $ move-whisperer tx 0xabc123... --json

${chalk.cyan('More info:')}
  Repository: https://github.com/example/move-whisperer
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
