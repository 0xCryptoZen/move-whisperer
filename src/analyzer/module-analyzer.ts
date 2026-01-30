/**
 * Module analyzer for processing Sui Move modules
 */

import type { SuiNormalizedModule, SuiNormalizedStruct, Network } from '../types/index.js';
import type {
  AnalyzedModule,
  AnalyzedStruct,
  AnalyzedEvent,
  AnalyzedField,
  DetectedDependency,
  ModuleCategory,
  ModuleMetadata,
  TypeParameterInfo,
} from '../types/skill.js';
import { FunctionAnalyzer } from './function-analyzer.js';
import { TypeMapper } from '../mapper/type-mapper.js';

/**
 * Module analyzer class
 */
export class ModuleAnalyzer {
  private functionAnalyzer: FunctionAnalyzer;
  private typeMapper: TypeMapper;

  constructor() {
    this.functionAnalyzer = new FunctionAnalyzer();
    this.typeMapper = new TypeMapper();
  }

  /**
   * Analyze a complete module
   */
  analyzeModule(
    module: SuiNormalizedModule,
    network: Network,
    sourceCode?: string
  ): AnalyzedModule {
    // Analyze functions
    const functions = this.functionAnalyzer.analyzeFunctions(module.exposedFunctions);

    // Analyze structs
    const structs = this.analyzeStructs(module.structs);

    // Extract events from structs
    const events = this.extractEvents(structs);

    // Detect dependencies
    const dependencies = this.detectDependencies(module);

    // Determine module category
    const category = this.inferCategory(functions, structs);

    // Build metadata
    const metadata: ModuleMetadata = {
      packageId: module.address,
      moduleName: module.name,
      network,
      totalFunctions: Object.keys(module.exposedFunctions).length,
      entryFunctions: functions.filter((f) => f.isEntry).length,
      publicFunctions: functions.filter((f) => f.visibility === 'public').length,
      totalStructs: Object.keys(module.structs).length,
      totalEvents: events.length,
      fetchedAt: new Date().toISOString(),
    };

    return {
      packageId: module.address,
      moduleName: module.name,
      functions,
      structs,
      events,
      dependencies,
      category,
      metadata,
      sourceCode,
    };
  }

