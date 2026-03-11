import type { ErrorInfo } from '../types/api';

export class AppError extends Error {
  public readonly code?: string;
  public readonly details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export function createErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      details: {
        stack: error.stack,
        name: error.name
      }
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      code: 'STRING_ERROR'
    };
  }

  return {
    message: 'An unknown error occurred',
    code: 'UNKNOWN',
    details: error
  };
}

export function isFileNotFoundError(error: unknown): boolean {
  const errorInfo = createErrorInfo(error);
  return errorInfo.code === 'ENOENT' || errorInfo.message.includes('ENOENT');
}

export function isPermissionError(error: unknown): boolean {
  const errorInfo = createErrorInfo(error);
  return errorInfo.code === 'EACCES' || errorInfo.message.includes('permission');
}

export function isNetworkError(error: unknown): boolean {
  const errorInfo = createErrorInfo(error);
  return errorInfo.code === 'NETWORK_ERROR' || errorInfo.message.includes('network');
}