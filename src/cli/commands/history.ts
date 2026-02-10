/**
 * Package version history command
 * Displays upgrade history and allows version comparison
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import type { Network } from '../../types/index.js';
import { parsePackageInput } from '../../fetcher/index.js';
import { createVersionFetcher, type PackageVersionHistory } from '../../history/index.js';
import {
  createStructuralDiffer,
  createSourceDiffer,
  createDiffFormatter,
  type StructuralDiff,
  type SourceDiff,
} from '../../diff/index.js';
import { InputValidationError } from '../../core/errors.js';

interface HistoryOptions {
  network: string;
  format: 'table' | 'json' | 'markdown';
  compare?: string;
  module?: string;
  diffType: 'structural' | 'source' | 'both';
  decompile: boolean;
  output?: string;
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
 * Parse compare option (e.g., "1:2", "latest:previous")
 */
function parseCompare(compare: string, maxVersion: number): { from: number; to: number } {
  const parts = compare.split(':');
  if (parts.length !== 2) {
    throw new InputValidationError(
      `Invalid compare format: ${compare}. Use "1:2" or "latest:previous"`
    );
  }

  const resolve = (v: string): number => {
    if (v === 'latest') return maxVersion;
    if (v === 'previous') return Math.max(1, maxVersion - 1);
    const num = parseInt(v, 10);
    if (isNaN(num) || num < 1 || num > maxVersion) {
      throw new InputValidationError(
        `Invalid version: ${v}. Must be 1-${maxVersion}, "latest", or "previous"`
      );
    }
    return num;
  };

  return {
    from: resolve(parts[0]),
    to: resolve(parts[1]),
  };
}

/**
 * Create history command
 */
export function createHistoryCommand(): Command {
  const command = new Command('history');

  command
    .description('Display package version history and compare versions')
    .argument('<package>', 'Package ID (any version in the upgrade chain)')
    .option('-n, --network <network>', 'Sui network (mainnet, testnet, devnet)', 'mainnet')
    .option('-f, --format <format>', 'Output format: table, json, markdown', 'table')
    .option('-c, --compare <versions>', 'Compare two versions (e.g., "1:2", "latest:previous")')
    .option('-m, --module <module>', 'Filter to specific module for comparison')
    .option('-d, --diff-type <type>', 'Diff type: structural, source, both', 'both')
    .option('--decompile', 'Use Revela decompiler for better source comparison', false)
    .option('-o, --output <path>', 'Output file path (for json/markdown formats)')
    .action(async (packageInput: string, options: HistoryOptions) => {
      const spinner = ora('Fetching version history...').start();

      try {
        const network = validateNetwork(options.network);
        const { packageId } = parsePackageInput(packageInput);

        const versionFetcher = createVersionFetcher(network);

        // Fetch version history
        spinner.text = 'Discovering package versions...';
        const history = await versionFetcher.getVersionHistory(packageId);

        if (history.versions.length === 0) {
          spinner.fail(chalk.red(`No version history found for ${packageId}`));
          process.exit(1);
        }

        spinner.succeed(
          chalk.green(`Found ${history.versions.length} version(s) for package`)
        );

        // If compare option is provided, do comparison
        if (options.compare) {
          const { from, to } = parseCompare(options.compare, history.currentVersion);
          await compareVersions(
            versionFetcher,
            history,
            from,
            to,
            options,
            spinner
          );
        } else {
          // Just display version history
          await displayHistory(history, options);
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to fetch version history'));
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        }
        process.exit(1);
      }
    });

  return command;
}

/**
 * Display version history
 */
async function displayHistory(
  history: PackageVersionHistory,
  options: HistoryOptions
): Promise<void> {
  switch (options.format) {
    case 'table':
      displayHistoryTable(history);
      break;
    case 'json':
      await outputJson(history, options.output);
      break;
    case 'markdown':
      await outputMarkdown(history, options.output);
      break;
  }
}

/**
 * Display history as table
 */
