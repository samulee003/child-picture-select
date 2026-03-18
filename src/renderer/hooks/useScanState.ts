import { useState, useEffect, useCallback, useRef } from 'react';
import type { MatchResult, ScanProgress, AppSettings, AppInfo } from '../../types/api';

export type MultiRefStrategy = 'best' | 'average' | 'weighted';

export interface RefFileResult {
  path: string;
  source: 'face' | 'deterministic';
  faceAnalysis?: { confidence: number; age?: number; gender?: 'male' | 'female'; faceCount: number };
}

export interface ScanState {
  folder: string;
  setFolder: (folder: string) => void;
  refPaths: string;
  setRefPaths: React.Dispatch<React.SetStateAction<string>>;
  refsLoaded: number;
  setRefsLoaded: (n: number) => void;
  refQualityResults: RefFileResult[];
  threshold: number;
  setThreshold: (n: number) => void;
  topN: number;
  results: MatchResult[];
  setResults: React.Dispatch<React.SetStateAction<MatchResult[]>>;
  status: string;
  setStatus: (s: string) => void;
  progress: ScanProgress | null;
  setProgress: (p: ScanProgress | null) => void;
  error: string | null;
  setError: (e: string | null) => void;
  modelStatus: { loaded: boolean; error: string | null } | null;
  settings: AppSettings;
  appInfo: AppInfo | null;
  lastRunSummary: { scanned: number; matched: number; elapsedMs: number } | null;
  scanWarnings: string[];
  isProcessing: boolean;
  hasLastRunConfig: boolean;
  lastFolderDisplay: string;
  scanStartTimeRef: React.MutableRefObject<number | undefined>;
  refPathsTextareaRef: React.RefObject<HTMLTextAreaElement>;

  enhancingPath: string | null;
  multiRefStrategy: MultiRefStrategy;
  setMultiRefStrategy: (s: MultiRefStrategy) => void;

  // Callbacks
  handleRefFilesDrop: (files: string[]) => void;
  handleFolderDrop: (folderPath: string) => void;
  handleBrowseFiles: () => Promise<void>;
  handleBrowseFolder: () => Promise<void>;
  handleEmbedRefs: () => Promise<void>;
  handleRunScan: () => Promise<void>;
  handleClear: () => void;
  handleLoadLastSettings: () => void;
  handleClearCacheAndRescan: () => Promise<void>;
  lowerThresholdForRetry: () => boolean;
  handleNoMatchLowerThresholdAndRerun: () => void;
  handleNoMatchAddReference: () => void;
  handleNoMatchSwitchPendingView: () => void;
  handleEnhanceRefPhoto: (path: string) => Promise<void>;

  // Helpers
  getThresholdGuide: () => { label: string; desc: string; color: string };
  getStatusText: () => string;
  getStatusType: () => 'idle' | 'processing' | 'success' | 'warning' | 'error';
  formatElapsed: (ms: number) => string;
  getBestScoreText: () => string;

  // Onboarding
  onboardingChecklist: { hasRefs: boolean; hasFolder: boolean; modelLoaded: boolean | null };

}

