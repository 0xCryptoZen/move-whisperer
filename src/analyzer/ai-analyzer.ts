/**
 * AI Contract Analyzer
 * Combines Claude analysis with fallback regex patterns for contract understanding
 */

import type {
  ContractAnalysis,
  GenericSemantics,
  ErrorCodeEntry,
  AIAnalyzedFunction,
  AIAnalyzedType,
  SecurityAnalysis,
  ModuleCategory,
  RiskLevel,
} from '../types/index.js';
import { extractErrorCodes } from './error-extractor.js';
import { inferGenericSemantics } from './generic-inference.js';
import { buildAnalysisPrompt, parseAnalysisResponse, validateAnalysisResponse } from './prompts/analysis.js';
import { executeCommand, commandExists } from '../server/terminal.js';

export interface ModuleInfo {
  packageId: string;
  moduleName: string;
  network?: string;
}

export interface AnalyzerOptions {
  /** Use Claude for analysis (if available) */
  useClaude?: boolean;
  /** Working directory for Claude CLI */
  cwd?: string;
  /** Timeout for Claude in ms */
  timeout?: number;
}

/**
 * Default analysis result when no source code is available
 */
function createEmptyAnalysis(moduleInfo: ModuleInfo): ContractAnalysis {
  return {
    purpose: {
      summary: 'Unknown contract purpose',
      category: 'unknown',
      protocols: [],
    },
    functions: [],
    types: [],
    generics: { mapping: {}, confidence: 0, inferredFrom: [] },
    errorCodes: [],
    security: { riskLevel: 'medium', concerns: [], adminFunctions: [] },
    suggestedName: moduleInfo.moduleName.toLowerCase().replace(/_/g, '-'),
    confidence: 0,
    fallbackUsed: true,
    analysisSource: 'regex',
  };
}

/**
 * Infer module category from source code using regex patterns
 */
function inferCategoryFromSource(sourceCode: string): ModuleCategory {
  const patterns: Array<{ pattern: RegExp; category: ModuleCategory }> = [
    { pattern: /swap|trade|exchange|order_book|clob|amm|liquidity/i, category: 'dex' },
    { pattern: /nft|collectible|mint_token|burn_token|royalty/i, category: 'nft' },
    { pattern: /stake|unstake|reward|yield|farm/i, category: 'defi' },
    { pattern: /lend|borrow|collateral|liquidate|repay|supply/i, category: 'defi' },
    { pattern: /game|play|score|level|battle/i, category: 'gaming' },
    { pattern: /vote|proposal|governance|dao/i, category: 'governance' },
    { pattern: /oracle|price_feed|data_source/i, category: 'oracle' },
    { pattern: /bridge|cross_chain|relay/i, category: 'bridge' },
    { pattern: /social|profile|follow|post/i, category: 'social' },
  ];

  for (const { pattern, category } of patterns) {
    if (pattern.test(sourceCode)) {
      return category;
    }
  }

  return 'utility';
}

/**
 * Extract functions from source code using regex
 */
function extractFunctionsFromSource(sourceCode: string): AIAnalyzedFunction[] {
  const functions: AIAnalyzedFunction[] = [];

  // Match function declarations: public fun name(...) or public entry fun name(...)
  const funcPattern = /(public\s+)?(entry\s+)?fun\s+(\w+)/g;
  let match;

  while ((match = funcPattern.exec(sourceCode)) !== null) {
    const isPublic = !!match[1];
    const isEntry = !!match[2];
    const name = match[3];

    // Skip internal functions
    if (!isPublic && !isEntry) continue;

    // Infer category from name
    let category: 'admin' | 'user' | 'query' | 'internal' = 'user';
    let risk: RiskLevel = 'low';

    if (/^(get|view|is_|has_|check|query)/i.test(name)) {
      category = 'query';
      risk = 'low';
    } else if (/^(admin|set_|update_|pause|unpause|withdraw|upgrade)/i.test(name)) {
      category = 'admin';
      risk = 'high';
    } else if (/^(init|new|create)/i.test(name)) {
      category = 'internal';
      risk = 'medium';
    }

    functions.push({
      name,
      purpose: `${isEntry ? 'Entry function' : 'Public function'}: ${name.replace(/_/g, ' ')}`,
      category,
      risk,
    });
  }

  return functions;
}

/**
 * Extract types/structs from source code using regex
 */