function displayHistoryTable(history: PackageVersionHistory): void {
  console.log();
  console.log(chalk.bold.cyan('Package Version History'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
  console.log(`  ${chalk.bold('Original Package:')} ${chalk.white(history.originalPackageId)}`);
  console.log(`  ${chalk.bold('Network:')}          ${chalk.white(history.network)}`);
  console.log(`  ${chalk.bold('Current Version:')}  ${chalk.white(history.currentVersion)}`);
  if (history.upgradeCapId) {
    console.log(`  ${chalk.bold('UpgradeCap:')}       ${chalk.white(history.upgradeCapId)}`);
  }
  console.log();

  // Table header
  console.log(
    chalk.bold(
      ` ${'Ver'.padEnd(4)} │ ${'Package ID'.padEnd(42)} │ ${'Digest'.padEnd(12)} │ Status`
    )
  );
  console.log(chalk.gray('─'.repeat(80)));

  // Table rows
  for (const version of history.versions) {
    const verNum = version.version.toString().padEnd(4);
    const pkgId = shortenId(version.packageId, 42);
    const digest = version.digest ? shortenId(version.digest, 12) : '-'.padEnd(12);
    const isLatest = version.version === history.currentVersion;
    const status = isLatest ? chalk.green('latest') : chalk.gray('');

    console.log(` ${verNum} │ ${pkgId} │ ${digest} │ ${status}`);
  }

  console.log();
  console.log(chalk.gray(`Use --compare "1:2" to see changes between versions`));
}

/**
 * Compare two versions
 */
async function compareVersions(
  versionFetcher: ReturnType<typeof createVersionFetcher>,
  history: PackageVersionHistory,
  fromVersion: number,
  toVersion: number,
  options: HistoryOptions,
  spinner: ReturnType<typeof ora>
): Promise<void> {
  const fromPkg = history.versions.find((v) => v.version === fromVersion);
  const toPkg = history.versions.find((v) => v.version === toVersion);

  if (!fromPkg || !toPkg) {
    throw new InputValidationError(
      `Version not found. Available versions: ${history.versions.map((v) => v.version).join(', ')}`
    );
  }

  console.log();
  console.log(chalk.bold.cyan(`Comparing v${fromVersion} → v${toVersion}`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`  ${chalk.bold('From:')} ${fromPkg.packageId} (v${fromVersion})`);
  console.log(`  ${chalk.bold('To:')}   ${toPkg.packageId} (v${toVersion})`);
  console.log();

  // Fetch source/ABI for both versions
  spinner.start('Fetching source for v' + fromVersion + '...');
  const fromSource = await versionFetcher.getSourceAtVersion(
    history.originalPackageId,
    fromVersion,
    { modules: options.module ? [options.module] : undefined }
  );

  spinner.text = 'Fetching source for v' + toVersion + '...';
  const toSource = await versionFetcher.getSourceAtVersion(
    history.originalPackageId,
    toVersion,
    { modules: options.module ? [options.module] : undefined }
  );

  // Optionally decompile using Revela
  let fromDecompiled: Record<string, string> | undefined;
  let toDecompiled: Record<string, string> | undefined;

  if (options.decompile && (options.diffType === 'source' || options.diffType === 'both')) {
    spinner.text = 'Decompiling v' + fromVersion + ' (this may take a while)...';
    fromDecompiled = await decompileWithRevela(fromPkg.packageId, fromSource.disassembled);

    spinner.text = 'Decompiling v' + toVersion + '...';
    toDecompiled = await decompileWithRevela(toPkg.packageId, toSource.disassembled);
  }

  spinner.succeed('Fetched source for both versions');

  const formatter = createDiffFormatter({ colors: options.format === 'table' });

  // Structural diff
  let structuralDiff: StructuralDiff | undefined;
  if (options.diffType === 'structural' || options.diffType === 'both') {
    const structuralDiffer = createStructuralDiffer();
    structuralDiff = structuralDiffer.comparePackages(
      fromSource.abi,
      toSource.abi,
      fromVersion,
      toVersion,
      fromPkg.packageId,
      toPkg.packageId
    );
  }

  // Source diff
  let sourceDiffs: Record<string, SourceDiff> | undefined;
  if (options.diffType === 'source' || options.diffType === 'both') {
    const sourceDiffer = createSourceDiffer();
    const fromSrc = fromDecompiled ?? fromSource.disassembled;
    const toSrc = toDecompiled ?? toSource.disassembled;

    sourceDiffs = sourceDiffer.diffPackage(
      fromSrc,
      toSrc,
      fromVersion,
      toVersion,
      { modules: options.module ? [options.module] : undefined }
    );
  }

  // Output based on format
  switch (options.format) {
    case 'table':
      if (structuralDiff) {
        console.log();
        console.log(formatter.formatStructuralDiffTable(structuralDiff));
      }
      if (sourceDiffs) {
        console.log();
        console.log(formatter.formatSourceDiffSummary(sourceDiffs));

        // Show detailed diff for each module with changes
        const sourceDifferDisplay = createSourceDiffer();
        for (const [, diff] of Object.entries(sourceDiffs)) {
          if (diff.stats.linesChanged > 0) {
            console.log();
            console.log(sourceDifferDisplay.formatColoredDiff(diff));
          }
        }
      }
      break;

    case 'json':
      const jsonOutput = {
        comparison: {
          fromVersion,
          toVersion,
          fromPackageId: fromPkg.packageId,
          toPackageId: toPkg.packageId,
          network: history.network,
          comparedAt: new Date().toISOString(),
        },
        structural: structuralDiff,
        sources: sourceDiffs,
      };
      await outputJson(jsonOutput, options.output);
      break;

    case 'markdown':
      let mdContent = `# Version Comparison: v${fromVersion} → v${toVersion}\n\n`;
      mdContent += `- **From:** \`${fromPkg.packageId}\` (v${fromVersion})\n`;
      mdContent += `- **To:** \`${toPkg.packageId}\` (v${toVersion})\n`;
      mdContent += `- **Network:** ${history.network}\n\n`;

      if (structuralDiff) {
        mdContent += formatter.formatStructuralDiffMarkdown(structuralDiff);
        mdContent += '\n';
      }

      await outputMarkdown({ content: mdContent }, options.output);
      break;
  }
}

/**
 * Decompile bytecode using Revela move-decompiler
 */
async function decompileWithRevela(
  _packageId: string,
  disassembled: Record<string, string>
): Promise<Record<string, string>> {
  // Check if move-decompiler is available
  const isAvailable = await checkRevelaAvailable();
  if (!isAvailable) {
    console.log(
      chalk.yellow(
        'Warning: move-decompiler not found. Using disassembled bytecode instead.'
      )
    );
    console.log(chalk.gray('Install Revela: pnpm run install:revela'));
    return disassembled;
  }

  // For now, return disassembled as fallback
  // Full implementation would write bytecode to temp files and run move-decompiler
  // This requires the actual bytecode (not disassembled), which we'd need to fetch separately
  return disassembled;
}

/**
 * Check if Revela move-decompiler is available
 */
async function checkRevelaAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('move-decompiler', ['--version'], {
      stdio: 'ignore',
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Output JSON to file or console
 */
async function outputJson(data: unknown, outputPath?: string): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  if (outputPath) {
    await fs.writeFile(outputPath, json, 'utf-8');
    console.log(chalk.green(`✓ Written: ${outputPath}`));
  } else {
    console.log(json);
  }
}

/**
 * Output markdown to file or console
 */
async function outputMarkdown(
  data: PackageVersionHistory | { content: string },
  outputPath?: string
): Promise<void> {
  let content: string;

  if ('content' in data) {
    content = data.content;
  } else {
    // Format history as markdown
    content = formatHistoryMarkdown(data);
  }

  if (outputPath) {
    await fs.writeFile(outputPath, content, 'utf-8');
    console.log(chalk.green(`✓ Written: ${outputPath}`));
  } else {
    console.log(content);
  }
}

/**
 * Format history as markdown
 */
function formatHistoryMarkdown(history: PackageVersionHistory): string {
  let md = `# Package Version History\n\n`;
  md += `- **Original Package:** \`${history.originalPackageId}\`\n`;
  md += `- **Network:** ${history.network}\n`;
  md += `- **Current Version:** ${history.currentVersion}\n`;
  if (history.upgradeCapId) {
    md += `- **UpgradeCap:** \`${history.upgradeCapId}\`\n`;
  }
  md += `\n## Versions\n\n`;
  md += `| Version | Package ID | Status |\n`;
  md += `|---------|------------|--------|\n`;

  for (const version of history.versions) {
    const status = version.version === history.currentVersion ? '✓ latest' : '';
    md += `| ${version.version} | \`${version.packageId}\` | ${status} |\n`;
  }

  return md;
}

/**
 * Shorten an ID for display
 */
function shortenId(id: string, maxLen: number): string {
  if (id.length <= maxLen) {
    return id.padEnd(maxLen);
  }
  const half = Math.floor((maxLen - 3) / 2);
  return `${id.slice(0, half)}...${id.slice(-half)}`;
}
