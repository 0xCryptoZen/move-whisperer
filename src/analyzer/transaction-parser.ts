/**
 * Transaction Parser
 * Parses and classifies Sui transactions for skill generation
 */

import type {
  FetchedTransaction,
  ParsedMoveCall,
  InvolvedPackage,
} from '../fetcher/transaction-fetcher.js';

// ============ Types ============

export type TransactionType =
  | 'swap'              // DEX swap
  | 'transfer'          // Simple transfer
  | 'mint'              // NFT/token mint
  | 'burn'              // Token burn
  | 'stake'             // Staking
  | 'unstake'           // Unstaking
  | 'liquidity_add'     // Add liquidity
  | 'liquidity_remove'  // Remove liquidity
  | 'borrow'            // Lending borrow
  | 'repay'             // Lending repay
  | 'claim'             // Claim rewards
  | 'governance'        // Governance action
  | 'upgrade'           // Package upgrade
  | 'publish'           // Package publish
  | 'complex'           // Multi-operation
  | 'unknown';

export interface TransactionParseResult {
  // High-level classification
  transactionType: TransactionType;
  typeConfidence: number;  // 0-1

  // Primary package (the main contract being interacted with)
  primaryPackage: InvolvedPackage | null;

  // All packages involved
  involvedPackages: InvolvedPackage[];

  // Call sequence analysis
  callSequence: CallSequenceEntry[];

  // Object flow tracking
  objectFlow: ObjectFlowEntry[];

  // Summary statistics
  summary: TransactionSummary;
}

export interface CallSequenceEntry {
  index: number;
  call: ParsedMoveCall;
  purpose: string;
  inputObjects: string[];
  createsObjects: boolean;
  modifiesObjects: boolean;
}

export interface ObjectFlowEntry {
  objectId: string;
  objectType: string;
  shortType: string;
  lifecycle: ObjectLifecycleStep[];
  finalState: 'transferred' | 'deleted' | 'wrapped' | 'returned' | 'shared' | 'created';
}

export interface ObjectLifecycleStep {
  action: 'created' | 'read' | 'mutated' | 'deleted' | 'transferred' | 'wrapped';
  atCallIndex: number;
  details?: string;
}

export interface TransactionSummary {
  totalMoveCalls: number;
  uniquePackages: number;
  uniqueModules: number;
  gasUsedTotal: string;
  objectsCreated: number;
  objectsDeleted: number;
  objectsMutated: number;
  eventsEmitted: number;
  coinTypesInvolved: string[];
  netValueChanges: Map<string, bigint>;  // coinType -> amount
}

// ============ Known Protocol Patterns ============

interface ProtocolPattern {
  packagePatterns: RegExp[];
  functionPatterns: RegExp[];
  transactionType: TransactionType;
  confidence: number;
}

