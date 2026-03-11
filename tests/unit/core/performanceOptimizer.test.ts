/**
 * 效能優化器測試
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getOptimalBatchSize,
  getOptimalConcurrency,
  getPerformanceConfig,
  MemoryMonitor,
  PerformanceMonitor,
  perfMonitor,
} from '../../../src/core/performanceOptimizer';

describe('Performance Optimizer', () => {
  describe('getOptimalBatchSize', () => {
    it('should return batch size based on available memory', () => {
      const batchSize = getOptimalBatchSize(1000);
      expect(batchSize).toBeGreaterThan(0);
      expect(batchSize).toBeLessThanOrEqual(50);
    });

    it('should return smaller batch size for low memory', () => {
      // 模拟大量照片
      const batchSize = getOptimalBatchSize(10000);
      expect(batchSize).toBeLessThanOrEqual(50);
    });
  });

  describe('getOptimalConcurrency', () => {
    it('should return concurrency between 1-4', () => {
      const concurrency = getOptimalConcurrency();
      expect(concurrency).toBeGreaterThanOrEqual(1);
      expect(concurrency).toBeLessThanOrEqual(4);
    });
  });

  describe('getPerformanceConfig', () => {
    it('should return valid performance config', () => {
      const config = getPerformanceConfig();
      
      expect(config.batchSize).toBeGreaterThan(0);
      expect(config.maxConcurrency).toBeGreaterThan(0);
      expect(config.memoryThreshold).toBeGreaterThan(0);
      expect(config.gcInterval).toBeGreaterThan(0);
      expect(typeof config.enableCache).toBe('boolean');
      expect(typeof config.lowMemoryMode).toBe('boolean');
    });

    it('should have consistent low memory mode flag', () => {
      const config = getPerformanceConfig();
      
      if (config.lowMemoryMode) {
        expect(config.batchSize).toBeLessThanOrEqual(20);
        expect(config.maxConcurrency).toBeLessThanOrEqual(2);
      }
    });
  });
});

describe('Memory Monitor', () => {
  let monitor: MemoryMonitor;

  beforeEach(() => {
    monitor = new MemoryMonitor(500);
  });

  afterEach(() => {
    monitor.stop();
  });

  it('should start and stop without errors', () => {
    expect(() => monitor.start()).not.toThrow();
    expect(() => monitor.stop()).not.toThrow();
  });

  it('should get current memory usage', () => {
    const usage = monitor.getCurrentUsage();
    
    expect(usage.used).toBeGreaterThan(0);
    expect(usage.total).toBeGreaterThan(0);
    expect(usage.percentage).toBeGreaterThanOrEqual(0);
    expect(usage.percentage).toBeLessThanOrEqual(100);
  });

  it('should call onLowMemory callback when memory is low', (done) => {
    // 設定非常低的門檻值以觸發警告
    const lowMemoryMonitor = new MemoryMonitor(1, () => {
      done();
    });

    lowMemoryMonitor.start();

    // 清理
    setTimeout(() => {
      lowMemoryMonitor.stop();
    }, 10000);
  }, 15000);
});

describe('Performance Monitor', () => {
  let perfMon: PerformanceMonitor;

  beforeEach(() => {
    perfMon = new PerformanceMonitor();
  });

  afterEach(() => {
    perfMon.reset();
  });

  it('should measure duration correctly', () => {
    perfMon.start('test-operation');
    
    // 模拟操作
    const start = performance.now();
    while (performance.now() - start < 10) {
      // 等待 10ms
    }
    
    const duration = perfMon.end('test-operation');
    
    expect(duration).toBeGreaterThanOrEqual(10);
    expect(duration).toBeLessThan(1000);
  });

  it('should track multiple measurements', () => {
    perfMon.start('repeated-op');
    perfMon.end('repeated-op');
    
    perfMon.start('repeated-op');
    perfMon.end('repeated-op');
    
    perfMon.start('repeated-op');
    perfMon.end('repeated-op');
    
    const metrics = perfMon.getMetrics();
    
    expect(metrics['repeated-op']).toBeDefined();
    expect(metrics['repeated-op'].count).toBe(3);
  });

  it('should calculate average correctly', () => {
    const values = [10, 20, 30];
    
    values.forEach(value => {
      perfMon.start('avg-test');
      // 模拟不同时长
      const start = performance.now();
      while (performance.now() - start < value) {
        // 等待
      }
      perfMon.end('avg-test');
    });
    
    const avg = perfMon.getAverage('avg-test');
    expect(avg).toBeGreaterThanOrEqual(10);
    expect(avg).toBeLessThanOrEqual(30);
  });

  it('should reset metrics correctly', () => {
    perfMon.start('to-reset');
    perfMon.end('to-reset');
    
    perfMon.reset();
    
    const metrics = perfMon.getMetrics();
    expect(Object.keys(metrics).length).toBe(0);
  });

  it('should warn when ending without start', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    perfMon.end('non-existent');
    
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No start marker')
    );
    
    warnSpy.mockRestore();
  });
});

describe('Global Performance Monitor', () => {
  it('should export perfMonitor instance', () => {
    expect(perfMonitor).toBeDefined();
    expect(perfMonitor).toBeInstanceOf(PerformanceMonitor);
  });
});
