/**
 * 成長紀錄管理器
 * 管理孩子的成長紀錄和照片歷史
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'node:crypto';
import os from 'os';
import { logger } from '../utils/logger';

import type {
  GrowthRecord,
  GrowthEvent,
  ScanSession,
  Reminder,
  FamilyMember,
  SharedAlbum,
} from '../types/api';

const resolvePaths = () => {
  const dataDir = (() => {
    const envDir = process.env.GROWTH_DATA_DIR;
    if (envDir) return envDir;
    try {
      if (app && typeof app.getPath === 'function') {
        return path.join(app.getPath('userData'), 'growth-data');
      }
    } catch {
      // 測試環境 fallback
    }
    return path.join(os.tmpdir(), 'find-my-kid-offline-growth-data');
  })();

  return {
    dataDir,
    recordsDir: path.join(dataDir, 'records'),
    sessionsDir: path.join(dataDir, 'sessions'),
    remindersFile: path.join(dataDir, 'reminders.json'),
    familyFile: path.join(dataDir, 'family.json'),
    albumsFile: path.join(dataDir, 'albums.json'),
  };
};

// 確保資料目錄存在
type GrowthPaths = ReturnType<typeof resolvePaths>;

/**
 * 成長記錄管理器類
 */
export class GrowthRecordManager {
  private paths: GrowthPaths = resolvePaths();

  constructor() {
    this.paths = resolvePaths();
    fs.ensureDirSync(this.paths.recordsDir);
    fs.ensureDirSync(this.paths.sessionsDir);
  }

  // ==================== 成長紀錄管理 ====================

  /**
   * 儲存成長紀錄
   */
  async saveGrowthRecord(record: GrowthRecord): Promise<{ id: string }> {
    const filePath = path.join(this.paths.recordsDir, `${record.id}.json`);
    await fs.writeJson(filePath, record, { spaces: 2 });
    return { id: record.id };
  }

  /**
   * 取得所有成長紀錄
   */
  async getGrowthRecords(): Promise<{ records: GrowthRecord[] }> {
    const files = await fs.readdir(this.paths.recordsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const records = (
      await Promise.all(
        jsonFiles.map(async file => {
          try {
            return await fs.readJson(path.join(this.paths.recordsDir, file));
          } catch (error) {
            logger.error('Failed to read growth record', { file, error: String(error) });
            return null;
          }
        })
      )
    ).filter((record): record is GrowthRecord => record !== null);

    // 按结束日期排序，最新的在前
    records.sort((a, b) => {
      const dateA = a.endDate ? new Date(a.endDate).getTime() : new Date(a.startDate).getTime();
      const dateB = b.endDate ? new Date(b.endDate).getTime() : new Date(b.startDate).getTime();
      return dateB - dateA;
    });

    return { records };
  }

  /**
   * 取得單筆成長紀錄
   */
  async getGrowthRecord(id: string): Promise<{ record: GrowthRecord }> {
    const filePath = path.join(this.paths.recordsDir, `${id}.json`);
    const record = await fs.readJson(filePath);
    return { record };
  }

  /**
   * 刪除成長紀錄
   */
  async deleteGrowthRecord(id: string): Promise<void> {
    const filePath = path.join(this.paths.recordsDir, `${id}.json`);
    await fs.remove(filePath);
  }

  /**
   * 新增成長事件
   */
  async addGrowthEvent(recordId: string, event: GrowthEvent): Promise<void> {
    const record = await this.getGrowthRecord(recordId);
    record.record.events.push(event);
    record.record.endDate = event.date;
    await this.saveGrowthRecord(record.record);
  }

  /**
   * 建立成長紀錄
   */
  createGrowthRecord(childName: string, collectionName: string): GrowthRecord {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      childName,
      collectionName,
      totalPhotos: 0,
      matchedPhotos: 0,
      startDate: now,
      events: [],
      statistics: {
        monthsRecorded: 0,
        avgPhotosPerMonth: 0,
      },
    };
  }

  // ==================== 扫描会话管理 ====================

