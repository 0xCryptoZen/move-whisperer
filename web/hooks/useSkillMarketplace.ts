'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toHex, fromBase64 } from '@mysten/bcs';
import { getWalrusClient, downloadSkillBlob } from '@/lib/walrus/client';
import { getSealClient, createSessionKey, decryptSkillContent, encryptSkillContent, SessionKey } from '@/lib/seal/client';
import {
  buildPublishSkillTx,
  buildPurchaseSkillTx,
  buildClaimFreeSkillTx,
  buildSealApproveTx,
  buildSealApproveFreeTx,
  fetchUserAccessCaps,
  checkUserHasAccess,
  MARKETPLACE_PACKAGE_ID,
  type SkillRecord,
  type AccessCap,
} from '@/lib/contracts/skill-marketplace';
import type { Network } from '@/lib/walrus/types';

const MARKETPLACE_NETWORK: Network =
  (process.env.NEXT_PUBLIC_MARKETPLACE_NETWORK as Network) || 'testnet';

const STORAGE_EPOCHS = 10; // ~20 weeks on mainnet

export interface PublishSkillParams {
  content: string;
  title: string;
  description: string;
  price: bigint; // MIST, 0 = free
  scene: string;
  network: string;
  suiPackageId?: string; // The analyzed contract package ID
}

export interface PublishResult {
  blobId: string;
  skillObjectId: string;
  txDigest: string;
}

export interface PurchaseResult {
  accessCapId: string;
  txDigest: string;
}

