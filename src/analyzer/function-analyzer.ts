/**
 * Function analyzer for extracting and enriching function information
 */

import type {
  SuiNormalizedFunction,
  SuiMoveNormalizedType,
  SuiMoveAbilitySet,
} from '../types/sui.js';
import type {
  AnalyzedFunction,
  AnalyzedParameter,
  AnalyzedReturn,
  TypeParameterInfo,
} from '../types/skill.js';
import { TypeMapper } from '../mapper/type-mapper.js';
import { SemanticInference } from './semantic-inference.js';

/**
 * Function analyzer class
 */
export class FunctionAnalyzer {
  private typeMapper: TypeMapper;
  private semanticInference: SemanticInference;

  constructor() {
    this.typeMapper = new TypeMapper();
    this.semanticInference = new SemanticInference();
  }

  /**
   * Analyze a single function
   */
  analyzeFunction(name: string, func: SuiNormalizedFunction): AnalyzedFunction {
    // Extract type parameters
    const typeParameters = this.extractTypeParameters(func.typeParameters);

    // Set up type mapper with type parameter names
    this.typeMapper.setTypeParameters(typeParameters.map((tp) => tp.name));

    // Analyze parameters
    const parameters = this.analyzeParameters(func.parameters);

    // Analyze return types
    const returns = this.analyzeReturns(func.return);

    // Infer semantics
    const semantic = this.semanticInference.infer(name, parameters);

    // Map visibility
    const visibility = this.mapVisibility(func.visibility);

    return {
      name,
      visibility,
      isEntry: func.isEntry,
      parameters,
      returns,
      typeParameters,
      semantic,
    };
  }

  /**
   * Analyze multiple functions from a module
   */
  analyzeFunctions(
    functions: Record<string, SuiNormalizedFunction>
  ): AnalyzedFunction[] {
    const results: AnalyzedFunction[] = [];

    for (const [name, func] of Object.entries(functions)) {
      const analyzed = this.analyzeFunction(name, func);
      results.push(analyzed);
    }

    // Sort: entry functions first, then by name
    results.sort((a, b) => {
      if (a.isEntry !== b.isEntry) {
        return a.isEntry ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  /**
   * Extract type parameters
   */
  private extractTypeParameters(params: SuiMoveAbilitySet[]): TypeParameterInfo[] {
    return params.map((param, index) => ({
      index,
      name: `T${index}`,
      constraints: param.abilities,
    }));
  }

  /**
   * Analyze function parameters
   */
  private analyzeParameters(params: SuiMoveNormalizedType[]): AnalyzedParameter[] {
    return params.map((param, index) => {
      const mapped = this.typeMapper.mapType(param);
      const isAutoInjected = this.typeMapper.isAutoInjected(param);
      const isSystemObject = this.typeMapper.isSystemObject(param);
      const objectIdRequired = this.typeMapper.requiresObjectId(param);

      // Generate parameter name
      const name = this.inferParameterName(param, index);

      return {
        index,
        name,
        moveType: param,
        tsType: mapped.ts,
        description: mapped.description,
        isOptional: false,
        isSystemObject,
        isAutoInjected,
        objectIdRequired,
        defaultValue: mapped.defaultValue,
      };
    });
  }

  /**
   * Analyze return types
   */
  private analyzeReturns(returns: SuiMoveNormalizedType[]): AnalyzedReturn[] {
    return returns.map((ret) => {
      const mapped = this.typeMapper.mapType(ret);
      return {
        moveType: ret,
        tsType: mapped.ts,
        description: mapped.description,
      };
    });
  }

  /**
   * Infer parameter name from type
   */
  private inferParameterName(type: SuiMoveNormalizedType, index: number): string {
    // Try to extract meaningful name from type
    const typeName = this.extractTypeName(type);

    if (typeName) {
      // Convert to camelCase
      const name = typeName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/_+/g, '_');

      // Handle common patterns
      if (name.includes('coin')) return 'coin';
      if (name.includes('clock')) return 'clock';
      if (name.includes('pool')) return 'pool';
      if (name.includes('position')) return 'position';
      if (name.includes('account')) return 'account';

      return name.split('_')[0] || `arg${index}`;
    }

    // Fallback based on primitive types
    if (typeof type === 'string') {
      switch (type) {
        case 'Bool':
          return 'flag';
        case 'U8':
        case 'U16':
        case 'U32':
        case 'U64':
        case 'U128':
        case 'U256':
          return index === 0 ? 'amount' : `value${index}`;
        case 'Address':
          return 'address';
        default:
          return `arg${index}`;
      }
    }

    return `arg${index}`;
  }

  /**
   * Extract type name from Move type
   */
  private extractTypeName(type: SuiMoveNormalizedType): string | null {
    if (typeof type === 'object') {
      if ('Struct' in type) {
        return type.Struct.name;
      }
      if ('Reference' in type) {
        return this.extractTypeName(type.Reference);
      }
      if ('MutableReference' in type) {
        return this.extractTypeName(type.MutableReference);
      }
      if ('Vector' in type) {
        const inner = this.extractTypeName(type.Vector);
        return inner ? `${inner}s` : null;
      }
    }
    return null;
  }

  /**
   * Map visibility string
   */
  private mapVisibility(visibility: string): 'public' | 'private' | 'friend' {
    switch (visibility.toLowerCase()) {
      case 'public':
        return 'public';
      case 'friend':
        return 'friend';
      default:
        return 'private';
    }
  }

  /**
   * Filter entry functions
   */
  filterEntryFunctions(functions: AnalyzedFunction[]): AnalyzedFunction[] {
    return functions.filter((f) => f.isEntry);
  }

  /**
   * Filter public functions (non-entry)
   */
  filterPublicFunctions(functions: AnalyzedFunction[]): AnalyzedFunction[] {
    return functions.filter((f) => !f.isEntry && f.visibility === 'public');
  }

  /**
   * Get user-facing parameters (exclude auto-injected)
   */
  getUserParameters(func: AnalyzedFunction): AnalyzedParameter[] {
    return func.parameters.filter((p) => !p.isAutoInjected);
  }
}

/**
 * Create a function analyzer instance
 */
export function createFunctionAnalyzer(): FunctionAnalyzer {
  return new FunctionAnalyzer();
}