export function useScanState(): ScanState {
  const [folder, setFolder] = useState<string>('');
  const [refPaths, setRefPaths] = useState<string>('');
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; error: string | null } | null>(null);
  const [threshold, setThreshold] = useState<number>(0.6);
  const [topN, setTopN] = useState<number>(50);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refsLoaded, setRefsLoaded] = useState<number>(0);
  const [settings, setSettings] = useState<AppSettings>({
    threshold: 0.6,
    topN: 50,
    lastReferencePaths: [],
    lastFolder: ''
  });
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [lastRunSummary, setLastRunSummary] = useState<{
    scanned: number;
    matched: number;
    elapsedMs: number;
  } | null>(null);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [refQualityResults, setRefQualityResults] = useState<RefFileResult[]>([]);
  const [enhancingPath, setEnhancingPath] = useState<string | null>(null);
  const [multiRefStrategy, setMultiRefStrategy] = useState<MultiRefStrategy>('best');
  const scanStartTimeRef = useRef<number>();
  const refPathsTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isProcessing = status.includes('ing...');
  const hasLastRunConfig = settings.lastFolder.trim().length > 0 && settings.lastReferencePaths.length > 0;
  const lastFolderDisplay = settings.lastFolder ? settings.lastFolder.split(/[/\\]/).pop() || '' : '';

  const onboardingChecklist = {
    hasRefs: refsLoaded > 0 || refPaths.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).length >= 3,
    hasFolder: folder.trim().length > 0,
    modelLoaded: modelStatus ? modelStatus.loaded : null,
  };

  // Load settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        setThreshold(parsed.threshold || 0.6);
        setTopN(parsed.topN || 50);
        // 啟動時維持空白，避免剛安裝/重新安裝直接帶入舊資料夾與舊參考照
      } catch {
        // non-critical: start with defaults
      }
    }
  }, []);

  // App info
  useEffect(() => {
    if (!window.api) return;
    window.api.getAppInfo().then((info: AppInfo) => {
      setAppInfo(info);
    }).catch(() => {
      setAppInfo({ appName: '大海撈Ｂ', version: '獲取中...' });
    });
  }, []);

  // AI model status polling
  useEffect(() => {
    if (!window.api?.getModelStatus) return;
    let cancelled = false;

    const checkStatus = () => {
      window.api?.getModelStatus().then((s: { loaded: boolean; error: string | null }) => {
        if (cancelled) return;
        setModelStatus(s);
        if (!s.loaded && !s.error) {
          setTimeout(checkStatus, 2000);
        }
      }).catch(() => {});
    };
    checkStatus();

    return () => { cancelled = true; };
  }, [refsLoaded]);

  // Performance mode
  useEffect(() => {
    if (!window.api?.setPerformanceMode) return;
    window.api.setPerformanceMode('default').catch(() => {});
  }, []);

  // Save settings when they change
  useEffect(() => {
    const newSettings = {
      ...settings,
      threshold,
      topN,
      lastReferencePaths: refPaths.split('\n').filter(p => p.trim()),
      lastFolder: folder
    };
    setSettings(newSettings);
    localStorage.setItem('app-settings', JSON.stringify(newSettings));
  }, [threshold, topN, refPaths, folder]);

  // Setup progress listener
  useEffect(() => {
    if (!window.api) return;
    const api = window.api as any;
    api.onScanProgress((prog: ScanProgress) => {
      setProgress(prog);
    });
    return () => {
      api.removeScanProgressListener();
    };
  }, []);

  // Helpers
  const formatElapsed = (ms: number) => {
    const seconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    if (minutes > 0) return `${minutes}分${remain}秒`;
    return `${remain}秒`;
  };

  const getThresholdGuide = () => {
    if (threshold >= 0.75) return { label: '精確', desc: '只留最像的，容易漏掉側臉或模糊照', color: '#ef4444' };
    if (threshold >= 0.6) return { label: '平衡', desc: '精準度與找齊度兼顧，推薦大多數情況使用', color: '#f59e0b' };
    if (threshold >= 0.45) return { label: '寬鬆', desc: '多找一些候選照片，建議搭配人工複核', color: '#3b82f6' };
    return { label: '最寬', desc: '盡量不漏掉，但會混入較多不相關照片', color: '#10b981' };
  };

  const getBestScoreText = () => {
    if (!results.length) return '';
    const best = Math.max(...results.map(r => r.score));
    return `${(best * 100).toFixed(1)}%`;
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return '就緒';
      case 'embedding refs...': return '載入參考照片中...';
      case 'refs ready': return `已載入 ${refsLoaded} 張參考照片`;
      case 'scanning...': return '掃描照片中...';
      case 'matching...': return '比對中...';
      case 'done': return '完成';
      case 'exporting...': return '匯出中...';
      default: return status;
    }
  };

  const getStatusType = (): 'idle' | 'processing' | 'success' | 'warning' | 'error' => {
    if (status === 'idle') return 'idle';
    if (status.includes('ing...')) return 'processing';
    if (status.includes('ready') || status.includes('done') || status.includes('exported')) return 'success';
    return 'idle';
  };

  // Callbacks
  const handleRefFilesDrop = useCallback((files: string[]) => {
    const imageFiles = files.filter(file =>
      /\.(jpg|jpeg|png|gif|bmp|webp|heic|heif)$/i.test(file)
    );
    if (imageFiles.length > 0) {
      const currentPaths = refPaths.split('\n').filter(p => p.trim());
      const newPaths = [...new Set([...currentPaths, ...imageFiles])];
      setRefPaths(newPaths.join('\n'));
      setRefsLoaded(0);
      setRefQualityResults([]);
      setStatus('idle');
      setError(null);
    }
  }, [refPaths]);

  const handleFolderDrop = useCallback((folderPath: string) => {
    setFolder(folderPath);
  }, []);

  const handleBrowseFiles = async () => {
    if (!window.api?.selectFiles) return;
    const files = await window.api.selectFiles();
    if (files && files.length > 0) {
      const next = Array.from(new Set(files.map(f => f.trim()).filter(Boolean)));
      setRefPaths(next.join('\n'));
      setRefsLoaded(0);
      setRefQualityResults([]);
      setStatus('idle');
      setError(null);
    }
  };

  const handleBrowseFolder = async () => {
    if (!window.api?.selectFolder) return;
    const selectedFolder = await window.api.selectFolder();
    if (selectedFolder) {
      setFolder(selectedFolder);
    }
  };

  const handleEmbedRefs = useCallback(async () => {
    const files = refPaths.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (files.length === 0) {
      setError('請至少提供一張參考照片');
      return;
    }
    setError(null);
    setStatus('embedding refs...');
    if (!window.api) {
      setError('API 未初始化');
      return;
    }
    try {
      const api = window.api;
      if (!api) {
        setError('API 未初始化');
        setStatus('idle');
        return;
      }
      const result = await api.embedReferences(files);
      if (!result.ok) {
        setError(`嵌入參考照片失敗: ${(result as any).error || '未知錯誤'}`);
        setStatus('idle');
        return;
      }
      setRefsLoaded(result.data?.count || files.length);

      // Store per-file face detection results for quality feedback
      const resData = result.data as any;
      if (resData?.perFileResults) {
        setRefQualityResults(resData.perFileResults as RefFileResult[]);
      }

      const faceDetected = result.data?.faceDetected ?? 0;
      const deterministicFallback = result.data?.deterministicFallback ?? 0;
      const warning = result.data?.warning;

      if (warning) {
        setError(`⚠️ ${warning}`);
      } else if (faceDetected > 0) {
        setError(`✅ ${faceDetected} 張照片成功偵測到人臉` + (deterministicFallback > 0 ? `，${deterministicFallback} 張未偵測到` : ''));
      }

      setStatus('refs ready');
    } catch (err: any) {
      setError(`錯誤: ${err?.message || '未知錯誤'}`);
      setStatus('idle');
    }
  }, [refPaths]);

  const handleRunScan = useCallback(async () => {
    if (!folder || folder.trim() === '') {
      setError('請提供照片資料夾路徑');
      return;
    }
    if (!window.api) {
      setError('API 未初始化');
      return;
    }

    const api = window.api;
    const files = refPaths.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (refsLoaded === 0) {
      if (files.length === 0) {
        setError('請至少提供一張參考照片');
        return;
      }
      setError(null);
      setStatus('embedding refs...');
      try {
        const embedResult = await api.embedReferences(files);
        if (!embedResult.ok) {
          setError(`載入參考照片失敗: ${(embedResult as any).error || '未知錯誤'}`);
          setStatus('idle');
          return;
        }
        setRefsLoaded(embedResult.data?.count || files.length);
        const perFileResults = (embedResult.data as any)?.perFileResults;
        if (Array.isArray(perFileResults)) {
          setRefQualityResults(perFileResults as RefFileResult[]);
        }
        const warning = embedResult.data?.warning;
        if (warning) {
          setError(`⚠️ ${warning}`);
        }
      } catch (err: any) {
        setError(`載入參考照片錯誤: ${err?.message || '未知錯誤'}`);
        setStatus('idle');
        return;
      }
    }

    setError(null);
    setStatus('scanning...');
    setProgress(null);
    setLastRunSummary(null);
    setScanWarnings([]);
    scanStartTimeRef.current = Date.now();

    try {
      const scanResult = await api.runScan(folder);
      if (!scanResult.ok) {
        setError(`掃描失敗: ${scanResult.error || '未知錯誤'}`);
        setStatus('idle');
        setProgress(null);
        return;
      }

      const scanData = scanResult.data;
      if (Array.isArray(scanData?.warnings) && scanData.warnings.length > 0) {
        setScanWarnings(scanData.warnings);
      }

      if (scanData?.cancelled) {
        setStatus('idle');
        setProgress(null);
        setError(`掃描已取消（已完成 ${scanData?.scanned || 0} 張）`);
        return;
      }


      setStatus('matching...');
      setProgress(null);

      const matchResponse = await api.runMatch({ topN, threshold, strategy: multiRefStrategy });
      const matched = matchResponse.results;
      const initialReviewScores = matched.reduce<Record<string, number>>((acc, item) => {
        acc[item.path] = Math.round(item.score * 100);
        return acc;
      }, {});
      const elapsedMs = scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0;
      const scannedCount = typeof scanData?.scanned === 'number' ? scanData.scanned : 0;
      setLastRunSummary({ scanned: scannedCount, matched: matched.length, elapsedMs });
      setResults(matched);

      setStatus('done');
      if (matched.length === 0) {
        const faceDetected = scanData?.faceDetected ?? 0;
        if (faceDetected === 0 && scannedCount > 0) {
          setError('⚠️ 這次掃描中尚未偵測到可用人臉，已用保守模式完成比對；建議改用更清晰正面照片、增加參考照，或降低門檻後再試一次。');
        } else {
          setError('未找到匹配的照片，請嘗試降低門檻值或增加參考照片數量');
        }
      }
      if (scanData?.skippedErrors && scanData.skippedErrors > 0) {
        setScanWarnings((prev) => {
          const warning = `已略過 ${scanData.skippedErrors} 張處理失敗照片，建議先看掃描摘要中的提醒後再重試。`;
          return prev.includes(warning) ? prev : [...prev, warning];
        });
      }
    } catch (err: any) {
      setError(`錯誤: ${err?.message || '未知錯誤'}`);
      setStatus('idle');
      setProgress(null);
      scanStartTimeRef.current = undefined;
    }
  }, [folder, threshold, topN, refsLoaded, refPaths, multiRefStrategy]);

  const handleClear = useCallback(() => {
    setResults([]);
    setError(null);
    setLastRunSummary(null);
    setScanWarnings([]);
  }, []);

  const handleLoadLastSettings = useCallback(() => {
    if (!settings.lastFolder && settings.lastReferencePaths.length === 0) {
      setError('目前沒有可用的上次設定');
      return;
    }
    if (settings.lastFolder) {
      setFolder(settings.lastFolder);
    }
    if (settings.lastReferencePaths.length > 0) {
      setRefPaths(settings.lastReferencePaths.join('\n'));
      setRefsLoaded(0);
      setStatus('idle');
      setError('已載入上次設定，請點「重新載入參考照片」');
    }
  }, [settings.lastFolder, settings.lastReferencePaths]);

  const lowerThresholdForRetry = useCallback((): boolean => {
    const next = Math.max(0, parseFloat((threshold - 0.08).toFixed(2)));
    if (next === threshold) {
      setError('門檻已經是最低值，建議增加參考照片再重新掃描');
      return false;
    }
    setThreshold(next);
    setError('我幫你把門檻值放寬一點，先用新結果複核低信心照片');
    return true;
  }, [threshold]);

  const handleNoMatchLowerThresholdAndRerun = useCallback(() => {
    const changed = lowerThresholdForRetry();
    if (!changed) return;
    setTimeout(() => {
      if (folder && refsLoaded > 0) {
        handleRunScan();
      }
    }, 0);
  }, [folder, refsLoaded, handleRunScan, lowerThresholdForRetry]);

  const handleClearCacheAndRescan = useCallback(async () => {
    if (isProcessing || !window.api) return;
    setError(null);
    setStatus('scanning...');
    try {
      await window.api.clearEmbeddingCache();
      setError('✅ 快取已清除，重新掃描中...');
      const files = refPaths.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (files.length > 0) {
        const refResult = await window.api.embedReferences(files);
        if (refResult.ok) {
          setRefsLoaded(refResult.data?.count || files.length);
        }
      }
      if (folder) {
        handleRunScan();
      }
    } catch (err: any) {
      setError(`清除快取失敗: ${err?.message || '未知錯誤'}`);
      setStatus('idle');
    }
  }, [isProcessing, refPaths, folder, handleRunScan]);

  const handleNoMatchAddReference = useCallback(() => {
    if (isProcessing) return;
    refPathsTextareaRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setError('再補 2~3 張參考照，特別是正面笑臉，通常會立刻變好');
  }, [isProcessing]);

  const handleEnhanceRefPhoto = useCallback(async (path: string) => {
    if (!window.api?.enhancePhoto) return;
    setEnhancingPath(path);
    try {
      const result = await window.api.enhancePhoto(path);
      if (result.ok && result.data?.enhancedPath) {
        setRefPaths(prev => {
          const lines = prev.split('\n').map(l => l.trim()).filter(Boolean);
          const idx = lines.indexOf(path);
          if (idx >= 0) lines[idx] = result.data!.enhancedPath;
          return lines.join('\n');
        });
        setRefsLoaded(0);
        setStatus('idle');
        setError(`✅ 已增強照片，請點「重新載入」以更新識別結果`);
      } else {
        setError(`增強失敗: ${(result as any).error || '未知錯誤'}`);
      }
    } catch (err: any) {
      setError(`增強失敗: ${err?.message || '未知錯誤'}`);
    } finally {
      setEnhancingPath(null);
    }
  }, []);

  const handleNoMatchSwitchPendingView = useCallback(() => {
    if (!results.length) {
      setError('目前待複核是空白，先用「低信心先放寬門檻」重新跑一次後再切回篩選');
    }
    // Review filter is set by the caller (App) after this callback
  }, [results.length]);

  return {
    folder, setFolder,
    refPaths, setRefPaths,
    refsLoaded, setRefsLoaded,
    refQualityResults,
    threshold, setThreshold,
    topN,
    results, setResults,
    status, setStatus,
    progress, setProgress,
    error, setError,
    modelStatus,
    settings,
    appInfo,
    lastRunSummary,
    scanWarnings,
    isProcessing,
    hasLastRunConfig,
    lastFolderDisplay,
    scanStartTimeRef,
    refPathsTextareaRef,
    handleRefFilesDrop,
    handleFolderDrop,
    handleBrowseFiles,
    handleBrowseFolder,
    handleEmbedRefs,
    handleRunScan,
    handleClear,
    handleLoadLastSettings,
    handleClearCacheAndRescan,
    lowerThresholdForRetry,
    handleNoMatchLowerThresholdAndRerun,
    handleNoMatchAddReference,
    handleNoMatchSwitchPendingView,
    handleEnhanceRefPhoto,
    enhancingPath,
    multiRefStrategy,
    setMultiRefStrategy,
    getThresholdGuide,
    getStatusText,
    getStatusType,
    formatElapsed,
    getBestScoreText,
    onboardingChecklist,
  };
}
