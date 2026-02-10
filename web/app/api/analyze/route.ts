import { NextRequest, NextResponse } from 'next/server';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

export const runtime = 'edge';

const NETWORK_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io',
  testnet: 'https://fullnode.testnet.sui.io',
  devnet: 'https://fullnode.devnet.sui.io',
};

interface AnalyzeRequest {
  packageId: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  moduleName?: string;
  sourceCode?: string;
}

interface ContractAnalysis {
  purpose: {
    summary: string;
    category: string;
    protocols: string[];
  };
  functions: Array<{
    name: string;
    purpose: string;
    category: 'admin' | 'user' | 'query' | 'internal';
    risk: 'high' | 'medium' | 'low';
    genericUsage?: Record<string, 'input' | 'output' | 'both'>;
  }>;
  types: Array<{
    name: string;
    purpose: string;
    isCapability: boolean;
    isSharedObject: boolean;
    fields: Array<{ name: string; purpose: string }>;
  }>;
  generics: {
    mapping: Record<string, { name: string; description: string; commonTypes: string[] }>;
    confidence: number;
    inferredFrom: string[];
  };
  errorCodes: Array<{
    name: string;
    code: number;
    description: string;
    possibleCauses: string[];
    solutions: string[];
    category: 'permission' | 'validation' | 'state' | 'math' | 'other';
  }>;
  security: {
    riskLevel: 'high' | 'medium' | 'low';
    concerns: string[];
    adminFunctions: string[];
  };
  suggestedName: string;
  confidence: number;
  fallbackUsed: boolean;
  analysisSource: 'claude' | 'regex' | 'hybrid';
}

/**
 * Regex-based analysis (runs on edge)
 * For AI-powered analysis, use the local server directly from the browser.
 */
function analyzeWithRegex(sourceCode: string, packageId: string, moduleName: string): ContractAnalysis {
  // Extract error codes
  const errorCodes: ContractAnalysis['errorCodes'] = [];
  const errorPattern = /const\s+(E[A-Z_][A-Za-z0-9_]*)\s*:\s*u64\s*=\s*(\d+)/g;
  let match;
  while ((match = errorPattern.exec(sourceCode)) !== null) {
    errorCodes.push({
      name: match[1],
      code: parseInt(match[2], 10),
      description: inferErrorDescription(match[1]),
      possibleCauses: ['Review source code for details'],
      solutions: ['Check function requirements'],
      category: inferErrorCategory(match[1]),
    });
  }

  // Infer category
  let category = 'utility';
  if (/swap|trade|exchange|clob|amm/i.test(sourceCode)) category = 'dex';
  else if (/nft|mint_token|royalty/i.test(sourceCode)) category = 'nft';
  else if (/stake|lend|borrow|yield/i.test(sourceCode)) category = 'defi';
  else if (/game|play|battle/i.test(sourceCode)) category = 'gaming';

  // Extract functions
  const functions: ContractAnalysis['functions'] = [];
  const funcPattern = /(public\s+)?(entry\s+)?fun\s+(\w+)/g;
  while ((match = funcPattern.exec(sourceCode)) !== null) {
    const isPublic = !!match[1];
    const isEntry = !!match[2];
    const name = match[3];

    if (!isPublic && !isEntry) continue;

    let funcCategory: 'admin' | 'user' | 'query' | 'internal' = 'user';
    let risk: 'high' | 'medium' | 'low' = 'low';

    if (/^(get|view|is_|has_|check)/i.test(name)) {
      funcCategory = 'query';
    } else if (/^(admin|set_|update_|pause|withdraw)/i.test(name)) {
      funcCategory = 'admin';
      risk = 'high';
    }

    functions.push({
      name,
      purpose: `${isEntry ? 'Entry function' : 'Public function'}: ${name.replace(/_/g, ' ')}`,
      category: funcCategory,
      risk,
    });
  }

  // Extract types
  const types: ContractAnalysis['types'] = [];
  const structPattern = /struct\s+(\w+)/g;
  while ((match = structPattern.exec(sourceCode)) !== null) {
    const name = match[1];
    types.push({
      name,
      purpose: `Type: ${name}`,
      isCapability: /Cap$|Capability$|Admin|Owner/.test(name),
      isSharedObject: /Pool|Registry|Config|State|Store/.test(name),
      fields: [],
    });
  }

  // Infer generics
  const generics: ContractAnalysis['generics'] = {
    mapping: {},
    confidence: 0.5,
    inferredFrom: ['pattern-matching'],
  };

  const genericSet = new Set<string>();
  const genericPattern = /<([^>]+)>/g;
  while ((match = genericPattern.exec(sourceCode)) !== null) {
    const params = match[1].split(',').map(p => p.trim().split(':')[0].trim());
    params.forEach(p => {
      if (/^T\d+$/.test(p)) genericSet.add(p);
    });
  }

  const categoryPatterns: Record<string, Record<string, { name: string; description: string; commonTypes: string[] }>> = {
    dex: {
      T0: { name: 'Base Asset', description: 'The base asset in trading pairs', commonTypes: ['SUI', 'USDC'] },
      T1: { name: 'Quote Asset', description: 'The quote asset in trading pairs', commonTypes: ['USDT', 'USDC'] },
    },
    defi: {
      T0: { name: 'Collateral', description: 'Asset used as collateral', commonTypes: ['SUI', 'WETH'] },
      T1: { name: 'Debt Asset', description: 'Asset being borrowed', commonTypes: ['USDC', 'USDT'] },
    },
  };

  const patterns = categoryPatterns[category] || {};
  for (const generic of Array.from(genericSet)) {
    generics.mapping[generic] = patterns[generic] || {
      name: `Type Parameter ${generic}`,
      description: `Generic type parameter ${generic}`,
      commonTypes: [],
    };
  }

  const adminFunctions = functions.filter(f => f.category === 'admin').map(f => f.name);

  return {
    purpose: {
      summary: `${category.charAt(0).toUpperCase() + category.slice(1)} module with ${functions.length} functions`,
      category,
      protocols: [],
    },
    functions,
    types,
    generics,
    errorCodes,
    security: {
      riskLevel: adminFunctions.length > 3 ? 'medium' : 'low',
      concerns: adminFunctions.length > 0 ? [`${adminFunctions.length} admin-only functions detected`] : [],
      adminFunctions,
    },
    suggestedName: moduleName.toLowerCase().replace(/_/g, '-'),
    confidence: 0.6,
    fallbackUsed: true,
    analysisSource: 'regex',
  };
}

