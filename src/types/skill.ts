/**
 * Skill output type definitions
 */

import type { Network, SuiMoveNormalizedType } from './sui.js';

// Predefined skill scene types
export type PredefinedScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs';

// Skill scene can be predefined or custom
export type SkillScene = PredefinedScene | 'custom';

// Scene configuration for predefined scenes
export interface SceneConfig {
  id: PredefinedScene;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  focusAreas: string[];
  focusAreasZh: string[];
}

// Custom scene configuration
export interface CustomSceneConfig {
  name: string;
  description: string;
  prompt: string;
  focusAreas: string[];
}

// Protocol preset for quick access
export interface ProtocolPreset {
  id: string;
  name: string;
  packageId: string;
  network: Network;
  suggestedModules?: string[];
  description?: string;
}

// Generation options
export interface GenerationOptions {
  network: Network;
  output: string;
  format: 'skill' | 'json' | 'markdown';
  language: 'en' | 'zh';
  includeScripts: boolean;
  includeExamples: boolean;
  inferSemantics: boolean;
  riskAnnotations: boolean;
  verbose: boolean;
  // Scene-related options
  scene: SkillScene;
  customScene?: CustomSceneConfig;
  analyzeDependencies: boolean;
  includeArchitectureDiagram: boolean;
  moduleFilter?: string[];
}

// Input source types
export type InputSource =
  | { type: 'packageId'; packageId: string; module?: string }
  | { type: 'github'; url: string; path?: string }
  | { type: 'local'; path: string };

export interface ParsedInput {
  source: InputSource;
  network: Network;
  options: GenerationOptions;
}

// Analyzed types (after processing)
export interface AnalyzedModule {
  packageId: string;
  moduleName: string;
  functions: AnalyzedFunction[];
  structs: AnalyzedStruct[];
  events: AnalyzedEvent[];
  dependencies: DetectedDependency[];
  category: ModuleCategory;
  metadata: ModuleMetadata;
  /** Disassembled Move source code */
  sourceCode?: string;
}

export interface AnalyzedFunction {
  name: string;
  visibility: 'public' | 'private' | 'friend';
  isEntry: boolean;
  parameters: AnalyzedParameter[];
  returns: AnalyzedReturn[];
  typeParameters: TypeParameterInfo[];
  semantic: SemanticInfo;
  documentation?: string;
}

export interface AnalyzedParameter {
  index: number;
  name: string;
  moveType: SuiMoveNormalizedType;
  tsType: string;
  description: string;
  isOptional: boolean;
  isSystemObject: boolean;
  isAutoInjected: boolean;
  objectIdRequired: boolean;
  defaultValue?: string;
}

export interface AnalyzedReturn {
  moveType: SuiMoveNormalizedType;
  tsType: string;
  description: string;
}

export interface TypeParameterInfo {
  index: number;
  name: string;
  constraints: string[];
}

export interface AnalyzedStruct {
  name: string;
  abilities: string[];
  typeParameters: TypeParameterInfo[];
  fields: AnalyzedField[];
  isEvent: boolean;
}

export interface AnalyzedField {
  name: string;
  moveType: SuiMoveNormalizedType;
  tsType: string;
  description: string;
}

export interface AnalyzedEvent {
  name: string;
  structName: string;
  fields: AnalyzedField[];
  description: string;
}

// Semantic information
export interface SemanticInfo {
  category: SemanticCategory;
  risk: RiskLevel;
  description: string;
  warnings: string[];
  tags: string[];
}

export type SemanticCategory =
  | 'dex'
  | 'nft'
  | 'staking'
  | 'lending'
  | 'rewards'
  | 'admin'
  | 'config'
  | 'transfer'
  | 'query'
  | 'create'
  | 'destroy'
  | 'unknown';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ModuleCategory =
  | 'dex'
  | 'nft'
  | 'defi'
  | 'gaming'
  | 'social'
  | 'utility'
  | 'governance'
  | 'oracle'
  | 'bridge'
  | 'unknown';

// Dependencies
export interface DetectedDependency {
  packageId: string;
  moduleName: string;
  typeName?: string;
  usageType: 'parameter' | 'return' | 'generic' | 'import';
  implications: string[];
}

// Module metadata
export interface ModuleMetadata {
  packageId: string;
  moduleName: string;
  network: Network;
  totalFunctions: number;
  entryFunctions: number;
  publicFunctions: number;
  totalStructs: number;
  totalEvents: number;
  fetchedAt: string;
}

// Skill output
export interface SkillOutput {
  packageName: string;
  skillMd: string;
  references: {
    abi: string;
    types: string;
    events: string;
  };
  scripts: {
    call: string;
    read: string;
  };
  examples: GeneratedExample[];
  metadata: SkillMetadata;
}

export interface GeneratedExample {
  name: string;
  description: string;
  code: string;
  functionName: string;
}

