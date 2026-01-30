/**
 * Source code download command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import type { Network } from '../../types/index.js';
import { parsePackageInput } from '../../fetcher/index.js';
import { createSuiClient } from '../../fetcher/sui-client.js';
import { InputValidationError } from '../../core/errors.js';

interface SourceOptions {
  network: string;
  output?: string;
  module?: string;
  format: 'console' | 'file' | 'json';
}

/**
 * Validate network option
 */
function validateNetwork(network: string): Network {
  const valid: Network[] = ['mainnet', 'testnet', 'devnet'];
  if (!valid.includes(network as Network)) {
    throw new InputValidationError(`Invalid network: ${network}. Valid options: ${valid.join(', ')}`);
  }
  return network as Network;
}

/**
 * Create source command
 */
export function createSourceCommand(): Command {
  const command = new Command('source');

  command
    .description('Download and display disassembled Move source code from on-chain')
    .argument('<package>', 'Package ID or package::module format')
    .option('-n, --network <network>', 'Sui network (mainnet, testnet, devnet)', 'mainnet')
    .option('-m, --module <module>', 'Specific module name (downloads all if not specified)')
    .option('-o, --output <path>', 'Output file or directory path')
    .option('-f, --format <format>', 'Output format: console, file, json', 'console')
    .action(async (packageInput: string, options: SourceOptions) => {
      const spinner = ora('Fetching source code...').start();

      try {
        const network = validateNetwork(options.network);
        const { packageId, moduleName: inputModule } = parsePackageInput(packageInput);
        const targetModule = options.module || inputModule;

        const client = createSuiClient(network);

        if (targetModule) {
          // Download single module
          spinner.text = `Fetching source for ${packageId}::${targetModule}...`;

          const sourceCode = await client.getModuleSource(packageId, targetModule);

          if (!sourceCode) {
            spinner.fail(chalk.red(`No source code found for ${packageId}::${targetModule}`));
            process.exit(1);
          }

          spinner.succeed(chalk.green(`Downloaded source for ${packageId}::${targetModule}`));

          await outputSource(
            { [targetModule]: sourceCode },
            packageId,
            options
          );
        } else {
          // Download all modules
          spinner.text = `Fetching all modules from ${packageId}...`;

          const sources = await client.getDisassembledSource(packageId);
          const moduleNames = Object.keys(sources);

          if (moduleNames.length === 0) {
            spinner.fail(chalk.red(`No modules found in package ${packageId}`));
            process.exit(1);
          }

          spinner.succeed(chalk.green(`Downloaded ${moduleNames.length} module(s) from ${packageId}`));

          await outputSource(sources, packageId, options);
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to fetch source code'));
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        }
        process.exit(1);
      }
    });

  return command;
}

/**
 * Output source code based on format option
 */
async function outputSource(
  sources: Record<string, string>,
  packageId: string,
  options: SourceOptions
): Promise<void> {
  const moduleNames = Object.keys(sources);

  switch (options.format) {
    case 'console':
      for (const [moduleName, code] of Object.entries(sources)) {
        console.log();
        console.log(chalk.cyan(`// ========== ${packageId}::${moduleName} ==========`));
        console.log();
        console.log(code);
        console.log();
      }
      break;

    case 'file':
      const outputPath = options.output || `./source-${packageId.slice(0, 10)}`;
      await fs.mkdir(outputPath, { recursive: true });

      for (const [moduleName, code] of Object.entries(sources)) {
        const filePath = path.join(outputPath, `${moduleName}.move`);
        await fs.writeFile(filePath, code, 'utf-8');
        console.log(chalk.green(`✓ Written: ${filePath}`));
      }

      console.log();
      console.log(chalk.cyan(`Source code saved to: ${outputPath}/`));
      console.log(chalk.gray(`Total modules: ${moduleNames.length}`));
      break;

    case 'json':
      const jsonOutput = {
        packageId,
        fetchedAt: new Date().toISOString(),
        modules: sources,
      };

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(jsonOutput, null, 2), 'utf-8');
        console.log(chalk.green(`✓ Written: ${options.output}`));
      } else {
        console.log(JSON.stringify(jsonOutput, null, 2));
      }
      break;
  }

  // Print summary
  console.log();
  console.log(chalk.cyan('Summary:'));
  console.log(`  Package ID: ${chalk.white(packageId)}`);
  console.log(`  Modules: ${chalk.white(moduleNames.join(', '))}`);
  console.log(`  Total: ${chalk.white(moduleNames.length)} module(s)`);
}
