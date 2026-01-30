/**
 * List command - list modules in a package
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { Network } from '../../types/index.js';
import { createMainGenerator } from '../../core/generator.js';
import { AutoSuiSkillsError } from '../../core/errors.js';

export interface ListOptions {
  network: Network;
  verbose: boolean;
}

export function createListCommand(): Command {
  const cmd = new Command('list');

  cmd
    .description('List modules in a Sui package')
    .argument('<packageId>', 'Package ID (0x...)')
    .option('-n, --network <network>', 'Network: mainnet | testnet | devnet', 'mainnet')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (packageId: string, options: ListOptions) => {
      const spinner = ora('Fetching modules...').start();

      try {
        // Validate network
        const network = validateNetwork(options.network);

        // Create generator
        const generator = createMainGenerator({ network });

        // List modules
        const modules = await generator.listModules(packageId);

        spinner.succeed(chalk.green(`Found ${modules.length} module(s)`));

        console.log('');
        console.log(chalk.cyan(`  Package: ${chalk.white(packageId)}`));
        console.log(chalk.cyan(`  Network: ${chalk.white(network)}`));
        console.log('');
        console.log(chalk.cyan('  Modules:'));

        for (const mod of modules) {
          console.log(`    ${chalk.gray('-')} ${chalk.white(mod)}`);
        }

        console.log('');
        console.log(chalk.gray('  Use "auto-sui-skills generate <packageId>::<module>" to generate a specific module.'));
        console.log('');
      } catch (error) {
        spinner.fail(chalk.red('Failed to list modules'));
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
  if (error instanceof AutoSuiSkillsError) {
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