const PROTOCOL_PATTERNS: ProtocolPattern[] = [
  // Cetus DEX
  {
    packagePatterns: [/^0x1eabed72c53feb73/],
    functionPatterns: [/swap/, /flash_swap/],
    transactionType: 'swap',
    confidence: 0.95,
  },
  {
    packagePatterns: [/^0x1eabed72c53feb73/],
    functionPatterns: [/add_liquidity/, /open_position/],
    transactionType: 'liquidity_add',
    confidence: 0.9,
  },
  {
    packagePatterns: [/^0x1eabed72c53feb73/],
    functionPatterns: [/remove_liquidity/, /close_position/],
    transactionType: 'liquidity_remove',
    confidence: 0.9,
  },
  // DeepBook
  {
    packagePatterns: [/^0xdee9/],
    functionPatterns: [/place.*order/, /swap/],
    transactionType: 'swap',
    confidence: 0.9,
  },
  // Turbos
  {
    packagePatterns: [/^0x91bfb/],
    functionPatterns: [/swap/],
    transactionType: 'swap',
    confidence: 0.9,
  },
  // Scallop Lending
  {
    packagePatterns: [/^0xefe8b/],
    functionPatterns: [/deposit/],
    transactionType: 'stake',
    confidence: 0.85,
  },
  {
    packagePatterns: [/^0xefe8b/],
    functionPatterns: [/borrow/],
    transactionType: 'borrow',
    confidence: 0.9,
  },
  {
    packagePatterns: [/^0xefe8b/],
    functionPatterns: [/repay/],
    transactionType: 'repay',
    confidence: 0.9,
  },
  // Standard library operations
  {
    packagePatterns: [/^0x0*2$/],
    functionPatterns: [/^transfer$/],
    transactionType: 'transfer',
    confidence: 0.95,
  },
  {
    packagePatterns: [/^0x0*2$/],
    functionPatterns: [/^public_transfer$/],
    transactionType: 'transfer',
    confidence: 0.95,
  },
  // Generic patterns
  {
    packagePatterns: [/.*/],
    functionPatterns: [/swap/, /exchange/],
    transactionType: 'swap',
    confidence: 0.7,
  },
  {
    packagePatterns: [/.*/],
    functionPatterns: [/mint/, /create_nft/],
    transactionType: 'mint',
    confidence: 0.75,
  },
  {
    packagePatterns: [/.*/],
    functionPatterns: [/burn/],
    transactionType: 'burn',
    confidence: 0.75,
  },
  {
    packagePatterns: [/.*/],
    functionPatterns: [/stake/, /deposit/],
    transactionType: 'stake',
    confidence: 0.65,
  },
  {
    packagePatterns: [/.*/],
    functionPatterns: [/unstake/, /withdraw/],
    transactionType: 'unstake',
    confidence: 0.65,
  },
  {
    packagePatterns: [/.*/],
    functionPatterns: [/claim/, /harvest/],
    transactionType: 'claim',
    confidence: 0.7,
  },
  {
    packagePatterns: [/.*/],
    functionPatterns: [/vote/, /propose/],
    transactionType: 'governance',
    confidence: 0.7,
  },
];

// ============ TransactionParser Class ============

export class TransactionParser {
  /**
   * Parse a fetched transaction
   */
  parse(tx: FetchedTransaction): TransactionParseResult {
    const involvedPackages = this.extractInvolvedPackages(tx);
    const callSequence = this.analyzeCallSequence(tx);
    const objectFlow = this.traceObjectFlow(tx);
    const summary = this.generateSummary(tx);

    const { type, confidence } = this.inferTransactionType(tx, callSequence);
    const primaryPackage = this.identifyPrimaryPackage(involvedPackages, callSequence);

    return {
      transactionType: type,
      typeConfidence: confidence,
      primaryPackage,
      involvedPackages,
      callSequence,
      objectFlow,
      summary,
    };
  }

  /**
   * Extract all involved packages
   */
  private extractInvolvedPackages(tx: FetchedTransaction): InvolvedPackage[] {
    const packageMap = new Map<string, InvolvedPackage>();

    for (const call of tx.moveCalls) {
      const key = `${call.packageId}::${call.moduleName}`;
      const existing = packageMap.get(key);

      if (existing) {
        if (!existing.functionsUsed.includes(call.functionName)) {
          existing.functionsUsed.push(call.functionName);
        }
        existing.callCount++;
      } else {
        packageMap.set(key, {
          packageId: call.packageId,
          moduleName: call.moduleName,
          functionsUsed: [call.functionName],
          callCount: 1,
        });
      }
    }

    return Array.from(packageMap.values());
  }

  /**
   * Analyze the call sequence
   */
  private analyzeCallSequence(tx: FetchedTransaction): CallSequenceEntry[] {
    return tx.moveCalls.map((call, index) => {
      const inputObjects = call.arguments
        .filter(arg => arg.objectId)
        .map(arg => arg.objectId!);

      // Check if this call creates or modifies objects
      const createsObjects = tx.objectChanges.some(
        change => change.type === 'created'
      );
      const modifiesObjects = tx.objectChanges.some(
        change => change.type === 'mutated'
      );

      return {
        index,
        call,
        purpose: this.inferCallPurpose(call),
        inputObjects,
        createsObjects,
        modifiesObjects,
      };
    });
  }

