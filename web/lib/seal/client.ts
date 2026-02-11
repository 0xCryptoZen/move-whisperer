import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { SealClient, SessionKey } from '@mysten/seal';
import type { Network } from '../walrus/types';

// Seal key server object IDs per network
// See: https://seal-docs.wal.app/UsingSeal/
const SEAL_KEY_SERVERS: Record<string, { objectId: string; weight: number }[]> = {
  testnet: [
    {
      objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
      weight: 1,
    },
    {
      objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
      weight: 1,
    },
  ],
  mainnet: [
    {
      objectId: '0x1afb3a57211ceff8f6781757821847e3ddae73f64e78ec8cd9349914ad985475',
      weight: 1,
    },
  ],
};

const clientCache = new Map<string, SealClient>();

/**
 * Get or create a SealClient for the given network.
 * Clients are cached per network for reuse.
 */
export function getSealClient(network: Network): SealClient {
  const key = network;
  if (clientCache.has(key)) {
    return clientCache.get(key)!;
  }

  const suiClient = new SuiJsonRpcClient({ network, url: getJsonRpcFullnodeUrl(network) });
  const serverConfigs = SEAL_KEY_SERVERS[network] || SEAL_KEY_SERVERS.testnet;

  const client = new SealClient({
    suiClient,
    serverConfigs,
    verifyKeyServers: true,
    timeout: 15_000,
  });

  clientCache.set(key, client);
  return client;
}

/**
 * Encrypt skill content with Seal.
 *
 * @param content - The plaintext content to encrypt
 * @param packageId - The marketplace contract package ID (used as encryption namespace)
 * @param id - The identity string for encryption (typically the SkillRecord object ID)
 * @returns Encrypted bytes
 */
export async function encryptSkillContent(
  client: SealClient,
  content: Uint8Array,
  packageId: string,
  id: string,
  network: Network = 'testnet',
): Promise<{ encryptedData: Uint8Array; backupKey: Uint8Array }> {
  const servers = SEAL_KEY_SERVERS[network] || SEAL_KEY_SERVERS.testnet;
  const threshold = Math.min(servers.length, 2);

  const { encryptedObject, key } = await client.encrypt({
    threshold,
    packageId,
    id,
    data: content,
  });

  return {
    encryptedData: encryptedObject,
    backupKey: key,
  };
}

/**
 * Create a session key for decryption.
 * The session key must be signed by the user's wallet before it can be used.
 */
export async function createSessionKey(
  network: Network,
  address: string,
  packageId: string,
  ttlMin: number = 10,
): Promise<SessionKey> {
  const suiClient = new SuiJsonRpcClient({ network, url: getJsonRpcFullnodeUrl(network) });
  return SessionKey.create({
    address,
    packageId,
    ttlMin,
    suiClient,
  });
}

/**
 * Decrypt skill content with Seal.
 *
 * @param encryptedData - The encrypted bytes from Walrus
 * @param sessionKey - An initialized session key (signed by user)
 * @param txBytes - Transaction bytes calling seal_approve
 * @returns Decrypted plaintext bytes
 */
export async function decryptSkillContent(
  client: SealClient,
  encryptedData: Uint8Array,
  sessionKey: SessionKey,
  txBytes: Uint8Array,
): Promise<Uint8Array> {
  return client.decrypt({
    data: encryptedData,
    sessionKey,
    txBytes,
  });
}

export { SessionKey };
