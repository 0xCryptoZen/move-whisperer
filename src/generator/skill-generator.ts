/**
 * Skill generator - generates SKILL.md from analyzed module
 */

import type { AnalyzedModule, AnalyzedFunction, Network, SkillScene } from '../types/index.js';
import {
  TemplateEngine,
  createTemplateEngine,
  type SkillMdContext,
  type FunctionContext,
  type PrimaryFunctionContext,
  type SceneSkillMdContext,
  type StructContext,
} from '../templates/engine.js';
import { NETWORK_URLS } from '../types/sui.js';
import { VERSION } from '../index.js';

export interface SkillGeneratorOptions {
  language?: 'en' | 'zh';
  includeExamples?: boolean;
  scene?: SkillScene;
}

/**
 * Skill generator class
 */
export class SkillGenerator {
  private templateEngine: TemplateEngine;
  private defaultScene: SkillScene;

  constructor(options: SkillGeneratorOptions = {}) {
    this.templateEngine = createTemplateEngine();
    this.defaultScene = options.scene ?? 'sdk';
  }

  /**
   * Generate SKILL.md content from analyzed module
   */
  generateSkillMd(module: AnalyzedModule): string {
    const context = this.buildSkillMdContext(module);
    return this.templateEngine.renderSkillMd(context);
  }

  /**
   * Generate scene-specific SKILL.md content
   */
  generateSceneSkillMd(module: AnalyzedModule, scene?: SkillScene): string {
    const actualScene = scene ?? this.defaultScene;
    const context = this.buildSceneSkillMdContext(module, actualScene);
    return this.templateEngine.renderSceneSkillMd(actualScene, context);
  }

  /**
   * Generate types.md content
   */
  generateTypesMd(module: AnalyzedModule): string {
    return this.templateEngine.renderTypesMd({
      packageId: module.packageId,
      moduleName: module.moduleName,
      structs: module.structs.map((s) => ({
        name: s.name,
        abilities: s.abilities,
        typeParameters: s.typeParameters,
        fields: s.fields,
        isEvent: s.isEvent,
      })),
      generatorVersion: VERSION,
    });
  }

