/**
 * MoveWhisperer - Local Server
 * Bridges web UI with local CLI tools (move-decompiler, claude, sui)
 *
 * Security features:
 * - API key authentication (X-API-Key header)
 * - Rate limiting (per-IP, tiered by endpoint)
 * - Input validation (Zod schemas)
 * - CORS origin validation
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'url';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { executeCommand, streamCommand } from './terminal.js';
import { handleDecompile } from './routes/decompile.js';
import { handleChat } from './routes/chat.js';
import { handleClaude } from './routes/claude.js';
import { handleHealth, getHealthData } from './routes/health.js';
import { handleAnalyzeContract, handleAnalyzeVersionChanges } from './routes/analyze.js';
import { handleHistory, handleCompare } from './routes/history.js';
import { handleTransaction, handleTransactionSkill } from './routes/transaction-api.js';
import { handleListSkills, handleSaveSkill, handleReadSkill } from './routes/skills.js';
import { createSecurityMiddleware, type SecurityMiddleware } from './middleware.js';
import { createServerConfig, type ServerConfig } from './config.js';
import {
  DecompileRequestSchema,
  ChatRequestSchema,
  ClaudeRequestSchema,
  AnalyzeContractSchema,
  AnalyzeChangesSchema,
  HistoryRequestSchema,
  CompareRequestSchema,
  TransactionRequestSchema,
  TransactionSkillSchema,
  TerminalRequestSchema,
  SkillsListSchema,
  SkillSaveSchema,
  SkillReadSchema,
  WsMessageSchema,
  type TerminalRequest,
} from './security/index.js';

// Active WebSocket connections for streaming
const wsConnections = new Map<string, WebSocket>();

// Security middleware (initialized on server start)
let security: SecurityMiddleware;

/**
 * Parse raw body from request with size limit
 */
async function parseRawBody(req: IncomingMessage, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error(`Request body exceeds maximum size of ${maxSize} bytes`));
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Send JSON response with CORS headers
 */
