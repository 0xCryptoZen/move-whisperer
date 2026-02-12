import { SealClient, SessionKey } from '@mysten/seal';
import { getSuiRpcClient } from '../sui-rpc';
import type { Network } from '../walrus/types';

const SEAL_API_KEY = process.env.NEXT_PUBLIC_SEAL_API_KEY || '';

// Seal key server object IDs per network
// See: https://seal-docs.wal.app/Pricing/
interface KeyServerConfig {
  objectId: string;
  weight: number;
  apiKeyName?: string;
  apiKey?: string;
}

function getKeyServerConfigs(network: string): KeyServerConfig[] {
  const configs: Record<string, KeyServerConfig[]> = {
    testnet: [
      {
        objectId: '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2',
        weight: 1,
        ...(SEAL_API_KEY ? { apiKeyName: 'api-key', apiKey: SEAL_API_KEY } : {}),
      },
    ],
    mainnet: [
      {
        objectId: '0x1afb3a57211ceff8f6781757821847e3ddae73f64e78ec8cd9349914ad985475',
        weight: 1,
        ...(SEAL_API_KEY ? { apiKeyName: 'api-key', apiKey: SEAL_API_KEY } : {}),
      },
    ],
  };
  return configs[network] || configs.testnet;
}

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

  const suiClient = getSuiRpcClient(network);
  const serverConfigs = getKeyServerConfigs(network);

  const client = new SealClient({
    suiClient,
    serverConfigs,
    verifyKeyServers: false,
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
 * @param id - The identity hex string for encryption (e.g. blob ID hex)
 * @returns Encrypted bytes
 */
export async function encryptSkillContent(
  client: SealClient,
  content: Uint8Array,
  packageId: string,
  id: string,
  network: Network = 'testnet',
): Promise<{ encryptedData: Uint8Array; backupKey: Uint8Array }> {
  const servers = getKeyServerConfigs(network);
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
  const suiClient = getSuiRpcClient(network);
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
