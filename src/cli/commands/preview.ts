/**
 * Preview command - preview skill without saving
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { Network } from '../../types/index.js';
import { createMainGenerator } from '../../core/generator.js';
import { MoveWhispererError } from '../../core/errors.js';

export interface PreviewOptions {
  network: Network;
  verbose: boolean;
}

export function createPreviewCommand(): Command {
  const cmd = new Command('preview');

  cmd
    .description('Preview skill generation without saving files')
    .argument('<input>', 'Package ID (0x...) or Package::Module (0x...::module_name)')
    .option('-n, --network <network>', 'Network: mainnet | testnet | devnet', 'mainnet')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (input: string, options: PreviewOptions) => {
      const spinner = ora('Initializing...').start();

      try {
        // Validate network
        const network = validateNetwork(options.network);

        // Create generator
        const generator = createMainGenerator({
          network,
          includeScripts: true,
          includeExamples: true,
        });

        // Generate preview
        const output = await generator.preview(input, (_stage, message) => {
          spinner.text = message;
        });

        spinner.succeed(chalk.green('Preview generated!'));

        // Print SKILL.md content
        console.log('');
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.cyan.bold('  SKILL.md Preview'));
        console.log(chalk.cyan('═'.repeat(60)));
        console.log('');

        // Print first 100 lines of SKILL.md
        const lines = output.skillMd.split('\n');
        const previewLines = lines.slice(0, 100);
        console.log(previewLines.join('\n'));

        if (lines.length > 100) {
          console.log('');
          console.log(chalk.gray(`... (${lines.length - 100} more lines)`));
        }

        console.log('');
        console.log(chalk.cyan('═'.repeat(60)));
        console.log('');

        // Print summary
        console.log(chalk.cyan('  Generated files (not saved):'));
        console.log(`    ${chalk.gray('-')} SKILL.md`);
        console.log(`    ${chalk.gray('-')} references/abi.json`);
        console.log(`    ${chalk.gray('-')} references/types.md`);
        if (output.references.events) {
          console.log(`    ${chalk.gray('-')} references/events.md`);
        }
        if (output.scripts.call) {
          console.log(`    ${chalk.gray('-')} scripts/call.ts`);
        }
        if (output.scripts.read) {
          console.log(`    ${chalk.gray('-')} scripts/read.ts`);
        }
        console.log('');
        console.log(chalk.gray('  Use "move-whisperer generate" to save files.'));
        console.log('');
      } catch (error) {
        spinner.fail(chalk.red('Preview failed'));
        handleError(error, options.verbose);
        process.exit(1);
      }
    });

  return cmd;
}

function validateNetwork(network: string): Network {
  const valid: Network[] = ['mainnet', 'testnet', 'devnet'];
  if (!valid.includes(network as Network)) {
    throw new Error(`Invalid network: ${network}. Valid options: ${valid.join(', ')}`);
  }
  return network as Network;
}

function handleError(error: unknown, verbose: boolean): void {
  if (error instanceof MoveWhispererError) {
    console.error(chalk.red(`\n  Error [${error.code}]: ${error.message}`));
    if (error.details && verbose) {
      console.error(chalk.gray(`  Details: ${JSON.stringify(error.details, null, 2)}`));
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(`\n  Error: ${error.message}`));
    if (verbose && error.stack) {
      console.error(chalk.gray(error.stack));
    }
  } else {
    console.error(chalk.red(`\n  Error: ${String(error)}`));
  }
}