function extractTypesFromSource(sourceCode: string): AIAnalyzedType[] {
  const types: AIAnalyzedType[] = [];

  // Match struct declarations
  const structPattern = /struct\s+(\w+)/g;
  let match;

  while ((match = structPattern.exec(sourceCode)) !== null) {
    const name = match[1];

    const isCapability = /Cap$|Capability$|Admin|Owner/.test(name);
    const isSharedObject = /Pool|Registry|Config|State|Store/.test(name);

    types.push({
      name,
      purpose: `${isCapability ? 'Capability: ' : isSharedObject ? 'Shared object: ' : 'Type: '}${name}`,
      isCapability,
      isSharedObject,
      fields: [],
    });
  }

  return types;
}

/**
 * Analyze contract using regex patterns (fallback)
 */
function analyzeWithRegex(sourceCode: string, moduleInfo: ModuleInfo): ContractAnalysis {
  const category = inferCategoryFromSource(sourceCode);
  const functions = extractFunctionsFromSource(sourceCode);
  const types = extractTypesFromSource(sourceCode);
  const errorCodes = extractErrorCodes(sourceCode);
  const generics = inferGenericSemantics(sourceCode, category);

  // Find admin functions
  const adminFunctions = functions
    .filter(f => f.category === 'admin')
    .map(f => f.name);

  // Determine risk level
  let riskLevel: RiskLevel = 'low';
  if (adminFunctions.length > 3) riskLevel = 'medium';
  if (adminFunctions.some(f => /withdraw|upgrade|pause/i.test(f))) riskLevel = 'high';

  const security: SecurityAnalysis = {
    riskLevel,
    concerns: adminFunctions.length > 0
      ? [`${adminFunctions.length} admin-only functions detected`]
      : [],
    adminFunctions,
  };

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
    security,
    suggestedName: moduleInfo.moduleName.toLowerCase().replace(/_/g, '-'),
    confidence: 0.6,
    fallbackUsed: true,
    analysisSource: 'regex',
  };
}

/**
 * Analyze contract using Claude CLI
 */
async function analyzeWithClaude(
  sourceCode: string,
  moduleInfo: ModuleInfo,
  options: AnalyzerOptions
): Promise<ContractAnalysis | null> {
  const { cwd = process.cwd(), timeout = 120000 } = options;

  // Check if Claude CLI is available
  const hasClaude = await commandExists('claude');
  if (!hasClaude) {
    console.log('[AI Analyzer] Claude CLI not available, using fallback');
    return null;
  }

  // Build prompt
  const prompt = buildAnalysisPrompt({
    packageId: moduleInfo.packageId,
    moduleName: moduleInfo.moduleName,
    sourceCode,
    network: moduleInfo.network,
  });

  // Execute Claude CLI
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const command = `claude --print '${escapedPrompt}'`;

  try {
    const result = await executeCommand(command, { cwd, timeout });

    if (!result.success) {
      console.error('[AI Analyzer] Claude execution failed:', result.stderr);
      return null;
    }

    // Parse response
    const parsed = parseAnalysisResponse(result.stdout);

    if (!validateAnalysisResponse(parsed)) {
      console.error('[AI Analyzer] Invalid response format from Claude');
      return null;
    }

    const response = parsed as Record<string, unknown>;

    // Map response to ContractAnalysis
    return mapClaudeResponseToAnalysis(response, moduleInfo);
  } catch (error) {
    console.error('[AI Analyzer] Error calling Claude:', error);
    return null;
  }
}

/**
 * Map Claude response to ContractAnalysis type
 */
