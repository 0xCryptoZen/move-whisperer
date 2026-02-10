/**
 * Transaction Skill Generation API
 * POST /api/transaction/skill
 * Generates a SKILL.md from a transaction
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

interface TransactionSkillRequest {
  digest: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  options?: {
    language?: 'en' | 'zh';
    includeScripts?: boolean;
    includeReplicationGuide?: boolean;
  };
}

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as TransactionSkillRequest;
    const { digest, network, options = {} } = body;

    if (!digest) {
      return NextResponse.json(
        { error: 'Transaction digest is required' },
        { status: 400 }
      );
    }

    if (!network || !RPC_URLS[network]) {
      return NextResponse.json(
        { error: 'Valid network (mainnet/testnet/devnet) is required' },
        { status: 400 }
      );
    }

    // Fetch transaction from Sui RPC
    const rpcUrl = RPC_URLS[network];
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getTransactionBlock',
        params: [
          digest,
          {
            showInput: true,
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
            showBalanceChanges: true,
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch transaction from RPC' },
        { status: 502 }
      );
    }

    const rpcResult = await response.json() as { error?: { message?: string }; result?: any };

    if (rpcResult.error) {
      return NextResponse.json(
        { error: rpcResult.error.message || 'RPC error' },
        { status: 400 }
      );
    }

    const tx = rpcResult.result;
    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Parse and generate skill
    const parsed = parseTransaction(tx, network);
    const skill = generateSkillContent(parsed, options);

    return NextResponse.json({
      success: true,
      digest,
      network,
      skill: {
        content: skill.content,
        metadata: skill.metadata,
      },
    });
  } catch (error) {
    console.error('[Transaction Skill API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

interface ParsedTransaction {
  digest: string;
  network: string;
  type: string;
  confidence: number;
  status: string;
  sender: string;
  gasUsed: string;
  moveCalls: Array<{
    packageId: string;
    moduleName: string;
    functionName: string;
    typeArguments: string[];
  }>;
  balanceChanges: Array<{
    coinType: string;
    amount: string;
  }>;
  objectChanges: Array<{
    type: string;
    objectId: string;
    objectType: string;
  }>;
}

function parseTransaction(tx: any, network: string): ParsedTransaction {
  const effects = tx.effects || {};
  const transaction = tx.transaction?.data?.transaction;
  const balanceChanges = tx.balanceChanges || [];
  const objectChanges = tx.objectChanges || [];

  // Extract move calls
  const moveCalls: ParsedTransaction['moveCalls'] = [];

  if (transaction?.kind === 'ProgrammableTransaction') {
    const txs = transaction.transactions || [];
    txs.forEach((cmd: any) => {
      if (cmd.MoveCall) {
        moveCalls.push({
          packageId: cmd.MoveCall.package,
          moduleName: cmd.MoveCall.module,
          functionName: cmd.MoveCall.function,
          typeArguments: cmd.MoveCall.type_arguments || [],
        });
      }
    });
  }

  // Infer transaction type
  const { type, confidence } = inferTransactionType(moveCalls);

  // Calculate gas
  const gasUsed = effects.gasUsed || {};
  const totalGas = (
    BigInt(gasUsed.computationCost || '0') +
    BigInt(gasUsed.storageCost || '0') -
    BigInt(gasUsed.storageRebate || '0')
  ).toString();

  return {
    digest: tx.digest,
    network,
    type,
    confidence,
    status: effects.status?.status === 'success' ? 'success' : 'failure',
    sender: tx.transaction?.data?.sender || '',
    gasUsed: totalGas,
    moveCalls,
    balanceChanges: balanceChanges.map((bc: any) => ({
      coinType: bc.coinType,
      amount: bc.amount,
    })),
    objectChanges: objectChanges.map((oc: any) => ({
      type: oc.type,
      objectId: oc.objectId,
      objectType: oc.objectType || '',
    })),
  };
}

function inferTransactionType(moveCalls: ParsedTransaction['moveCalls']): { type: string; confidence: number } {
  for (const call of moveCalls) {
    const fn = call.functionName.toLowerCase();
    const pkg = call.packageId.toLowerCase();

    // Known protocols
    if (pkg.startsWith('0x1eabed72c53feb73')) {
      if (fn.includes('swap')) return { type: 'swap', confidence: 0.95 };
      if (fn.includes('add_liquidity') || fn.includes('open_position')) return { type: 'liquidity_add', confidence: 0.9 };
      if (fn.includes('remove_liquidity') || fn.includes('close_position')) return { type: 'liquidity_remove', confidence: 0.9 };
    }

    if (pkg.startsWith('0xdee9')) {
      if (fn.includes('swap') || fn.includes('place')) return { type: 'swap', confidence: 0.9 };
    }

    // Generic patterns
    if (fn.includes('swap') || fn.includes('exchange')) return { type: 'swap', confidence: 0.7 };
    if (fn === 'transfer' || fn === 'public_transfer') return { type: 'transfer', confidence: 0.9 };
    if (fn.includes('mint')) return { type: 'mint', confidence: 0.75 };
    if (fn.includes('burn')) return { type: 'burn', confidence: 0.75 };
    if (fn.includes('stake') || fn.includes('deposit')) return { type: 'stake', confidence: 0.65 };
    if (fn.includes('unstake') || fn.includes('withdraw')) return { type: 'unstake', confidence: 0.65 };
    if (fn.includes('borrow')) return { type: 'borrow', confidence: 0.8 };
    if (fn.includes('repay')) return { type: 'repay', confidence: 0.8 };
    if (fn.includes('claim') || fn.includes('harvest')) return { type: 'claim', confidence: 0.7 };
  }

  if (moveCalls.length > 3) return { type: 'complex', confidence: 0.6 };
  return { type: 'unknown', confidence: 0 };
}

function generateSkillContent(
  parsed: ParsedTransaction,
  options: { language?: string; includeScripts?: boolean; includeReplicationGuide?: boolean }
): { content: string; metadata: any } {
  const language = options.language || 'en';
  const includeScripts = options.includeScripts !== false;
  const includeReplicationGuide = options.includeReplicationGuide !== false;

  // Generate title
  const typeLabels: Record<string, string> = {
    swap: 'Token Swap',
    transfer: 'Token Transfer',
    mint: 'Token Mint',
    burn: 'Token Burn',
    stake: 'Staking',
    unstake: 'Unstaking',
    liquidity_add: 'Add Liquidity',
    liquidity_remove: 'Remove Liquidity',
    borrow: 'Borrow',
    repay: 'Repay',
    claim: 'Claim Rewards',
    complex: 'Complex Transaction',
    unknown: 'Transaction',
  };

  const title = `${typeLabels[parsed.type] || 'Transaction'} Skill`;
  const packages = Array.from(new Set(parsed.moveCalls.map(c => c.packageId)));

  // Format gas
  const gasValue = BigInt(parsed.gasUsed);
  const ONE_SUI = BigInt(1_000_000_000);
  const formattedGas = gasValue >= ONE_SUI
    ? `${(Number(gasValue) / 1_000_000_000).toFixed(4)} SUI`
    : `${gasValue} MIST`;

  // Build content
  let content = `---
name: ${title}
description: Skill generated from transaction ${parsed.digest.slice(0, 10)}...
scene: transaction
network: ${parsed.network}
---

# ${title}

Skill generated from transaction \`${parsed.digest}\` on ${parsed.network}.

## Transaction Overview

| Property | Value |
|----------|-------|
| **Digest** | \`${parsed.digest}\` |
| **Network** | ${parsed.network} |
| **Type** | ${parsed.type} (${Math.round(parsed.confidence * 100)}% confidence) |
| **Status** | ${parsed.status} |
| **Gas Used** | ${formattedGas} |

## Involved Packages

${packages.map(p => `- \`${p}\``).join('\n')}

## Call Sequence

This transaction executes the following Move function calls in order:

`;

  parsed.moveCalls.forEach((call, i) => {
    content += `### ${i + 1}. ${call.moduleName}::${call.functionName}

| Property | Value |
|----------|-------|
| **Package** | \`${call.packageId}\` |
| **Module** | ${call.moduleName} |
| **Function** | ${call.functionName} |
${call.typeArguments.length > 0 ? `| **Type Arguments** | ${call.typeArguments.map(t => `\`${t}\``).join(', ')} |\n` : ''}
`;
  });

  if (parsed.balanceChanges.length > 0) {
    content += `## Balance Changes

| Token | Amount |
|-------|--------|
${parsed.balanceChanges.map(bc => {
  const coinName = bc.coinType.split('::').pop() || bc.coinType;
  const amount = BigInt(bc.amount);
  const sign = amount >= BigInt(0) ? '+' : '';
  return `| ${coinName} | ${sign}${amount} |`;
}).join('\n')}

`;
  }

  if (includeReplicationGuide) {
    content += `## How to Replicate This Transaction

To replicate this transaction pattern using the Sui TypeScript SDK:

\`\`\`typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: getFullnodeUrl('${parsed.network}') });

async function replicateTransaction() {
  const tx = new Transaction();

${parsed.moveCalls.map((call, i) => `  // Step ${i + 1}: ${call.moduleName}::${call.functionName}
  tx.moveCall({
    target: '${call.packageId}::${call.moduleName}::${call.functionName}',${call.typeArguments.length > 0 ? `
    typeArguments: [
      ${call.typeArguments.map(t => `'${t}'`).join(',\n      ')}
    ],` : ''}
    arguments: [
      // TODO: Add appropriate arguments
    ],
  });
`).join('\n')}
  return tx;
}
\`\`\`
`;
  }

  if (includeScripts) {
    content += `## Quick Reference

### Fetch Original Transaction

\`\`\`bash
sui client tx-block ${parsed.digest} --json
\`\`\`

`;
  }

  content += `## Notes

- This skill was auto-generated from an on-chain transaction
- Actual argument values and object IDs will differ when replicating
- Always test on testnet/devnet before mainnet
- Gas costs may vary based on current network conditions

---
*Generated by MoveWhisperer from transaction ${parsed.digest}*
`;

  return {
    content,
    metadata: {
      title,
      description: `Skill generated from transaction ${parsed.digest.slice(0, 10)}...`,
      txType: parsed.type,
      packages,
      functions: parsed.moveCalls.map(c => `${c.moduleName}::${c.functionName}`),
    },
  };
}
