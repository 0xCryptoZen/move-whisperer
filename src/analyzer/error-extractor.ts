/**
 * Error code extractor - extracts error constants from Move source code
 */

import type { ErrorCodeEntry, ErrorCodeCategory } from '../types/index.js';

/**
 * Pattern for extracting error constants
 * Matches: const E_SOMETHING: u64 = 123;
 * Also matches: const ESOMETHING: u64 = 123;
 */
const ERROR_CONST_PATTERN = /const\s+(E[A-Z_][A-Za-z0-9_]*)\s*:\s*u64\s*=\s*(\d+)/g;

/**
 * Error name patterns for categorization
 */
const ERROR_CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: ErrorCodeCategory }> = [
  // Permission errors
  { pattern: /not.*auth|unauthorized|forbidden|permission|access.*denied|admin.*only/i, category: 'permission' },
  { pattern: /not.*owner|invalid.*cap|capability/i, category: 'permission' },

  // Validation errors
  { pattern: /invalid|insufficient|too.*low|too.*high|exceed|overflow|underflow/i, category: 'validation' },
  { pattern: /empty|missing|required|not.*found|zero/i, category: 'validation' },
  { pattern: /balance|amount|value|price|quantity/i, category: 'validation' },

  // State errors
  { pattern: /already|exists|duplicate|initialized|paused|locked|frozen/i, category: 'state' },
  { pattern: /not.*initialized|not.*active|inactive|closed|expired/i, category: 'state' },

  // Math errors
  { pattern: /divide.*zero|arithmetic|calculation|precision|rounding/i, category: 'math' },
  { pattern: /overflow|underflow|out.*of.*range/i, category: 'math' },
];

/**
 * Common error name to description mapping
 */
const COMMON_ERROR_DESCRIPTIONS: Record<string, { description: string; causes: string[]; solutions: string[] }> = {
  EInsufficientBalance: {
    description: 'Account balance is insufficient for the operation',
    causes: ['Balance lower than transfer amount', 'Gas fees not accounted for'],
    solutions: ['Check account balance with `sui client balance`', 'Ensure sufficient funds including gas'],
  },
  ENotAuthorized: {
    description: 'Caller is not authorized to perform this operation',
    causes: ['Not the owner or admin', 'Capability object mismatch'],
    solutions: ['Use the correct AdminCap object', 'Verify caller address is authorized'],
  },
  EInvalidAmount: {
    description: 'The provided amount is invalid',
    causes: ['Amount is zero', 'Amount exceeds maximum', 'Amount below minimum'],
    solutions: ['Verify amount is within valid range', 'Check contract minimum/maximum limits'],
  },
  EAlreadyExists: {
    description: 'The resource or state already exists',
    causes: ['Duplicate creation attempt', 'Resource not cleaned up'],
    solutions: ['Check if resource exists before creating', 'Use update instead of create'],
  },
  ENotFound: {
    description: 'The requested resource was not found',
    causes: ['Invalid object ID', 'Resource was deleted', 'Wrong module or package'],
    solutions: ['Verify object ID is correct', 'Check if resource still exists'],
  },
  EOverflow: {
    description: 'Arithmetic overflow occurred',
    causes: ['Result exceeds maximum value', 'Multiplication overflow'],
    solutions: ['Use checked arithmetic operations', 'Validate inputs before calculation'],
  },
  EPaused: {
    description: 'The contract or feature is paused',
    causes: ['Admin paused the contract', 'Emergency shutdown activated'],
    solutions: ['Wait for admin to unpause', 'Check contract status before calling'],
  },
  EInvalidState: {
    description: 'The contract is in an invalid state for this operation',
    causes: ['Wrong phase or stage', 'Preconditions not met'],
    solutions: ['Check contract state before calling', 'Follow correct operation sequence'],
  },
};

/**
 * Infer error category from error name
 */
function inferCategory(errorName: string): ErrorCodeCategory {
  for (const { pattern, category } of ERROR_CATEGORY_PATTERNS) {
    if (pattern.test(errorName)) {
      return category;
    }
  }
  return 'other';
}

/**
 * Generate description for an error based on its name
 */
function inferErrorDescription(errorName: string): { description: string; causes: string[]; solutions: string[] } {
  // Check common errors first
  const common = COMMON_ERROR_DESCRIPTIONS[errorName];
  if (common) {
    return common;
  }

  // Parse error name into words
  const words = errorName
    .replace(/^E_?/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(/[_\s]+/)
    .map(w => w.toLowerCase());

  const description = words.join(' ').replace(/^\w/, c => c.toUpperCase());

  const category = inferCategory(errorName);

  // Generate generic causes and solutions based on category
  const causes: string[] = [];
  const solutions: string[] = [];

  switch (category) {
    case 'permission':
      causes.push('Caller lacks required permissions', 'Invalid capability object');
      solutions.push('Verify caller has required permissions', 'Use correct capability object');
      break;
    case 'validation':
      causes.push('Input validation failed', 'Value out of acceptable range');
      solutions.push('Check input values', 'Verify parameters meet requirements');
      break;
    case 'state':
      causes.push('Contract in unexpected state', 'Operation sequence error');
      solutions.push('Check contract state before calling', 'Follow correct operation order');
      break;
    case 'math':
      causes.push('Arithmetic calculation error', 'Value overflow or underflow');
      solutions.push('Use safe math operations', 'Validate values before calculation');
      break;
    default:
      causes.push('Operation preconditions not met');
      solutions.push('Check function requirements');
  }

  return { description, causes, solutions };
}

/**
 * Extract error codes from Move source code
 */
export function extractErrorCodes(sourceCode: string): ErrorCodeEntry[] {
  const errors: ErrorCodeEntry[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = ERROR_CONST_PATTERN.exec(sourceCode)) !== null) {
    const name = match[1];
    const code = parseInt(match[2], 10);

    // Skip duplicates
    if (seen.has(name)) continue;
    seen.add(name);

    const category = inferCategory(name);
    const { description, causes, solutions } = inferErrorDescription(name);

    errors.push({
      name,
      code,
      description,
      possibleCauses: causes,
      solutions,
      category,
    });
  }

  // Sort by error code
  errors.sort((a, b) => a.code - b.code);

  return errors;
}

/**
 * Group error codes by category
 */
export function groupErrorsByCategory(errors: ErrorCodeEntry[]): Record<ErrorCodeCategory, ErrorCodeEntry[]> {
  const groups: Record<ErrorCodeCategory, ErrorCodeEntry[]> = {
    permission: [],
    validation: [],
    state: [],
    math: [],
    other: [],
  };

  for (const error of errors) {
    groups[error.category].push(error);
  }

  return groups;
}

/**
 * Create error extractor instance
 */
export function createErrorExtractor() {
  return {
    extract: extractErrorCodes,
    groupByCategory: groupErrorsByCategory,
  };
}
