/**
 * Semantic inference engine for function categorization
 */

import type { SemanticInfo, SemanticCategory, RiskLevel, AnalyzedParameter } from '../types/skill.js';

/**
 * Pattern definition for semantic matching
 */
interface SemanticPattern {
  regex: RegExp;
  category: SemanticCategory;
  risk: RiskLevel;
  tags: string[];
  description?: string;
}

/**
 * Context from analyzing function parameters
 */
interface ParameterContext {
  hasCoin: boolean;
  hasMutableRef: boolean;
  hasAdminCap: boolean;
  hasTxContext: boolean;
  coinTypes: string[];
  objectTypes: string[];
}

/**
 * Semantic inference engine
 */
export class SemanticInference {
  private readonly patterns: SemanticPattern[] = [
    // DEX patterns
    { regex: /^swap(_|$)/i, category: 'dex', risk: 'medium', tags: ['swap', 'trade', 'exchange'] },
    { regex: /^swap_exact/i, category: 'dex', risk: 'medium', tags: ['swap', 'trade'] },
    { regex: /^add_liquidity/i, category: 'dex', risk: 'medium', tags: ['liquidity', 'lp'] },
    { regex: /^remove_liquidity/i, category: 'dex', risk: 'medium', tags: ['liquidity', 'lp'] },
    { regex: /^place.*order/i, category: 'dex', risk: 'medium', tags: ['order', 'trade'] },
    { regex: /^place_limit_order/i, category: 'dex', risk: 'medium', tags: ['order', 'limit'] },
    { regex: /^place_market_order/i, category: 'dex', risk: 'medium', tags: ['order', 'market'] },
    { regex: /^cancel.*order/i, category: 'dex', risk: 'low', tags: ['order', 'cancel'] },
    { regex: /^create_pool/i, category: 'dex', risk: 'medium', tags: ['pool', 'create'] },

    // NFT patterns
    { regex: /^mint(_|$)/i, category: 'nft', risk: 'low', tags: ['mint', 'create', 'nft'] },
    { regex: /^burn(_|$)/i, category: 'destroy', risk: 'high', tags: ['burn', 'destroy'] },
    { regex: /^transfer(_|$)/i, category: 'transfer', risk: 'high', tags: ['transfer', 'send'] },
    { regex: /^transfer_to/i, category: 'transfer', risk: 'high', tags: ['transfer'] },
    { regex: /^public_transfer/i, category: 'transfer', risk: 'high', tags: ['transfer'] },

    // Staking patterns
    { regex: /^stake(_|$)/i, category: 'staking', risk: 'medium', tags: ['stake', 'lock'] },
    { regex: /^unstake(_|$)/i, category: 'staking', risk: 'medium', tags: ['unstake', 'unlock'] },
    { regex: /^add_stake/i, category: 'staking', risk: 'medium', tags: ['stake'] },
    { regex: /^withdraw_stake/i, category: 'staking', risk: 'medium', tags: ['unstake'] },

    // Lending patterns
    { regex: /^borrow(_|$)/i, category: 'lending', risk: 'high', tags: ['borrow', 'debt', 'loan'] },
    { regex: /^repay(_|$)/i, category: 'lending', risk: 'medium', tags: ['repay', 'debt'] },
    { regex: /^liquidate(_|$)/i, category: 'lending', risk: 'high', tags: ['liquidate'] },
    { regex: /^deposit(_|$)/i, category: 'lending', risk: 'medium', tags: ['deposit', 'supply'] },
    { regex: /^withdraw(_|$)/i, category: 'lending', risk: 'medium', tags: ['withdraw'] },
    { regex: /^supply(_|$)/i, category: 'lending', risk: 'medium', tags: ['supply', 'deposit'] },

    // Rewards patterns
    { regex: /^claim(_|$)/i, category: 'rewards', risk: 'low', tags: ['claim', 'rewards'] },
    { regex: /^claim_rewards/i, category: 'rewards', risk: 'low', tags: ['claim', 'rewards'] },
    { regex: /^harvest(_|$)/i, category: 'rewards', risk: 'low', tags: ['harvest', 'rewards'] },
    { regex: /^collect(_|$)/i, category: 'rewards', risk: 'low', tags: ['collect', 'rewards'] },

    // Admin patterns (critical risk)
    { regex: /^admin_/i, category: 'admin', risk: 'critical', tags: ['admin', 'restricted'] },
    { regex: /^owner_/i, category: 'admin', risk: 'critical', tags: ['admin', 'owner'] },
    { regex: /^pause(_|$)/i, category: 'admin', risk: 'critical', tags: ['admin', 'pause', 'emergency'] },
    { regex: /^unpause(_|$)/i, category: 'admin', risk: 'critical', tags: ['admin', 'unpause'] },
    { regex: /^upgrade(_|$)/i, category: 'admin', risk: 'critical', tags: ['admin', 'upgrade'] },
    { regex: /^emergency/i, category: 'admin', risk: 'critical', tags: ['admin', 'emergency'] },

    // Config patterns
    { regex: /^set_/i, category: 'config', risk: 'medium', tags: ['config', 'settings'] },
    { regex: /^update_/i, category: 'config', risk: 'medium', tags: ['config', 'update'] },
    { regex: /^configure/i, category: 'config', risk: 'medium', tags: ['config'] },
    { regex: /^initialize/i, category: 'config', risk: 'medium', tags: ['init', 'setup'] },
    { regex: /^init(_|$)/i, category: 'config', risk: 'medium', tags: ['init', 'setup'] },

    // Query patterns (safe)
    { regex: /^get_/i, category: 'query', risk: 'low', tags: ['read', 'query', 'view'] },
    { regex: /^is_/i, category: 'query', risk: 'low', tags: ['read', 'check'] },
    { regex: /^has_/i, category: 'query', risk: 'low', tags: ['read', 'check'] },
    { regex: /^check_/i, category: 'query', risk: 'low', tags: ['read', 'check'] },
    { regex: /^view_/i, category: 'query', risk: 'low', tags: ['read', 'view'] },
    { regex: /^balance(_|$)/i, category: 'query', risk: 'low', tags: ['read', 'balance'] },
    { regex: /^total_/i, category: 'query', risk: 'low', tags: ['read', 'total'] },

    // Create patterns
    { regex: /^create(_|$)/i, category: 'create', risk: 'low', tags: ['create', 'new'] },
    { regex: /^new(_|$)/i, category: 'create', risk: 'low', tags: ['create', 'new'] },
    { regex: /^open(_|$)/i, category: 'create', risk: 'low', tags: ['create', 'open'] },

    // Destroy patterns
    { regex: /^destroy(_|$)/i, category: 'destroy', risk: 'high', tags: ['destroy', 'delete'] },
    { regex: /^close(_|$)/i, category: 'destroy', risk: 'medium', tags: ['close', 'delete'] },
    { regex: /^delete(_|$)/i, category: 'destroy', risk: 'high', tags: ['delete', 'remove'] },
    { regex: /^remove(_|$)/i, category: 'destroy', risk: 'medium', tags: ['remove'] },
  ];

