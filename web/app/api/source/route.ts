import { NextRequest, NextResponse } from 'next/server';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

export const runtime = 'edge';

type Network = 'mainnet' | 'testnet' | 'devnet';

const NETWORK_URLS: Record<Network, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io',
  testnet: 'https://fullnode.testnet.sui.io',
  devnet: 'https://fullnode.devnet.sui.io',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { input?: string; network?: string };
    const { input, network = 'mainnet' } = body;

    if (!input) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Validate network
    if (!NETWORK_URLS[network as Network]) {
      return NextResponse.json(
        { error: 'Invalid network' },
        { status: 400 }
      );
    }

    // Parse input - extract package ID
    const packageId = input.split('::')[0].trim();

    // Validate package ID format
    if (!/^0x[a-fA-F0-9]+$/.test(packageId)) {
      return NextResponse.json(
        { error: 'Invalid package ID format' },
        { status: 400 }
      );
    }

    // Create Sui client
    const client = new SuiJsonRpcClient({ url: NETWORK_URLS[network as Network], network: network as Network });

    // Fetch package object
    const packageObject = await client.getObject({
      id: packageId,
      options: {
        showContent: true,
      },
    });

    if (!packageObject.data) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }

    const content = packageObject.data.content;
    if (!content || content.dataType !== 'package') {
      return NextResponse.json(
        { error: 'Object is not a package' },
        { status: 400 }
      );
    }

    // Extract disassembled source
    const disassembled = content.disassembled;
    if (!disassembled || typeof disassembled !== 'object') {
      return NextResponse.json(
        { error: 'No source code available for this package' },
        { status: 404 }
      );
    }

    // Also fetch raw bytecode for decompilation
    let bytecode: Record<string, string> = {};
    try {
      const objectWithBcs = await client.getObject({
        id: packageId,
        options: {
          showBcs: true,
        },
      });

      const bcsData = objectWithBcs.data?.bcs;
      if (bcsData && 'moduleMap' in bcsData) {
        bytecode = bcsData.moduleMap as Record<string, string>;
      }
    } catch (e) {
      console.warn('Could not fetch bytecode:', e);
    }

    return NextResponse.json({
      packageId,
      modules: disassembled as Record<string, string>,
      bytecode, // Raw bytecode (base64) for decompilation
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Source fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch source code' },
      { status: 500 }
    );
  }
}
