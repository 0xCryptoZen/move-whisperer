/**
 * Security module - barrel export
 */

// Authentication
export {
  createAuthenticator,
  loadApiKeysFromEnv,
  type Authenticator,
  type AuthConfig,
  type AuthResult,
} from './auth.js';

// Rate limiting
export {
  RateLimiter,
  createRateLimiters,
  checkEndpointRateLimit,
  getClientIp,
  HEAVY_ENDPOINTS,
  EXEMPT_ENDPOINTS,
  type RateLimitConfig,
  type RateLimitResult,
  type EndpointRateLimiters,
} from './rate-limit.js';

// CORS
export {
  createCorsHandler,
  type CorsHandler,
  type CorsConfig,
} from './cors.js';

// Validation
export {
  validateRequest,
  checkBodySize,
  ALLOWED_COMMANDS,
  // Schemas
  DecompileRequestSchema,
  ClaudeRequestSchema,
  AnalyzeContractSchema,
  AnalyzeChangesSchema,
  HistoryRequestSchema,
  CompareRequestSchema,
  TransactionRequestSchema,
  TransactionSkillSchema,
  ChatRequestSchema,
  TerminalRequestSchema,
  SkillsListSchema,
  SkillSaveSchema,
  SkillReadSchema,
  WsMessageSchema,
  WsExecuteMessageSchema,
  // Types
  type ChatRequest,
  type DecompileRequest,
  type ClaudeRequest,
  type AnalyzeContractRequest,
  type AnalyzeChangesRequest,
  type HistoryRequest,
  type CompareRequest,
  type TransactionRequest,
  type TransactionSkillRequest,
  type TerminalRequest,
  type SkillsListRequest,
  type SkillSaveRequest,
  type SkillReadRequest,
  type WsMessage,
  type WsExecuteMessage,
  type ValidationResult,
} from './validation.js';
