/**
 * ABI fetcher service for Sui Move contracts
 */

import type { Network, SuiNormalizedModule } from '../types/index.js';
import { SuiClientWrapper, createSuiClient } from './sui-client.js';
import { abiCache, Cache } from './cache.js';
import { NetworkError, InputValidationError } from '../core/errors.js';

export interface FetchedModule {
  packageId: string;
  moduleName: string;
  network: Network;
  abi: SuiNormalizedModule;
  /** Disassembled Move source code */
  sourceCode?: string;
  fetchedAt: string;
}

export interface AbiFetcherOptions {
  network: Network;
  rpcUrl?: string;
  useCache?: boolean;
  cacheTtlMs?: number;
}

export class AbiFetcher {
  private client: SuiClientWrapper;
  private network: Network;
  private useCache: boolean;
  private cache: Cache<FetchedModule>;

  constructor(options: AbiFetcherOptions) {
    this.network = options.network;
    this.client = createSuiClient(options.network, options.rpcUrl);
    this.useCache = options.useCache ?? true;
    this.cache = abiCache as Cache<FetchedModule>;
  }

  /**
   * Fetch ABI for a single module
   */
  async fetchModule(packageId: string, moduleName: string, includeSource = true): Promise<FetchedModule> {
    // Validate inputs
    this.validatePackageId(packageId);
    this.validateModuleName(moduleName);

    const cacheKey = this.getCacheKey(packageId, moduleName);

    // Check cache first
    if (this.useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch ABI from RPC
    const abi = await this.client.getNormalizedMoveModule(packageId, moduleName);

    // Fetch disassembled source code
    let sourceCode: string | undefined;
    if (includeSource) {
      try {
        sourceCode = await this.client.getModuleSource(packageId, moduleName) ?? undefined;
      } catch {
        // Source code is optional, don't fail if we can't get it
        console.warn(`Could not fetch source for ${packageId}::${moduleName}`);
      }
    }

    const result: FetchedModule = {
      packageId,
      moduleName,
      network: this.network,
      abi,
      sourceCode,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    if (this.useCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Fetch all modules in a package
   */
  async fetchPackage(packageId: string): Promise<FetchedModule[]> {
    this.validatePackageId(packageId);

    // Get list of modules
    const moduleNames = await this.client.getPackageModules(packageId);

    if (moduleNames.length === 0) {
      throw NetworkError.packageNotFound(packageId, this.network);
    }

    // Fetch all modules
    const results: FetchedModule[] = [];
    for (const moduleName of moduleNames) {
      try {
        const module = await this.fetchModule(packageId, moduleName);
        results.push(module);
      } catch (error) {
        // Skip modules that fail to fetch (might be internal/private)
        console.warn(`Failed to fetch module ${moduleName}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Get list of module names in a package
   */
  async listModules(packageId: string): Promise<string[]> {
    this.validatePackageId(packageId);
    return this.client.getPackageModules(packageId);
  }

  /**
   * Check if a package exists
   */
  async packageExists(packageId: string): Promise<boolean> {
    return this.client.packageExists(packageId);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache key for a module
   */
  private getCacheKey(packageId: string, moduleName: string): string {
    return `${this.network}:${packageId}::${moduleName}`;
  }

  /**
   * Validate package ID format
   */
  private validatePackageId(packageId: string): void {
    // Package ID should be a hex address starting with 0x
    const hexPattern = /^0x[a-fA-F0-9]+$/;
    if (!hexPattern.test(packageId)) {
      throw InputValidationError.invalidPackageId(packageId);
    }
  }

  /**
   * Validate module name format
   */
  private validateModuleName(moduleName: string): void {
    // Module name should start with letter/underscore and contain only alphanumeric/underscore
    const namePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!namePattern.test(moduleName)) {
      throw InputValidationError.invalidModuleName(moduleName);
    }
  }
}

/**
 * Create an AbiFetcher for a network
 */
export function createAbiFetcher(
  network: Network,
  options?: Partial<AbiFetcherOptions>
): AbiFetcher {
  return new AbiFetcher({ network, ...options });
}

/**
 * Parse package ID input (supports "0xaddr" and "0xaddr::module" formats)
 */
export function parsePackageInput(input: string): {
  packageId: string;
  moduleName?: string;
} {
  const trimmed = input.trim();

  // Check for "package::module" format
  const parts = trimmed.split('::');

  if (parts.length === 1) {
    // Just package ID
    return { packageId: parts[0] };
  } else if (parts.length === 2) {
    // Package ID and module name
    return { packageId: parts[0], moduleName: parts[1] };
  } else {
    throw InputValidationError.invalidPackageId(input);
  }
}
