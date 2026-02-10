/**
 * Transaction Fetcher
 * Fetches and normalizes Sui transaction data for skill generation
 */

import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import type { Network } from '../types/index.js';
import { NETWORK_URLS } from '../types/sui.js';

// ============ Types ============

export interface TransactionFetcherOptions {
  network: Network;
  rpcUrl?: string;
}

export interface ParsedMoveCall {
  index: number;
  packageId: string;
  moduleName: string;
  functionName: string;
  typeArguments: string[];
  arguments: CallArgument[];
}

export interface CallArgument {
  kind: 'input' | 'nested_result' | 'gas_coin' | 'result';
  index?: number;
  objectId?: string;
  objectType?: string;
  value?: unknown;
  nestedResultIndex?: number;
  resultIndex?: number;
}

export interface ObjectChange {
  type: 'created' | 'mutated' | 'deleted' | 'wrapped' | 'unwrapped';
  objectId: string;
  objectType: string;
  owner?: string;
  digest?: string;
  version?: string;
}

export interface BalanceChange {
  owner: string;
  coinType: string;
  amount: string;
}

export interface TransactionEvent {
  packageId: string;
  moduleName: string;
  eventType: string;
  transactionModule: string;
  sender: string;
  parsedJson: unknown;
  timestampMs?: string;
}

export interface FetchedTransaction {
  // Metadata
  digest: string;
  network: Network;
  timestamp?: string;
  sender: string;
  checkpoint?: string;

  // Status
  status: 'success' | 'failure';
  errorMessage?: string;

  // Gas
  gasUsed: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
    totalCost: string;
  };

  // Parsed transaction data
  moveCalls: ParsedMoveCall[];

  // Object changes
  objectChanges: ObjectChange[];

  // Balance changes
  balanceChanges: BalanceChange[];

  // Events
  events: TransactionEvent[];

  // Raw data for advanced analysis
  rawTransaction: SuiTransactionBlockResponse;
}

export interface InvolvedPackage {
  packageId: string;
  moduleName: string;
  functionsUsed: string[];
  callCount: number;
}

// ============ TransactionFetcher Class ============

export class TransactionFetcher {
  private suiClient: SuiClient;
  private network: Network;
  private cache: Map<string, FetchedTransaction> = new Map();

  constructor(options: TransactionFetcherOptions) {
    this.network = options.network;
    const rpcUrl = options.rpcUrl || NETWORK_URLS[options.network];
    this.suiClient = new SuiClient({ url: rpcUrl });
  }

