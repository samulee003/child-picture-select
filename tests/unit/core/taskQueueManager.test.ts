/**
 * 任務佇列管理器測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskQueueManager, type ScanTask } from '../../../src/core/taskQueueManager';

describe('TaskQueueManager', () => {
  let queue: TaskQueueManager;

  beforeEach(() => {
    queue = new TaskQueueManager(3);
  });

  describe('addTask', () => {
    it('should add a new task with pending status', () => {
      const taskId = queue.addTask({
        name: 'Test Task',
        folderPath: '/test/folder',
        referencePaths: ['/ref1.jpg'],
        threshold: 0.6,
        topN: 50,
      });

      const task = queue.getTask(taskId);
      
      expect(task).toBeDefined();
      expect(task?.status).toBe('pending');
      expect(task?.progress).toEqual({ current: 0, total: 0, percentage: 0 });
      expect(task?.createdAt).toBeDefined();
    });

    it('should generate unique UUID for each task', () => {
      const id1 = queue.addTask({
        name: 'Task 1',
        folderPath: '/folder1',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      const id2 = queue.addTask({
        name: 'Task 2',
        folderPath: '/folder2',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      expect(id1).not.toBe(id2);
    });

    it('should emit task:added event', () => {
      const eventHandler = vi.fn();
      queue.on('task:added', eventHandler);

      queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('task status management', () => {
    it('should update task status', () => {
      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      queue.updateTaskStatus(taskId, { status: 'processing' });

      const task = queue.getTask(taskId);
      expect(task?.status).toBe('processing');
    });

    it('should update task progress', () => {
      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      queue.updateTaskProgress(taskId, 50, 100);

      const task = queue.getTask(taskId);
      expect(task?.progress).toEqual({
        current: 50,
        total: 100,
        percentage: 50,
      });
    });

    it('should emit task:progress event', () => {
      const eventHandler = vi.fn();
      queue.on('task:progress', eventHandler);

      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      queue.updateTaskProgress(taskId, 25, 100);

      expect(eventHandler).toHaveBeenCalledWith({
        taskId,
        current: 25,
        total: 100,
        percentage: 25,
      });
    });
  });

  describe('removeTask', () => {
    it('should remove a task', () => {
      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      const removed = queue.removeTask(taskId);

      expect(removed).toBe(true);
      expect(queue.getTask(taskId)).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      const removed = queue.removeTask('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a pending task', () => {
      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      const cancelled = queue.cancelTask(taskId);

      expect(cancelled).toBe(true);
      expect(queue.getTask(taskId)?.status).toBe('cancelled');
    });

    it('should not cancel a completed task', () => {
      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      queue.updateTaskStatus(taskId, { status: 'completed' });

      const cancelled = queue.cancelTask(taskId);

      expect(cancelled).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      queue.addTask({ name: 'Task 1', folderPath: '/f1', referencePaths: [], threshold: 0.6, topN: 50 });
      queue.addTask({ name: 'Task 2', folderPath: '/f2', referencePaths: [], threshold: 0.6, topN: 50 });
      queue.addTask({ name: 'Task 3', folderPath: '/f3', referencePaths: [], threshold: 0.6, topN: 50 });

      const stats = queue.getStats();

      expect(stats.totalTasks).toBe(3);
      expect(stats.pendingTasks).toBe(3);
      expect(stats.processingTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
    });
  });

  describe('clearCompleted', () => {
    it('should clear completed and cancelled tasks', () => {
      const id1 = queue.addTask({ name: 'Task 1', folderPath: '/f1', referencePaths: [], threshold: 0.6, topN: 50 });
      const id2 = queue.addTask({ name: 'Task 2', folderPath: '/f2', referencePaths: [], threshold: 0.6, topN: 50 });
      const id3 = queue.addTask({ name: 'Task 3', folderPath: '/f3', referencePaths: [], threshold: 0.6, topN: 50 });

      queue.updateTaskStatus(id1, { status: 'completed' });
      queue.updateTaskStatus(id2, { status: 'cancelled' });
      // id3 remains pending

      const cleared = queue.clearCompleted();

      expect(cleared).toBe(2);
      expect(queue.getTask(id1)).toBeUndefined();
      expect(queue.getTask(id2)).toBeUndefined();
      expect(queue.getTask(id3)).toBeDefined();
    });
  });

  describe('pause/resume', () => {
    it('should pause queue processing', () => {
      queue.pause();

      const config = queue.getConfig();
      expect(config.isPaused).toBe(true);
    });

    it('should resume queue processing', () => {
      queue.pause();
      queue.resume();

      const config = queue.getConfig();
      expect(config.isPaused).toBe(false);
    });

    it('should emit queue:paused and queue:resumed events', () => {
      const pauseHandler = vi.fn();
      const resumeHandler = vi.fn();

      queue.on('queue:paused', pauseHandler);
      queue.on('queue:resumed', resumeHandler);

      queue.pause();
      queue.resume();

      expect(pauseHandler).toHaveBeenCalledTimes(1);
      expect(resumeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed with results', () => {
      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      const results = [{ path: '/result1.jpg', score: 0.85 }];
      queue.completeTask(taskId, results);

      const task = queue.getTask(taskId);
      expect(task?.status).toBe('completed');
      expect(task?.results).toEqual(results);
      expect(task?.completedAt).toBeDefined();
      expect(task?.duration).toBeDefined();
    });

    it('should emit task:completed event', () => {
      const eventHandler = vi.fn();
      queue.on('task:completed', eventHandler);

      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      queue.completeTask(taskId, []);

      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('failTask', () => {
    it('should mark task as failed with error', () => {
      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      queue.failTask(taskId, 'Test error message');

      const task = queue.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('Test error message');
      expect(task?.completedAt).toBeDefined();
    });

    it('should emit task:failed event', () => {
      const eventHandler = vi.fn();
      queue.on('task:failed', eventHandler);

      const taskId = queue.addTask({
        name: 'Test',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
      });

      queue.failTask(taskId, 'Error');

      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('setMaxConcurrent', () => {
    it('should update max concurrent tasks', () => {
      queue.setMaxConcurrent(5);

      const config = queue.getConfig();
      expect(config.maxConcurrent).toBe(5);
    });

    it('should emit config:changed event', () => {
      const eventHandler = vi.fn();
      queue.on('config:changed', eventHandler);

      queue.setMaxConcurrent(5);

      expect(eventHandler).toHaveBeenCalledWith({ maxConcurrent: 5 });
    });
  });
});