  /**
   * 儲存掃描工作階段
   */
  async saveScanSession(session: ScanSession): Promise<{ id: string }> {
    const filePath = path.join(this.paths.sessionsDir, `${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
    return { id: session.id };
  }

  /**
   * 取得所有掃描工作階段
   */
  async getScanSessions(): Promise<{ sessions: ScanSession[] }> {
    const files = await fs.readdir(this.paths.sessionsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const sessions = (
      await Promise.all(
        jsonFiles.map(async file => {
          try {
            return await fs.readJson(path.join(this.paths.sessionsDir, file));
          } catch (error) {
            logger.error('Failed to read scan session', { file, error: String(error) });
            return null;
          }
        })
      )
    ).filter((session): session is ScanSession => session !== null);

    // 依建立日期排序，最新的在前
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { sessions };
  }

  /**
   * 刪除單筆掃描工作階段
   */
  async deleteScanSession(id: string): Promise<void> {
    const filePath = path.join(this.paths.sessionsDir, `${id}.json`);
    await fs.remove(filePath);
  }

  // ==================== 提醒管理 ====================

  /**
   * 取得所有提醒
   */
  async getReminders(): Promise<{ reminders: Reminder[] }> {
    try {
      const data = await fs.readJson(this.paths.remindersFile);
      return { reminders: data.reminders || [] };
    } catch {
      return { reminders: [] };
    }
  }

  /**
   * 標記提醒為已讀
   */
  async markReminderRead(id: string): Promise<void> {
    const { reminders } = await this.getReminders();
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
      reminder.isRead = true;
      await fs.writeJson(this.paths.remindersFile, { reminders }, { spaces: 2 });
    }
  }

  /**
   * 刪除提醒
   */
  async dismissReminder(id: string): Promise<void> {
    const { reminders } = await this.getReminders();
    const filtered = reminders.filter(r => r.id !== id);
    await fs.writeJson(this.paths.remindersFile, { reminders: filtered }, { spaces: 2 });
  }

  /**
   * 檢查並生成新提醒
   */
  async checkReminders(): Promise<{ newReminders: Reminder[] }> {
    const { reminders: existingReminders } = await this.getReminders();
    const { sessions } = await this.getScanSessions();
    const newReminders: Reminder[] = [];

    // 檢查長時間未掃描
    if (sessions.length > 0) {
      const lastSession = sessions[0];
      const daysSinceLastScan = Math.floor(
        (Date.now() - new Date(lastSession.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (
        daysSinceLastScan > 30 &&
        !existingReminders.some(r => r.type === 'coverage_gap' && !r.isRead)
      ) {
        const newReminder: Reminder = {
          id: randomUUID(),
          type: 'coverage_gap',
          title: '間隔提醒',
          message: `距離上次記錄已 ${daysSinceLastScan} 天，孩子又長大了！`,
          recommendedAction: '建議多拍幾張日常照片來記錄成長',
          priority: daysSinceLastScan > 60 ? 'high' : 'medium',
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        newReminders.push(newReminder);
      }
    }

    // 儲存新提醒
    if (newReminders.length > 0) {
      await fs.writeJson(
        this.paths.remindersFile,
        { reminders: [...existingReminders, ...newReminders] },
        { spaces: 2 }
      );
    }

    return { newReminders };
  }

  // ==================== 家庭成员管理 ====================

  /**
   * 取得家庭成員
   */
  async getFamilyMembers(): Promise<{ members: FamilyMember[] }> {
    try {
      const data = await fs.readJson(this.paths.familyFile);
      return { members: data.members || [] };
    } catch {
      return { members: [] };
    }
  }

  /**
   * 添加家庭成员
   */
  async addFamilyMember(
    member: Omit<FamilyMember, 'id' | 'photosAdded' | 'lastActive'>
  ): Promise<{ member: FamilyMember }> {
    const { members } = await this.getFamilyMembers();
    const newMember: FamilyMember = {
      ...member,
      id: randomUUID(),
      photosAdded: 0,
      lastActive: new Date().toISOString(),
    };
    members.push(newMember);
    await fs.writeJson(this.paths.familyFile, { members }, { spaces: 2 });
    return { member: newMember };
  }

  // ==================== 共享相册管理 ====================

  /**
   * 取得共享相簿
   */
  async getSharedAlbums(): Promise<{ albums: SharedAlbum[] }> {
    try {
      const data = await fs.readJson(this.paths.albumsFile);
      return { albums: data.albums || [] };
    } catch {
      return { albums: [] };
    }
  }

  /**
   * 建立共享相簿
   */
  async createSharedAlbum(
    album: Omit<SharedAlbum, 'id' | 'createdAt' | 'lastUpdated'>
  ): Promise<{ album: SharedAlbum }> {
    const { albums } = await this.getSharedAlbums();
    const now = new Date().toISOString();
    const newAlbum: SharedAlbum = {
      ...album,
      id: randomUUID(),
      createdAt: now,
      lastUpdated: now,
    };
    albums.push(newAlbum);
    await fs.writeJson(this.paths.albumsFile, { albums }, { spaces: 2 });
    return { album: newAlbum };
  }

  /**
   * 將掃描工作階段更新到成長紀錄
   */
  async updateRecordFromSession(recordId: string, session: ScanSession): Promise<void> {
    try {
      const record = await this.getGrowthRecord(recordId);

      record.record.totalPhotos += session.results.length;
      record.record.matchedPhotos += session.results.filter(
        r => r.score >= session.threshold
      ).length;
      record.record.endDate = session.createdAt;

      // 添加事件
      const event: GrowthEvent = {
        id: randomUUID(),
        type: 'scan-session',
        title: `扫描会话 - ${path.basename(session.folderPath)}`,
        date: session.createdAt,
        description: `找到 ${session.results.length} 张匹配照片`,
        photoPaths: session.results.map(r => r.path),
        metadata: {
          sessionId: session.id,
          threshold: session.threshold,
          topN: session.topN,
        },
      };
      record.record.events.push(event);

      // 更新統計
      const startDate = new Date(record.record.startDate);
      const endDate = new Date(record.record.endDate);
      const monthsRecorded = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      record.record.statistics = {
        monthsRecorded: Math.max(1, monthsRecorded),
        avgPhotosPerMonth: Math.round(record.record.matchedPhotos / Math.max(1, monthsRecorded)),
        lastScanDate: session.createdAt,
      };

      await this.saveGrowthRecord(record.record);
    } catch (error) {
      logger.error('Failed to update record from session', { error: String(error) });
    }
  }
}

// 延遲初始化全域實例，避免在 app ready 前呼叫 app.getPath()
let _growthRecordManager: GrowthRecordManager | null = null;
export function getGrowthRecordManager(): GrowthRecordManager {
  if (!_growthRecordManager) {
    _growthRecordManager = new GrowthRecordManager();
  }
  return _growthRecordManager;
}
