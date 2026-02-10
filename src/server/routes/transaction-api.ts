/**
 * Transaction API Route Handlers
 * Handles transaction analysis and skill generation
 */

import type { ServerResponse } from 'http';
import { TransactionFetcher } from '../../fetcher/transaction-fetcher.js';
import { TransactionParser } from '../../analyzer/transaction-parser.js';
import { generateTransactionSkill } from '../../generator/transaction-skill-generator.js';
import type { Network } from '../../types/index.js';

type SendJsonFn = (res: ServerResponse, data: unknown, status?: number) => void;
type SendErrorFn = (res: ServerResponse, message: string, status?: number) => void;

interface TransactionRequest {
  digest: string;
  network?: Network;
}

interface TransactionSkillRequest extends TransactionRequest {
  options?: {
    language?: 'en' | 'zh';
    includeScripts?: boolean;
    includeReplicationGuide?: boolean;
  };
}

/**
 * Handle POST /api/transaction
 * Analyze a transaction and return parsed data
 */
export async function handleTransaction(
  body: unknown,
  res: ServerResponse,
  sendJson: SendJsonFn,
  sendError: SendErrorFn
): Promise<void> {
  try {
    const { digest, network = 'mainnet' } = body as TransactionRequest;

    if (!digest) {
      sendError(res, 'Transaction digest is required', 400);
      return;
    }

    const validNetworks = ['mainnet', 'testnet', 'devnet'];
    if (!validNetworks.includes(network)) {
      sendError(res, 'Invalid network. Use mainnet, testnet, or devnet', 400);
      return;
    }

    console.log(`[Transaction] Analyzing ${digest} on ${network}`);

    // Fetch transaction
    const fetcher = new TransactionFetcher({ network });
    const transaction = await fetcher.fetchTransaction(digest);

    // Parse transaction
    const parser = new TransactionParser();
    const parsed = parser.parse(transaction);

    // Calculate summary
    const uniquePackages = [...new Set(transaction.moveCalls.map(c => c.packageId))];
    const uniqueModules = [...new Set(transaction.moveCalls.map(c => `${c.packageId}::${c.moduleName}`))];

    sendJson(res, {
      success: true,
      digest,
      network,
      analysis: {
        digest: transaction.digest,
        type: parsed.transactionType,
        confidence: parsed.typeConfidence,
        status: transaction.status,
        sender: transaction.sender,
        gasUsed: transaction.gasUsed.totalCost,
        summary: {
          moveCalls: transaction.moveCalls.length,
          packages: uniquePackages.length,
          modules: uniqueModules.length,
          objectsCreated: transaction.objectChanges.filter(c => c.type === 'created').length,
          objectsDeleted: transaction.objectChanges.filter(c => c.type === 'deleted').length,
          events: transaction.events.length,
        },
        involvedPackages: parsed.involvedPackages,
        callSequence: parsed.callSequence.map((entry, index) => ({
          index,
          target: `${entry.call.moduleName}::${entry.call.functionName}`,
          purpose: entry.purpose,
        })),
        balanceChanges: transaction.balanceChanges.map(bc => ({
          coinType: bc.coinType,
          amount: bc.amount,
        })),
      },
    });
  } catch (error) {
    console.error('[Transaction] Error:', error);
    sendError(res, error instanceof Error ? error.message : 'Failed to analyze transaction');
  }
}

/**
 * Handle POST /api/transaction/skill
 * Generate a SKILL.md from a transaction
 */
export async function handleTransactionSkill(
  body: unknown,
  res: ServerResponse,
  sendJson: SendJsonFn,
  sendError: SendErrorFn
): Promise<void> {
  try {
    const { digest, network = 'mainnet', options = {} } = body as TransactionSkillRequest;

    if (!digest) {
      sendError(res, 'Transaction digest is required', 400);
      return;
    }

    const validNetworks = ['mainnet', 'testnet', 'devnet'];
    if (!validNetworks.includes(network)) {
      sendError(res, 'Invalid network. Use mainnet, testnet, or devnet', 400);
      return;
    }

    console.log(`[Transaction] Generating skill from ${digest} on ${network}`);

    // Fetch transaction
    const fetcher = new TransactionFetcher({ network });
    const transaction = await fetcher.fetchTransaction(digest);

    // Parse transaction
    const parser = new TransactionParser();
    const parsed = parser.parse(transaction);

    // Generate skill
    const skill = generateTransactionSkill(transaction, parsed, {
      language: options.language || 'en',
      includeScripts: options.includeScripts !== false,
      includeReplicationGuide: options.includeReplicationGuide !== false,
    });

    sendJson(res, {
      success: true,
      digest,
      network,
      skill: {
        content: skill.content,
        metadata: skill.metadata,
      },
    });
  } catch (error) {
    console.error('[Transaction] Error generating skill:', error);
    sendError(res, error instanceof Error ? error.message : 'Failed to generate skill');
  }
}