  /**
   * Analyze structs in the module
   */
  private analyzeStructs(
    structs: Record<string, SuiNormalizedStruct>
  ): AnalyzedStruct[] {
    const results: AnalyzedStruct[] = [];

    for (const [name, struct] of Object.entries(structs)) {
      const analyzed = this.analyzeStruct(name, struct);
      results.push(analyzed);
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Analyze a single struct
   */
  private analyzeStruct(name: string, struct: SuiNormalizedStruct): AnalyzedStruct {
    // Extract type parameters
    const typeParameters: TypeParameterInfo[] = struct.typeParameters.map((tp, index) => ({
      index,
      name: `T${index}`,
      constraints: tp.constraints.abilities,
    }));

    // Set up type mapper
    this.typeMapper.setTypeParameters(typeParameters.map((tp) => tp.name));

    // Analyze fields
    const fields: AnalyzedField[] = struct.fields.map((field) => {
      const mapped = this.typeMapper.mapType(field.type);
      return {
        name: field.name,
        moveType: field.type,
        tsType: mapped.ts,
        description: mapped.description,
      };
    });

    // Check if this is an event
    const isEvent = this.isEventStruct(name, struct);

    return {
      name,
      abilities: struct.abilities.abilities,
      typeParameters,
      fields,
      isEvent,
    };
  }

  /**
   * Check if struct is an event
   */
  private isEventStruct(name: string, struct: SuiNormalizedStruct): boolean {
    // Events typically have 'copy' and 'drop' abilities
    const abilities = struct.abilities.abilities;
    const hasCopyDrop = abilities.includes('Copy') && abilities.includes('Drop');

    // Also check naming convention
    const eventNamePattern = /Event$/i;
    const hasEventName = eventNamePattern.test(name);

    return hasCopyDrop || hasEventName;
  }

  /**
   * Extract events from structs
   */
  private extractEvents(structs: AnalyzedStruct[]): AnalyzedEvent[] {
    return structs
      .filter((s) => s.isEvent)
      .map((s) => ({
        name: s.name,
        structName: s.name,
        fields: s.fields,
        description: `Event emitted when ${this.formatEventDescription(s.name)}`,
      }));
  }

  /**
   * Format event description
   */
  private formatEventDescription(name: string): string {
    // Convert PascalCase/snake_case to readable text
    return name
      .replace(/Event$/i, '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .toLowerCase()
      .trim();
  }

  /**
   * Detect dependencies used by the module
   */
  private detectDependencies(module: SuiNormalizedModule): DetectedDependency[] {
    const dependencies: Map<string, DetectedDependency> = new Map();

    // Scan all functions for dependencies
    for (const func of Object.values(module.exposedFunctions)) {
      // Check parameters
      for (const param of func.parameters) {
        this.scanTypeForDependencies(param, 'parameter', dependencies);
      }

      // Check return types
      for (const ret of func.return) {
        this.scanTypeForDependencies(ret, 'return', dependencies);
      }
    }

    // Scan structs for dependencies
    for (const struct of Object.values(module.structs)) {
      for (const field of struct.fields) {
        this.scanTypeForDependencies(field.type, 'parameter', dependencies);
      }
    }

    return Array.from(dependencies.values());
  }

  /**
   * Scan a type for dependencies
   */
  private scanTypeForDependencies(
    type: unknown,
    usageType: 'parameter' | 'return' | 'generic',
    deps: Map<string, DetectedDependency>
  ): void {
    if (typeof type !== 'object' || type === null) {
      return;
    }

    if ('Struct' in type) {
      const struct = type as { Struct: { address: string; module: string; name: string; typeArguments: unknown[] } };
      const key = `${struct.Struct.address}::${struct.Struct.module}`;

      // Only track external dependencies (not self)
      const normalizedAddr = this.normalizeAddress(struct.Struct.address);
      if (normalizedAddr === '0x1' || normalizedAddr === '0x2') {
        if (!deps.has(key)) {
          deps.set(key, {
            packageId: struct.Struct.address,
            moduleName: struct.Struct.module,
            typeName: struct.Struct.name,
            usageType,
            implications: this.getDependencyImplications(struct.Struct.module, struct.Struct.name),
          });
        }
      }

      // Scan type arguments
      for (const arg of struct.Struct.typeArguments) {
        this.scanTypeForDependencies(arg, 'generic', deps);
      }
    }

    if ('Vector' in type) {
      this.scanTypeForDependencies((type as { Vector: unknown }).Vector, usageType, deps);
    }

    if ('Reference' in type) {
      this.scanTypeForDependencies((type as { Reference: unknown }).Reference, usageType, deps);
    }

    if ('MutableReference' in type) {
      this.scanTypeForDependencies((type as { MutableReference: unknown }).MutableReference, usageType, deps);
    }
  }

  /**
   * Get implications for a dependency
   */
  private getDependencyImplications(module: string, name: string): string[] {
    const implications: string[] = [];

    if (module === 'coin' && name === 'Coin') {
      implications.push('Handles token transfers');
      implications.push('Requires Coin object IDs as input');
    }

    if (module === 'clock' && name === 'Clock') {
      implications.push('Uses on-chain timestamp');
      implications.push('Pass "0x6" as the Clock object');
    }

    if (module === 'tx_context' && name === 'TxContext') {
      implications.push('Transaction context is auto-injected');
    }

    if (module === 'transfer') {
      implications.push('Involves ownership transfer');
    }

    if (module === 'object') {
      implications.push('Creates or manages Sui objects');
    }

    if (module === 'table' || module === 'dynamic_field') {
      implications.push('Uses dynamic storage');
    }

    return implications;
  }

  /**
   * Infer module category from functions and structs
   */
  private inferCategory(
    functions: { semantic: { category: string } }[],
    structs: AnalyzedStruct[]
  ): ModuleCategory {
    // Count category occurrences
    const categoryCounts: Record<string, number> = {};

    for (const func of functions) {
      const cat = func.semantic.category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // Check struct names for hints
    for (const struct of structs) {
      const name = struct.name.toLowerCase();
      if (name.includes('pool') || name.includes('swap')) {
        categoryCounts['dex'] = (categoryCounts['dex'] || 0) + 2;
      }
      if (name.includes('nft') || name.includes('collection')) {
        categoryCounts['nft'] = (categoryCounts['nft'] || 0) + 2;
      }
      if (name.includes('stake') || name.includes('validator')) {
        categoryCounts['defi'] = (categoryCounts['defi'] || 0) + 2;
      }
      if (name.includes('game') || name.includes('player')) {
        categoryCounts['gaming'] = (categoryCounts['gaming'] || 0) + 2;
      }
    }

    // Map semantic categories to module categories
    const categoryMapping: Record<string, ModuleCategory> = {
      dex: 'dex',
      nft: 'nft',
      staking: 'defi',
      lending: 'defi',
      rewards: 'defi',
    };

    // Find dominant category
    let maxCount = 0;
    let dominant: ModuleCategory = 'unknown';

    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = categoryMapping[cat] || 'utility';
      }
    }

    return dominant;
  }

  /**
   * Normalize Sui address
   */
  private normalizeAddress(address: string): string {
    const hex = address.replace(/^0x/, '');
    const trimmed = hex.replace(/^0+/, '') || '0';
    return `0x${trimmed}`;
  }
}

/**
 * Create a module analyzer instance
 */
export function createModuleAnalyzer(): ModuleAnalyzer {
  return new ModuleAnalyzer();
}
