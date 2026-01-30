/**
 * Decompile endpoint
 * Uses move-decompiler (Revela) CLI to decompile Sui packages
 */

import { ServerResponse } from 'http';
import { WebSocket } from 'ws';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { streamCommand, commandExists } from '../terminal.js';

interface DecompileRequest {
  packageId: string;
  bytecode?: Record<string, string>; // base64-encoded bytecode per module
  network?: 'mainnet' | 'testnet' | 'devnet';
  module?: string;
  streamId?: string;
}

interface DecompileResponse {
  success: boolean;
  packageId: string;
  output: string;
  error?: string;
}

/**
 * Handle decompile request
 */
export async function handleDecompile(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void,
  wsConnections: Map<string, WebSocket>
) {
  const { packageId, bytecode, streamId } = body as DecompileRequest;

  if (!packageId) {
    sendError(res, 'packageId is required', 400);
    return;
  }

  // Validate package ID format (0x followed by hex, any length)
  if (!packageId.match(/^0x[a-fA-F0-9]+$/)) {
    sendError(res, 'Invalid package ID format. Expected 0x...', 400);
    return;
  }

  // Check if move-decompiler is available
  const hasDecompiler = await commandExists('move-decompiler');
  if (!hasDecompiler) {
    sendError(res, 'move-decompiler CLI not found. Run: bun run install:revela', 503);
    return;
  }

  // Get WebSocket for streaming (if provided)
  const ws = streamId ? wsConnections.get(streamId) : null;

  const sendProgress = (message: string) => {
    console.log(`[Decompile] ${message}`);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'progress', message }));
    }
  };

  try {
    // Bytecode is required
    if (!bytecode || Object.keys(bytecode).length === 0) {
      sendError(res, 'bytecode is required for decompilation', 400);
      return;
    }

    sendProgress(`Decompiling ${Object.keys(bytecode).length} modules...`);

    // Create temp directory for bytecode files
    const tempDir = join(tmpdir(), `sui-decompile-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Write all bytecode files and collect paths
    const moduleNames = Object.keys(bytecode);
    const filePaths: string[] = [];

    for (const moduleName of moduleNames) {
      const bytecodeBase64 = bytecode[moduleName];
      const bytecodeBuffer = Buffer.from(bytecodeBase64, 'base64');
      const filePath = join(tempDir, `${moduleName}.mv`);
      await writeFile(filePath, bytecodeBuffer);
      filePaths.push(filePath);
      sendProgress(`Wrote ${moduleName}.mv (${bytecodeBuffer.length} bytes)`);
    }

    // Decompile each module separately and collect outputs
    const outputs: string[] = [];
    let hasError = false;
    let lastError = '';

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const moduleName = moduleNames[i];
      sendProgress(`Decompiling module ${i + 1}/${filePaths.length}: ${moduleName}...`);

      const command = `move-decompiler -b "${filePath}"`;

      const result = await streamCommand(command, {
        timeout: 60000,
        onStdout: (chunk) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stdout', data: chunk }));
          }
        },
        onStderr: (chunk) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stderr', data: chunk }));
          }
        },
      });

      if (result.success && result.stdout) {
        outputs.push(`// ===== Module: ${moduleName} =====\n\n${result.stdout}`);
      } else {
        hasError = true;
        lastError = result.stderr;
        outputs.push(`// ===== Module: ${moduleName} =====\n// Decompilation failed: ${result.stderr}`);
      }
    }

    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    if (outputs.length === 0) {
      throw new Error(`Decompilation failed: ${lastError}`);
    }

    const response: DecompileResponse = {
      success: !hasError || outputs.some(o => !o.includes('failed')),
      packageId,
      output: outputs.join('\n\n'),
    };

    sendProgress(`Decompilation complete! (${moduleNames.length} modules)`);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: hasError ? 1 : 0 }));
    }

    sendJson(res, response);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Decompilation failed';
    console.error('[Decompile] Error:', message);
    sendError(res, message);
  }
}