function inferErrorDescription(name: string): string {
  const words = name.replace(/^E_?/, '').replace(/([A-Z])/g, ' $1').trim().split(/[_\s]+/);
  return words.map(w => w.toLowerCase()).join(' ').replace(/^\w/, c => c.toUpperCase());
}

function inferErrorCategory(name: string): ContractAnalysis['errorCodes'][0]['category'] {
  if (/not.*auth|unauthorized|permission|admin/i.test(name)) return 'permission';
  if (/invalid|insufficient|exceed|overflow/i.test(name)) return 'validation';
  if (/already|exists|paused|locked/i.test(name)) return 'state';
  if (/divide.*zero|arithmetic/i.test(name)) return 'math';
  return 'other';
}

/**
 * Fetch and decompile source code
 */
async function fetchSourceCode(
  client: SuiJsonRpcClient,
  packageId: string,
  moduleName: string
): Promise<string | null> {
  try {
    const packageObj = await client.getObject({
      id: packageId,
      options: { showContent: true },
    });

    if (!packageObj.data?.content) return null;

    const content = packageObj.data.content;
    if (content.dataType !== 'package' || !content.disassembled) return null;

    const moduleSource = content.disassembled[moduleName];
    return typeof moduleSource === 'string' ? moduleSource : null;
  } catch (error) {
    console.error('[Analyze] Failed to fetch source:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { packageId, network, moduleName: inputModuleName, sourceCode: providedSource } = body;

    if (!packageId || !packageId.startsWith('0x')) {
      return NextResponse.json({ error: 'Valid packageId is required' }, { status: 400 });
    }

    const client = new SuiJsonRpcClient({ url: NETWORK_URLS[network], network });

    // Get module name if not provided
    let moduleName = inputModuleName;
    if (!moduleName) {
      const packageObj = await client.getObject({
        id: packageId,
        options: { showContent: true },
      });

      if (!packageObj.data?.content || packageObj.data.content.dataType !== 'package') {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 });
      }

      const modules = Object.keys(packageObj.data.content.disassembled || {});
      if (modules.length === 0) {
        return NextResponse.json({ error: 'No modules found in package' }, { status: 404 });
      }
      moduleName = modules[0];
    }

    // Get source code
    const sourceCode = providedSource || await fetchSourceCode(client, packageId, moduleName);
    if (!sourceCode) {
      return NextResponse.json({ error: 'Failed to fetch source code' }, { status: 500 });
    }

    // Generate analysis ID
    const analysisId = `${packageId.slice(0, 10)}-${Date.now()}`;

    // Regex-based analysis on edge (AI analysis via local server from browser)
    const analysis = analyzeWithRegex(sourceCode, packageId, moduleName);

    return NextResponse.json({
      analysisId,
      packageId,
      moduleName,
      network,
      analysis,
      sourceCode: sourceCode.slice(0, 10000), // Limit source code size in response
    });
  } catch (error) {
    console.error('[Analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