export interface SkillMetadata {
  generatedAt: string;
  generatorVersion: string;
  network: Network;
  packageId: string;
  modules: string[];
  checksum: string;
}

// Mapped type result
export interface MappedType {
  ts: string;
  description: string;
  isObjectRef?: boolean;
  isSystemObject?: boolean;
  isAutoInjected?: boolean;
  isMutable?: boolean;
  defaultValue?: string;
  moveType?: string;
}

// Progress callback
export type ProgressCallback = (stage: string, message: string, progress?: number) => void;

// ============================================
// AI-Enhanced Analysis Types (v3)
// ============================================

/**
 * Error code category for classification
 */
export type ErrorCodeCategory = 'permission' | 'validation' | 'state' | 'math' | 'other';

/**
 * Error code entry extracted from Move source
 */
export interface ErrorCodeEntry {
  /** Error constant name, e.g., "EInsufficientBalance" */
  name: string;
  /** Numeric error code, e.g., 1 */
  code: number;
  /** AI-inferred description of the error */
  description: string;
  /** Possible causes for this error */
  possibleCauses: string[];
  /** Suggested solutions */
  solutions: string[];
  /** Error category */
  category: ErrorCodeCategory;
}

/**
 * Generic parameter meaning (e.g., T0 → "Base Asset")
 */
export interface GenericMeaning {
  /** Human-readable name, e.g., "Base Asset" */
  name: string;
  /** Detailed description */
  description: string;
  /** Common concrete types, e.g., ["SUI", "USDC"] */
  commonTypes: string[];
}

/**
 * Generic semantics for a module (T0, T1, etc.)
 */
export interface GenericSemantics {
  /** Mapping from generic name to meaning, e.g., T0 → GenericMeaning */
  mapping: Record<string, GenericMeaning>;
  /** Confidence score (0-1) */
  confidence: number;
  /** Sources used for inference, e.g., ["function:swap", "param:base_coin"] */
  inferredFrom: string[];
}

/**
 * AI-enhanced function analysis
 */
export interface AIAnalyzedFunction {
  /** Function name */
  name: string;
  /** AI-inferred purpose */
  purpose: string;
  /** Function category */
  category: 'admin' | 'user' | 'query' | 'internal';
  /** Risk level */
  risk: RiskLevel;
  /** How generics are used in this function */
  genericUsage?: Record<string, 'input' | 'output' | 'both'>;
  /** Code example */
  example?: string;
}

/**
 * AI-enhanced type analysis
 */
export interface AIAnalyzedType {
  /** Type name */
  name: string;
  /** AI-inferred purpose */
  purpose: string;
  /** Whether this is a capability type */
  isCapability: boolean;
  /** Whether this is a shared object */
  isSharedObject: boolean;
  /** Field descriptions */
  fields: Array<{ name: string; purpose: string }>;
}

/**
 * Security analysis result
 */
export interface SecurityAnalysis {
  /** Overall risk level */
  riskLevel: RiskLevel;
  /** Security concerns */
  concerns: string[];
  /** Admin-only functions */
  adminFunctions: string[];
}

/**
 * Complete contract analysis result from AI
 */
export interface ContractAnalysis {
  /** Contract purpose and category */
  purpose: {
    /** Brief summary */
    summary: string;
    /** Category (dex, nft, lending, etc.) */
    category: ModuleCategory;
    /** Related protocols */
    protocols: string[];
  };
  /** Analyzed functions */
  functions: AIAnalyzedFunction[];
  /** Analyzed types */
  types: AIAnalyzedType[];
  /** Generic parameter semantics */
  generics: GenericSemantics;
  /** Error code dictionary */
  errorCodes: ErrorCodeEntry[];
  /** Security analysis */
  security: SecurityAnalysis;
  /** Suggested package name */
  suggestedName: string;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Whether fallback regex analysis was used */
  fallbackUsed: boolean;
  /** Source of analysis: 'claude' | 'regex' | 'hybrid' */
  analysisSource: 'claude' | 'regex' | 'hybrid';
}

/**
 * User feedback for review step
 */
export interface UserFeedback {
  /** Confirmed or corrected purpose */
  purpose?: {
    confirmed: boolean;
    correction?: string;
    category?: ModuleCategory;
  };
  /** Generic semantics corrections */
  generics?: {
    confirmed: boolean;
    corrections?: Record<string, GenericMeaning>;
  };
  /** Admin function annotation preferences */
  adminFunctions?: {
    highlightRisks: boolean;
    addPermissionDocs: boolean;
  };
  /** Error code preferences */
  errorCodes?: {
    generateErrorsMd: boolean;
    includeInSkillMd: boolean;
  };
  /** Additional business context */
  businessContext?: string;
}

/**
 * Merged analysis after user review
 */
export interface MergedAnalysis extends ContractAnalysis {
  /** User feedback that was applied */
  userFeedback: UserFeedback;
  /** Whether user made any corrections */
  userCorrected: boolean;
}
