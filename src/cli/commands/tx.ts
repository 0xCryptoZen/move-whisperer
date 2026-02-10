/**
 * TX Command
 * Generate skill from Sui transaction hash
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createTransactionFetcher } from '../../fetcher/transaction-fetcher.js';
import { createTransactionParser, type TransactionType } from '../../analyzer/transaction-parser.js';
import type { Network } from '../../types/index.js';

// Transaction type labels
const TYPE_LABELS: Record<TransactionType, { label: string; color: string }> = {
  swap: { label: 'Token Swap', color: 'cyan' },
  transfer: { label: 'Transfer', color: 'green' },
  mint: { label: 'Mint', color: 'magenta' },
  burn: { label: 'Burn', color: 'red' },
  stake: { label: 'Stake', color: 'blue' },
  unstake: { label: 'Unstake', color: 'yellow' },
  liquidity_add: { label: 'Add Liquidity', color: 'cyan' },
  liquidity_remove: { label: 'Remove Liquidity', color: 'yellow' },
  borrow: { label: 'Borrow', color: 'magenta' },
  repay: { label: 'Repay', color: 'green' },
  claim: { label: 'Claim Rewards', color: 'green' },
  governance: { label: 'Governance', color: 'blue' },
  upgrade: { label: 'Package Upgrade', color: 'yellow' },
  publish: { label: 'Package Publish', color: 'magenta' },
  complex: { label: 'Complex Transaction', color: 'white' },
  unknown: { label: 'Unknown', color: 'gray' },
};

export function createTxCommand(): Command {
  const cmd = new Command('tx');

  cmd
    .description('Analyze a Sui transaction and generate skill')
    .argument('<digest>', 'Transaction digest (0x...)')
    .option('-n, --network <network>', 'Network: mainnet | testnet | devnet', 'mainnet')
    .option('-o, --output <dir>', 'Output directory for generated skill')
    .option('-l, --lang <lang>', 'Language: en | zh', 'en')
    .option('-v, --verbose', 'Show detailed output', false)
    .option('--json', 'Output as JSON', false)
    .action(async (digest: string, options) => {
      const spinner = ora();

      try {
        // Validate digest
        if (!digest.startsWith('0x') && !digest.match(/^[a-zA-Z0-9]+$/)) {
          console.error(chalk.red('Error: Invalid transaction digest format'));
          process.exit(1);
        }

        // Validate network
        const network = options.network as Network;
        if (!['mainnet', 'testnet', 'devnet'].includes(network)) {
          console.error(chalk.red('Error: Network must be mainnet, testnet, or devnet'));
          process.exit(1);
        }

        console.log(chalk.bold('\n🔍 Sui Transaction Analyzer\n'));
        console.log(chalk.gray(`Digest: ${digest}`));
        console.log(chalk.gray(`Network: ${network}\n`));

        // Fetch transaction
        spinner.start('Fetching transaction...');
        const fetcher = createTransactionFetcher({ network });
        const tx = await fetcher.fetchTransaction(digest);
        spinner.succeed('Transaction fetched');

        if (tx.status === 'failure') {
          console.log(chalk.red(`\n⚠️  Transaction failed: ${tx.errorMessage || 'Unknown error'}\n`));
        }

        // Parse transaction
        spinner.start('Analyzing transaction...');
        const parser = createTransactionParser();
        const result = parser.parse(tx);
        spinner.succeed('Analysis complete');

        // Output results
        if (options.json) {
          console.log(JSON.stringify({
            digest: tx.digest,
            network,
            status: tx.status,
            type: result.transactionType,
            confidence: result.typeConfidence,
            summary: {
              moveCalls: result.summary.totalMoveCalls,
              packages: result.summary.uniquePackages,
              modules: result.summary.uniqueModules,
              gasUsed: result.summary.gasUsedTotal,
              objectsCreated: result.summary.objectsCreated,
              objectsDeleted: result.summary.objectsDeleted,
              events: result.summary.eventsEmitted,
            },
            involvedPackages: result.involvedPackages,
            callSequence: result.callSequence.map(c => ({
              index: c.index,
              target: `${c.call.packageId}::${c.call.moduleName}::${c.call.functionName}`,
              purpose: c.purpose,
            })),
          }, null, 2));
        } else {
          // Pretty print results
          const typeInfo = TYPE_LABELS[result.transactionType];
          const typeLabel = (chalk as unknown as Record<string, (s: string) => string>)[typeInfo.color]?.(typeInfo.label) || typeInfo.label;

          console.log(chalk.bold('\n📊 Transaction Analysis\n'));
          console.log(`  Type: ${typeLabel} (${Math.round(result.typeConfidence * 100)}% confidence)`);
          console.log(`  Status: ${tx.status === 'success' ? chalk.green('Success') : chalk.red('Failed')}`);
          console.log(`  Sender: ${chalk.gray(tx.sender)}`);
          console.log(`  Timestamp: ${tx.timestamp ? new Date(parseInt(tx.timestamp)).toISOString() : 'N/A'}`);
          console.log(`  Gas Used: ${chalk.yellow(formatGas(result.summary.gasUsedTotal))}`);

          console.log(chalk.bold('\n📦 Packages Involved\n'));
          for (const pkg of result.involvedPackages) {
            const shortId = `${pkg.packageId.slice(0, 10)}...`;
            console.log(`  ${chalk.cyan(pkg.moduleName)} (${chalk.gray(shortId)})`);
            console.log(`    Functions: ${pkg.functionsUsed.join(', ')}`);
            console.log(`    Calls: ${pkg.callCount}`);
          }

          console.log(chalk.bold('\n🔗 Call Sequence\n'));
          for (const entry of result.callSequence) {
            const target = `${entry.call.moduleName}::${chalk.white(entry.call.functionName)}`;
            console.log(`  ${entry.index + 1}. ${target}`);
            console.log(`     ${chalk.gray(entry.purpose)}`);
            if (entry.call.typeArguments.length > 0 && options.verbose) {
              console.log(`     Type args: ${chalk.gray(entry.call.typeArguments.join(', '))}`);
            }
          }

          if (result.summary.coinTypesInvolved.length > 0) {
            console.log(chalk.bold('\n💰 Coins Involved\n'));
            for (const coinType of result.summary.coinTypesInvolved) {
              const shortType = coinType.split('::').pop() || coinType;
              const netChange = result.summary.netValueChanges.get(coinType);
              if (netChange !== undefined) {
                const sign = netChange >= 0n ? '+' : '';
                const color = netChange >= 0n ? 'green' : 'red';
                console.log(`  ${shortType}: ${(chalk as unknown as Record<string, (s: string) => string>)[color]?.(`${sign}${formatAmount(netChange)}`) || `${sign}${formatAmount(netChange)}`}`);
              } else {
                console.log(`  ${shortType}`);
              }
            }
          }

          if (tx.events.length > 0) {
            console.log(chalk.bold('\n📢 Events Emitted\n'));
            for (const event of tx.events.slice(0, 5)) {
              const eventName = event.eventType.split('::').pop() || event.eventType;
              console.log(`  • ${chalk.magenta(eventName)}`);
            }
            if (tx.events.length > 5) {
              console.log(chalk.gray(`  ... and ${tx.events.length - 5} more`));
            }
          }

          console.log();

          // TODO: Generate skill file when TransactionSkillGenerator is implemented
          if (options.output) {
            console.log(chalk.yellow('⚠️  Skill generation not yet implemented'));
            console.log(chalk.gray(`   Output would be saved to: ${options.output}`));
          }
        }
      } catch (error) {
        spinner.fail('Error');
        console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
        if (options.verbose && error instanceof Error) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Format gas amount
 */
function formatGas(gas: string): string {
  const value = BigInt(gas);
  if (value >= 1_000_000_000n) {
    return `${(Number(value) / 1_000_000_000).toFixed(4)} SUI`;
  }
  if (value >= 1_000_000n) {
    return `${(Number(value) / 1_000_000).toFixed(2)} MIST`;
  }
  return `${value} wei`;
}

/**
 * Format coin amount
 */
function formatAmount(amount: bigint): string {
  const abs = amount < 0n ? -amount : amount;
  if (abs >= 1_000_000_000n) {
    return `${(Number(amount) / 1_000_000_000).toFixed(4)}`;
  }
  if (abs >= 1_000_000n) {
    return `${(Number(amount) / 1_000_000).toFixed(2)}M`;
  }
  return amount.toString();
}
