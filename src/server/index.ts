/**
 * Auto Sui Skill - Local Server
 * Bridges web UI with local CLI tools (move-decompiler, claude, sui)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'url';
import { executeCommand, streamCommand } from './terminal.js';
import { handleDecompile } from './routes/decompile.js';
import { handleClaude } from './routes/claude.js';
import { handleHealth } from './routes/health.js';
import { handleAnalyzeContract } from './routes/analyze.js';

export interface ServerConfig {
  port: number;
  host: string;
  allowedOrigins: string[];
}

const DEFAULT_CONFIG: ServerConfig = {
  port: 3456,
  host: 'localhost',
  allowedOrigins: ['http://localhost:3000', 'http://localhost:3456', 'http://127.0.0.1:3000'],
};

// Active WebSocket connections for streaming
const wsConnections = new Map<string, WebSocket>();

/**
 * Parse JSON body from request
 */
async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res: ServerResponse, message: string, status = 500) {
  sendJson(res, { error: message }, status);
}

/**
 * Handle CORS preflight
 */
function handleCors(res: ServerResponse) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  res.end();
}

/**
 * Route handler
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const { pathname } = parseUrl(req.url || '/', true);
  const method = req.method?.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    handleCors(res);
    return;
  }

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  try {
    // Parse body for POST requests
    const body = method === 'POST' ? await parseBody(req) : {};

    // Route handling
    switch (pathname) {
      case '/':
      case '/health':
        await handleHealth(req, res, sendJson);
        break;

      case '/api/decompile':
        if (method !== 'POST') {
          sendError(res, 'Method not allowed', 405);
          return;
        }
        await handleDecompile(body, res, sendJson, sendError, wsConnections);
        break;

      case '/api/claude':
        if (method !== 'POST') {
          sendError(res, 'Method not allowed', 405);
          return;
        }
        await handleClaude(body, res, sendJson, sendError, wsConnections);
        break;

      case '/api/analyze-contract':
        if (method !== 'POST') {
          sendError(res, 'Method not allowed', 405);
          return;
        }
        await handleAnalyzeContract(body, res, sendJson, sendError);
        break;

      case '/api/terminal':
        if (method !== 'POST') {
          sendError(res, 'Method not allowed', 405);
          return;
        }
        await handleTerminal(body as { command: string; cwd?: string }, res, sendJson, sendError);
        break;

      default:
        sendError(res, 'Not found', 404);
    }
  } catch (error) {
    console.error('Request error:', error);
    sendError(res, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * Handle generic terminal command execution
 */
async function handleTerminal(
  body: { command: string; cwd?: string },
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void
) {
  const { command, cwd } = body;

  if (!command) {
    sendError(res, 'Command is required', 400);
    return;
  }

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
export function startServer(config: Partial<ServerConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { port, host } = finalConfig;

  // Create HTTP server
  const server = createServer(handleRequest);

  // Create WebSocket server for streaming
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, _req) => {
    const id = Math.random().toString(36).substring(7);
    wsConnections.set(id, ws);
    console.log(`[WS] Client connected: ${id}`);

    // Send connection ID to client
    ws.send(JSON.stringify({ type: 'connected', id }));

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`[WS] Message from ${id}:`, data.type);

        // Handle streaming commands
        if (data.type === 'execute') {
          const { command, cwd } = data;

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
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });

    ws.on('close', () => {
      wsConnections.delete(id);
      console.log(`[WS] Client disconnected: ${id}`);
    });
  });

  // Start listening
  server.listen(port, host, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Auto Sui Skill Server                                ║
║                                                           ║
║   Local server running at:                                ║
║   → HTTP: http://${host}:${port}                          ║
║   → WebSocket: ws://${host}:${port}/ws                    ║
║                                                           ║
║   Available endpoints:                                    ║
║   • GET  /health             - Server health check        ║
║   • POST /api/decompile      - Decompile Sui package      ║
║   • POST /api/claude         - Execute Claude Code CLI    ║
║   • POST /api/analyze-contract - AI contract analysis     ║
║   • POST /api/terminal       - Run terminal command       ║
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