  /**
   * Infer semantic information for a function
   */
  infer(functionName: string, params: AnalyzedParameter[]): SemanticInfo {
    // Match against patterns
    const matched = this.matchPattern(functionName);

    // Analyze parameters for additional context
    const context = this.analyzeParameters(params);

    // Build semantic info
    return this.buildSemanticInfo(functionName, matched, context);
  }

  /**
   * Match function name against patterns
   */
  private matchPattern(functionName: string): SemanticPattern | null {
    for (const pattern of this.patterns) {
      if (pattern.regex.test(functionName)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Analyze parameters for context
   */
  private analyzeParameters(params: AnalyzedParameter[]): ParameterContext {
    const context: ParameterContext = {
      hasCoin: false,
      hasMutableRef: false,
      hasAdminCap: false,
      hasTxContext: false,
      coinTypes: [],
      objectTypes: [],
    };

    for (const param of params) {
      // Check for coin types
      if (param.moveType && this.isCoinType(param.moveType)) {
        context.hasCoin = true;
        const coinType = this.extractCoinType(param.moveType);
        if (coinType) {
          context.coinTypes.push(coinType);
        }
      }

      // Check for admin capabilities
      if (param.name.toLowerCase().includes('cap') ||
          param.name.toLowerCase().includes('admin') ||
          param.tsType.toLowerCase().includes('admincap')) {
        context.hasAdminCap = true;
      }

      // Check for TxContext
      if (param.isAutoInjected) {
        context.hasTxContext = true;
      }

      // Track object types
      if (param.objectIdRequired && param.moveType) {
        context.objectTypes.push(param.tsType);
      }
    }

    return context;
  }

  /**
   * Build semantic info from pattern and context
   */
  private buildSemanticInfo(
    functionName: string,
    pattern: SemanticPattern | null,
    context: ParameterContext
  ): SemanticInfo {
    // Start with pattern info or defaults
    let category: SemanticCategory = pattern?.category ?? 'unknown';
    let risk: RiskLevel = pattern?.risk ?? 'low';
    const tags: string[] = [...(pattern?.tags ?? [])];
    const warnings: string[] = [];

    // Elevate risk based on context
    if (context.hasCoin && risk === 'low') {
      risk = 'medium';
      warnings.push('This function handles tokens. Verify amounts before executing.');
    }

    if (context.hasAdminCap) {
      if (risk !== 'critical') {
        risk = 'high';
      }
      warnings.push('This function requires admin capabilities.');
      tags.push('admin');
    }

    // Add context-based warnings
    if (risk === 'high' || risk === 'critical') {
      warnings.push('This is a high-risk operation. Review carefully before executing.');
    }

    if (context.hasCoin) {
      warnings.push('This function transfers tokens. Ensure sufficient balance.');
      tags.push('token');
    }

    // Generate description
    const description = this.generateDescription(functionName, category, context);

    return {
      category,
      risk,
      description,
      warnings,
      tags: [...new Set(tags)], // Deduplicate tags
    };
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    functionName: string,
    category: SemanticCategory,
    context: ParameterContext
  ): string {
    // Convert snake_case to readable text
    const readable = functionName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const categoryDescriptions: Record<SemanticCategory, string> = {
      dex: 'DEX operation',
      nft: 'NFT operation',
      staking: 'Staking operation',
      lending: 'Lending operation',
      rewards: 'Rewards operation',
      admin: 'Administrative operation',
      config: 'Configuration operation',
      transfer: 'Transfer operation',
      query: 'Query operation',
      create: 'Create operation',
      destroy: 'Destroy operation',
      unknown: 'Contract operation',
    };

    let description = `${categoryDescriptions[category]}: ${readable}`;

    // Add coin context
    if (context.coinTypes.length > 0) {
      description += ` (involves ${context.coinTypes.join(', ')})`;
    }

    return description;
  }

  /**
   * Check if type is a Coin type
   */
  private isCoinType(moveType: unknown): boolean {
    if (typeof moveType !== 'object' || moveType === null) {
      return false;
    }

    // Check for Struct with Coin
    if ('Struct' in moveType) {
      const struct = (moveType as { Struct: { name: string } }).Struct;
      return struct.name === 'Coin';
    }

    // Check references
    if ('Reference' in moveType || 'MutableReference' in moveType) {
      const inner = 'Reference' in moveType
        ? (moveType as { Reference: unknown }).Reference
        : (moveType as { MutableReference: unknown }).MutableReference;
      return this.isCoinType(inner);
    }

    return false;
  }

  /**
   * Extract coin type from Coin<T>
   */
  private extractCoinType(moveType: unknown): string | null {
    if (typeof moveType !== 'object' || moveType === null) {
      return null;
    }

    if ('Struct' in moveType) {
      const struct = moveType as { Struct: { name: string; typeArguments: unknown[] } };
      if (struct.Struct.name === 'Coin' && struct.Struct.typeArguments.length > 0) {
        return this.formatType(struct.Struct.typeArguments[0]);
      }
    }

    if ('Reference' in moveType) {
      return this.extractCoinType((moveType as { Reference: unknown }).Reference);
    }

    if ('MutableReference' in moveType) {
      return this.extractCoinType((moveType as { MutableReference: unknown }).MutableReference);
    }

    return null;
  }

  /**
   * Format type for display
   */
  private formatType(type: unknown): string {
    if (typeof type === 'string') {
      return type.toLowerCase();
    }

    if (typeof type === 'object' && type !== null && 'Struct' in type) {
      const struct = type as { Struct: { module: string; name: string } };
      return `${struct.Struct.module}::${struct.Struct.name}`;
    }

    return 'unknown';
  }

  /**
   * Get all available categories
   */
  getCategories(): SemanticCategory[] {
    return [
      'dex', 'nft', 'staking', 'lending', 'rewards',
      'admin', 'config', 'transfer', 'query', 'create', 'destroy', 'unknown'
    ];
  }

  /**
   * Get risk level color for display
   */
  getRiskColor(risk: RiskLevel): string {
    const colors: Record<RiskLevel, string> = {
      low: 'green',
      medium: 'yellow',
      high: 'orange',
      critical: 'red',
    };
    return colors[risk];
  }
}

/**
 * Create a semantic inference instance
 */
export function createSemanticInference(): SemanticInference {
  return new SemanticInference();
}
