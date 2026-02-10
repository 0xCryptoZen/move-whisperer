/**
 * Custom error classes for MoveWhisperer
 */

export enum ErrorCode {
  // Input errors
  INPUT_VALIDATION = 'INPUT_VALIDATION',
  INVALID_PACKAGE_ID = 'INVALID_PACKAGE_ID',
  INVALID_MODULE_NAME = 'INVALID_MODULE_NAME',
  INVALID_NETWORK = 'INVALID_NETWORK',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  RPC_TIMEOUT = 'RPC_TIMEOUT',
  RPC_RATE_LIMIT = 'RPC_RATE_LIMIT',
  PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',

  // Processing errors
  TYPE_MAPPING = 'TYPE_MAPPING',
  ANALYSIS_ERROR = 'ANALYSIS_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',

  // Output errors
  FILE_SYSTEM = 'FILE_SYSTEM',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Config errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
}

export class MoveWhispererError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MoveWhispererError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// Input validation errors
export class InputValidationError extends MoveWhispererError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.INPUT_VALIDATION, details);
    this.name = 'InputValidationError';
  }

  static invalidPackageId(packageId: string): InputValidationError {
    return new InputValidationError(
      `Invalid package ID format: "${packageId}". Expected format: 0x<hex> or 0x<hex>::<module>`,
      { packageId }
    );
  }

  static invalidModuleName(moduleName: string): InputValidationError {
    return new InputValidationError(
      `Invalid module name: "${moduleName}". Module names must start with a letter and contain only alphanumeric characters and underscores.`,
      { moduleName }
    );
  }

  static invalidNetwork(network: string): InputValidationError {
    return new InputValidationError(
      `Invalid network: "${network}". Valid networks are: mainnet, testnet, devnet`,
      { network }
    );
  }
}

// Network errors
export class NetworkError extends MoveWhispererError {
  constructor(message: string, code: ErrorCode = ErrorCode.NETWORK_ERROR, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'NetworkError';
  }

  static packageNotFound(packageId: string, network: string): NetworkError {
    return new NetworkError(
      `Package "${packageId}" not found on ${network}. Please verify the package ID and network.`,
      ErrorCode.PACKAGE_NOT_FOUND,
      { packageId, network }
    );
  }

  static moduleNotFound(packageId: string, moduleName: string, network: string): NetworkError {
    return new NetworkError(
      `Module "${moduleName}" not found in package "${packageId}" on ${network}.`,
      ErrorCode.MODULE_NOT_FOUND,
      { packageId, moduleName, network }
    );
  }

  static rpcTimeout(url: string, timeoutMs: number): NetworkError {
    return new NetworkError(
      `RPC request timed out after ${timeoutMs}ms. Try again or use a different RPC endpoint.`,
      ErrorCode.RPC_TIMEOUT,
      { rpcUrl: url, timeoutMs }
    );
  }

  static rpcRateLimit(url: string): NetworkError {
    return new NetworkError(
      `RPC rate limit exceeded. Please wait before retrying or use a different RPC endpoint.`,
      ErrorCode.RPC_RATE_LIMIT,
      { rpcUrl: url }
    );
  }

  static connectionFailed(url: string, originalError: Error): NetworkError {
    return new NetworkError(
      `Failed to connect to RPC endpoint: ${url}. ${originalError.message}`,
      ErrorCode.NETWORK_ERROR,
      { rpcUrl: url, originalError: originalError.message }
    );
  }
}

// Type mapping errors
export class TypeMappingError extends MoveWhispererError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.TYPE_MAPPING, details);
    this.name = 'TypeMappingError';
  }

  static unknownType(moveType: unknown): TypeMappingError {
    return new TypeMappingError(
      `Unknown Move type encountered: ${JSON.stringify(moveType)}`,
      { moveType }
    );
  }

  static unsupportedType(typeName: string): TypeMappingError {
    return new TypeMappingError(
      `Unsupported Move type: ${typeName}`,
      { typeName }
    );
  }
}

// Template errors
export class TemplateError extends MoveWhispererError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.TEMPLATE_ERROR, details);
    this.name = 'TemplateError';
  }

  static notFound(templateName: string): TemplateError {
    return new TemplateError(
      `Template "${templateName}" not found`,
      { templateName }
    );
  }

  static renderFailed(templateName: string, originalError: Error): TemplateError {
    return new TemplateError(
      `Failed to render template "${templateName}": ${originalError.message}`,
      { templateName, originalError: originalError.message }
    );
  }
}

// File system errors
export class FileSystemError extends MoveWhispererError {
  constructor(message: string, code: ErrorCode = ErrorCode.FILE_SYSTEM, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'FileSystemError';
  }

  static writeError(path: string, originalError: Error): FileSystemError {
    return new FileSystemError(
      `Failed to write file "${path}": ${originalError.message}`,
      ErrorCode.FILE_SYSTEM,
      { path, originalError: originalError.message }
    );
  }

  static readError(path: string, originalError: Error): FileSystemError {
    return new FileSystemError(
      `Failed to read file "${path}": ${originalError.message}`,
      ErrorCode.FILE_SYSTEM,
      { path, originalError: originalError.message }
    );
  }

  static directoryError(path: string, originalError: Error): FileSystemError {
    return new FileSystemError(
      `Failed to create directory "${path}": ${originalError.message}`,
      ErrorCode.FILE_SYSTEM,
      { path, originalError: originalError.message }
    );
  }

  static permissionDenied(path: string): FileSystemError {
    return new FileSystemError(
      `Permission denied: "${path}"`,
      ErrorCode.PERMISSION_DENIED,
      { path }
    );
  }
}

// Config errors
export class ConfigError extends MoveWhispererError {
  constructor(message: string, code: ErrorCode = ErrorCode.CONFIG_ERROR, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'ConfigError';
  }

  static notFound(path: string): ConfigError {
    return new ConfigError(
      `Configuration file not found: "${path}"`,
      ErrorCode.CONFIG_NOT_FOUND,
      { path }
    );
  }

  static invalidFormat(path: string, originalError: Error): ConfigError {
    return new ConfigError(
      `Invalid configuration file format in "${path}": ${originalError.message}`,
      ErrorCode.CONFIG_ERROR,
      { path, originalError: originalError.message }
    );
  }
}

// Utility function to check if error is retryable
export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return [
      ErrorCode.RPC_TIMEOUT,
      ErrorCode.RPC_RATE_LIMIT,
      ErrorCode.NETWORK_ERROR,
    ].includes(error.code);
  }

  if (error instanceof Error) {
    const retryableMessages = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'rate limit',
      '429',
      '503',
      '502',
      '504',
    ];
    return retryableMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  return false;
}
