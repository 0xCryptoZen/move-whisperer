/**
 * Version fetcher - discovers and retrieves package version history
 * Primary: Trace through UpgradeCap transaction history
 * Fallback: GraphQL API or basic RPC
 */

import { SuiClient } from '@mysten/sui/client';
import type { Network, SuiNormalizedModule } from '../types/index.js';
import { SuiClientWrapper, createSuiClient } from '../fetcher/sui-client.js';
import { NetworkError } from '../core/errors.js';
import {
  versionHistoryCache,
  versionedSourceCache,
  getHistoryCacheKey,
  getVersionedSourceCacheKey,
} from './version-cache.js';
import type {
  PackageVersion,
  PackageVersionHistory,
  VersionedSourceResult,
  VersionFetcherOptions,
  FetchVersionedSourceOptions,
} from './types.js';

// UpgradeCap type
const UPGRADE_CAP_TYPE = '0x2::package::UpgradeCap';

export class VersionFetcher {
  private client: SuiClientWrapper;
  private suiClient: SuiClient;
  private network: Network;
  private useCache: boolean;

  constructor(options: VersionFetcherOptions) {
    this.network = options.network;
    this.client = createSuiClient(options.network, options.rpcUrl);
    this.suiClient = this.client.getClient();
    this.useCache = options.useCache ?? true;
  }

