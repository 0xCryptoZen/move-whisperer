/**
 * Input validation schemas using Zod
 * Provides comprehensive validation for all API endpoints
 */

import { z } from 'zod';

// Common validators
const packageIdSchema = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid package ID format');
const networkSchema = z.enum(['mainnet', 'testnet', 'devnet']);
const streamIdSchema = z.string().max(20).optional();

// Safe path pattern - no path traversal, no shell metacharacters
const safePathSchema = z.string()
  .max(500)
  .regex(/^[a-zA-Z0-9\/_.\-~]+$/, 'Invalid path characters')
  .refine(path => !path.includes('..'), 'Path traversal not allowed')
  .optional();

// Allowed terminal commands (whitelist)
const ALLOWED_COMMANDS = [
  'sui',              // Sui CLI
  'move-decompiler',  // Revela
  'claude',           // Claude CLI
  'ls',               // List files
  'cat',              // Read files
  'head',             // Read file head
  'tail',             // Read file tail
  'grep',             // Search content
  'find',             // Find files
  'pwd',              // Print working directory
  'echo',             // Echo (limited use)
  'which',            // Check command existence
];

/**
 * Check if command starts with an allowed prefix
 */
function isAllowedCommand(cmd: string): boolean {
  const trimmed = cmd.trim();
  return ALLOWED_COMMANDS.some(allowed => {
    // Match exact command or command followed by space/flag
    return trimmed === allowed ||
           trimmed.startsWith(allowed + ' ') ||
           trimmed.startsWith(allowed + '\t');
  });
}

// ============ Endpoint Schemas ============

/**
 * POST /api/decompile
 */
export const DecompileRequestSchema = z.object({
  packageId: packageIdSchema,
  bytecode: z.record(z.string()).optional(),
  network: networkSchema.optional(),
  module: z.string().max(100).optional(),
  streamId: streamIdSchema,
});

export type DecompileRequest = z.infer<typeof DecompileRequestSchema>;

/**
 * POST /api/claude
 */
export const ClaudeRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(50000, 'Prompt too long'),
  cwd: safePathSchema,
  model: z.string().max(50).optional(),
  maxTurns: z.number().int().min(1).max(100).optional(),
  allowedTools: z.array(z.string().max(50)).max(20).optional(),
  streamId: streamIdSchema,
  mode: z.enum(['interactive', 'print', 'json']).optional(),
});

export type ClaudeRequest = z.infer<typeof ClaudeRequestSchema>;

/**
 * POST /api/analyze-contract
 */
export const AnalyzeContractSchema = z.object({
  packageId: packageIdSchema,
  moduleName: z.string().min(1).max(100),
  sourceCode: z.string().min(1).max(500000), // Max 500KB source
  network: networkSchema.optional(),
});

export type AnalyzeContractRequest = z.infer<typeof AnalyzeContractSchema>;

/**
 * POST /api/analyze-changes
 */
export const AnalyzeChangesSchema = z.object({
  packageId: packageIdSchema,
  moduleName: z.string().min(1).max(100),
  oldVersion: z.number().int().min(1),
  newVersion: z.number().int().min(1),
  oldSource: z.string().max(500000),
  newSource: z.string().max(500000),
  diffText: z.string().max(100000).optional(),
});

export type AnalyzeChangesRequest = z.infer<typeof AnalyzeChangesSchema>;

/**
 * POST /api/history
 */
export const HistoryRequestSchema = z.object({
  packageId: packageIdSchema,
  network: networkSchema.optional().default('mainnet'),
});

export type HistoryRequest = z.infer<typeof HistoryRequestSchema>;

/**
 * POST /api/compare
 */
export const CompareRequestSchema = z.object({
  packageId: packageIdSchema,
  version1: z.number().int().min(1),
  version2: z.number().int().min(1),
  network: networkSchema.optional().default('mainnet'),
});

export type CompareRequest = z.infer<typeof CompareRequestSchema>;

/**
 * POST /api/transaction
 */
export const TransactionRequestSchema = z.object({
  digest: z.string().min(1).max(100),
  network: networkSchema.optional().default('mainnet'),
});

export type TransactionRequest = z.infer<typeof TransactionRequestSchema>;

/**
 * POST /api/transaction/skill
 */
export const TransactionSkillSchema = z.object({
  digest: z.string().min(1).max(100),
  network: networkSchema.optional().default('mainnet'),
  scene: z.enum(['sdk', 'learn', 'audit', 'frontend', 'bot', 'docs']).optional(),
});

export type TransactionSkillRequest = z.infer<typeof TransactionSkillSchema>;

/**
 * POST /api/terminal (strict whitelist)
 */
export const TerminalRequestSchema = z.object({
  command: z.string()
    .min(1, 'Command is required')
    .max(1000, 'Command too long')
    .refine(isAllowedCommand, {
      message: `Command not allowed. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`,
    }),
  cwd: safePathSchema,
});

export type TerminalRequest = z.infer<typeof TerminalRequestSchema>;

/**
 * POST /api/chat
 */
export const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(10000),
  })).min(1).max(50),
  context: z.object({
    skillMd: z.string().max(50000),
    analysisJson: z.string().max(50000),
    sourceCodeSnippet: z.string().max(20000).optional(),
    packageId: packageIdSchema,
    network: networkSchema,
    scene: z.string().max(50),
    moduleName: z.string().max(100).optional(),
  }),
  streamId: streamIdSchema,
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * WebSocket execute message
 */
export const WsExecuteMessageSchema = z.object({
  type: z.literal('execute'),
  command: z.string()
    .min(1)
    .max(1000)
    .refine(isAllowedCommand, {
      message: `Command not allowed. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`,
    }),
  cwd: safePathSchema,
});

export type WsExecuteMessage = z.infer<typeof WsExecuteMessageSchema>;

/**
 * POST /api/skills
 */
export const SkillsListSchema = z.object({}).optional();

export type SkillsListRequest = z.infer<typeof SkillsListSchema>;

/**
 * POST /api/skills/save
 */
export const SkillSaveSchema = z.object({
  name: z.string()
    .min(1, 'Skill name is required')
    .max(100, 'Skill name too long')
    .regex(/^[a-zA-Z0-9_\-]+$/, 'Skill name must be alphanumeric, dashes, or underscores'),
  content: z.string().min(1, 'Content is required').max(200000, 'Content too large'),
});

export type SkillSaveRequest = z.infer<typeof SkillSaveSchema>;

/**
 * POST /api/skills/read
 */
export const SkillReadSchema = z.object({
  name: z.string()
    .min(1, 'Skill name is required')
    .max(100, 'Skill name too long')
    .regex(/^[a-zA-Z0-9_\-]+$/, 'Skill name must be alphanumeric, dashes, or underscores'),
});

export type SkillReadRequest = z.infer<typeof SkillReadSchema>;

/**
 * Generic WebSocket message
 */
export const WsMessageSchema = z.discriminatedUnion('type', [
  WsExecuteMessageSchema,
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('request_health') }),
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;

// ============ Validation Helper ============

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  issues?: z.ZodIssue[];
}

/**
 * Validate request body against a schema
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): ValidationResult<T> {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error message from Zod issues
  const errorMessages = result.error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });

  return {
    success: false,
    error: errorMessages.join('; '),
    issues: result.error.issues,
  };
}

/**
 * Check request body size
 */
export function checkBodySize(body: string, maxSize: number): boolean {
  return Buffer.byteLength(body, 'utf8') <= maxSize;
}

export { ALLOWED_COMMANDS };
