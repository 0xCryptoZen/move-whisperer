/**
 * Transaction Analysis API
 * POST /api/transaction
 * Analyzes a Sui transaction and returns structured data
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

interface TransactionRequest {
  digest: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  options?: {
    includeReplication?: boolean;
    analyzeContracts?: boolean;
  };
}

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as TransactionRequest;
    const { digest, network } = body;

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

    // Parse the transaction
    const analysis = parseTransaction(tx, network);

    return NextResponse.json({
      success: true,
      digest,
      network,
      analysis,
    });
  } catch (error) {
    console.error('[Transaction API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Parse transaction into analysis format
 */
function parseTransaction(tx: any, network: string) {
  const effects = tx.effects || {};
  const transaction = tx.transaction?.data?.transaction;
  const balanceChanges = tx.balanceChanges || [];
  const objectChanges = tx.objectChanges || [];
  const events = tx.events || [];

  // Extract move calls
  const moveCalls: Array<{
    index: number;
    packageId: string;
    moduleName: string;
    functionName: string;
    typeArguments: string[];
  }> = [];

  if (transaction?.kind === 'ProgrammableTransaction') {
    const txs = transaction.transactions || [];
    txs.forEach((cmd: any, index: number) => {
      if (cmd.MoveCall) {
        moveCalls.push({
          index,
          packageId: cmd.MoveCall.package,
          moduleName: cmd.MoveCall.module,
          functionName: cmd.MoveCall.function,
          typeArguments: cmd.MoveCall.type_arguments || [],
        });
      }
    });
  }

  // Group by package
  const packageMap = new Map<string, {
    packageId: string;
    moduleName: string;
    functionsUsed: string[];
    callCount: number;
  }>();

  for (const call of moveCalls) {
    const key = `${call.packageId}::${call.moduleName}`;
    const existing = packageMap.get(key);
    if (existing) {
      if (!existing.functionsUsed.includes(call.functionName)) {
        existing.functionsUsed.push(call.functionName);
      }
      existing.callCount++;
    } else {
      packageMap.set(key, {
        packageId: call.packageId,
        moduleName: call.moduleName,
        functionsUsed: [call.functionName],
        callCount: 1,
      });
    }
  }

  // Infer transaction type
  const { type, confidence } = inferTransactionType(moveCalls, balanceChanges);

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
    status: effects.status?.status === 'success' ? 'success' : 'failure',
    type,
    confidence,
    sender: tx.transaction?.data?.sender || '',
    timestamp: tx.timestampMs,
    gasUsed: totalGas,
    summary: {
      moveCalls: moveCalls.length,
      packages: new Set(moveCalls.map(c => c.packageId)).size,
      modules: packageMap.size,
      objectsCreated: objectChanges.filter((c: any) => c.type === 'created').length,
      objectsDeleted: objectChanges.filter((c: any) => c.type === 'deleted').length,
      events: events.length,
    },
    involvedPackages: Array.from(packageMap.values()),
    callSequence: moveCalls.map(call => ({
      index: call.index,
      target: `${call.moduleName}::${call.functionName}`,
      purpose: inferCallPurpose(call.functionName),
    })),
    balanceChanges: balanceChanges.map((bc: any) => ({
      coinType: bc.coinType,
      amount: bc.amount,
    })),
  };
}

/**
 * Infer transaction type from calls
 */
function inferTransactionType(
  moveCalls: Array<{ functionName: string; packageId: string }>,
  balanceChanges: any[]
): { type: string; confidence: number } {
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

/**
 * Infer call purpose from function name
 */
function inferCallPurpose(functionName: string): string {
  const fn = functionName.toLowerCase();

  if (fn.includes('swap')) return 'Execute token swap';
  if (fn.includes('transfer')) return 'Transfer object/tokens';
  if (fn.includes('mint')) return 'Mint new tokens/NFT';
  if (fn.includes('burn')) return 'Burn tokens';
  if (fn.includes('stake') || fn.includes('deposit')) return 'Deposit/stake assets';
  if (fn.includes('unstake') || fn.includes('withdraw')) return 'Withdraw/unstake assets';
  if (fn.includes('borrow')) return 'Borrow assets';
  if (fn.includes('repay')) return 'Repay borrowed assets';
  if (fn.includes('claim') || fn.includes('harvest')) return 'Claim rewards';
  if (fn.includes('add_liquidity') || fn.includes('open_position')) return 'Add liquidity';
  if (fn.includes('remove_liquidity') || fn.includes('close_position')) return 'Remove liquidity';
  if (fn.includes('create') || fn.includes('new')) return 'Create new object';

  return `Call ${functionName}`;
}
