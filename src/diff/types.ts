/**
 * Types for package version diff/comparison
 */

import type { SuiMoveNormalizedType } from '../types/index.js';

/**
 * Type of change detected
 */
export type ChangeType = 'added' | 'removed' | 'modified';

/**
 * Category of the changed element
 */
export type ChangeCategory = 'function' | 'struct' | 'field' | 'type_param' | 'module';

/**
 * Risk level of a change
 */
export type ChangeRisk = 'breaking' | 'non_breaking' | 'unknown';

/**
 * A single ABI change between versions
 */
export interface ABIChange {
  /** Type of change */
  type: ChangeType;
  /** Category of element that changed */
  category: ChangeCategory;
  /** Name of the changed element (function name, struct name, etc.) */
  name: string;
  /** Module the change belongs to */
  moduleName?: string;
  /** Risk assessment */
  risk: ChangeRisk;
  /** Human-readable description of the change */
  description: string;
  /** Detailed change information */
  details?: {
    before?: unknown;
    after?: unknown;
    /** List of specific changes within this element */
    changes: string[];
  };
}

/**
 * Summary of structural differences between two versions
 */
export interface StructuralDiffSummary {
  functionsAdded: number;
  functionsRemoved: number;
  functionsModified: number;
  structsAdded: number;
  structsRemoved: number;
  structsModified: number;
  modulesAdded: number;
  modulesRemoved: number;
  /** Whether any breaking changes were detected */
  breakingChanges: boolean;
  /** Total number of changes */
  totalChanges: number;
}

/**
 * Complete structural diff between two package versions
 */
export interface StructuralDiff {
  /** Version number of the "before" state */
  fromVersion: number;
  /** Version number of the "after" state */
  toVersion: number;
  /** Package ID of the "before" version */
  fromPackageId: string;
  /** Package ID of the "after" version */
  toPackageId: string;
  /** Summary statistics */
  summary: StructuralDiffSummary;
  /** All detected changes */
  changes: ABIChange[];
  /** Changes grouped by module */
  changesByModule: Record<string, ABIChange[]>;
}

/**
 * A single line in a diff hunk
 */
export interface DiffLine {
  /** Type of line: context (unchanged), add, or remove */
  type: 'context' | 'add' | 'remove';
  /** The content of the line */
  content: string;
  /** Line numbers */
  lineNumber: {
    /** Line number in old file (undefined for added lines) */
    old?: number;
    /** Line number in new file (undefined for removed lines) */
    new?: number;
  };
}

/**
 * A diff hunk (chunk of continuous changes)
 */
export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines from old file in this hunk */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines from new file in this hunk */
  newLines: number;
  /** The lines in this hunk */
  lines: DiffLine[];
}

/**
 * Source-level diff for a single module
 */
export interface SourceDiff {
  /** Module name */
  moduleName: string;
  /** Version this diff is from */
  fromVersion: number;
  /** Version this diff is to */
  toVersion: number;
  /** All diff hunks */
  hunks: DiffHunk[];
  /** Statistics */
  stats: {
    linesAdded: number;
    linesRemoved: number;
    /** Lines that had any change (add + remove) */
    linesChanged: number;
  };
  /** Whether the module exists in the old version */
  existsInOld: boolean;
  /** Whether the module exists in the new version */
  existsInNew: boolean;
}

/**
 * Complete comparison between two package versions
 */
export interface PackageComparison {
  /** Structural/ABI comparison */
  structural: StructuralDiff;
  /** Source-level diffs by module name */
  sources: Record<string, SourceDiff>;
  /** Comparison metadata */
  metadata: {
    fromPackageId: string;
    toPackageId: string;
    fromVersion: number;
    toVersion: number;
    network: string;
    comparedAt: string;
  };
}

/**
 * Options for diff operations
 */
export interface DiffOptions {
  /** Include context lines in source diff */
  contextLines?: number;
  /** Ignore whitespace changes in source diff */
  ignoreWhitespace?: boolean;
  /** Only compare specific modules */
  modules?: string[];
}

/**
 * Function signature for comparison
 */
export interface FunctionSignature {
  name: string;
  visibility: string;
  isEntry: boolean;
  typeParameters: number;
  parameters: SuiMoveNormalizedType[];
  returnType: SuiMoveNormalizedType[];
}

/**
 * Struct definition for comparison
 */
export interface StructDefinition {
  name: string;
  abilities: string[];
  typeParameters: number;
  fields: Array<{
    name: string;
    type: SuiMoveNormalizedType;
  }>;
}
