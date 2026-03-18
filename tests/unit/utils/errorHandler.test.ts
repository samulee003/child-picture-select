/**
 * 錯誤處理器測試（測試 error-handler.ts，生產環境實際使用）
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  createErrorInfo,
  isFileNotFoundError,
  isPermissionError,
  isNetworkError,
} from '../../../src/utils/error-handler';

describe('Error Handler (error-handler)', () => {
  describe('AppError', () => {
    it('should create AppError with message only', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it('should create AppError with code', () => {
      const error = new AppError('Not found', 'ENOENT');

      expect(error.code).toBe('ENOENT');
      expect(error.message).toBe('Not found');
    });

    it('should create AppError with details', () => {
      const details = { path: '/foo/bar' };
      const error = new AppError('File error', 'FILE_ERROR', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('createErrorInfo', () => {
    it('should convert AppError to ErrorInfo', () => {
      const error = new AppError('Test', 'TEST_CODE', { foo: 1 });
      const info = createErrorInfo(error);

      expect(info.message).toBe('Test');
      expect(info.code).toBe('TEST_CODE');
      expect(info.details).toEqual({ foo: 1 });
    });

    it('should convert plain Error to ErrorInfo', () => {
      const error = new Error('Plain error');
      const info = createErrorInfo(error);

      expect(info.message).toBe('Plain error');
      expect(info.code).toBe('UNKNOWN_ERROR');
      expect(info.details).toBeDefined();
      expect(info.details?.stack).toBeDefined();
      expect(info.details?.name).toBe('Error');
    });

    it('should convert string to ErrorInfo', () => {
      const info = createErrorInfo('String error');

      expect(info.message).toBe('String error');
      expect(info.code).toBe('STRING_ERROR');
    });

    it('should handle unknown error type', () => {
      const info = createErrorInfo({ weird: 'object' });

      expect(info.message).toBe('An unknown error occurred');
      expect(info.code).toBe('UNKNOWN');
    });
  });

  describe('isFileNotFoundError', () => {
    it('should return true for ENOENT code', () => {
      const error = new AppError('Not found', 'ENOENT');
      expect(isFileNotFoundError(error)).toBe(true);
    });

    it('should return true when message includes ENOENT', () => {
      expect(isFileNotFoundError(new Error('ENOENT: no such file'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isFileNotFoundError(new AppError('Other', 'OTHER'))).toBe(false);
    });
  });

  describe('isPermissionError', () => {
    it('should return true for EACCES code', () => {
      const error = new AppError('Access denied', 'EACCES');
      expect(isPermissionError(error)).toBe(true);
    });

    it('should return true when message includes permission', () => {
      expect(isPermissionError(new Error('permission denied'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isPermissionError(new AppError('Other'))).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for NETWORK_ERROR code', () => {
      const error = new AppError('Network fail', 'NETWORK_ERROR');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true when message includes network', () => {
      expect(isNetworkError(new Error('network request failed'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isNetworkError(new AppError('Other'))).toBe(false);
    });
  });
});
