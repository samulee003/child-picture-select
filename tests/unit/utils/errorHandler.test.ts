/**
 * 錯誤處理器測試
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createAppError,
  categorizeError,
  getRecoveryStrategy,
  safeExecute,
  getUserFriendlyMessage,
  ErrorCode,
} from '../../../src/utils/errorHandler';

describe('Error Handler', () => {
  describe('createAppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = createAppError('Test error', ErrorCode.FILE_NOT_FOUND, 'high');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.severity).toBe('high');
      expect(error.recoverable).toBe(true);
      expect(error.message).toBe('Test error');
    });

    it('should set recoverable to false for critical errors', () => {
      const error = createAppError('Critical error', ErrorCode.DATABASE_CORRUPTED, 'critical');

      expect(error.recoverable).toBe(false);
    });

    it('should include context and original error', () => {
      const originalError = new Error('Original');
      const context = { component: 'TestComponent', action: 'test' };
      
      const error = createAppError(
        'Test error',
        ErrorCode.UNKNOWN,
        'medium',
        originalError,
        context
      );

      expect(error.originalError).toBe(originalError);
      expect(error.context).toBeDefined();
      expect(error.context?.component).toBe('TestComponent');
    });

    it('should set timestamp in context', () => {
      const error = createAppError('Test error');

      expect(error.context?.timestamp).toBeDefined();
      expect(new Date(error.context!.timestamp!)).toBeInstanceOf(Date);
    });
  });

  describe('categorizeError', () => {
    it('should categorize AppError correctly', () => {
      const appError = createAppError('File not found', ErrorCode.FILE_NOT_FOUND);
      const result = categorizeError(appError);

      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(result.userMessage).toBe('檔案未找到');
    });

    it('should categorize ENOENT error', () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';

      const result = categorizeError(error);

      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(result.userMessage).toBe('檔案未找到');
    });

    it('should categorize EACCES error', () => {
      const error = new Error('Permission denied');
      (error as any).code = 'EACCES';

      const result = categorizeError(error);

      expect(result.code).toBe(ErrorCode.FILE_ACCESS_DENIED);
      expect(result.userMessage).toBe('無法存取檔案');
    });

    it('should categorize memory error', () => {
      const error = new Error('JavaScript heap out of memory');

      const result = categorizeError(error);

      expect(result.code).toBe(ErrorCode.LOW_MEMORY);
      expect(result.userMessage).toBe('記憶體不足');
    });

    it('should categorize timeout error', () => {
      const error = new Error('Request timed out');

      const result = categorizeError(error);

      expect(result.code).toBe(ErrorCode.TIMEOUT);
      expect(result.userMessage).toBe('操作逾時');
    });

    it('should handle unknown error', () => {
      const error = new Error('Unknown thing happened');

      const result = categorizeError(error);

      expect(result.code).toBe(ErrorCode.UNKNOWN);
      expect(result.userMessage).toBe('Unknown thing happened');
    });
  });

  describe('getRecoveryStrategy', () => {
    it('should provide retry strategy for timeout errors', () => {
      const error = createAppError('Timeout', ErrorCode.TIMEOUT);
      const strategy = getRecoveryStrategy(error);

      expect(strategy.canRecover).toBe(true);
      expect(strategy.retryCount).toBe(3);
      expect(strategy.retryDelay).toBe(1000);
    });

    it('should provide GC fallback for low memory', () => {
      const error = createAppError('Low memory', ErrorCode.LOW_MEMORY);
      const strategy = getRecoveryStrategy(error);

      expect(strategy.canRecover).toBe(true);
      expect(strategy.retryCount).toBe(1);
      expect(strategy.fallbackAction).toBeDefined();
    });

    it('should not recover from file not found', () => {
      const error = createAppError('Not found', ErrorCode.FILE_NOT_FOUND);
      const strategy = getRecoveryStrategy(error);

      expect(strategy.canRecover).toBe(false);
    });

    it('should not recover from database corrupted', () => {
      const error = createAppError('Corrupted', ErrorCode.DATABASE_CORRUPTED);
      const strategy = getRecoveryStrategy(error);

      expect(strategy.canRecover).toBe(false);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user friendly message with suggestion', () => {
      const error = createAppError('File not found', ErrorCode.FILE_NOT_FOUND);
      const message = getUserFriendlyMessage(error);

      expect(message).toContain('檔案未找到');
      expect(message).toContain('請確認檔案路徑正確');
    });

    it('should return message without suggestion if none', () => {
      const error = createAppError('Cancelled', ErrorCode.OPERATION_CANCELLED);
      const message = getUserFriendlyMessage(error);

      expect(message).toBe('操作已取消');
    });
  });

  describe('safeExecute', () => {
    it('should return success result for successful execution', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await safeExecute(fn);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('success');
      }
    });

    it('should return error result for failed execution', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));
      
      const result = await safeExecute(fn);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('发生未知错误');
      }
    });

    it('should include context in error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));
      const context = { component: 'Test', action: 'testing' };
      
      const result = await safeExecute(fn, context);

      if (!result.success) {
        expect(result.error.context).toBeDefined();
        expect(result.error.context?.component).toBe('Test');
      }
    });
  });
});
