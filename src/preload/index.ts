import { contextBridge, ipcRenderer } from 'electron';
import type { GrowthRecord, GrowthEvent, ScanSession, FamilyMember, SharedAlbum } from '../types/api';

contextBridge.exposeInMainWorld('api', {
  getAppInfo: () => ipcRenderer.invoke('app:about'),
  selectFiles: () => ipcRenderer.invoke('dialog:open-files'),
  selectFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  // 基础功能
  ping: () => ipcRenderer.invoke('ping'),
  scanFolder: (dir: string) => ipcRenderer.invoke('scan:folder', dir),
  embedReferences: (files: string[]) => ipcRenderer.invoke('embed:references', files),
  runScan: (dir: string) => ipcRenderer.invoke('embed:batch', dir),
  runMatch: (opts: { topN: number; threshold: number }) => ipcRenderer.invoke('match:run', opts),
  exportCopy: (files: string[], outDir: string) => ipcRenderer.invoke('export:copy', { files, outDir }),
  openFolder: (folderPath: string) => ipcRenderer.invoke('folder:open', folderPath),
  onScanProgress: (callback: (progress: { current: number; total: number; path: string }) => void) => {
    ipcRenderer.on('scan:progress', (_event, progress) => callback(progress));
  },
  removeScanProgressListener: () => {
    ipcRenderer.removeAllListeners('scan:progress');
  },
  clearEmbeddingCache: () => ipcRenderer.invoke('scan:clear-cache'),
  setPerformanceMode: (mode: 'default' | 'eco') => ipcRenderer.invoke('scan:performance-mode', mode),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  getModelStatus: () => ipcRenderer.invoke('model:status'),

  // 掃描控制
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  pauseScan: () => ipcRenderer.invoke('scan:pause'),
  resumeScan: () => ipcRenderer.invoke('scan:resume'),

  // 自動更新
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback: (status: { status: string; version?: string; progress?: number; error?: string }) => void) => {
    ipcRenderer.on('update:status', (_event, status) => callback(status));
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners('update:status');
  },

  // 照片质量评估
  assessPhotoQuality: (filePath: string) => ipcRenderer.invoke('assess:photo-quality', filePath),
  enhancePhoto: (filePath: string) => ipcRenderer.invoke('enhance:photo', filePath),

  // 成長記錄管理
  saveGrowthRecord: (record: GrowthRecord) => ipcRenderer.invoke('growth:save-record', record),
  getGrowthRecords: () => ipcRenderer.invoke('growth:get-records'),
  getGrowthRecord: (id: string) => ipcRenderer.invoke('growth:get-record', id),
  deleteGrowthRecord: (id: string) => ipcRenderer.invoke('growth:delete-record', id),
  addGrowthEvent: (recordId: string, event: GrowthEvent) => ipcRenderer.invoke('growth:add-event', recordId, event),

  // 扫描会话管理
  saveScanSession: (session: ScanSession) => ipcRenderer.invoke('growth:save-session', session),
  getScanSessions: () => ipcRenderer.invoke('growth:get-sessions'),

  // 提醒管理
  getReminders: () => ipcRenderer.invoke('growth:get-reminders'),
  markReminderRead: (id: string) => ipcRenderer.invoke('growth:mark-reminder-read', id),
  dismissReminder: (id: string) => ipcRenderer.invoke('growth:dismiss-reminder', id),
  checkReminders: () => ipcRenderer.invoke('growth:check-reminders'),

  // 家庭共享
  getFamilyMembers: () => ipcRenderer.invoke('growth:get-family-members'),
  addFamilyMember: (member: Omit<FamilyMember, 'id' | 'photosAdded' | 'lastActive'>) => ipcRenderer.invoke('growth:add-family-member', member),
  getSharedAlbums: () => ipcRenderer.invoke('growth:get-shared-albums'),
  createSharedAlbum: (album: Omit<SharedAlbum, 'id' | 'createdAt' | 'lastUpdated'>) => ipcRenderer.invoke('growth:create-shared-album', album),

  // GDPR 資料匯出
  exportAllData: () => ipcRenderer.invoke('data:export-all'),

  // 隱私設定
  clearOldSessions: (olderThanDays: number) => ipcRenderer.invoke('privacy:clear-old-sessions', olderThanDays),
});

export {};