function mapClaudeResponseToAnalysis(
  response: Record<string, unknown>,
  moduleInfo: ModuleInfo
): ContractAnalysis {
  const purpose = response.purpose as Record<string, unknown> || {};
  const rawFunctions = (response.functions as unknown[]) || [];
  const rawTypes = (response.types as unknown[]) || [];
  const rawGenerics = (response.generics as Record<string, unknown>) || {};
  const rawErrorCodes = (response.errorCodes as unknown[]) || [];
  const rawSecurity = (response.security as Record<string, unknown>) || {};

  // Map functions
  const functions: AIAnalyzedFunction[] = rawFunctions.map((f: unknown) => {
    const func = f as Record<string, unknown>;
    return {
      name: String(func.name || ''),
      purpose: String(func.purpose || ''),
      category: (func.category as 'admin' | 'user' | 'query' | 'internal') || 'user',
      risk: (func.risk as RiskLevel) || 'low',
      genericUsage: func.genericUsage as Record<string, 'input' | 'output' | 'both'> | undefined,
      example: func.example as string | undefined,
    };
  });

  // Map types
  const types: AIAnalyzedType[] = rawTypes.map((t: unknown) => {
    const type = t as Record<string, unknown>;
    return {
      name: String(type.name || ''),
      purpose: String(type.purpose || ''),
      isCapability: Boolean(type.isCapability),
      isSharedObject: Boolean(type.isSharedObject),
      fields: ((type.fields as unknown[]) || []).map((f: unknown) => {
        const field = f as Record<string, unknown>;
        return {
          name: String(field.name || ''),
          purpose: String(field.purpose || ''),
        };
      }),
    };
  });

  // Map generics
  const genericMapping: Record<string, { name: string; description: string; commonTypes: string[] }> = {};
  for (const [key, value] of Object.entries(rawGenerics)) {
    const g = value as Record<string, unknown>;
    genericMapping[key] = {
      name: String(g.name || key),
      description: String(g.description || ''),
      commonTypes: Array.isArray(g.commonTypes) ? g.commonTypes.map(String) : [],
    };
  }

  const generics: GenericSemantics = {
    mapping: genericMapping,
    confidence: 0.9,
    inferredFrom: ['claude-analysis'],
  };

  // Map error codes
  const errorCodes: ErrorCodeEntry[] = rawErrorCodes.map((e: unknown) => {
    const error = e as Record<string, unknown>;
    return {
      name: String(error.name || ''),
      code: Number(error.code || 0),
      description: String(error.description || ''),
      possibleCauses: Array.isArray(error.possibleCauses) ? error.possibleCauses.map(String) : [],
      solutions: Array.isArray(error.solutions) ? error.solutions.map(String) : [],
      category: (error.category as ErrorCodeEntry['category']) || 'other',
    };
  });

  // Map security
  const security: SecurityAnalysis = {
    riskLevel: (rawSecurity.riskLevel as RiskLevel) || 'medium',
    concerns: Array.isArray(rawSecurity.concerns) ? rawSecurity.concerns.map(String) : [],
    adminFunctions: Array.isArray(rawSecurity.adminFunctions) ? rawSecurity.adminFunctions.map(String) : [],
  };

  return {
    purpose: {
      summary: String(purpose.summary || 'Unknown'),
      category: (purpose.category as ModuleCategory) || 'unknown',
      protocols: Array.isArray(purpose.protocols) ? purpose.protocols.map(String) : [],
    },
    functions,
    types,
    generics,
    errorCodes,
    security,
    suggestedName: String(response.suggestedName || moduleInfo.moduleName.toLowerCase().replace(/_/g, '-')),
    confidence: 0.9,
    fallbackUsed: false,
    analysisSource: 'claude',
  };
}

/**
 * AI Contract Analyzer class
 */
export class AIContractAnalyzer {
  private options: AnalyzerOptions;

  constructor(options: AnalyzerOptions = {}) {
    this.options = {
      useClaude: true,
      timeout: 120000,
      ...options,
    };
  }

  /**
   * Analyze contract with Claude, fallback to regex
   */
  async analyzeContract(sourceCode: string, moduleInfo: ModuleInfo): Promise<ContractAnalysis> {
    if (!sourceCode || sourceCode.trim().length === 0) {
      return createEmptyAnalysis(moduleInfo);
    }

    // Try Claude first if enabled
    if (this.options.useClaude) {
      const claudeResult = await analyzeWithClaude(sourceCode, moduleInfo, this.options);
      if (claudeResult) {
        return claudeResult;
      }
    }

    // Fallback to regex analysis
    console.log('[AI Analyzer] Using regex fallback analysis');
    return analyzeWithRegex(sourceCode, moduleInfo);
  }

  /**
   * Quick analysis using only regex (no Claude)
   */
  analyzeWithPattern(sourceCode: string, moduleInfo: ModuleInfo): ContractAnalysis {
    if (!sourceCode || sourceCode.trim().length === 0) {
      return createEmptyAnalysis(moduleInfo);
    }
    return analyzeWithRegex(sourceCode, moduleInfo);
  }
}

/**
 * Create AI analyzer instance
 */
export function createAIAnalyzer(options?: AnalyzerOptions): AIContractAnalyzer {
  return new AIContractAnalyzer(options);
}