export function useSkillMarketplace() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [accessCaps, setAccessCaps] = useState<AccessCap[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Refresh user's access caps on account change
  useEffect(() => {
    if (!account?.address || !MARKETPLACE_PACKAGE_ID) {
      setAccessCaps([]);
      return;
    }

    let cancelled = false;
    fetchUserAccessCaps(suiClient, account.address).then((caps) => {
      if (!cancelled) setAccessCaps(caps);
    });

    return () => { cancelled = true; };
  }, [account?.address, suiClient]);

  /**
   * Publish a new skill to the marketplace.
   *
   * Flow:
   * 1. Encode content to bytes
   * 2. If paid: encrypt with Seal
   * 3. Upload to Walrus via flow-based approach (browser wallet signing)
   * 4. Register on-chain via publish_skill
   * 5. Return blobId and skillObjectId
   */
  const publishSkill = useCallback(
    async (params: PublishSkillParams): Promise<PublishResult> => {
      if (!account?.address) throw new Error('Wallet not connected');
      setPublishing(true);

      try {
        const contentBytes = new TextEncoder().encode(params.content);
        const isPaid = params.price > BigInt(0);
        let blobData: Uint8Array;

        if (isPaid) {
          // Encrypt with Seal before uploading
          // Use a temporary ID - we'll use the marketplace package ID as the encryption namespace
          // The actual identity will be the skill's blob ID (deterministic from content)
          const sealClient = getSealClient(MARKETPLACE_NETWORK);

          // For encryption, we need a stable ID. We use the content hash as the ID.
          // After publishing, the on-chain SkillRecord ID will be used for seal_approve.
          // Since the identity for encrypt must match what seal_approve checks,
          // we use the marketplace package ID as namespace and a placeholder.
          // The actual approach: encrypt with package+blobId, and seal_approve verifies AccessCap.
          const walrusClient = getWalrusClient(MARKETPLACE_NETWORK);
          const metadata = await walrusClient.computeBlobMetadata({
            bytes: contentBytes,
            numShards: undefined as unknown as number, // Will use default
          });
          const predictedBlobId = metadata.blobId;

          // Seal's encrypt expects `id` as a hex string, but Walrus blobId is base64url.
          // Convert base64url → standard base64 → bytes → hex.
          const blobIdBase64 = predictedBlobId.replaceAll('-', '+').replaceAll('_', '/');
          const blobIdHex = toHex(fromBase64(blobIdBase64));

          const { encryptedData } = await encryptSkillContent(
            sealClient,
            contentBytes,
            MARKETPLACE_PACKAGE_ID,
            blobIdHex,
            MARKETPLACE_NETWORK,
          );
          blobData = encryptedData;
        } else {
          blobData = contentBytes;
        }

        // Upload to Walrus using the flow-based approach for browser wallets
        const walrusClient = getWalrusClient(MARKETPLACE_NETWORK);
        const flow = walrusClient.writeBlobFlow({ blob: blobData });
        await flow.encode();

        // Register blob on Walrus (requires wallet signature)
        const registerTx = flow.register({
          epochs: STORAGE_EPOCHS,
          owner: account.address,
          deletable: false,
        });
        const registerResult = await signAndExecute({
          transaction: registerTx as unknown as Transaction,
        });

        // Upload slivers to storage nodes
        await flow.upload({ digest: registerResult.digest });

        // Certify the blob (requires wallet signature)
        const certifyTx = flow.certify();
        await signAndExecute({
          transaction: certifyTx as unknown as Transaction,
        });

        const blobResult = await flow.getBlob();
        const blobId = blobResult.blobId;
        if (!blobId) throw new Error('Failed to get blob ID after upload');

        // Register skill on-chain
        const publishTx = buildPublishSkillTx({
          blobId,
          title: params.title,
          description: params.description,
          price: params.price,
          scene: params.scene,
          network: params.network,
          packageId: params.suiPackageId,
          isEncrypted: isPaid,
        });

        const publishResult = await signAndExecute({ transaction: publishTx });

        // Extract SkillRecord object ID from transaction effects
        const txResponse = await suiClient.waitForTransaction({
          digest: publishResult.digest,
          options: { showObjectChanges: true },
        });

        const skillObject = txResponse.objectChanges?.find(
          (change) =>
            change.type === 'created' &&
            change.objectType?.includes('SkillRecord'),
        );
        const skillObjectId = skillObject && 'objectId' in skillObject
          ? skillObject.objectId
          : '';

        return {
          blobId,
          skillObjectId,
          txDigest: publishResult.digest,
        };
      } finally {
        setPublishing(false);
      }
    },
    [account?.address, signAndExecute, suiClient],
  );

  /**
   * Purchase a paid skill.
   */
  const purchaseSkill = useCallback(
    async (skillObjectId: string, priceMist: bigint): Promise<PurchaseResult> => {
      if (!account?.address) throw new Error('Wallet not connected');
      setPurchasing(true);

      try {
        const tx = buildPurchaseSkillTx(skillObjectId, priceMist);
        const result = await signAndExecute({ transaction: tx });

        // Extract AccessCap object ID
        const txResponse = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showObjectChanges: true },
        });

        const capObject = txResponse.objectChanges?.find(
          (change) =>
            change.type === 'created' &&
            change.objectType?.includes('AccessCap'),
        );
        const accessCapId = capObject && 'objectId' in capObject
          ? capObject.objectId
          : '';

        // Refresh access caps
        const caps = await fetchUserAccessCaps(suiClient, account.address);
        setAccessCaps(caps);

        return { accessCapId, txDigest: result.digest };
      } finally {
        setPurchasing(false);
      }
    },
    [account?.address, signAndExecute, suiClient],
  );

  /**
   * Claim access to a free skill.
   */
  const claimFreeSkill = useCallback(
    async (skillObjectId: string): Promise<PurchaseResult> => {
      if (!account?.address) throw new Error('Wallet not connected');
      setPurchasing(true);

      try {
        const tx = buildClaimFreeSkillTx(skillObjectId);
        const result = await signAndExecute({ transaction: tx });

        const txResponse = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showObjectChanges: true },
        });

        const capObject = txResponse.objectChanges?.find(
          (change) =>
            change.type === 'created' &&
            change.objectType?.includes('AccessCap'),
        );
        const accessCapId = capObject && 'objectId' in capObject
          ? capObject.objectId
          : '';

        const caps = await fetchUserAccessCaps(suiClient, account.address);
        setAccessCaps(caps);

        return { accessCapId, txDigest: result.digest };
      } finally {
        setPurchasing(false);
      }
    },
    [account?.address, signAndExecute, suiClient],
  );

  /**
   * Check if the current user has access to a skill.
   */
  const hasAccess = useCallback(
    (skillObjectId: string): AccessCap | undefined => {
      return accessCaps.find((cap) => cap.skillId === skillObjectId);
    },
    [accessCaps],
  );

  /**
   * Get the full skill content. Handles:
   * - Free unencrypted: download directly from Walrus
   * - Paid encrypted: decrypt with Seal using AccessCap
   */
  const getSkillContent = useCallback(
    async (skill: {
      blobId: string;
      objectId: string;
      isEncrypted: boolean;
      price: bigint;
    }): Promise<string> => {
      if (!skill.blobId) throw new Error('No blob ID for this skill');
      setLoading(true);

      try {
        const walrusClient = getWalrusClient(MARKETPLACE_NETWORK);
        const rawData = await downloadSkillBlob(walrusClient, skill.blobId);

        if (!skill.isEncrypted) {
          // Free skill - return plaintext
          return new TextDecoder().decode(rawData);
        }

        // Encrypted skill - need to decrypt with Seal
        if (!account?.address) throw new Error('Wallet not connected');

        const cap = hasAccess(skill.objectId);
        if (!cap) throw new Error('No access to this skill. Purchase it first.');

        // Create session key for decryption
        const sessionKey = await createSessionKey(
          MARKETPLACE_NETWORK,
          account.address,
          MARKETPLACE_PACKAGE_ID,
          10, // 10 min TTL
        );

        // Sign the session key personal message
        const personalMessage = sessionKey.getPersonalMessage();
        const { signature } = await signPersonalMessage({ message: personalMessage });
        await sessionKey.setPersonalMessageSignature(signature);

        // Build seal_approve transaction (not executed, just for key servers)
        const sealApproveTx = buildSealApproveTx(
          skill.objectId,
          cap.objectId,
          skill.blobId,
        );
        const txBytes = await sealApproveTx.build({
          client: suiClient,
          onlyTransactionKind: true,
        });

        // Decrypt
        const sealClient = getSealClient(MARKETPLACE_NETWORK);
        const decrypted = await decryptSkillContent(
          sealClient,
          rawData,
          sessionKey,
          txBytes,
        );

        return new TextDecoder().decode(decrypted);
      } finally {
        setLoading(false);
      }
    },
    [account?.address, hasAccess, signPersonalMessage, suiClient],
  );

  /**
   * Get free skill content (no AccessCap needed).
   */
  const getFreeSkillContent = useCallback(
    async (skill: { blobId: string; objectId: string }): Promise<string> => {
      if (!skill.blobId) throw new Error('No blob ID for this skill');
      setLoading(true);

      try {
        const walrusClient = getWalrusClient(MARKETPLACE_NETWORK);
        const rawData = await downloadSkillBlob(walrusClient, skill.blobId);
        return new TextDecoder().decode(rawData);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    // Actions
    publishSkill,
    purchaseSkill,
    claimFreeSkill,
    getSkillContent,
    getFreeSkillContent,

    // Queries
    hasAccess,
    accessCaps,

    // State
    publishing,
    purchasing,
    loading,
    connected: !!account?.address,
    address: account?.address,
    network: MARKETPLACE_NETWORK,
  };
}
