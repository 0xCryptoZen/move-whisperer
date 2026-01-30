/**
 * Skill output type definitions
 */

import type { Network, SuiMoveNormalizedType } from './sui.js';

// Skill scene types - different generation purposes
export type SkillScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs';

// Scene configuration
export interface SceneConfig {
  id: SkillScene;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  focusAreas: string[];
  focusAreasZh: string[];
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
