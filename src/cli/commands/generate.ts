/**
 * Generate command - generates skill from Sui contract
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { Network, SkillScene } from '../../types/index.js';
import { createMainGenerator } from '../../core/generator.js';
import { MoveWhispererError } from '../../core/errors.js';
import { isValidScene, getSceneDisplayName, SCENE_CONFIGS } from '../../scenes/index.js';

export interface GenerateOptions {
  network: Network;
  output?: string;
  lang: 'en' | 'zh';
  scene: SkillScene;
  scripts: boolean;
  examples: boolean;
  analyzeDeps: boolean;
  includeDiagram: boolean;
  modules?: string;
  verbose: boolean;
}

export function createGenerateCommand(): Command {
  const cmd = new Command('generate');

  const sceneChoices = Object.keys(SCENE_CONFIGS).join(' | ');

  cmd
    .description('Generate skill from Sui Move contract')
    .argument('<input>', 'Package ID (0x...) or Package::Module (0x...::module_name)')
    .option('-n, --network <network>', 'Network: mainnet | testnet | devnet', 'mainnet')
    .option('-o, --output <dir>', 'Output directory')
    .option('-l, --lang <lang>', 'Language: en | zh', 'en')
    .option(`-s, --scene <scene>`, `Scene: ${sceneChoices}`, 'sdk')
    .option('--analyze-deps', 'Analyze dependencies', false)
    .option('--include-diagram', 'Include architecture diagram', false)
    .option('--modules <modules>', 'Comma-separated module filter')
    .option('--no-scripts', 'Skip script generation')
    .option('--no-examples', 'Skip example generation')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (input: string, options: GenerateOptions) => {
      const spinner = ora('Initializing...').start();

      try {
        // Validate network
        const network = validateNetwork(options.network);

        // Validate scene
        const scene = validateScene(options.scene);

        // Parse module filter
        const moduleFilter = options.modules
          ? options.modules.split(',').map(m => m.trim())
          : undefined;

        // Create generator
        const generator = createMainGenerator({
          network,
          language: options.lang,
          includeScripts: options.scripts,
          includeExamples: options.examples,
          outputDir: options.output,
          scene,
          analyzeDependencies: options.analyzeDeps,
          includeArchitectureDiagram: options.includeDiagram,
          moduleFilter,
        });

        // Generate with progress updates
        const result = await generator.generate(input, (_stage, message, progress) => {
          spinner.text = message;
          if (options.verbose && progress !== undefined) {
            spinner.text = `${message} (${progress}%)`;
          }
        });

        spinner.succeed(chalk.green('Skill generated successfully!'));

        // Print summary
        console.log('');
        console.log(chalk.cyan('  Summary:'));
        console.log(`    Package: ${chalk.white(result.analyzedModule.packageId)}`);
        console.log(`    Module:  ${chalk.white(result.analyzedModule.moduleName)}`);
        console.log(`    Network: ${chalk.white(network)}`);
        console.log(`    Scene:   ${chalk.white(getSceneDisplayName(scene, options.lang))}`);
        console.log('');
        console.log(chalk.cyan('  Statistics:'));
        console.log(`    Entry functions: ${chalk.white(result.analyzedModule.metadata.entryFunctions)}`);
        console.log(`    Public functions: ${chalk.white(result.analyzedModule.metadata.publicFunctions)}`);
        console.log(`    Structs: ${chalk.white(result.analyzedModule.metadata.totalStructs)}`);
        console.log(`    Events: ${chalk.white(result.analyzedModule.metadata.totalEvents)}`);
        console.log('');
        console.log(chalk.cyan('  Output:'));
        for (const file of result.writtenFiles.slice(0, 5)) {
          console.log(`    ${chalk.gray('-')} ${chalk.white(file)}`);
        }
        if (result.writtenFiles.length > 5) {
          console.log(`    ${chalk.gray(`... and ${result.writtenFiles.length - 5} more files`)}`);
        }
        console.log('');
      } catch (error) {
        spinner.fail(chalk.red('Generation failed'));
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

function validateScene(scene: string): SkillScene {
  if (!isValidScene(scene)) {
    const valid = Object.keys(SCENE_CONFIGS).join(', ');
    throw new Error(`Invalid scene: ${scene}. Valid options: ${valid}`);
  }
  return scene;
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