  /**
   * Get complete version history for a package
   */
  async getVersionHistory(packageId: string): Promise<PackageVersionHistory> {
    const cacheKey = getHistoryCacheKey(this.network, packageId);

    // Check cache first
    if (this.useCache) {
      const cached = versionHistoryCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Primary method: trace through UpgradeCap
    let history: PackageVersionHistory;
    try {
      history = await this.fetchVersionHistoryViaUpgradeCap(packageId);
    } catch (error) {
      console.warn(`UpgradeCap trace failed, falling back to basic RPC: ${error}`);
      history = await this.fetchVersionHistoryBasic(packageId);
    }

    // Cache the result
    if (this.useCache) {
      versionHistoryCache.set(cacheKey, history);
    }

    return history;
  }

  /**
   * Get source code and ABI for a specific version
   */
  async getSourceAtVersion(
    packageId: string,
    version: number,
    options: FetchVersionedSourceOptions = {}
  ): Promise<VersionedSourceResult> {
    // First get the version history to find the package ID for this version
    const history = await this.getVersionHistory(packageId);
    const versionInfo = history.versions.find((v) => v.version === version);

    if (!versionInfo) {
      throw new NetworkError(
        `Version ${version} not found for package ${packageId}. Available versions: ${history.versions.map((v) => v.version).join(', ')}`,
        undefined,
        { packageId, version, availableVersions: history.versions.map((v) => v.version) }
      );
    }

    const targetPackageId = versionInfo.packageId;
    const cacheKey = getVersionedSourceCacheKey(this.network, targetPackageId, version);

    // Check cache
    if (this.useCache) {
      const cached = versionedSourceCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch source data
    const result = await this.fetchVersionedSource(targetPackageId, version, options);

    // Cache the result
    if (this.useCache) {
      versionedSourceCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Fetch version history by tracing UpgradeCap transactions
   * This is the most accurate method
   */
  private async fetchVersionHistoryViaUpgradeCap(packageId: string): Promise<PackageVersionHistory> {
    // Step 1: Find the UpgradeCap for this package
    const upgradeCapInfo = await this.findUpgradeCapForPackage(packageId);

    if (!upgradeCapInfo) {
      // No UpgradeCap found - this might be an immutable package
      return this.fetchVersionHistoryBasic(packageId);
    }

    const { upgradeCapId, currentVersion } = upgradeCapInfo;

    // Step 2: Get all transactions that created packages using this UpgradeCap
    const versions = await this.traceUpgradeTransactions(upgradeCapId, currentVersion);

    // Ensure versions are sorted by version number
    versions.sort((a, b) => a.version - b.version);

    // Find the original package ID (version 1)
    const originalPackageId = versions.length > 0 ? versions[0].packageId : packageId;

    // Use actual version count, not UpgradeCap's version field
    const actualCurrentVersion = versions.length > 0 ? versions[versions.length - 1].version : 1;

    return {
      originalPackageId,
      upgradeCapId,
      versions,
      currentVersion: actualCurrentVersion,
      network: this.network,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Find the UpgradeCap associated with a package
   */
  private async findUpgradeCapForPackage(
    packageId: string
  ): Promise<{ upgradeCapId: string; currentPackageId: string; currentVersion: number } | null> {
    // Get the package's creation transaction
    const packageObj = await this.suiClient.getObject({
      id: packageId,
      options: { showPreviousTransaction: true },
    });

    if (!packageObj.data?.previousTransaction) {
      return null;
    }

    // Get the transaction that created/upgraded this package
    const tx = await this.suiClient.getTransactionBlock({
      digest: packageObj.data.previousTransaction,
      options: { showInput: true, showEffects: true },
    });

    // Find the UpgradeCap in the transaction inputs
    if (tx.transaction?.data?.transaction && 'inputs' in tx.transaction.data.transaction) {
      const inputs = tx.transaction.data.transaction.inputs as Array<{
        type?: string;
        objectId?: string;
      }>;

      for (const input of inputs) {
        if (input.type === 'object' && input.objectId) {
          // Check if this is an UpgradeCap
          const obj = await this.suiClient.getObject({
            id: input.objectId,
            options: { showType: true, showContent: true },
          });

          if (obj.data?.type === UPGRADE_CAP_TYPE && obj.data.content?.dataType === 'moveObject') {
            const fields = obj.data.content.fields as {
              package?: string;
              version?: string | number;
            };

            return {
              upgradeCapId: input.objectId,
              currentPackageId: fields.package ?? packageId,
              currentVersion: Number(fields.version ?? 1),
            };
          }
        }
      }
    }

    // If no UpgradeCap found in the transaction, this might be the initial publish
    // Try to find UpgradeCap that was created in the same transaction
    if (tx.effects?.created) {
      for (const created of tx.effects.created) {
        const obj = await this.suiClient.getObject({
          id: created.reference.objectId,
          options: { showType: true, showContent: true },
        });

        if (obj.data?.type === UPGRADE_CAP_TYPE && obj.data.content?.dataType === 'moveObject') {
          const fields = obj.data.content.fields as {
            package?: string;
            version?: string | number;
          };

          return {
            upgradeCapId: created.reference.objectId,
            currentPackageId: fields.package ?? packageId,
            currentVersion: Number(fields.version ?? 1),
          };
        }
      }
    }

    return null;
  }

  /**
   * Trace all upgrade transactions to build version history
   * Strategy: Query all transactions from UpgradeCap owner, find those that
   * created or used this UpgradeCap, and collect the created packages
   */
  private async traceUpgradeTransactions(
    upgradeCapId: string,
    _currentVersion: number
  ): Promise<PackageVersion[]> {
    const versions: PackageVersion[] = [];

    // Get the UpgradeCap's owner
    const upgradeCap = await this.suiClient.getObject({
      id: upgradeCapId,
      options: { showContent: true, showOwner: true },
    });

    if (!upgradeCap.data?.content || upgradeCap.data.content.dataType !== 'moveObject') {
      return versions;
    }

    // Get owner address
    const owner = upgradeCap.data.owner;
    if (!owner || typeof owner !== 'object' || !('AddressOwner' in owner)) {
      return versions;
    }
    const ownerAddress = owner.AddressOwner;

    // Query all transactions from this owner (paginated)
    const allTxs: Array<{
      digest: string;
      timestampMs?: string | null;
      effects?: {
        created?: Array<{ reference: { objectId: string } }>;
      } | null;
      transaction?: {
        data?: {
          sender?: string;
          transaction?: {
            inputs?: Array<{ type?: string; objectId?: string }>;
          };
        };
      } | null;
    }> = [];

    let cursor: string | null | undefined = undefined;
    for (let page = 0; page < 20; page++) {
      const result = await this.suiClient.queryTransactionBlocks({
        filter: { FromAddress: ownerAddress },
        options: { showEffects: true, showInput: true },
        limit: 50,
        cursor,
        order: 'ascending',
      });

      allTxs.push(...(result.data as typeof allTxs));
      if (!result.hasNextPage) break;
      cursor = result.nextCursor;
    }

    // Find transactions that involve this UpgradeCap
    for (const tx of allTxs) {
      // Check if tx created the UpgradeCap (original publish)
      const createdCap = tx.effects?.created?.some(
        (c) => c.reference.objectId === upgradeCapId
      );

      // Check if tx used the UpgradeCap as input (upgrade)
      let usedCap = false;
      const txData = tx.transaction?.data?.transaction;
      if (txData && 'inputs' in txData && Array.isArray(txData.inputs)) {
        usedCap = txData.inputs.some(
          (i: { objectId?: string }) => i.objectId === upgradeCapId
        );
      }

      if (createdCap || usedCap) {
        // Find created packages in this transaction
        for (const created of tx.effects?.created || []) {
          try {
            const obj = await this.suiClient.getObject({
              id: created.reference.objectId,
              options: { showContent: true },
            });

            if (obj.data?.content?.dataType === 'package') {
              const versionNum = versions.length + 1;
              const prevPackageId = versions.length > 0
                ? versions[versions.length - 1].packageId
                : undefined;

              versions.push({
                packageId: created.reference.objectId,
                version: versionNum,
                digest: tx.digest,
                sender: tx.transaction?.data?.sender ?? undefined,
                timestampMs: tx.timestampMs ?? undefined,
                previousPackageId: prevPackageId,
              });
            }
          } catch {
            // Skip objects that can't be fetched
          }
        }
      }
    }

    return versions;
  }

  /**
   * Basic version history (fallback - returns only the given package as version 1)
   */
  private async fetchVersionHistoryBasic(packageId: string): Promise<PackageVersionHistory> {
    const packageObject = await this.suiClient.getObject({
      id: packageId,
      options: { showContent: true, showPreviousTransaction: true },
    });

    if (!packageObject.data) {
      throw NetworkError.packageNotFound(packageId, this.network);
    }

    const version: PackageVersion = {
      packageId,
      version: 1,
      digest: packageObject.data.previousTransaction ?? undefined,
    };

    return {
      originalPackageId: packageId,
      versions: [version],
      currentVersion: 1,
      network: this.network,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch source code and ABI for a specific package version
   */
  private async fetchVersionedSource(
    packageId: string,
    version: number,
    options: FetchVersionedSourceOptions
  ): Promise<VersionedSourceResult> {
    // Get disassembled source and bytecode
    const packageObject = await this.suiClient.getObject({
      id: packageId,
      options: { showContent: true, showBcs: true },
    });

    if (!packageObject.data || packageObject.data.content?.dataType !== 'package') {
      throw NetworkError.packageNotFound(packageId, this.network);
    }

    const content = packageObject.data.content;
    const disassembled = (content.disassembled as Record<string, string>) ?? {};

    // Get bytecode (base64 encoded module map)
    const bytecode: Record<string, string> = {};

    // Get ABIs for all modules
    const moduleNames = options.modules ?? Object.keys(disassembled);
    const abi: Record<string, SuiNormalizedModule> = {};

    for (const moduleName of moduleNames) {
      try {
        const moduleAbi = await this.client.getNormalizedMoveModule(packageId, moduleName);
        abi[moduleName] = moduleAbi;
      } catch (error) {
        console.warn(`Could not fetch ABI for ${packageId}::${moduleName}: ${error}`);
      }
    }

    return {
      packageId,
      version,
      network: this.network,
      disassembled,
      bytecode,
      abi,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Find UpgradeCap for a package (public method)
   */
  async findUpgradeCap(packageId: string): Promise<string | null> {
    const info = await this.findUpgradeCapForPackage(packageId);
    return info?.upgradeCapId ?? null;
  }

  /**
   * Get all module names for a package version
   */
  async getModulesAtVersion(packageId: string, version: number): Promise<string[]> {
    const source = await this.getSourceAtVersion(packageId, version);
    return Object.keys(source.disassembled);
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    versionHistoryCache.clear();
    versionedSourceCache.clear();
  }
}

/**
 * Create a VersionFetcher for a network
 */
export function createVersionFetcher(
  network: Network,
  options?: Partial<VersionFetcherOptions>
): VersionFetcher {
  return new VersionFetcher({ network, ...options });
}
