/**
 * Types for package version history tracking
 */

import type { Network, SuiNormalizedModule } from '../types/index.js';

/**
 * Single package version information
 */
export interface PackageVersion {
  /** Package ID for this version */
  packageId: string;
  /** Version number (1-indexed, 1 = original) */
  version: number;
  /** Package ID of the previous version (undefined for original) */
  previousPackageId?: string;
  /** Timestamp when this version was published */
  publishedAt?: string;
  /** Transaction digest that published/upgraded this version */
  digest?: string;
  /** Address of the account that published/upgraded this version */
  sender?: string;
  /** Timestamp in milliseconds from the transaction */
  timestampMs?: string;
  /** Upgrade policy used (if upgraded) */
  upgradePolicy?: 'compatible' | 'additive' | 'dep_only' | 'immutable';
}

/**
 * Complete version history for a package
 */
export interface PackageVersionHistory {
  /** Original package ID (version 1) */
  originalPackageId: string;
  /** UpgradeCap object ID (if found) */
  upgradeCapId?: string;
  /** All versions in order (oldest to newest) */
  versions: PackageVersion[];
  /** Current/latest version number */
  currentVersion: number;
  /** Network where the package exists */
  network: Network;
  /** When the history was fetched */
  fetchedAt: string;
}

/**
 * Source code and ABI for a specific version
 */
export interface VersionedSourceResult {
  packageId: string;
  version: number;
  network: Network;
  /** Module name -> disassembled source code */
  disassembled: Record<string, string>;
  /** Module name -> base64 bytecode */
  bytecode: Record<string, string>;
  /** Module name -> normalized ABI */
  abi: Record<string, SuiNormalizedModule>;
  /** Module name -> decompiled Move code (from Revela) */
  decompiled?: Record<string, string>;
  fetchedAt: string;
}

/**
 * Options for version fetcher
 */
export interface VersionFetcherOptions {
  network: Network;
  /** Custom GraphQL endpoint URL */
  graphqlUrl?: string;
  /** Custom RPC endpoint URL */
  rpcUrl?: string;
  /** Use cache for version history */
  useCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * GraphQL response types for package queries
 */
export interface GraphQLPackageResponse {
  data?: {
    package?: {
      address: string;
      version: number;
      previousTransactionBlock?: {
        digest: string;
      };
      latestPackage?: {
        address: string;
        version: number;
      };
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface GraphQLPackageVersionsResponse {
  data?: {
    packageVersions?: {
      nodes: Array<{
        address: string;
        version: number;
        previousTransactionBlock?: {
          digest: string;
        };
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor?: string;
      };
    };
  };
  errors?: Array<{
    message: string;
  }>;
}

/**
 * Upgrade transaction data from RPC
 */
export interface UpgradeTransactionInfo {
  digest: string;
  timestampMs?: string;
  oldPackageId: string;
  newPackageId: string;
  upgradePolicy?: string;
}

/**
 * Options for fetching versioned source
 */
export interface FetchVersionedSourceOptions {
  /** Include decompilation using Revela */
  includeDecompiled?: boolean;
  /** Specific modules to fetch (all if not specified) */
  modules?: string[];
}
