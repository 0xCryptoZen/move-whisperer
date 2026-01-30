/**
 * Generic parameter semantic inference
 * Infers meaning of T0, T1, etc. based on contract category and usage patterns
 */

import type { GenericSemantics, GenericMeaning, ModuleCategory } from '../types/index.js';

/**
 * Predefined generic patterns by contract category
 */
const CATEGORY_GENERIC_PATTERNS: Record<string, Record<string, GenericMeaning>> = {
  dex: {
    T0: { name: 'Base Asset', description: 'The base asset in the trading pair', commonTypes: ['SUI', 'USDC', 'WETH'] },
    T1: { name: 'Quote Asset', description: 'The quote asset in the trading pair', commonTypes: ['USDT', 'USDC'] },
    T2: { name: 'LP Token', description: 'Liquidity provider token representing pool share', commonTypes: [] },
  },
  amm: {
    T0: { name: 'Token A', description: 'First token in the liquidity pool', commonTypes: ['SUI', 'USDC'] },
    T1: { name: 'Token B', description: 'Second token in the liquidity pool', commonTypes: ['USDT', 'USDC'] },
    T2: { name: 'LP Token', description: 'Liquidity provider token', commonTypes: [] },
  },
  lending: {
    T0: { name: 'Collateral', description: 'Asset used as collateral', commonTypes: ['SUI', 'WETH', 'WBTC'] },
    T1: { name: 'Debt Asset', description: 'Asset being borrowed', commonTypes: ['USDC', 'USDT'] },
  },
  nft: {
    T0: { name: 'NFT Type', description: 'The type of NFT being operated on', commonTypes: [] },
    T1: { name: 'Payment Token', description: 'Token used for payment', commonTypes: ['SUI', 'USDC'] },
  },
  staking: {
    T0: { name: 'Stake Token', description: 'Token being staked', commonTypes: ['SUI'] },
    T1: { name: 'Reward Token', description: 'Token received as rewards', commonTypes: ['SUI'] },
  },
  bridge: {
    T0: { name: 'Source Token', description: 'Token on the source chain', commonTypes: [] },
    T1: { name: 'Destination Token', description: 'Token on the destination chain', commonTypes: [] },
  },
};

/**
 * Default generic pattern for unknown categories
 */
const DEFAULT_GENERIC_PATTERN: Record<string, GenericMeaning> = {
  T0: { name: 'Primary Type', description: 'Primary generic type parameter', commonTypes: [] },
  T1: { name: 'Secondary Type', description: 'Secondary generic type parameter', commonTypes: [] },
  T2: { name: 'Tertiary Type', description: 'Third generic type parameter', commonTypes: [] },
};

/**
 * Parameter name patterns that hint at generic meaning
 */
const PARAM_NAME_HINTS: Array<{ pattern: RegExp; genericIndex: number; meaning: Partial<GenericMeaning> }> = [
  // Base/Quote patterns
  { pattern: /base[_\s]*(coin|token|asset)/i, genericIndex: 0, meaning: { name: 'Base Asset' } },
  { pattern: /quote[_\s]*(coin|token|asset)/i, genericIndex: 1, meaning: { name: 'Quote Asset' } },

  // Input/Output patterns
  { pattern: /input[_\s]*(coin|token)/i, genericIndex: 0, meaning: { name: 'Input Token' } },
  { pattern: /output[_\s]*(coin|token)/i, genericIndex: 1, meaning: { name: 'Output Token' } },

  // Token A/B patterns
  { pattern: /token[_\s]*a/i, genericIndex: 0, meaning: { name: 'Token A' } },
  { pattern: /token[_\s]*b/i, genericIndex: 1, meaning: { name: 'Token B' } },

  // Collateral/Debt patterns
  { pattern: /collateral/i, genericIndex: 0, meaning: { name: 'Collateral Asset' } },
  { pattern: /debt|borrow/i, genericIndex: 1, meaning: { name: 'Debt Asset' } },

  // Stake/Reward patterns
  { pattern: /stake[_\s]*(token|coin)/i, genericIndex: 0, meaning: { name: 'Stake Token' } },
  { pattern: /reward[_\s]*(token|coin)/i, genericIndex: 1, meaning: { name: 'Reward Token' } },
];

/**
 * Function name patterns that hint at contract category
 */
