/**
 * 成長紀錄管理器測試
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrowthRecordManager } from '../../../src/main/growthRecordManager';
import type { GrowthRecord, GrowthEvent, ScanSession, Reminder } from '../../../src/types/api';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const TEST_DATA_ROOT = path.join(os.tmpdir(), 'find-my-kid-offline-tests', 'growth-data');

const getRemindersFile = () => path.join(TEST_DATA_ROOT, 'reminders.json');

describe('GrowthRecordManager', () => {
  let manager: GrowthRecordManager;

  beforeEach(() => {
    process.env.GROWTH_DATA_DIR = TEST_DATA_ROOT;
    fs.emptyDirSync(TEST_DATA_ROOT);
    manager = new GrowthRecordManager();
  });

  afterEach(() => {
    fs.removeSync(TEST_DATA_ROOT);
  });

  describe('createGrowthRecord', () => {
    it('should create a new growth record with correct initial values', () => {
      const record = manager.createGrowthRecord('小明', '幼儿园小班');

      expect(record.childName).toBe('小明');
      expect(record.collectionName).toBe('幼儿园小班');
      expect(record.totalPhotos).toBe(0);
      expect(record.matchedPhotos).toBe(0);
      expect(record.events).toEqual([]);
      expect(record.statistics.monthsRecorded).toBe(0);
      expect(record.statistics.avgPhotosPerMonth).toBe(0);
    });

    it('should generate a valid UUID for record id', () => {
      const record = manager.createGrowthRecord('小明', 'Test');
      
      // UUID v4 format check
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(record.id).toMatch(uuidRegex);
    });
  });

  describe('addGrowthEvent', () => {
    it('should add event to record and update endDate', async () => {
      const record = manager.createGrowthRecord('小明', 'Test');
      await manager.saveGrowthRecord(record);

      const event: GrowthEvent = {
        id: 'event-1',
        type: 'milestone',
        title: '第一次走路',
        date: new Date().toISOString(),
        photoPaths: ['/path/to/photo1.jpg'],
      };

      await manager.addGrowthEvent(record.id, event);

      const updated = await manager.getGrowthRecord(record.id);
      expect(updated.record.events).toHaveLength(1);
      expect(updated.record.events[0].title).toBe('第一次走路');
      expect(updated.record.endDate).toBeDefined();
    });
  });

  describe('saveScanSession', () => {
    it('should save and retrieve scan session', async () => {
      const session: ScanSession = {
        id: 'session-1',
        folderPath: '/test/folder',
        referencePaths: ['/ref1.jpg', '/ref2.jpg'],
        threshold: 0.6,
        topN: 50,
        results: [
          { path: '/result1.jpg', score: 0.85 },
          { path: '/result2.jpg', score: 0.72 },
        ],
        createdAt: new Date().toISOString(),
        duration: 1500,
      };

      await manager.saveScanSession(session);

      const { sessions } = await manager.getScanSessions();
      const saved = sessions.find(s => s.id === 'session-1');
      
      expect(saved).toBeDefined();
      expect(saved?.folderPath).toBe('/test/folder');
      expect(saved?.results).toHaveLength(2);
    });

    it('should sort sessions by createdAt descending', async () => {
      const session1: ScanSession = {
        id: 'session-1',
        folderPath: '/folder1',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
        results: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const session2: ScanSession = {
        id: 'session-2',
        folderPath: '/folder2',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
        results: [],
        createdAt: '2024-02-01T00:00:00.000Z',
      };

      await manager.saveScanSession(session1);
      await manager.saveScanSession(session2);

      const { sessions } = await manager.getScanSessions();
      
      expect(sessions[0].id).toBe('session-2');
      expect(sessions[1].id).toBe('session-1');
    });
  });

  describe('reminder management', () => {
    it('should get empty reminders initially', async () => {
      const { reminders } = await manager.getReminders();
      expect(reminders).toEqual([]);
    });

    it('should mark reminder as read', async () => {
      const reminder: Reminder = {
        id: 'reminder-1',
        type: 'coverage_gap',
        title: 'Test Reminder',
        message: 'Test message',
        priority: 'medium',
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      // 直接寫入測試資料
      const remindersFile = getRemindersFile();
      
      await fs.writeJson(remindersFile, { reminders: [reminder] });

      await manager.markReminderRead('reminder-1');

      const { reminders } = await manager.getReminders();
      expect(reminders.find(r => r.id === 'reminder-1')?.isRead).toBe(true);
    });

    it('should dismiss reminder', async () => {
      const remindersFile = getRemindersFile();
      
      await fs.writeJson(remindersFile, { 
        reminders: [
          { id: 'r1', isRead: false },
          { id: 'r2', isRead: false },
        ] 
      });

      await manager.dismissReminder('r1');

      const { reminders } = await manager.getReminders();
      expect(reminders).toHaveLength(1);
      expect(reminders[0].id).toBe('r2');
    });
  });

  describe('checkReminders', () => {
    it('should generate coverage_gap reminder when no scan for 30+ days', async () => {
      const oldSession: ScanSession = {
        id: 'old-session',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
        results: [],
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days ago
      };

      await manager.saveScanSession(oldSession);

      const { newReminders } = await manager.checkReminders();
      
      expect(newReminders).toHaveLength(1);
      expect(newReminders[0].type).toBe('coverage_gap');
      expect(newReminders[0].priority).toBe('medium');
    });

    it('should generate high priority reminder when no scan for 60+ days', async () => {
      const oldSession: ScanSession = {
        id: 'old-session',
        folderPath: '/test',
        referencePaths: [],
        threshold: 0.6,
        topN: 50,
        results: [],
        createdAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(), // 65 days ago
      };

      await manager.saveScanSession(oldSession);

      const { newReminders } = await manager.checkReminders();
      
      expect(newReminders).toHaveLength(1);
      expect(newReminders[0].priority).toBe('high');
    });
  });

  describe('family member management', () => {
    it('should get empty family members initially', async () => {
      const { members } = await manager.getFamilyMembers();
      expect(members).toEqual([]);
    });

    it('should add family member with generated id', async () => {
      const { member } = await manager.addFamilyMember({
        name: '爸爸',
        role: 'parent',
        avatar: '/avatar/dad.png',
      });

      expect(member.id).toBeDefined();
      expect(member.name).toBe('爸爸');
      expect(member.role).toBe('parent');
      expect(member.photosAdded).toBe(0);
      expect(member.lastActive).toBeDefined();
    });
  });

  describe('shared album management', () => {
    it('should get empty albums initially', async () => {
      const { albums } = await manager.getSharedAlbums();
      expect(albums).toEqual([]);
    });

    it('should create shared album with timestamps', async () => {
      const { album } = await manager.createSharedAlbum({
        name: '小明的成長',
        description: '記錄小明的成長歷程',
        members: [],
        photoPaths: [],
        settings: {
          canAddPhotos: true,
          canDelete: false,
          canExport: true,
        },
      });

      expect(album.id).toBeDefined();
      expect(album.name).toBe('小明的成長');
      expect(album.createdAt).toBeDefined();
      expect(album.lastUpdated).toBeDefined();
    });
  });
});
