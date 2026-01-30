/**
 * Terminal execution utilities
 * Execute local CLI commands and stream output
 */

import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecuteOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface StreamOptions extends ExecuteOptions {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number) => void;
}

/**
 * Execute a command and return the result
 */
export async function executeCommand(
  command: string,
  options: ExecuteOptions = {}
): Promise<ExecuteResult> {
  const { cwd, timeout = 60000, env } = options;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      success: true,
    };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout?.trim() || '',
      stderr: execError.stderr?.trim() || (error instanceof Error ? error.message : 'Unknown error'),
      exitCode: execError.code || 1,
      success: false,
    };
  }
}

/**
 * Stream command output in real-time
 */
export function streamCommand(
  command: string,
  options: StreamOptions = {}
): Promise<ExecuteResult> {
  const { cwd, timeout = 300000, env, onStdout, onStderr, onExit } = options;

  return new Promise((resolve) => {
    // Parse command into program and args
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const program = parts[0] || 'echo';
    const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));

    const child: ChildProcess = spawn(program, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;

    if (timeout) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        stderr += '\nCommand timed out';
      }, timeout);
    }

    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      onStdout?.(chunk);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      onStderr?.(chunk);
    });

    child.on('close', (code: number | null) => {
      if (timeoutId) clearTimeout(timeoutId);
      const exitCode = code ?? 1;
      onExit?.(exitCode);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        success: exitCode === 0,
      });
    });

    child.on('error', (error: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      stderr += error.message;
      onExit?.(1);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 1,
        success: false,
      });
    });
  });
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    await execAsync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get version of a CLI tool
 */
export async function getToolVersion(command: string): Promise<string | null> {
  try {
    const { stdout } = await executeCommand(`${command} --version`);
    return stdout.split('\n')[0];
  } catch {
    return null;
  }
}