  /**
   * Build context for SKILL.md template
   */
  private buildSkillMdContext(module: AnalyzedModule): SkillMdContext {
    const entryFunctions = module.functions.filter((f) => f.isEntry);
    const publicFunctions = module.functions.filter(
      (f) => !f.isEntry && f.visibility === 'public'
    );

    // Generate description
    const description = this.generateDescription(module);

    // Generate overview
    const overview = this.generateOverview(module);

    // Get security notes
    const securityNotes = this.generateSecurityNotes(module);

    // Find primary function for example
    const primaryFunction = this.findPrimaryFunction(entryFunctions);

    return {
      packageName: this.formatPackageName(module.moduleName),
      packageId: module.packageId,
      moduleName: module.moduleName,
      network: module.metadata.network,
      rpcUrl: NETWORK_URLS[module.metadata.network as Network] ?? NETWORK_URLS.mainnet,
      category: module.category,
      description,
      overview,
      entryFunctions: entryFunctions.map((f) => this.mapFunction(f)),
      publicFunctions: publicFunctions.map((f) => this.mapFunction(f)),
      events: module.events.map((e) => ({
        name: e.name,
        description: e.description,
        fields: e.fields,
      })),
      dependencies: module.dependencies,
      securityNotes,
      primaryFunction,
      generatorVersion: VERSION,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build context for scene-specific SKILL.md template
   */
  private buildSceneSkillMdContext(module: AnalyzedModule, scene: SkillScene): SceneSkillMdContext {
    const baseContext = this.buildSkillMdContext(module);
    const entryFunctions = module.functions.filter((f) => f.isEntry);

    // Calculate additional statistics for scenes
    const highRiskCount = module.functions.filter(
      (f) => f.semantic.risk === 'high' || f.semantic.risk === 'critical'
    ).length;

    // Map structs for scene context
    const structs: StructContext[] = module.structs.map((s) => ({
      name: s.name,
      abilities: s.abilities,
      typeParameters: s.typeParameters.map((tp) => ({
        name: tp.name,
        constraints: tp.constraints,
      })),
      fields: s.fields.map((f) => ({
        name: f.name,
        tsType: f.tsType,
        description: f.description,
      })),
      isEvent: s.isEvent,
    }));

    return {
      ...baseContext,
      scene,
      totalFunctions: module.functions.length,
      entryFunctionCount: entryFunctions.length,
      highRiskCount,
      structs,
      sourceCode: module.sourceCode,
    };
  }

  /**
   * Map analyzed function to template context
   */
  private mapFunction(func: AnalyzedFunction): FunctionContext {
    return {
      name: func.name,
      visibility: func.visibility,
      isEntry: func.isEntry,
      parameters: func.parameters.map((p) => ({
        name: p.name,
        tsType: p.tsType,
        description: p.description,
        isOptional: p.isOptional,
        isAutoInjected: p.isAutoInjected,
        isSystemObject: p.isSystemObject,
        objectIdRequired: p.objectIdRequired,
        defaultValue: p.defaultValue,
      })),
      returns: func.returns,
      typeParameters: func.typeParameters,
      semantic: func.semantic,
    };
  }

  /**
   * Generate module description
   */
  private generateDescription(module: AnalyzedModule): string {
    const categoryDescriptions: Record<string, string> = {
      dex: 'DEX trading and liquidity operations',
      nft: 'NFT minting and management',
      defi: 'DeFi protocol interactions',
      gaming: 'Gaming and entertainment features',
      utility: 'Utility functions',
      unknown: 'Contract interactions',
    };

    const categoryDesc = categoryDescriptions[module.category] || 'Contract interactions';

    // Extract function categories
    const functionCategories = new Set(
      module.functions.map((f) => f.semantic.category)
    );
    const categories = Array.from(functionCategories)
      .filter((c) => c !== 'unknown')
      .slice(0, 3);

    let description = `${this.formatPackageName(module.moduleName)} on Sui blockchain. `;
    description += `Use this skill for ${categoryDesc}`;

    if (categories.length > 0) {
      description += `: ${categories.join(', ')}`;
    }

    return description;
  }

  /**
   * Generate module overview
   */
  private generateOverview(module: AnalyzedModule): string {
    const parts: string[] = [];

    // Count functions by type
    const entryCount = module.functions.filter((f) => f.isEntry).length;
    const publicCount = module.functions.filter(
      (f) => !f.isEntry && f.visibility === 'public'
    ).length;

    parts.push(
      `This module provides ${entryCount} entry function${entryCount !== 1 ? 's' : ''}`
    );

    if (publicCount > 0) {
      parts.push(` and ${publicCount} public function${publicCount !== 1 ? 's' : ''}`);
    }

    parts.push('.');

    // Add category-specific info
    if (module.category === 'dex') {
      parts.push(' It supports decentralized exchange operations.');
    } else if (module.category === 'nft') {
      parts.push(' It handles NFT-related operations.');
    } else if (module.category === 'defi') {
      parts.push(' It provides DeFi protocol functionality.');
    }

    return parts.join('');
  }

  /**
   * Generate security notes
   */
  private generateSecurityNotes(module: AnalyzedModule): string[] {
    const notes: string[] = [];

    // Check for high-risk functions
    const highRiskFuncs = module.functions.filter(
      (f) => f.semantic.risk === 'high' || f.semantic.risk === 'critical'
    );

    if (highRiskFuncs.length > 0) {
      notes.push(
        `This module contains ${highRiskFuncs.length} high-risk function(s). Review carefully before executing.`
      );
    }

    // Check for token handling
    const handlesCoin = module.dependencies.some((d) => d.moduleName === 'coin');
    if (handlesCoin) {
      notes.push('This module handles token transfers. Verify amounts and recipients before executing.');
    }

    // Check for admin functions
    const hasAdmin = module.functions.some((f) => f.semantic.category === 'admin');
    if (hasAdmin) {
      notes.push('Some functions require admin privileges and may be restricted.');
    }

    // General notes
    notes.push('Always verify transaction parameters before signing.');
    notes.push('Test transactions on testnet before using on mainnet.');

    return notes;
  }

  /**
   * Find primary function for quick start example
   */
  private findPrimaryFunction(
    entryFunctions: AnalyzedFunction[]
  ): PrimaryFunctionContext | undefined {
    if (entryFunctions.length === 0) {
      return undefined;
    }

    // Prefer low-risk entry functions
    const safe = entryFunctions.find((f) => f.semantic.risk === 'low');
    const func = safe || entryFunctions[0];

    // Generate example arguments
    const userParams = func.parameters.filter((p) => !p.isAutoInjected);
    const exampleArgs = userParams.map((p) => {
      if (p.isSystemObject && p.defaultValue) {
        return `tx.object('${p.defaultValue}')`;
      }
      if (p.objectIdRequired) {
        return `tx.object(${p.name}Id)`;
      }

      // Generate example based on type
      switch (p.tsType) {
        case 'boolean':
          return 'tx.pure.bool(true)';
        case 'number':
          return 'tx.pure.u64(100)';
        case 'bigint | string':
          return "tx.pure.u64('1000000000')";
        case 'string':
          if (p.name.toLowerCase().includes('address')) {
            return "tx.pure.address('0x...')";
          }
          return "tx.pure.string('value')";
        default:
          return `/* ${p.name}: ${p.tsType} */`;
      }
    });

    return {
      name: func.name,
      exampleArgs,
    };
  }

  /**
   * Format package name for display
   */
  private formatPackageName(moduleName: string): string {
    return moduleName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

/**
 * Create a skill generator instance
 */
export function createSkillGenerator(
  options?: SkillGeneratorOptions
): SkillGenerator {
  return new SkillGenerator(options);
}