const FUNCTION_CATEGORY_HINTS: Array<{ pattern: RegExp; category: ModuleCategory }> = [
  { pattern: /swap|trade|exchange/i, category: 'dex' },
  { pattern: /add_liquidity|remove_liquidity|pool/i, category: 'dex' },
  { pattern: /mint_nft|burn_nft|transfer_nft/i, category: 'nft' },
  { pattern: /stake|unstake|claim_reward/i, category: 'defi' },
  { pattern: /borrow|repay|liquidate|supply/i, category: 'defi' },
  { pattern: /bridge|cross_chain/i, category: 'bridge' },
];

/**
 * Extract generic parameters from source code
 */
function extractGenericsFromSource(sourceCode: string): string[] {
  const generics = new Set<string>();

  // Match type parameters in function signatures: fun name<T0, T1>
  const funcPattern = /<([^>]+)>/g;
  let match;
  while ((match = funcPattern.exec(sourceCode)) !== null) {
    const params = match[1].split(',').map(p => p.trim().split(':')[0].trim());
    params.forEach(p => {
      if (/^T\d+$/.test(p)) {
        generics.add(p);
      }
    });
  }

  return Array.from(generics).sort();
}

/**
 * Infer category from source code
 */
function inferCategoryFromSource(sourceCode: string): ModuleCategory | null {
  for (const { pattern, category } of FUNCTION_CATEGORY_HINTS) {
    if (pattern.test(sourceCode)) {
      return category;
    }
  }
  return null;
}

/**
 * Infer generic meanings from parameter names in source
 */
function inferFromParameterNames(sourceCode: string): Record<string, Partial<GenericMeaning>> {
  const inferred: Record<string, Partial<GenericMeaning>> = {};

  for (const { pattern, genericIndex, meaning } of PARAM_NAME_HINTS) {
    if (pattern.test(sourceCode)) {
      const genericName = `T${genericIndex}`;
      if (!inferred[genericName]) {
        inferred[genericName] = meaning;
      }
    }
  }

  return inferred;
}

/**
 * Infer generic semantics for a module
 */
export function inferGenericSemantics(
  sourceCode: string,
  category: ModuleCategory
): GenericSemantics {
  const inferredFrom: string[] = [];
  let confidence = 0.5;

  // Extract generics from source
  const generics = extractGenericsFromSource(sourceCode);
  if (generics.length === 0) {
    return {
      mapping: {},
      confidence: 1.0,
      inferredFrom: ['no-generics'],
    };
  }

  // Try to infer category from source if unknown
  let effectiveCategory = category;
  if (category === 'unknown') {
    const inferred = inferCategoryFromSource(sourceCode);
    if (inferred) {
      effectiveCategory = inferred;
      inferredFrom.push(`category:${inferred}`);
      confidence += 0.1;
    }
  } else {
    inferredFrom.push(`category:${category}`);
    confidence += 0.2;
  }

  // Get base patterns from category
  const categoryPatterns = CATEGORY_GENERIC_PATTERNS[effectiveCategory] || DEFAULT_GENERIC_PATTERN;

  // Infer from parameter names
  const paramInferred = inferFromParameterNames(sourceCode);
  const paramKeys = Object.keys(paramInferred);
  if (paramKeys.length > 0) {
    inferredFrom.push(...paramKeys.map(k => `param:${k}`));
    confidence += 0.2;
  }

  // Build final mapping
  const mapping: Record<string, GenericMeaning> = {};

  for (const generic of generics) {
    // Start with category pattern
    const categoryMeaning = categoryPatterns[generic] || DEFAULT_GENERIC_PATTERN[generic];

    // Override with parameter-inferred meaning if available
    const paramMeaning = paramInferred[generic];

    if (paramMeaning && categoryMeaning) {
      mapping[generic] = {
        name: paramMeaning.name || categoryMeaning.name,
        description: paramMeaning.description || categoryMeaning.description,
        commonTypes: paramMeaning.commonTypes || categoryMeaning.commonTypes,
      };
    } else if (categoryMeaning) {
      mapping[generic] = categoryMeaning;
    } else {
      mapping[generic] = {
        name: `Type Parameter ${generic}`,
        description: `Generic type parameter ${generic}`,
        commonTypes: [],
      };
    }
  }

  return {
    mapping,
    confidence: Math.min(confidence, 1.0),
    inferredFrom,
  };
}

/**
 * Format generic meaning for display
 */
export function formatGenericMeaning(generic: string, meaning: GenericMeaning): string {
  let result = `${generic} → ${meaning.name}`;
  if (meaning.commonTypes.length > 0) {
    result += ` (e.g., ${meaning.commonTypes.join(', ')})`;
  }
  return result;
}

/**
 * Create generic inference instance
 */
export function createGenericInference() {
  return {
    infer: inferGenericSemantics,
    format: formatGenericMeaning,
  };
}
