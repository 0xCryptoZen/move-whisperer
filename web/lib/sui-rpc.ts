import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from '@mysten/sui/jsonRpc';
import type { Network } from './walrus/types';

const clientCache = new Map<string, SuiJsonRpcClient>();

/**
 * Get a SuiJsonRpcClient for the given network.
 * Uses the default Sui fullnode URL (supports browser CORS).
 */
export function getSuiRpcClient(network: Network): SuiJsonRpcClient {
  if (clientCache.has(network)) {
    return clientCache.get(network)!;
  }

  const client = new SuiJsonRpcClient({
    network,
    url: getJsonRpcFullnodeUrl(network),
  });

  clientCache.set(network, client);
  return client;
}
