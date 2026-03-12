export interface Embedding {
  data: number[];
  length: number;
}

export interface MatchResult {
  path: string;
  score: number;
  thumbPath?: string;
}

export interface ScanProgressFaceAnalysis {
  confidence: number;
  age?: number;
  gender?: 'male' | 'female';
  faceCount: number;
}

export interface ScanProgress {
  current: number;
  total: number;
  path: string;
  thumbPath?: string | null;
  faceAnalysis?: ScanProgressFaceAnalysis | null;
  cancelled?: boolean;
}

export type UpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded' }
  | { status: 'error'; error: string };

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface EmbedReferencesResponse extends ApiResponse {
  data?: {
    count: number;
    faceDetected?: number;
    deterministicFallback?: number;
    warning?: string;
  };
}

export interface ScanFolderResponse extends ApiResponse {
  data?: { dir: string };
}

export interface RunScanResponse extends ApiResponse {
  data?: {
    scanned: number;
    processed?: number;
    cached?: number;
    faceDetected?: number;
    deterministicFallback?: number;
    thumbnailErrors?: number;
  };
}

export interface ExportCopyResponse extends ApiResponse {
  data?: {
    copied: number;
    failed?: number;
    failedPaths?: string[];
  };
}

export interface QualityMetrics {
  overallScore: number;
  sharpness: number;
  contrast: number;
  exposure: number;
  noise: number;
  resolution: number;
  faceClarity: number;
  recommendations: string[];
}

export interface EnhancePhotoResponse extends ApiResponse {
  data?: {
    originalPath: string;
    enhancedPath: string;
    enhancements: string[];
  };
}

export interface AppSettings {
  threshold: number;
  topN: number;
  lastReferencePaths: string[];
  lastFolder: string;
}

export interface ProcessingStatus {
  status: 'idle' | 'embedding-refs' | 'scanning' | 'matching' | 'done' | 'exporting';
  message: string;
  progress?: ScanProgress;
  refsLoaded?: number;
}

export interface ErrorInfo {
  message: string;
  code?: string;
  details?: any;
}

// 成長記錄相關類型
export interface GrowthEvent {
  id: string;
  type: 'milestone' | 'photo-collection' | 'scan-session';
  title: string;
  date: string; // ISO date string
  description?: string;
  photoPaths: string[];
  metadata?: Record<string, any>;
}

export interface GrowthRecord {
  id: string;
  childName: string;
  collectionName: string;
  totalPhotos: number;
  matchedPhotos: number;
  startDate: string; // ISO date string
  endDate?: string;
  events: GrowthEvent[];
  statistics: {
    monthsRecorded: number;
    avgPhotosPerMonth: number;
    bestMonth?: string;
    lastScanDate?: string;
  };
}

export interface ScanSession {
  id: string;
  folderPath: string;
  referencePaths: string[];
  threshold: number;
  topN: number;
  results: MatchResult[];
  createdAt: string; // ISO date string
  duration?: number; // ms
}

export interface Reminder {
  id: string;
  type: 'take_more_photos' | 'coverage_gap' | 'milestone_approaching';
  title: string;
  message: string;
  recommendedAction?: string;
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
  createdAt: string;
  remindAt?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'grandparent' | 'caregiver';
  photosAdded: number;
  lastActive: string;
  avatar?: string;
}

export interface SharedAlbum {
  id: string;
  name: string;
  description?: string;
  members: FamilyMember[];
  photoPaths: string[];
  createdAt: string;
  lastUpdated: string;
  settings: {
    canAddPhotos: boolean;
    canDelete: boolean;
    canExport: boolean;
  };
}

export interface GrowthApi {
  // 成長記錄管理
  saveGrowthRecord: (record: GrowthRecord) => Promise<ApiResponse<{ id: string }>>;
  getGrowthRecords: () => Promise<ApiResponse<{ records: GrowthRecord[] }>>;
  getGrowthRecord: (id: string) => Promise<ApiResponse<{ record: GrowthRecord }>>;
  deleteGrowthRecord: (id: string) => Promise<ApiResponse>;
  addGrowthEvent: (recordId: string, event: GrowthEvent) => Promise<ApiResponse>;
  
  // 扫描会话管理
  saveScanSession: (session: ScanSession) => Promise<ApiResponse<{ id: string }>>;
  getScanSessions: () => Promise<ApiResponse<{ sessions: ScanSession[] }>>;
  
  // 提醒管理
  getReminders: () => Promise<ApiResponse<{ reminders: Reminder[] }>>;
  markReminderRead: (id: string) => Promise<ApiResponse>;
  dismissReminder: (id: string) => Promise<ApiResponse>;
  checkReminders: () => Promise<ApiResponse<{ newReminders: Reminder[] }>>;
  
  // 家庭共享
  getFamilyMembers: () => Promise<ApiResponse<{ members: FamilyMember[] }>>;
  addFamilyMember: (member: Omit<FamilyMember, 'id' | 'photosAdded' | 'lastActive'>) => Promise<ApiResponse<{ member: FamilyMember }>>;
  getSharedAlbums: () => Promise<ApiResponse<{ albums: SharedAlbum[] }>>;
  createSharedAlbum: (album: Omit<SharedAlbum, 'id' | 'createdAt' | 'lastUpdated'>) => Promise<ApiResponse<{ album: SharedAlbum }>>;
}

export interface AppInfo {
  appName: string;
  version: string;
  supportEmail?: string;
  changelog?: string[];
}

export interface ElectronAPI extends GrowthApi {
  getAppInfo: () => Promise<AppInfo>;
  selectFiles: () => Promise<string[] | null>;
  selectFolder: () => Promise<string | null>;
  ping: () => Promise<string>;
  scanFolder: (dir: string) => Promise<ScanFolderResponse>;
  embedReferences: (files: string[]) => Promise<EmbedReferencesResponse>;
  runScan: (dir: string) => Promise<RunScanResponse>;
  runMatch: (opts: { topN: number; threshold: number }) => Promise<MatchResult[]>;
  exportCopy: (files: string[], outDir: string) => Promise<ExportCopyResponse>;
  openFolder: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;
  onScanProgress: (callback: (progress: ScanProgress) => void) => void;
  removeScanProgressListener: () => void;
  clearEmbeddingCache: () => Promise<{ ok: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
  getModelStatus: () => Promise<{ loaded: boolean; error: string | null }>;
  assessPhotoQuality: (filePath: string) => Promise<QualityMetrics>;
  enhancePhoto: (filePath: string) => Promise<EnhancePhotoResponse>;
  // 掃描控制
  cancelScan: () => Promise<{ ok: boolean }>;
  pauseScan: () => Promise<{ ok: boolean }>;
  resumeScan: () => Promise<{ ok: boolean }>;
  // 自動更新
  checkForUpdate: () => Promise<ApiResponse>;
  downloadUpdate: () => Promise<ApiResponse>;
  installUpdate: () => Promise<ApiResponse>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => void;
  removeUpdateListener: () => void;
}