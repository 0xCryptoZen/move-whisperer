import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { bcs, fromBase64 } from '@mysten/bcs';
import type { Network } from '../walrus/types';

// Contract package ID - set via environment variable after deployment
export const MARKETPLACE_PACKAGE_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_PACKAGE_ID || '';

export const MARKETPLACE_MODULE = 'skill_marketplace';

// Clock object ID (shared across all Sui networks)
const CLOCK_OBJECT_ID = '0x6';

// ====== Types ======

export interface SkillRecordFields {
  id: { id: string };
  blob_id: string;
  creator: string;
  title: number[]; // vector<u8> returned as number array
  description: number[];
  price: string; // u64 as string
  scene: number[];
  network: number[];
  package_id: number[];
  is_encrypted: boolean;
  total_sales: string;
  total_revenue: string;
  created_at: string;
}

export interface SkillRecord {
  objectId: string;
  blobId: string;
  creator: string;
  title: string;
  description: string;
  price: bigint;
  scene: string;
  network: string;
  packageId: string;
  isEncrypted: boolean;
  totalSales: number;
  totalRevenue: bigint;
  createdAt: number;
}

export interface AccessCapFields {
  id: { id: string };
  skill_id: string;
  blob_id: string;
  purchased_at: string;
}

export interface AccessCap {
  objectId: string;
  skillId: string;
  blobId: string;
  purchasedAt: number;
}

// ====== Helpers ======

function bytesToString(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function stringToBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

/** Convert base64url to standard base64. */
function base64urlToBase64(s: string): string {
  return s.replaceAll('-', '+').replaceAll('_', '/');
}

/** Convert a Walrus base64url blob ID string to BigInt (u256). */
function blobIdToInt(blobId: string): bigint {
  return BigInt(bcs.u256().fromBase64(base64urlToBase64(blobId)));
}

/** Convert a Walrus base64url blob ID string to raw bytes. */
function blobIdToBytes(blobId: string): number[] {
  return Array.from(fromBase64(base64urlToBase64(blobId)));
}

function parseSkillRecord(objectId: string, fields: SkillRecordFields): SkillRecord {
  return {
    objectId,
    blobId: fields.blob_id,
    creator: fields.creator,
    title: bytesToString(fields.title),
    description: bytesToString(fields.description),
    price: BigInt(fields.price),
    scene: bytesToString(fields.scene),
    network: bytesToString(fields.network),
    packageId: bytesToString(fields.package_id),
    isEncrypted: fields.is_encrypted,
    totalSales: Number(fields.total_sales),
    totalRevenue: BigInt(fields.total_revenue),
    createdAt: Number(fields.created_at),
  };
}

function parseAccessCap(objectId: string, fields: AccessCapFields): AccessCap {
  return {
    objectId,
    skillId: fields.skill_id,
    blobId: fields.blob_id,
    purchasedAt: Number(fields.purchased_at),
  };
}

// ====== Transaction Builders ======

/**
 * Build a transaction to publish a new skill to the marketplace.
 */
export function buildPublishSkillTx(params: {
  blobId: string;
  title: string;
  description: string;
  price: bigint;
  scene: string;
  network: string;
  packageId?: string; // Sui package being analyzed (not marketplace package)
  isEncrypted: boolean;
}): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::publish_skill`,
    arguments: [
      tx.pure.u256(blobIdToInt(params.blobId)),
      tx.pure.vector('u8', stringToBytes(params.title)),
      tx.pure.vector('u8', stringToBytes(params.description)),
      tx.pure.u64(params.price),
      tx.pure.vector('u8', stringToBytes(params.scene)),
      tx.pure.vector('u8', stringToBytes(params.network)),
      tx.pure.vector('u8', stringToBytes(params.packageId || '')),
      tx.pure.bool(params.isEncrypted),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

/**
 * Build a transaction to purchase a paid skill.
 */
export function buildPurchaseSkillTx(
  skillObjectId: string,
  priceMist: bigint,
): Transaction {
  const tx = new Transaction();

  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::purchase_skill`,
    arguments: [
      tx.object(skillObjectId),
      coin,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

/**
 * Build a transaction to claim access to a free skill.
 */
export function buildClaimFreeSkillTx(skillObjectId: string): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::claim_free_skill`,
    arguments: [
      tx.object(skillObjectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

/**
 * Build a transaction that calls seal_approve for Seal decryption.
 * This tx is NOT executed - only serialized as txBytes for Seal key servers.
 */
export function buildSealApproveTx(
  skillObjectId: string,
  accessCapObjectId: string,
  sealId: string,
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::seal_approve`,
    arguments: [
      tx.pure.vector('u8', blobIdToBytes(sealId)),
      tx.object(skillObjectId),
      tx.object(accessCapObjectId),
    ],
  });

  return tx;
}

