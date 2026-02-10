/**
 * Health check endpoint
 * Reports server status and available CLI tools
 */

import { IncomingMessage, ServerResponse } from 'http';
import { commandExists, getToolVersion } from '../terminal.js';

export interface ToolStatus {
  name: string;
  available: boolean;
  version: string | null;
  path?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  tools: ToolStatus[];
}

// Cache tool status for 60 seconds
let toolsCache: ToolStatus[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

/**
 * Check status of required CLI tools (with caching)
 */
async function checkTools(): Promise<ToolStatus[]> {
  const now = Date.now();

  // Return cached result if still valid
  if (toolsCache && (now - cacheTime) < CACHE_TTL) {
    return toolsCache;
  }

  const tools = [
    { name: 'move-decompiler', command: 'move-decompiler' },
    { name: 'claude', command: 'claude' },
    { name: 'sui', command: 'sui' },
  ];

  // Check tools in parallel for speed
  const results = await Promise.all(
    tools.map(async (tool) => {
      const available = await commandExists(tool.command);
      const version = available ? await getToolVersion(tool.command) : null;
      return {
        name: tool.name,
        available,
        version,
      };
    })
  );

  // Update cache
  toolsCache = results;
  cacheTime = now;

  return results;
}

/**
 * Get health data (reusable by HTTP handler and WebSocket broadcaster)
 */
export async function getHealthData(): Promise<HealthResponse> {
  const tools = await checkTools();
  const allAvailable = tools.every((t) => t.available);

  return {
    status: allAvailable ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    tools,
  };
}

/**
 * Handle health check request
 */
export async function handleHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void
) {
  const response = await getHealthData();
  sendJson(res, response);
}
