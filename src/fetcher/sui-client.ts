/**
 * Sui client wrapper with retry and error handling
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import type { Network, SuiNormalizedModule } from '../types/index.js';
import { NetworkError } from '../core/errors.js';
import { withRetry, type RetryOptions } from '../utils/retry.js';
import { NETWORK_URLS } from '../types/sui.js';

export interface SuiClientWrapperOptions {
  network: Network;
  rpcUrl?: string;
  retryOptions?: Partial<RetryOptions>;
}

export class SuiClientWrapper {
  private client: SuiClient;
  private network: Network;
  private rpcUrl: string;
  private retryOptions: Partial<RetryOptions>;

  constructor(options: SuiClientWrapperOptions) {
    this.network = options.network;
    this.rpcUrl = options.rpcUrl ?? NETWORK_URLS[options.network];
    this.retryOptions = options.retryOptions ?? {};

    this.client = new SuiClient({ url: this.rpcUrl });
  }

  /**
   * Get the network this client is connected to
   */
  getNetwork(): Network {
    return this.network;
  }

  /**
   * Get the RPC URL
   */
  getRpcUrl(): string {
    return this.rpcUrl;
  }

  /**
   * Get normalized Move module with retry
   */
  async getNormalizedMoveModule(
    packageId: string,
    moduleName: string
  ): Promise<SuiNormalizedModule> {
    return withRetry(
      async () => {
        try {
          const result = await this.client.getNormalizedMoveModule({
            package: packageId,
            module: moduleName,
          });

          // The SDK returns the correct type, but we cast to our interface
          return result as unknown as SuiNormalizedModule;
        } catch (error) {
          // Handle specific RPC errors
          if (error instanceof Error) {
            const message = error.message.toLowerCase();

            if (message.includes('not found') || message.includes('does not exist')) {
              throw NetworkError.moduleNotFound(packageId, moduleName, this.network);
            }

            if (message.includes('rate limit') || message.includes('429')) {
              throw NetworkError.rpcRateLimit(this.rpcUrl);
            }

            if (message.includes('timeout') || message.includes('etimedout')) {
              throw NetworkError.rpcTimeout(this.rpcUrl, 30000);
            }

            throw NetworkError.connectionFailed(this.rpcUrl, error);
          }

          throw error;
        }
      },
      {
        ...this.retryOptions,
        onRetry: (error, attempt, delay) => {
          console.warn(
            `Retry attempt ${attempt} for ${packageId}::${moduleName} after ${delay}ms: ${error.message}`
          );
        },
      }
    );
  }

  /**
   * Get all module names in a package
   */
  async getPackageModules(packageId: string): Promise<string[]> {
    return withRetry(
      async () => {
        try {
          // Get the package object to find modules
          const packageObject = await this.client.getObject({
            id: packageId,
            options: {
              showContent: true,
            },
          });

          if (!packageObject.data) {
            throw NetworkError.packageNotFound(packageId, this.network);
          }

          const content = packageObject.data.content;
          if (!content || content.dataType !== 'package') {
            throw NetworkError.packageNotFound(packageId, this.network);
          }

          // Extract module names from disassembled content
          const disassembled = content.disassembled;
          if (disassembled && typeof disassembled === 'object') {
            return Object.keys(disassembled);
          }

          // Fallback: return empty array if we can't parse modules
          return [];
        } catch (error) {
          if (error instanceof NetworkError) {
            throw error;
          }

          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('not found') || message.includes('does not exist')) {
              throw NetworkError.packageNotFound(packageId, this.network);
            }
            throw NetworkError.connectionFailed(this.rpcUrl, error);
          }

          throw error;
        }
      },
      this.retryOptions
    );
  }

  /**
   * Get disassembled Move source code for a package
   */
  async getDisassembledSource(packageId: string): Promise<Record<string, string>> {
    return withRetry(
      async () => {
        try {
          const packageObject = await this.client.getObject({
            id: packageId,
            options: {
              showContent: true,
            },
          });

          if (!packageObject.data) {
            throw NetworkError.packageNotFound(packageId, this.network);
          }

          const content = packageObject.data.content;
          if (!content || content.dataType !== 'package') {
            throw NetworkError.packageNotFound(packageId, this.network);
          }

          const disassembled = content.disassembled;
          if (disassembled && typeof disassembled === 'object') {
            return disassembled as Record<string, string>;
          }

          return {};
        } catch (error) {
          if (error instanceof NetworkError) {
            throw error;
          }

          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('not found') || message.includes('does not exist')) {
              throw NetworkError.packageNotFound(packageId, this.network);
            }
            throw NetworkError.connectionFailed(this.rpcUrl, error);
          }

          throw error;
        }
      },
      this.retryOptions
    );
  }

  /**
   * Get disassembled source for a specific module
   */
  async getModuleSource(packageId: string, moduleName: string): Promise<string | null> {
    const sources = await this.getDisassembledSource(packageId);
    return sources[moduleName] ?? null;
  }

  /**
   * Check if a package exists
   */
  async packageExists(packageId: string): Promise<boolean> {
    try {
      const modules = await this.getPackageModules(packageId);
      return modules.length > 0;
    } catch (error) {
      if (error instanceof NetworkError && error.code === 'PACKAGE_NOT_FOUND') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get the underlying SuiClient
   */
  getClient(): SuiClient {
    return this.client;
  }
}

/**
 * Create a SuiClientWrapper for a network
 */
export function createSuiClient(
  network: Network,
  rpcUrl?: string
): SuiClientWrapper {
  return new SuiClientWrapper({ network, rpcUrl });
}

/**
 * Get default RPC URL for network
 */
export function getDefaultRpcUrl(network: Network): string {
  return getFullnodeUrl(network);
}
