import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import {
  WalrusClient,
  TESTNET_WALRUS_PACKAGE_CONFIG,
  MAINNET_WALRUS_PACKAGE_CONFIG,
  RetryableWalrusClientError,
} from '@mysten/walrus';
import type { Network } from './types';

export type { Network };

const clientCache = new Map<string, WalrusClient>();

/**
 * Get or create a WalrusClient for the given network.
 * Clients are cached per network for reuse.
 */
export function getWalrusClient(network: Network): WalrusClient {
  if (clientCache.has(network)) {
    return clientCache.get(network)!;
  }

  const suiClient = new SuiJsonRpcClient({ network, url: getJsonRpcFullnodeUrl(network) });
  const packageConfig =
    network === 'mainnet' ? MAINNET_WALRUS_PACKAGE_CONFIG : TESTNET_WALRUS_PACKAGE_CONFIG;

  const walrusNetwork = network === 'devnet' ? 'testnet' : network;
  const client = new WalrusClient({
    network: walrusNetwork,
    suiClient,
    packageConfig,
    storageNodeClientOptions: {
      timeout: 60_000,
    },
  });

  clientCache.set(network, client);
  return client;
}

/**
 * Upload skill content as a blob to Walrus.
 * For browser use with wallet signing, use the flow-based approach in useSkillMarketplace hook.
 *
 * @returns The blob ID string
 */
export async function uploadSkillBlob(
  client: WalrusClient,
  content: Uint8Array,
  options: {
    signer: import('@mysten/sui/cryptography').Signer;
    epochs?: number;
    deletable?: boolean;
    owner?: string;
  },
): Promise<{ blobId: string; blobObjectId: string }> {
  const { signer, epochs = 10, deletable = false, owner } = options;

  try {
    const result = await client.writeBlob({
      blob: content,
      deletable,
      epochs,
      signer,
      owner,
    });

    return {
      blobId: result.blobId,
      blobObjectId: result.blobObject.id,
    };
  } catch (error) {
    if (error instanceof RetryableWalrusClientError) {
      client.reset();
      // Retry once on epoch transition errors
      const result = await client.writeBlob({
        blob: content,
        deletable,
        epochs,
        signer,
        owner,
      });
      return {
        blobId: result.blobId,
        blobObjectId: result.blobObject.id,
      };
    }
    throw error;
  }
}

/**
 * Download skill content from Walrus by blob ID.
 *
 * @returns The raw bytes of the blob
 */
export async function downloadSkillBlob(
  client: WalrusClient,
  blobId: string,
): Promise<Uint8Array> {
  try {
    return await client.readBlob({ blobId });
  } catch (error) {
    if (error instanceof RetryableWalrusClientError) {
      client.reset();
      return await client.readBlob({ blobId });
    }
    throw error;
  }
}

/**
 * Calculate storage cost for a blob of given size.
 */
export async function estimateStorageCost(
  client: WalrusClient,
  sizeBytes: number,
  epochs: number,
): Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }> {
  return client.storageCost(sizeBytes, epochs);
}