/**
 * Build a transaction that calls seal_approve_free for free skill decryption.
 */
export function buildSealApproveFreeTx(
  skillObjectId: string,
  sealId: string,
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::seal_approve_free`,
    arguments: [
      tx.pure.vector('u8', blobIdToBytes(sealId)),
      tx.object(skillObjectId),
    ],
  });

  return tx;
}

/**
 * Build a transaction to update skill price.
 */
export function buildUpdatePriceTx(
  skillObjectId: string,
  newPrice: bigint,
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::update_price`,
    arguments: [
      tx.object(skillObjectId),
      tx.pure.u64(newPrice),
    ],
  });

  return tx;
}

// ====== On-Chain Queries ======

/**
 * Fetch a SkillRecord from the chain.
 */
export async function fetchSkillRecord(
  suiClient: SuiJsonRpcClient,
  objectId: string,
): Promise<SkillRecord | null> {
  try {
    const result = await suiClient.getObject({
      id: objectId,
      options: { showContent: true },
    });

    if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = result.data.content.fields as unknown as SkillRecordFields;
    return parseSkillRecord(objectId, fields);
  } catch {
    return null;
  }
}

/**
 * Fetch all AccessCap objects owned by a given address.
 */
export async function fetchUserAccessCaps(
  suiClient: SuiJsonRpcClient,
  address: string,
): Promise<AccessCap[]> {
  if (!MARKETPLACE_PACKAGE_ID) return [];

  const accessCapType = `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::AccessCap`;
  const caps: AccessCap[] = [];
  let cursor: string | null | undefined = undefined;
  let hasNext = true;

  while (hasNext) {
    const result = await suiClient.getOwnedObjects({
      owner: address,
      filter: { StructType: accessCapType },
      options: { showContent: true },
      cursor,
    });

    for (const item of result.data) {
      if (item.data?.content && item.data.content.dataType === 'moveObject') {
        const fields = item.data.content.fields as unknown as AccessCapFields;
        caps.push(parseAccessCap(item.data.objectId, fields));
      }
    }

    hasNext = result.hasNextPage;
    cursor = result.nextCursor;
  }

  return caps;
}

/**
 * Check if a user has access (owns an AccessCap) for a specific skill.
 */
export async function checkUserHasAccess(
  suiClient: SuiJsonRpcClient,
  address: string,
  skillObjectId: string,
): Promise<AccessCap | null> {
  const caps = await fetchUserAccessCaps(suiClient, address);
  return caps.find((cap) => cap.skillId === skillObjectId) ?? null;
}

/**
 * Get a SuiClient for the given network.
 */
export function getSuiClient(network: Network): SuiJsonRpcClient {
  return new SuiJsonRpcClient({ network, url: getJsonRpcFullnodeUrl(network) });
}

/**
 * Convert MIST to SUI for display.
 */
export function mistToSui(mist: bigint): string {
  const sui = Number(mist) / 1_000_000_000;
  if (sui === 0) return 'Free';
  if (sui < 0.001) return `${sui.toExponential(2)} SUI`;
  return `${sui.toFixed(sui < 1 ? 4 : 2)} SUI`;
}

/**
 * Convert SUI to MIST.
 */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * 1_000_000_000));
}
