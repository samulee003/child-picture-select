import { logger } from '../utils/logger';

interface PerformanceConfig {
  batchSize: number;
  maxConcurrency: number;
  memoryThreshold: number;
  gcInterval: number;
}

class PerformanceManager {
  private config: PerformanceConfig = {
    batchSize: 50,
    maxConcurrency: 4,
    memoryThreshold: 1024 * 1024 * 1024, // 1GB
    gcInterval: 30000 // 30 seconds
  };

  private activeTasks = 0;
  private lastGC = Date.now();

  constructor() {
    // Set up periodic garbage collection
    setInterval(() => {
      this.checkAndCleanup();
    }, this.config.gcInterval);
  }

  /**
   * Process items in batches to avoid memory overload
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: { batchSize?: number; onProgress?: (completed: number, total: number) => void } = {}
  ): Promise<R[]> {
    const batchSize = options.batchSize || this.config.batchSize;
    const results: R[] = [];
    
    logger.debug(`Processing ${items.length} items in batches of ${batchSize}`);

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Wait for available concurrency slot
      await this.waitForSlot();
      
      // Process batch
      const batchPromises = batch.map(item => 
        this.withConcurrency(() => processor(item))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Report progress
      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, items.length), items.length);
      }
      
      // Allow event loop to process other tasks
      await this.yield();
      
      // Check memory usage and cleanup if needed
      this.checkMemoryUsage();
    }

    logger.debug(`Batch processing completed: ${results.length} results`);
    return results;
  }

  /**
   * Execute function with concurrency control
   */
  private async withConcurrency<T>(fn: () => Promise<T>): Promise<T> {
    this.activeTasks++;
    
    try {
      return await fn();
    } finally {
      this.activeTasks--;
    }
  }

  /**
   * Wait for available concurrency slot
   */
  private async waitForSlot(): Promise<void> {
    while (this.activeTasks >= this.config.maxConcurrency) {
      await this.sleep(100);
    }
  }

  /**
   * Yield control to event loop
   */
  private async yield(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;
      
      if (heapUsed > this.config.memoryThreshold) {
        logger.warn(`Memory usage high: ${Math.round(heapUsed / 1024 / 1024)}MB, triggering cleanup`);
        this.forceCleanup();
      }
    }
  }

  /**
   * Check and perform periodic cleanup
   */
  private checkAndCleanup(): void {
    const now = Date.now();
    if (now - this.lastGC > this.config.gcInterval) {
      this.forceCleanup();
      this.lastGC = now;
    }
  }

  /**
   * Force garbage collection and cleanup
   */
  private forceCleanup(): void {
    try {
      if (global.gc) {
        global.gc();
        logger.debug('Manual garbage collection triggered');
      }
      
      // Clear any caches if needed
      if (typeof process !== 'undefined') {
        // Force Node.js to clean up if possible
        // Note: 'cleanup' is not a standard Node.js event
        // We'll rely on garbage collection instead
      }
    } catch (error) {
      logger.warn('Failed to force cleanup:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      activeTasks: this.activeTasks,
      maxConcurrency: this.config.maxConcurrency,
      memoryUsage: typeof process !== 'undefined' && process.memoryUsage ? 
        process.memoryUsage() : null
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Performance config updated:', this.config);
  }
}

export const performanceManager = new PerformanceManager();