  /**
   * Infer the purpose of a call
   */
  private inferCallPurpose(call: ParsedMoveCall): string {
    const fn = call.functionName.toLowerCase();

    if (fn.includes('swap')) return 'Execute token swap';
    if (fn.includes('transfer')) return 'Transfer object/tokens';
    if (fn.includes('mint')) return 'Mint new tokens/NFT';
    if (fn.includes('burn')) return 'Burn tokens';
    if (fn.includes('stake') || fn.includes('deposit')) return 'Deposit/stake assets';
    if (fn.includes('unstake') || fn.includes('withdraw')) return 'Withdraw/unstake assets';
    if (fn.includes('borrow')) return 'Borrow assets';
    if (fn.includes('repay')) return 'Repay borrowed assets';
    if (fn.includes('claim') || fn.includes('harvest')) return 'Claim rewards';
    if (fn.includes('add_liquidity') || fn.includes('open_position')) return 'Add liquidity';
    if (fn.includes('remove_liquidity') || fn.includes('close_position')) return 'Remove liquidity';
    if (fn.includes('create') || fn.includes('new')) return 'Create new object';
    if (fn.includes('update') || fn.includes('set')) return 'Update object state';
    if (fn.includes('delete') || fn.includes('destroy')) return 'Delete object';

    return `Call ${call.moduleName}::${call.functionName}`;
  }

  /**
   * Trace object flow through the transaction
   */
  traceObjectFlow(tx: FetchedTransaction): ObjectFlowEntry[] {
    const objectMap = new Map<string, ObjectFlowEntry>();

    // Process object changes
    for (const change of tx.objectChanges) {
      const entry = objectMap.get(change.objectId) || {
        objectId: change.objectId,
        objectType: change.objectType,
        shortType: this.getShortType(change.objectType),
        lifecycle: [],
        finalState: 'created' as const,
      };

      entry.lifecycle.push({
        action: change.type as ObjectLifecycleStep['action'],
        atCallIndex: -1, // We don't have exact call index from object changes
      });

      // Update final state
      if (change.type === 'deleted') {
        entry.finalState = 'deleted';
      } else if (change.type === 'wrapped') {
        entry.finalState = 'wrapped';
      } else if (change.type === 'created') {
        entry.finalState = change.owner === 'Shared' ? 'shared' : 'created';
      }

      objectMap.set(change.objectId, entry);
    }

    return Array.from(objectMap.values());
  }

  /**
   * Get short type name
   */
  private getShortType(fullType: string): string {
    // Extract the last part of the type
    const match = fullType.match(/::(\w+)(?:<.*>)?$/);
    return match ? match[1] : fullType;
  }

  /**
   * Generate transaction summary
   */
  private generateSummary(tx: FetchedTransaction): TransactionSummary {
    const moduleSet = new Set<string>();
    const packageSet = new Set<string>();

    for (const call of tx.moveCalls) {
      packageSet.add(call.packageId);
      moduleSet.add(`${call.packageId}::${call.moduleName}`);
    }

    const coinTypes = new Set<string>();
    const netValueChanges = new Map<string, bigint>();

    for (const change of tx.balanceChanges) {
      coinTypes.add(change.coinType);
      const current = netValueChanges.get(change.coinType) || 0n;
      netValueChanges.set(change.coinType, current + BigInt(change.amount));
    }

    return {
      totalMoveCalls: tx.moveCalls.length,
      uniquePackages: packageSet.size,
      uniqueModules: moduleSet.size,
      gasUsedTotal: tx.gasUsed.totalCost,
      objectsCreated: tx.objectChanges.filter(c => c.type === 'created').length,
      objectsDeleted: tx.objectChanges.filter(c => c.type === 'deleted').length,
      objectsMutated: tx.objectChanges.filter(c => c.type === 'mutated').length,
      eventsEmitted: tx.events.length,
      coinTypesInvolved: Array.from(coinTypes),
      netValueChanges,
    };
  }

