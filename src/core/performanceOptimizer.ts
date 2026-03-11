/**
 * 效能優化設定
 * 自適應記憶體和批次處理策略
 */

export interface PerformanceConfig {
  batchSize: number;
  maxConcurrency: number;
  memoryThreshold: number;
  gcInterval: number;
  enableCache: boolean;
  prefetchEnabled: boolean;
  lowMemoryMode: boolean;
}

/**
 * 取得系統可用記憶體資訊
 */
function getMemoryInfo(): { total: number; free: number; usage: number } {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      total: usage.heapTotal,
      free: usage.heapTotal - usage.heapUsed,
      usage: usage.heapUsed,
    };
  }
  // 浏览器环境
  // @ts-ignore
  if (performance && performance.memory) {
    // @ts-ignore
    const mem = performance.memory;
    return {
      total: mem.jsHeapSizeLimit,
      free: mem.jsHeapSizeLimit - mem.usedJSHeapSize,
      usage: mem.usedJSHeapSize,
    };
  }
  // 默认值
  return {
    total: 2 * 1024 * 1024 * 1024, // 2GB
    free: 1 * 1024 * 1024 * 1024,  // 1GB
    usage: 1 * 1024 * 1024 * 1024,
  };
}

/**
 * 根据可用内存计算最佳批次大小
 */
export function getOptimalBatchSize(totalPhotos: number): number {
  const memoryInfo = getMemoryInfo();
  const availableMemoryMB = memoryInfo.free / 1024 / 1024;

  if (availableMemoryMB > 2000) {
    return 50; // 2GB+ RAM: 大批次
  } else if (availableMemoryMB > 1000) {
    return 30; // 1-2GB RAM: 中等批次
  } else if (availableMemoryMB > 500) {
    return 20; // 500MB-1GB RAM: 中小批次
  } else {
    return 10; // <500MB RAM: 小批次
  }
}

/**
 * 取得最佳並行數
 */
export function getOptimalConcurrency(): number {
  const memoryInfo = getMemoryInfo();
  const availableMemoryMB = memoryInfo.free / 1024 / 1024;

  if (availableMemoryMB > 2000) {
    return 4;
  } else if (availableMemoryMB > 1000) {
    return 3;
  } else if (availableMemoryMB > 500) {
    return 2;
  } else {
    return 1; // 低内存模式：串行处理
  }
}

/**
 * 取得效能設定
 */
export function getPerformanceConfig(): PerformanceConfig {
  const memoryInfo = getMemoryInfo();
  const availableMemoryMB = memoryInfo.free / 1024 / 1024;
  const lowMemoryMode = availableMemoryMB < 500;

  return {
    batchSize: getOptimalBatchSize(1000),
    maxConcurrency: getOptimalConcurrency(),
    memoryThreshold: lowMemoryMode ? 256 * 1024 * 1024 : 512 * 1024 * 1024,
    gcInterval: lowMemoryMode ? 5000 : 15000,
    enableCache: true,
    prefetchEnabled: !lowMemoryMode,
    lowMemoryMode,
  };
}

/**
 * 内存监控器
 */
export class MemoryMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private onLowMemory?: () => void;
  private threshold: number;

  constructor(thresholdMB: number = 500, onLowMemory?: () => void) {
    this.threshold = thresholdMB * 1024 * 1024;
    this.onLowMemory = onLowMemory;
  }

  start(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      const memoryInfo = getMemoryInfo();
      
      if (memoryInfo.free < this.threshold) {
        console.warn('Low memory warning:', Math.round(memoryInfo.free / 1024 / 1024), 'MB available');
        this.onLowMemory?.();
        
        // 触发垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
      }
    }, 5000);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getCurrentUsage(): { used: number; total: number; percentage: number } {
    const memoryInfo = getMemoryInfo();
    return {
      used: memoryInfo.usage,
      total: memoryInfo.total,
      percentage: (memoryInfo.usage / memoryInfo.total) * 100,
    };
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private markers: Map<string, number> = new Map();
  private metrics: Map<string, number[]> = new Map();

  /**
   * 標記開始時間
   */
  start(name: string): void {
    this.markers.set(name, performance.now());
  }

  /**
   * 標記結束並記錄時間
   */
  end(name: string): number {
    const start = this.markers.get(name);
    if (start === undefined) {
      console.warn(`PerformanceMonitor: No start marker for "${name}"`);
      return 0;
    }

    const duration = performance.now() - start;
    this.markers.delete(name);

    // 记录指标
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    return duration;
  }

  /**
   * 取得平均耗時
   */
  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 取得所有指標
   */
  getMetrics(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const result: Record<string, any> = {};
    
    this.metrics.forEach((values, name) => {
      result[name] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    });

    return result;
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.markers.clear();
    this.metrics.clear();
  }
}

// 建立全域實例
export const perfMonitor = new PerformanceMonitor();

/**
 * 性能装饰器
 */
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const metricName = `${target.constructor.name}.${propertyKey}`;

  descriptor.value = async function (...args: any[]) {
    perfMonitor.start(metricName);
    try {
      const result = await originalMethod.apply(this, args);
      const duration = perfMonitor.end(metricName);
      console.log(`[Performance] ${metricName}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      perfMonitor.end(metricName);
      throw error;
    }
  };

  return descriptor;
}
