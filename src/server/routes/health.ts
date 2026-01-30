/**
 * Health check endpoint
 * Reports server status and available CLI tools
 */

import { IncomingMessage, ServerResponse } from 'http';
import { commandExists, getToolVersion } from '../terminal.js';

interface ToolStatus {
  name: string;
  available: boolean;
  version: string | null;
  path?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  tools: ToolStatus[];
}

/**
 * Check status of required CLI tools
 */
async function checkTools(): Promise<ToolStatus[]> {
  const tools = [
    { name: 'move-decompiler', command: 'move-decompiler' },
    { name: 'claude', command: 'claude' },
    { name: 'sui', command: 'sui' },
  ];

  const results: ToolStatus[] = [];

  for (const tool of tools) {
    const available = await commandExists(tool.command);
    const version = available ? await getToolVersion(tool.command) : null;

    results.push({
      name: tool.name,
      available,
      version,
    });
  }

  return results;
}

/**
 * Handle health check request
 */
export async function handleHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void
) {
  const tools = await checkTools();
  const allAvailable = tools.every((t) => t.available);

  const response: HealthResponse = {
    status: allAvailable ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    tools,
  };

  sendJson(res, response);
}