  /**
   * Infer transaction type
   */
  inferTransactionType(
    tx: FetchedTransaction,
    _callSequence: CallSequenceEntry[]
  ): { type: TransactionType; confidence: number } {
    // Check for package publish
    if (tx.objectChanges.some(c => c.objectType.includes('package::UpgradeCap'))) {
      return { type: 'publish', confidence: 0.95 };
    }

    // Check for package upgrade
    if (tx.moveCalls.some(c =>
      c.packageId === '0x2' &&
      c.moduleName === 'package' &&
      c.functionName === 'upgrade'
    )) {
      return { type: 'upgrade', confidence: 0.95 };
    }

    // Try pattern matching
    let bestMatch: { type: TransactionType; confidence: number } = {
      type: 'unknown',
      confidence: 0,
    };

    for (const call of tx.moveCalls) {
      for (const pattern of PROTOCOL_PATTERNS) {
        const packageMatch = pattern.packagePatterns.some(p =>
          p.test(call.packageId)
        );
        const functionMatch = pattern.functionPatterns.some(p =>
          p.test(call.functionName.toLowerCase())
        );

        if (packageMatch && functionMatch) {
          if (pattern.confidence > bestMatch.confidence) {
            bestMatch = {
              type: pattern.transactionType,
              confidence: pattern.confidence,
            };
          }
        }
      }
    }

    // If multiple different operations, mark as complex
    if (tx.moveCalls.length > 3 && bestMatch.confidence < 0.8) {
      const types = new Set<TransactionType>();
      for (const call of tx.moveCalls) {
        const inferred = this.inferSingleCallType(call);
        if (inferred !== 'unknown') {
          types.add(inferred);
        }
      }
      if (types.size > 2) {
        return { type: 'complex', confidence: 0.7 };
      }
    }

    return bestMatch;
  }

  /**
   * Infer type from a single call
   */
  private inferSingleCallType(call: ParsedMoveCall): TransactionType {
    const fn = call.functionName.toLowerCase();

    if (fn.includes('swap') || fn.includes('exchange')) return 'swap';
    if (fn.includes('transfer')) return 'transfer';
    if (fn.includes('mint')) return 'mint';
    if (fn.includes('burn')) return 'burn';
    if (fn.includes('stake') || fn.includes('deposit')) return 'stake';
    if (fn.includes('unstake') || fn.includes('withdraw')) return 'unstake';
    if (fn.includes('borrow')) return 'borrow';
    if (fn.includes('repay')) return 'repay';
    if (fn.includes('claim') || fn.includes('harvest')) return 'claim';
    if (fn.includes('add_liquidity')) return 'liquidity_add';
    if (fn.includes('remove_liquidity')) return 'liquidity_remove';

    return 'unknown';
  }

  /**
   * Identify the primary package
   */
  private identifyPrimaryPackage(
    packages: InvolvedPackage[],
    _callSequence: CallSequenceEntry[]
  ): InvolvedPackage | null {
    if (packages.length === 0) return null;
    if (packages.length === 1) return packages[0];

    // Filter out standard library
    const nonStdPackages = packages.filter(
      p => !p.packageId.match(/^0x0*[12]$/)
    );

    if (nonStdPackages.length === 0) {
      return packages[0];
    }

    if (nonStdPackages.length === 1) {
      return nonStdPackages[0];
    }

    // Find the package with most calls
    return nonStdPackages.reduce((max, pkg) =>
      pkg.callCount > max.callCount ? pkg : max
    );
  }
}

// ============ Factory Function ============

export function createTransactionParser(): TransactionParser {
  return new TransactionParser();
}