  /**
   * Fetch a single transaction by digest
   */
  async fetchTransaction(digest: string): Promise<FetchedTransaction> {
    // Check cache first (transactions are immutable)
    const cacheKey = `${this.network}:${digest}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    console.log(`[TransactionFetcher] Fetching transaction ${digest} on ${this.network}`);

    const response = await this.suiClient.getTransactionBlock({
      digest,
      options: {
        showInput: true,
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
        showBalanceChanges: true,
        showRawInput: false,
      },
    });

    const parsed = this.parseTransaction(response);

    // Cache the result
    this.cache.set(cacheKey, parsed);

    return parsed;
  }

  /**
   * Fetch multiple transactions
   */
  async fetchMultipleTransactions(digests: string[]): Promise<FetchedTransaction[]> {
    const results = await Promise.all(
      digests.map(digest => this.fetchTransaction(digest))
    );
    return results;
  }

  /**
   * Parse raw transaction response into normalized format
   */
  private parseTransaction(response: SuiTransactionBlockResponse): FetchedTransaction {
    const effects = response.effects;
    const transaction = response.transaction;

    // Determine status
    const status = effects?.status?.status === 'success' ? 'success' : 'failure';
    const errorMessage = effects?.status?.status === 'failure'
      ? (effects.status as { error?: string }).error
      : undefined;

    // Parse gas
    const gasUsed = {
      computationCost: effects?.gasUsed?.computationCost || '0',
      storageCost: effects?.gasUsed?.storageCost || '0',
      storageRebate: effects?.gasUsed?.storageRebate || '0',
      totalCost: '0',
    };
    gasUsed.totalCost = (
      BigInt(gasUsed.computationCost) +
      BigInt(gasUsed.storageCost) -
      BigInt(gasUsed.storageRebate)
    ).toString();

    // Parse MoveCalls from PTB
    const moveCalls = this.parseMoveCalls(transaction);

    // Parse object changes
    const objectChanges = this.parseObjectChanges(response.objectChanges);

    // Parse balance changes
    const balanceChanges = this.parseBalanceChanges(response.balanceChanges);

    // Parse events
    const events = this.parseEvents(response.events);

    return {
      digest: response.digest,
      network: this.network,
      timestamp: response.timestampMs ?? undefined,
      sender: transaction?.data?.sender || '',
      checkpoint: response.checkpoint || undefined,
      status,
      errorMessage,
      gasUsed,
      moveCalls,
      objectChanges,
      balanceChanges,
      events,
      rawTransaction: response,
    };
  }

  /**
   * Parse MoveCall commands from Programmable Transaction Block
   */
  private parseMoveCalls(
    transaction: SuiTransactionBlockResponse['transaction']
  ): ParsedMoveCall[] {
    const calls: ParsedMoveCall[] = [];

    if (!transaction?.data?.transaction) {
      return calls;
    }

    const txData = transaction.data.transaction;

    // Handle ProgrammableTransaction
    if (txData.kind === 'ProgrammableTransaction') {
      const ptb = txData as {
        kind: 'ProgrammableTransaction';
        inputs: unknown[];
        transactions: unknown[];
      };

      ptb.transactions.forEach((cmd, index) => {
        if (this.isMoveCall(cmd)) {
          const moveCall = cmd as {
            MoveCall: {
              package: string;
              module: string;
              function: string;
              type_arguments?: string[];
              arguments?: unknown[];
            };
          };

          calls.push({
            index,
            packageId: moveCall.MoveCall.package,
            moduleName: moveCall.MoveCall.module,
            functionName: moveCall.MoveCall.function,
            typeArguments: moveCall.MoveCall.type_arguments || [],
            arguments: this.parseCallArguments(moveCall.MoveCall.arguments || [], ptb.inputs),
          });
        }
      });
    }

    return calls;
  }

  /**
   * Check if a PTB command is a MoveCall
   */
  private isMoveCall(cmd: unknown): boolean {
    return typeof cmd === 'object' && cmd !== null && 'MoveCall' in cmd;
  }

  /**
   * Parse call arguments
   */
  private parseCallArguments(args: unknown[], inputs: unknown[]): CallArgument[] {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        if ('Input' in arg) {
          const inputIndex = (arg as { Input: number }).Input;
          const input = inputs[inputIndex];
          return this.parseInputArgument(inputIndex, input);
        }
        if ('Result' in arg) {
          return {
            kind: 'result' as const,
            resultIndex: (arg as { Result: number }).Result,
          };
        }
        if ('NestedResult' in arg) {
          const nested = (arg as { NestedResult: [number, number] }).NestedResult;
          return {
            kind: 'nested_result' as const,
            resultIndex: nested[0],
            nestedResultIndex: nested[1],
          };
        }
        if ('GasCoin' in arg) {
          return { kind: 'gas_coin' as const };
        }
      }
      return { kind: 'input' as const, value: arg };
    });
  }

  /**
   * Parse an input argument
   */
  private parseInputArgument(index: number, input: unknown): CallArgument {
    if (typeof input === 'object' && input !== null) {
      // Pure value
      if ('Pure' in input) {
        return {
          kind: 'input',
          index,
          value: (input as { Pure: { bytes: string } }).Pure,
        };
      }
      // Object reference
      if ('Object' in input) {
        const objInput = input as {
          Object: {
            ImmOrOwnedObject?: { objectId: string; version: string; digest: string };
            SharedObject?: { objectId: string; initialSharedVersion: string; mutable: boolean };
            Receiving?: { objectId: string; version: string; digest: string };
          };
        };

        const obj = objInput.Object;
        if (obj.ImmOrOwnedObject) {
          return {
            kind: 'input',
            index,
            objectId: obj.ImmOrOwnedObject.objectId,
          };
        }
        if (obj.SharedObject) {
          return {
            kind: 'input',
            index,
            objectId: obj.SharedObject.objectId,
          };
        }
        if (obj.Receiving) {
          return {
            kind: 'input',
            index,
            objectId: obj.Receiving.objectId,
          };
        }
      }
    }

    return { kind: 'input', index, value: input };
  }

  /**
   * Parse object changes
   */
  private parseObjectChanges(
    changes: SuiTransactionBlockResponse['objectChanges']
  ): ObjectChange[] {
    if (!changes) return [];

    return changes.map(change => {
      const type = this.getObjectChangeType(change);
      return {
        type,
        objectId: 'objectId' in change ? change.objectId : '',
        objectType: 'objectType' in change ? (change.objectType as string) : '',
        owner: this.extractOwner(change),
        digest: 'digest' in change ? change.digest : undefined,
        version: 'version' in change ? change.version : undefined,
      };
    });
  }

  /**
   * Get object change type
   */
  private getObjectChangeType(change: unknown): ObjectChange['type'] {
    if (typeof change !== 'object' || change === null) return 'mutated';
    if ('type' in change) {
      const t = (change as { type: string }).type;
      if (t === 'created') return 'created';
      if (t === 'mutated') return 'mutated';
      if (t === 'deleted') return 'deleted';
      if (t === 'wrapped') return 'wrapped';
      if (t === 'published') return 'created';
    }
    return 'mutated';
  }

  /**
   * Extract owner from object change
   */
  private extractOwner(change: unknown): string | undefined {
    if (typeof change !== 'object' || change === null) return undefined;
    if ('owner' in change) {
      const owner = (change as { owner: unknown }).owner;
      if (typeof owner === 'string') return owner;
      if (typeof owner === 'object' && owner !== null) {
        if ('AddressOwner' in owner) return (owner as { AddressOwner: string }).AddressOwner;
        if ('ObjectOwner' in owner) return (owner as { ObjectOwner: string }).ObjectOwner;
        if ('Shared' in owner) return 'Shared';
      }
    }
    return undefined;
  }

  /**
   * Parse balance changes
   */
  private parseBalanceChanges(
    changes: SuiTransactionBlockResponse['balanceChanges']
  ): BalanceChange[] {
    if (!changes) return [];

    return changes.map(change => ({
      owner: typeof change.owner === 'string'
        ? change.owner
        : ('AddressOwner' in change.owner ? change.owner.AddressOwner : 'Unknown'),
      coinType: change.coinType,
      amount: change.amount,
    }));
  }

  /**
   * Parse events
   */
  private parseEvents(
    events: SuiTransactionBlockResponse['events']
  ): TransactionEvent[] {
    if (!events) return [];

    return events.map(event => ({
      packageId: event.packageId,
      moduleName: event.transactionModule.split('::')[0] || '',
      eventType: event.type,
      transactionModule: event.transactionModule,
      sender: event.sender,
      parsedJson: event.parsedJson,
      timestampMs: event.timestampMs ?? undefined,
    }));
  }

  /**
   * Get all involved packages from a transaction
   */
  getInvolvedPackages(tx: FetchedTransaction): InvolvedPackage[] {
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
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============ Factory Function ============

export function createTransactionFetcher(
  options: TransactionFetcherOptions
): TransactionFetcher {
  return new TransactionFetcher(options);
}
