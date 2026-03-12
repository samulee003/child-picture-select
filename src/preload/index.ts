import { contextBridge, ipcRenderer } from 'electron';

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
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  getModelStatus: () => ipcRenderer.invoke('model:status'),

  // 照片质量评估
  assessPhotoQuality: (filePath: string) => ipcRenderer.invoke('assess:photo-quality', filePath),
  enhancePhoto: (filePath: string) => ipcRenderer.invoke('enhance:photo', filePath),

  // 成長記錄管理
  saveGrowthRecord: (record: any) => ipcRenderer.invoke('growth:save-record', record),
  getGrowthRecords: () => ipcRenderer.invoke('growth:get-records'),
  getGrowthRecord: (id: string) => ipcRenderer.invoke('growth:get-record', id),
  deleteGrowthRecord: (id: string) => ipcRenderer.invoke('growth:delete-record', id),
  addGrowthEvent: (recordId: string, event: any) => ipcRenderer.invoke('growth:add-event', recordId, event),

  // 扫描会话管理
  saveScanSession: (session: any) => ipcRenderer.invoke('growth:save-session', session),
  getScanSessions: () => ipcRenderer.invoke('growth:get-sessions'),

  // 提醒管理
  getReminders: () => ipcRenderer.invoke('growth:get-reminders'),
  markReminderRead: (id: string) => ipcRenderer.invoke('growth:mark-reminder-read', id),
  dismissReminder: (id: string) => ipcRenderer.invoke('growth:dismiss-reminder', id),
  checkReminders: () => ipcRenderer.invoke('growth:check-reminders'),

  // 家庭共享
  getFamilyMembers: () => ipcRenderer.invoke('growth:get-family-members'),
  addFamilyMember: (member: any) => ipcRenderer.invoke('growth:add-family-member', member),
  getSharedAlbums: () => ipcRenderer.invoke('growth:get-shared-albums'),
  createSharedAlbum: (album: any) => ipcRenderer.invoke('growth:create-shared-album', album),
});

export {};

