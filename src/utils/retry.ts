/**
 * Retry utility with exponential backoff
 */

import { isRetryableError } from '../core/errors.js';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error) => isRetryableError(error),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we've exhausted retries
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
        break;
      }

      // Notify retry callback
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt + 1, delay);
      }

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper with fixed options
 */
export function createRetryWrapper(options: Partial<RetryOptions>) {
  return <T>(fn: () => Promise<T>): Promise<T> => withRetry(fn, options);
}