function sendJson(
  req: IncomingMessage,
  res: ServerResponse,
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  // Apply CORS headers
  security.applyCorsHeaders(req, res);

  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(
  req: IncomingMessage,
  res: ServerResponse,
  message: string,
  status = 500,
  extraHeaders: Record<string, string> = {}
) {
  sendJson(req, res, { error: message }, status, extraHeaders);
}

/**
 * Legacy sendJson/sendError adapters for route handlers
 */
function createLegacySendJson(req: IncomingMessage) {
  return (res: ServerResponse, data: unknown, status = 200) => {
    sendJson(req, res, data, status);
  };
}

function createLegacySendError(req: IncomingMessage) {
  return (res: ServerResponse, message: string, status = 500) => {
    sendError(req, res, message, status);
  };
}

/**
 * Route handler with security middleware
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig
) {
  const { pathname } = parseUrl(req.url || '/', true);
  const method = req.method?.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    if (security.handlePreflight(req, res)) {
      return;
    }
  }

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  try {
    // Parse raw body for POST requests
    const rawBody = method === 'POST'
      ? await parseRawBody(req, config.security.maxBodySize)
      : '';

    // Get validation schema for endpoint
    const schema = getSchemaForEndpoint(pathname || '/');

    // Run security checks
    const securityResult = await security.check(req, res, pathname || '/', rawBody, schema);

    if (!securityResult.allowed) {
      sendError(
        req,
        res,
        securityResult.error || 'Request denied',
        securityResult.status || 403,
        securityResult.headers || {}
      );
      return;
    }

    // Use validated body or parse raw body
    const body = securityResult.body || (rawBody ? JSON.parse(rawBody) : {});

    // Create legacy helpers for route handlers
    const legacySendJson = createLegacySendJson(req);
    const legacySendError = createLegacySendError(req);

    // Route handling
    switch (pathname) {
      case '/':
      case '/health':
        await handleHealth(req, res, legacySendJson);
        break;

      case '/api/decompile':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleDecompile(body, res, legacySendJson, legacySendError, wsConnections);
        break;

      case '/api/chat':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleChat(body, res, legacySendJson, legacySendError, wsConnections);
        break;

      case '/api/claude':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleClaude(body, res, legacySendJson, legacySendError, wsConnections);
        break;

      case '/api/analyze-contract':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleAnalyzeContract(body, res, legacySendJson, legacySendError);
        break;

      case '/api/analyze-changes':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleAnalyzeVersionChanges(body, res, legacySendJson, legacySendError);
        break;

      case '/api/history':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleHistory(body, res, legacySendJson, legacySendError);
        break;

      case '/api/compare':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleCompare(body, res, legacySendJson, legacySendError);
        break;

      case '/api/transaction':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleTransaction(body, res, legacySendJson, legacySendError);
        break;

      case '/api/transaction/skill':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleTransactionSkill(body, res, legacySendJson, legacySendError);
        break;

      case '/api/terminal':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleTerminal(body as TerminalRequest, res, legacySendJson, legacySendError);
        break;

      case '/api/skills':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleListSkills(body, res, legacySendJson, legacySendError);
        break;

      case '/api/skills/save':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleSaveSkill(body, res, legacySendJson, legacySendError);
        break;

      case '/api/skills/read':
        if (method !== 'POST') {
          sendError(req, res, 'Method not allowed', 405);
          return;
        }
        await handleReadSkill(body, res, legacySendJson, legacySendError);
        break;

      default:
        sendError(req, res, 'Not found', 404);
    }
  } catch (error) {
    console.error('Request error:', error);
    sendError(
      req,
      res,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
}

/**
 * Get validation schema for endpoint
 */
function getSchemaForEndpoint(pathname: string) {
  const schemas: Record<string, z.ZodSchema | undefined> = {
    '/api/chat': ChatRequestSchema,
    '/api/decompile': DecompileRequestSchema,
    '/api/claude': ClaudeRequestSchema,
    '/api/analyze-contract': AnalyzeContractSchema,
    '/api/analyze-changes': AnalyzeChangesSchema,
    '/api/history': HistoryRequestSchema,
    '/api/compare': CompareRequestSchema,
    '/api/transaction': TransactionRequestSchema,
    '/api/transaction/skill': TransactionSkillSchema,
    '/api/terminal': TerminalRequestSchema,
    '/api/skills': SkillsListSchema,
    '/api/skills/save': SkillSaveSchema,
    '/api/skills/read': SkillReadSchema,
  };
  return schemas[pathname];
}

/**
 * Handle terminal command execution (with validation already done)
 */
async function handleTerminal(
  body: TerminalRequest,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void
) {
  const { command, cwd } = body;

  try {
    const result = await executeCommand(command, { cwd });
    sendJson(res, result);
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Command execution failed');
  }
}

/**
 * Start the local server
 */
export function startServer(configOverrides: Partial<ServerConfig> = {}) {
  const config = createServerConfig(configOverrides);
  const { port, host } = config;

  // Initialize security middleware
  security = createSecurityMiddleware(config.security);

  // Create HTTP server
  const server = createServer((req, res) => handleRequest(req, res, config));

  // Create WebSocket server for streaming
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Health broadcast interval (30s) - only runs when clients are connected
  const HEALTH_BROADCAST_INTERVAL = 30000;
  let healthBroadcastTimer: NodeJS.Timeout | null = null;

  async function broadcastHealth() {
    if (wsConnections.size === 0) return;
    try {
      const healthData = await getHealthData();
      const message = JSON.stringify({ type: 'health', data: healthData });
      for (const ws of wsConnections.values()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    } catch (error) {
      console.error('[WS] Health broadcast error:', error);
    }
  }

  function startHealthBroadcast() {
    if (healthBroadcastTimer) return;
    healthBroadcastTimer = setInterval(broadcastHealth, HEALTH_BROADCAST_INTERVAL);
  }

  function stopHealthBroadcast() {
    if (healthBroadcastTimer) {
      clearInterval(healthBroadcastTimer);
      healthBroadcastTimer = null;
    }
  }

  async function sendHealthToClient(ws: WebSocket) {
    try {
      const healthData = await getHealthData();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'health', data: healthData }));
      }
    } catch (error) {
      console.error('[WS] Send health error:', error);
    }
  }

  wss.on('connection', (ws, req) => {
    // Validate WebSocket connection
    const wsValidation = security.validateWebSocket(req.url || '');
    if (!wsValidation.allowed) {
      console.log(`[WS] Connection rejected: ${wsValidation.error}`);
      ws.close(4001, wsValidation.error || 'Unauthorized');
      return;
    }

    // Use cryptographically secure ID
    const id = randomUUID().substring(0, 8);
    wsConnections.set(id, ws);
    console.log(`[WS] Client connected: ${id} (total: ${wsConnections.size})`);

    // Send connection ID to client
    ws.send(JSON.stringify({ type: 'connected', id }));

    // Push current health status immediately
    sendHealthToClient(ws);

    // Start broadcasting if this is the first client
    startHealthBroadcast();

    ws.on('message', async (message) => {
      try {
        const rawData = JSON.parse(message.toString());

        // Validate message structure
        const validation = WsMessageSchema.safeParse(rawData);
        if (!validation.success) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format: ' + validation.error.issues[0]?.message,
          }));
          return;
        }

        const data = validation.data;

        // Handle streaming commands
        if (data.type === 'execute') {
          console.log(`[WS] Message from ${id}:`, data.type);
          const { command, cwd } = data;

          ws.send(JSON.stringify({ type: 'start', command }));

          // Stream output back to client
          await streamCommand(command, {
            cwd,
            onStdout: (chunk) => {
              ws.send(JSON.stringify({ type: 'stdout', data: chunk }));
            },
            onStderr: (chunk) => {
              ws.send(JSON.stringify({ type: 'stderr', data: chunk }));
            },
            onExit: (code) => {
              ws.send(JSON.stringify({ type: 'exit', code }));
            },
          });
        } else if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (data.type === 'request_health') {
          await sendHealthToClient(ws);
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    });

    ws.on('close', () => {
      wsConnections.delete(id);
      console.log(`[WS] Client disconnected: ${id} (total: ${wsConnections.size})`);

      // Stop broadcasting when no clients
      if (wsConnections.size === 0) {
        stopHealthBroadcast();
      }
    });
  });

  // Handle server shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down...');
    stopHealthBroadcast();
    security.destroy();
    wss.close();
    server.close();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start listening
  server.listen(port, host, () => {
    const securityStatus = security.getStatus();
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 MoveWhisperer Server                                  ║
║                                                           ║
║   Local server running at:                                ║
║   → HTTP: http://${host}:${port}                          ║
║   → WebSocket: ws://${host}:${port}/ws                    ║
║                                                           ║
║   Security:                                               ║
║   → Auth: ${securityStatus.authEnabled ? 'Enabled (API key required)' : 'Disabled (open access)'}          ║
║   → Rate Limit: Enabled                                   ║
║   → Input Validation: Enabled                             ║
║                                                           ║
║   Available endpoints:                                    ║
║   • GET  /health             - Server health check        ║
║   • POST /api/chat           - Contract chat explorer     ║
║   • POST /api/decompile      - Decompile Sui package      ║
║   • POST /api/claude         - Execute Claude Code CLI    ║
║   • POST /api/analyze-contract - AI contract analysis     ║
║   • POST /api/analyze-changes  - AI version diff analysis ║
║   • POST /api/history        - Get package version history║
║   • POST /api/compare        - Compare package versions   ║
║   • POST /api/transaction    - Analyze a transaction      ║
║   • POST /api/transaction/skill - Generate TX skill       ║
║   • POST /api/terminal       - Run terminal command       ║
║   • POST /api/skills         - List saved skills          ║
║   • POST /api/skills/save    - Save a skill               ║
║   • POST /api/skills/read    - Read a skill               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
  });

  return server;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3456', 10);
  startServer({ port });
}

// Re-export types
export type { ServerConfig } from './config.js';
