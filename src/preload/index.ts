import { contextBridge, ipcRenderer } from 'electron';
import type {
  GrowthRecord,
  GrowthEvent,
  ScanSession,
  FamilyMember,
  SharedAlbum,
  ScanProgress,
  UpdateStatus,
} from '../types/api';

type ScanProgressCallback = (progress: ScanProgress) => void;
type UpdateStatusCallback = (status: UpdateStatus) => void;

const scanProgressCallbacks = new Set<ScanProgressCallback>();
const updateStatusCallbacks = new Set<UpdateStatusCallback>();

function handleScanProgress(_event: Electron.IpcRendererEvent, progress: unknown): void {
  scanProgressCallbacks.forEach(cb => {
    try {
      cb(progress as Parameters<ScanProgressCallback>[0]);
    } catch (err) {
      console.error('[preload] scan:progress callback error:', err);
    }
  });
}

function handleUpdateStatus(_event: Electron.IpcRendererEvent, status: unknown): void {
  updateStatusCallbacks.forEach(cb => {
    try {
      cb(status as Parameters<UpdateStatusCallback>[0]);
    } catch (err) {
      console.error('[preload] update:status callback error:', err);
    }
  });
}

ipcRenderer.on('scan:progress', handleScanProgress);
ipcRenderer.on('update:status', handleUpdateStatus);

contextBridge.exposeInMainWorld('api', {
  getAppInfo: () => ipcRenderer.invoke('app:about'),
  selectFiles: () => ipcRenderer.invoke('dialog:open-files'),
  selectFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  ping: () => ipcRenderer.invoke('ping'),
  scanFolder: (dir: string) => ipcRenderer.invoke('scan:folder', dir),
  embedReferences: (files: string[]) => ipcRenderer.invoke('embed:references', files),
  runScan: (dir: string) => ipcRenderer.invoke('embed:batch', dir),
  runMatch: (opts: {
    topN: number;
    threshold: number;
    strategy?: 'best' | 'average' | 'weighted' | 'centroid';
  }) => ipcRenderer.invoke('match:run', opts),
  exportCopy: (files: string[], outDir: string) =>
    ipcRenderer.invoke('export:copy', { files, outDir }),
  openFolder: (folderPath: string) => ipcRenderer.invoke('folder:open', folderPath),

  onScanProgress: (callback: ScanProgressCallback): (() => void) => {
    scanProgressCallbacks.add(callback);
    return () => {
      scanProgressCallbacks.delete(callback);
    };
  },

  removeScanProgressListener: (): void => {
    scanProgressCallbacks.clear();
  },

  clearEmbeddingCache: () => ipcRenderer.invoke('scan:clear-cache'),
  setPerformanceMode: (mode: 'default' | 'eco') =>
    ipcRenderer.invoke('scan:performance-mode', mode),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  getModelStatus: () => ipcRenderer.invoke('model:status'),

  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  pauseScan: () => ipcRenderer.invoke('scan:pause'),
  resumeScan: () => ipcRenderer.invoke('scan:resume'),

  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),

  onUpdateStatus: (callback: UpdateStatusCallback): (() => void) => {
    updateStatusCallbacks.add(callback);
    return () => {
      updateStatusCallbacks.delete(callback);
    };
  },

  removeUpdateListener: (): void => {
    updateStatusCallbacks.clear();
  },

  assessPhotoQuality: (filePath: string) => ipcRenderer.invoke('assess:photo-quality', filePath),
  enhancePhoto: (filePath: string) => ipcRenderer.invoke('enhance:photo', filePath),

  saveGrowthRecord: (record: GrowthRecord) => ipcRenderer.invoke('growth:save-record', record),
  getGrowthRecords: () => ipcRenderer.invoke('growth:get-records'),
  getGrowthRecord: (id: string) => ipcRenderer.invoke('growth:get-record', id),
  deleteGrowthRecord: (id: string) => ipcRenderer.invoke('growth:delete-record', id),
  addGrowthEvent: (recordId: string, event: GrowthEvent) =>
    ipcRenderer.invoke('growth:add-event', recordId, event),

  saveScanSession: (session: ScanSession) => ipcRenderer.invoke('growth:save-session', session),
  getScanSessions: () => ipcRenderer.invoke('growth:get-sessions'),

  getReminders: () => ipcRenderer.invoke('growth:get-reminders'),
  markReminderRead: (id: string) => ipcRenderer.invoke('growth:mark-reminder-read', id),
  dismissReminder: (id: string) => ipcRenderer.invoke('growth:dismiss-reminder', id),
  checkReminders: () => ipcRenderer.invoke('growth:check-reminders'),

  getFamilyMembers: () => ipcRenderer.invoke('growth:get-family-members'),
  addFamilyMember: (member: Omit<FamilyMember, 'id' | 'photosAdded' | 'lastActive'>) =>
    ipcRenderer.invoke('growth:add-family-member', member),
  getSharedAlbums: () => ipcRenderer.invoke('growth:get-shared-albums'),
  createSharedAlbum: (album: Omit<SharedAlbum, 'id' | 'createdAt' | 'lastUpdated'>) =>
    ipcRenderer.invoke('growth:create-shared-album', album),

  exportAllData: () => ipcRenderer.invoke('data:export-all'),
  clearOldSessions: (olderThanDays: number) =>
    ipcRenderer.invoke('privacy:clear-old-sessions', olderThanDays),

  getDiagnosticsInfo: () => ipcRenderer.invoke('diagnostics:get-info'),
  getLogTail: (lines?: number) => ipcRenderer.invoke('diagnostics:get-log-tail', lines),
});

export {};
