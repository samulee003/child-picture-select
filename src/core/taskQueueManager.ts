/**
 * 批次任務佇列管理器
 * 支援多組成語並行處理和進度追蹤
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ScanTask {
  id: string;
  name: string;
  folderPath: string;
  referencePaths: string[];
  threshold: number;
  topN: number;
  status: TaskStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results?: any[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // ms
}

export interface QueueStats {
  totalTasks: number;
  pendingTasks: number;
  processingTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgDuration: number;
}

/**
 * 任務佇列管理器
 */
export class TaskQueueManager extends EventEmitter {
  private tasks: Map<string, ScanTask> = new Map();
  private maxConcurrentTasks: number = 3;
  private processingCount: number = 0;
  private isPaused: boolean = false;

  constructor(maxConcurrent: number = 3) {
    super();
    this.maxConcurrentTasks = maxConcurrent;
  }

  /**
   * 新增新任務到佇列
   */
  addTask(task: Omit<ScanTask, 'id' | 'status' | 'progress' | 'createdAt'>): string {
    const id = randomUUID();
    const newTask: ScanTask = {
      ...task,
      id,
      status: 'pending',
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
      },
      createdAt: new Date().toISOString(),
    };

    this.tasks.set(id, newTask);
    this.emit('task:added', newTask);

    return id;
  }

  /**
   * 取得任務
   */
  getTask(id: string): ScanTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * 取得所有任務
   */
  getAllTasks(): ScanTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 取得 pending 任務
   */
  getPendingTasks(): ScanTask[] {
    return this.getAllTasks().filter(t => t.status === 'pending');
  }

  /**
   * 取得 processing 任務
   */
  getProcessingTasks(): ScanTask[] {
    return this.getAllTasks().filter(t => t.status === 'processing');
  }

  /**
   * 取得 completed 任務
   */
  getCompletedTasks(): ScanTask[] {
    return this.getAllTasks().filter(t => t.status === 'completed');
  }

  /**
   * 取得 failed 任務
   */
  getFailedTasks(): ScanTask[] {
    return this.getAllTasks().filter(t => t.status === 'failed');
  }

  /**
   * 更新任務狀態
   */
  updateTaskStatus(id: string, updates: Partial<ScanTask>): void {
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
      this.emit('task:updated', task);
    }
  }

  /**
   * 更新任務進度
   */
  updateTaskProgress(id: string, current: number, total: number): void {
    const task = this.tasks.get(id);
    if (task && total > 0) {
      task.progress = {
        current,
        total,
        percentage: Math.round((current / total) * 100),
      };
      this.emit('task:progress', { taskId: id, ...task.progress });
    }
  }

  /**
   * 刪除任務
   */
  removeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (task && task.status === 'processing') {
      this.emit('task:cancel-requested', task);
    }
    const deleted = this.tasks.delete(id);
    if (deleted) {
      this.emit('task:removed', task);
      this.processQueue();
    }
    return deleted;
  }

  /**
   * 取消任務
   */
  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (task && (task.status === 'pending' || task.status === 'processing')) {
      const wasProcessing = task.status === 'processing';
      task.status = 'cancelled';
      task.completedAt = new Date().toISOString();
      this.emit('task:cancelled', task);
      if (wasProcessing) {
        this.processingCount--;
        this.processQueue();
      }
      return true;
    }
    return false;
  }

  /**
   * 清空已完成任務
   */
  clearCompleted(): number {
    let cleared = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        this.tasks.delete(id);
        cleared++;
        this.emit('task:cleared', task);
      }
    }
    return cleared;
  }

  /**
   * 暫停佇列處理
   */
  pause(): void {
    this.isPaused = true;
    this.emit('queue:paused');
  }

  /**
   * 恢復佇列處理
   */
  resume(): void {
    this.isPaused = false;
    this.emit('queue:resumed');
    this.processQueue();
  }

  /**
   * 取得佇列統計
   */
  getStats(): QueueStats {
    const tasks = this.getAllTasks();
    const completed = this.getCompletedTasks();
    
    return {
      totalTasks: tasks.length,
      pendingTasks: this.getPendingTasks().length,
      processingTasks: this.getProcessingTasks().length,
      completedTasks: completed.length,
      failedTasks: this.getFailedTasks().length,
      avgDuration: completed.length > 0
        ? completed.reduce((sum, t) => sum + (t.duration || 0), 0) / completed.length
        : 0,
    };
  }

  /**
   * 處理佇列
   */
  private async processQueue(): Promise<void> {
    if (this.isPaused) return;
    if (this.processingCount >= this.maxConcurrentTasks) return;

    const pendingTask = this.getPendingTasks()[0];
    if (!pendingTask) return;

    this.processingCount++;
    this.updateTaskStatus(pendingTask.id, {
      status: 'processing',
      startedAt: new Date().toISOString(),
    });

    this.emit('task:started', pendingTask);

    // 通知監聽器開始處理任務
    this.emit('process:task', pendingTask);
  }

  /**
   * 標記任務完成
   */
  completeTask(id: string, results: any[]): void {
    const task = this.tasks.get(id);
    if (task) {
      const completedAt = new Date().toISOString();
      const startedAt = task.startedAt ? new Date(task.startedAt).getTime() : Date.now();
      const duration = Date.now() - startedAt;

      task.status = 'completed';
      task.results = results;
      task.completedAt = completedAt;
      task.duration = duration;
      task.progress = {
        current: task.progress.total,
        total: task.progress.total,
        percentage: 100,
      };

      this.processingCount--;
      this.emit('task:completed', task);
      this.processQueue();
    }
  }

  /**
   * 標記任務失敗
   */
  failTask(id: string, error: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'failed';
      task.error = error;
      task.completedAt = new Date().toISOString();

      this.processingCount--;
      this.emit('task:failed', task);
      this.processQueue();
    }
  }

  /**
   * 設定最大並行數
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrentTasks = max;
    this.emit('config:changed', { maxConcurrent: max });
    this.processQueue();
  }

  /**
   * 取得目前設定
   */
  getConfig() {
    return {
      maxConcurrent: this.maxConcurrentTasks,
      isPaused: this.isPaused,
      processingCount: this.processingCount,
    };
  }
}

// 建立全域實例
export const taskQueueManager = new TaskQueueManager(3);
