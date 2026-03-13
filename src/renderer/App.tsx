/**
 * Modern App Component with Beautiful UI
 * Features glassmorphism, gradients, animations, and contemporary design
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ModernButton } from './components/ModernButton';
import { GlassCard } from './components/GlassCard';
import { ModernProgress } from './components/ModernProgress';
import { StatusBadge } from './components/StatusBadge';
import { ModernLayout, ModernSection, ModernGrid } from './components/ModernLayout';
import { DragDropZone } from './components/DragDropZone';
import { HelpModal } from './components/HelpModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { MatchResultCard } from './components/MatchResultCard';
import { AIAnalysisPanel } from './components/AIAnalysisPanel';
import { ScanControls } from './components/ScanControls';
import { UpdateBanner } from './components/UpdateBanner';
import { TaskReadinessCard } from './components/TaskReadinessCard';
import { ScanWarningsPanel } from './components/ScanWarningsPanel';
import { useKeyboardShortcuts, commonShortcuts } from './hooks/useKeyboardShortcuts';
import { theme, animations, modernStyles } from './styles/theme';
import type { MatchResult, ScanProgress, AppSettings, AppInfo } from '../types/api';

export function App() {
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
  const scanStartTimeRef = useRef<number>();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [lastRunSummary, setLastRunSummary] = useState<{
    scanned: number;
    matched: number;
    elapsedMs: number;
  } | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [reviewScores, setReviewScores] = useState<Record<string, number>>({});
  const [reviewMode, setReviewMode] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'low'>('all');
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [favoritePaths, setFavoritePaths] = useState<string[]>([]);
  const [exportOnlyFavorites, setExportOnlyFavorites] = useState(false);
  const [isExportSuccessOpen, setIsExportSuccessOpen] = useState(false);
  const [isOpenFolderAfterExport, setIsOpenFolderAfterExport] = useState(false);
  const [isExportClipboardCopying, setIsExportClipboardCopying] = useState(false);
  const [exportSummary, setExportSummary] = useState<{
    outDir: string;
    requested: number;
    copied: number;
    failed: number;
    failedPaths?: string[];
    error?: string;
  } | null>(null);
  const [lastExportTargets, setLastExportTargets] = useState<string[]>([]);
  const [exportPreviewTargets, setExportPreviewTargets] = useState<MatchResult[]>([]);
  const [isTopTwentyView, setIsTopTwentyView] = useState(false);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const isProcessing = status.includes('ing...');
  const hasLastRunConfig = settings.lastFolder.trim().length > 0 && settings.lastReferencePaths.length > 0;
  const lastFolderDisplay = settings.lastFolder ? settings.lastFolder.split(/[/\\]/).pop() : '';
  const refPathsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const onboardingChecklist = {
    hasRefs: refsLoaded > 0 || refPaths.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).length >= 3,
    hasFolder: folder.trim().length > 0,
    modelLoaded: modelStatus ? modelStatus.loaded : null,
  };
  const readinessItems = [
    { label: '參考照（建議 3 張以上）', ok: onboardingChecklist.hasRefs, pending: '先載入或貼上參考照路徑' },
    { label: '照片資料夾', ok: onboardingChecklist.hasFolder, pending: '先選擇一個資料夾' },
    {
      label: 'AI 模型',
      ok: onboardingChecklist.modelLoaded === true,
      pending: onboardingChecklist.modelLoaded === null ? '初始化中' : '載入參考照時會自動啟用',
    },
  ];

  const formatElapsed = (ms: number) => {
    const seconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remain}秒`;
    }
    return `${remain}秒`;
  };

  const getThresholdGuide = () => {
    if (threshold >= 0.75) return '門檻較高，會更精準但容易漏掉模糊照片';
    if (threshold >= 0.6) return '建議模式：精準性與召回率平衡';
    if (threshold >= 0.45) return '門檻較低，可找出更多候選，建議先複核結果';
    return '門檻很低，適合盡量不漏找，但誤判可能增加';
  };

  const getBestScoreText = () => {
    if (!results.length) return '';
    const best = Math.max(...results.map(r => r.score));
    return `${(best * 100).toFixed(1)}%`;
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
        setRefPaths(parsed.lastReferencePaths?.join('\n') || '');
        setFolder(parsed.lastFolder || '');
      } catch (err) {
        console.warn('Failed to load settings:', err);
      }
    }
    const onboardingDone = localStorage.getItem('onboardingCompleted');
    if (!onboardingDone) {
      setShowOnboarding(true);
    }
    const savedFavorites = localStorage.getItem('favoriteMatchPaths');
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites);
        if (Array.isArray(parsed)) {
          setFavoritePaths(parsed.filter((item: unknown) => typeof item === 'string'));
        }
      } catch (err) {
        console.warn('Failed to load favorites:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!window.api) return;
    window.api.getAppInfo().then((info: AppInfo) => {
      setAppInfo(info);
    }).catch(() => {
      setAppInfo({
        appName: '大海撈Ｂ',
        version: '獲取中...',
      });
    });
  }, []);

  // Check AI model status on mount, after refs loaded, and poll until loaded
  useEffect(() => {
    if (!window.api?.getModelStatus) return;
    let cancelled = false;

    const checkStatus = () => {
      window.api?.getModelStatus().then((status: { loaded: boolean; error: string | null }) => {
        if (cancelled) return;
        setModelStatus(status);
        // Keep polling every 2s until model is loaded or has error
        if (!status.loaded && !status.error) {
          setTimeout(checkStatus, 2000);
        }
      }).catch(() => {
        // Model status API not available
      });
    };
    checkStatus();

    return () => { cancelled = true; };
  }, [refsLoaded]);

  useEffect(() => {
    if (!window.api?.setPerformanceMode) return;
    window.api.setPerformanceMode('default').catch(() => {
      // Keep default behavior when unavailable
    });
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

  useEffect(() => {
    localStorage.setItem('favoriteMatchPaths', JSON.stringify(favoritePaths));
  }, [favoritePaths]);

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

  // Handle drag and drop for reference files
  const handleRefFilesDrop = useCallback((files: string[]) => {
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|bmp|webp|heic|heif)$/i.test(file)
    );
    
    if (imageFiles.length > 0) {
      const currentPaths = refPaths.split('\n').filter(p => p.trim());
      const newPaths = [...new Set([...currentPaths, ...imageFiles])];
      setRefPaths(newPaths.join('\n'));
    }
  }, [refPaths]);

  // Handle drag and drop for folder
  const handleFolderDrop = useCallback((folderPath: string) => {
    setFolder(folderPath);
  }, []);

  // Keyboard shortcuts
  const handleSaveSettings = useCallback(() => {
    const tempError = error;
    setError('設定已儲存');
    setTimeout(() => setError(tempError), 2000);
  }, [error]);

  const handleRun = useCallback(() => {
    if (!isProcessing && folder.trim() && refsLoaded > 0) {
      handleRunScan();
    }
  }, [isProcessing, folder, refsLoaded]);

  const handleExport = useCallback(() => {
    if (results.length > 0 && !isProcessing) {
      setIsExportPreviewOpen(true);
    }
  }, [results.length, isProcessing]);

  const handleClear = useCallback(() => {
    setResults([]);
    setError(null);
    setLastRunSummary(null);
    setScanWarnings([]);
    setReviewDecisions({});
    setReviewScores({});
    setIsExportPreviewOpen(false);
    setIsExportSuccessOpen(false);
    setExportSummary(null);
    setLastExportTargets([]);
  }, []);

  const handleHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  useKeyboardShortcuts([
    { ...commonShortcuts.save, action: handleSaveSettings },
    { ...commonShortcuts.run, action: handleRun },
    { ...commonShortcuts.export, action: handleExport },
    { ...commonShortcuts.clear, action: handleClear },
    { ...commonShortcuts.help, action: handleHelp },
    { key: 'Escape', action: () => setIsHelpOpen(false) }
  ]);

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
      
      // 顯示人臉偵測診斷
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
    if (refsLoaded === 0) {
      setError('請先載入參考照片');
      return;
    }
    setError(null);
    setStatus('scanning...');
    setProgress(null);
    setLastRunSummary(null);
    setScanWarnings([]);
    scanStartTimeRef.current = Date.now();
    
    if (!window.api) {
      setError('API 未初始化');
      return;
    }
    
    try {
      const api = window.api;
      if (!api) {
        setError('API 未初始化');
        setStatus('idle');
        setProgress(null);
        return;
      }
      const scanResult = await api.runScan(folder);
      if (!scanResult.ok) {
        setError(`掃描失敗: ${scanResult.error || '未知錯誤'}`);
        setStatus('idle');
        setProgress(null);
        return;
      }
      
      // 顯示掃描診斷
      const scanData = scanResult.data;
      if (Array.isArray(scanData?.warnings) && scanData.warnings.length > 0) {
        setScanWarnings(scanData.warnings);
      }

      // Handle cancelled scan
      if (scanData?.cancelled) {
        setStatus('idle');
        setProgress(null);
        setError(`掃描已取消（已完成 ${scanData?.scanned || 0} 張）`);
        return;
      }

      if (scanData && scanData.deterministicFallback && scanData.deterministicFallback > 0) {
        console.warn(`[scan] ${scanData.deterministicFallback} photos used deterministic (non-face) embeddings`);
      }
      if (scanData && scanData.faceDetected && scanData.faceDetected > 0) {
        console.info(`[scan] ${scanData.faceDetected} photos had faces detected`);
      }
      
      setStatus('matching...');
      setProgress(null);
      
      const matchResponse = await api.runMatch({ topN, threshold });
      const matched = matchResponse.results;
      const initialReviewScores = matched.reduce<Record<string, number>>((acc, item) => {
        acc[item.path] = Math.round(item.score * 100);
        return acc;
      }, {});
      if (matchResponse.dimensionAdjustedCount > 0) {
        console.warn(
          `[match] ${matchResponse.dimensionAdjustedCount}/${matchResponse.totalComparisons} comparisons used adjusted embedding dimensions`
        );
      }
      const elapsedMs = scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0;
      const scannedCount = typeof scanData?.scanned === 'number'
        ? scanData.scanned
        : 0;
      setLastRunSummary({
        scanned: scannedCount,
        matched: matched.length,
        elapsedMs,
      });
      setResults(matched);
      setReviewDecisions({});
      setReviewScores(initialReviewScores);
      setStatus('done');
      if (matched.length === 0) {
        // 提供更有用的診斷資訊
        const faceDetected = scanData?.faceDetected ?? 0;
        const deterministicFallback = scanData?.deterministicFallback ?? 0;
        if (faceDetected === 0 && scannedCount > 0) {
          setError('⚠️ 所有照片都無法偵測到人臉！可能是 AI 模型載入失敗，請嘗試「清除快取重新掃描」，或確認照片是否包含清晰人臉。');
        } else {
          setError('未找到匹配的照片，請嘗試降低門檻值或增加參考照片數量');
        }
      }
      if (scanData?.skippedErrors && scanData.skippedErrors > 0) {
        setError(`已略過 ${scanData.skippedErrors} 張處理失敗照片，建議先看掃描摘要中的提醒後再重試。`);
      }
    } catch (err: any) {
      setError(`錯誤: ${err?.message || '未知錯誤'}`);
      setStatus('idle');
      setProgress(null);
      scanStartTimeRef.current = undefined;
    }
  }, [folder, threshold, topN, refsLoaded]);

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

  const isLowConfidence = (item: MatchResult) => {
    const score = typeof reviewScores[item.path] === 'number'
      ? reviewScores[item.path]
      : Math.round(item.score * 100);
    return score < 65;
  };

  const getExportTargets = useCallback((mode: 'default' | 'favorites' | 'pending' | 'low' = 'default') => {
    const base = reviewMode
      ? results.filter((r) => reviewDecisions[r.path] !== 'rejected')
      : results;
    if (mode === 'favorites') return base.filter((r) => favoritePaths.includes(r.path));
    if (mode === 'pending') return base.filter((r) => !reviewDecisions[r.path]);
    if (mode === 'low') return base.filter((r) => isLowConfidence(r));
    return exportOnlyFavorites ? base.filter((r) => favoritePaths.includes(r.path)) : base;
  }, [reviewMode, results, reviewDecisions, exportOnlyFavorites, favoritePaths, isLowConfidence]);

  const handlePrepareExport = useCallback((mode: 'default' | 'favorites' | 'pending' | 'low' = 'default') => {
    const exportTargets = getExportTargets(mode);
    if (exportTargets.length === 0) {
      setError('沒有可匯出的結果');
      return;
    }
    setExportPreviewTargets(exportTargets);
    setIsExportPreviewOpen(true);
  }, [getExportTargets]);

  const handleExportResults = useCallback(async (manualTargets?: string[], manualOutDir?: string) => {
    const targets = manualTargets
      ? manualTargets
      : getExportTargets().map((item) => item.path);

    if (targets.length === 0) {
      setError('沒有可匯出的結果');
      return;
    }
    setError(null);
    const out = manualOutDir || (folder ? folder + '_matched_export' : 'matched_export');
    setLastExportTargets(targets);
    setStatus('exporting...');
    setExportSummary(null);
    if (!window.api) {
      setError('API 未初始化');
      setStatus('done');
      const failedPaths = [] as string[];
      setExportSummary({
        outDir: out,
        requested: targets.length,
        copied: 0,
        failed: targets.length,
        failedPaths,
        error: 'API 未初始化',
      });
      setIsExportSuccessOpen(true);
      return {
        ok: false,
        error: 'API 未初始化',
        data: {
          copied: 0,
          failed: targets.length,
          failedPaths,
        },
      };
    }
    try {
      const api = window.api;
      if (!api) {
        setError('API 未初始化');
        setStatus('done');
        return {
          ok: false,
          error: 'API 未初始化',
          data: {
            copied: 0,
            failed: targets.length,
            failedPaths: targets,
          },
        };
      }
      const result = await api.exportCopy(targets, out);
      const copied = result.data?.copied || 0;
      const failed = result.data?.failed ?? Math.max(0, targets.length - copied);
      const failedPaths = result.data?.failedPaths || [];
      setLastExportTargets(failedPaths.length > 0 ? failedPaths : targets);
      const hasFailure = failed > 0 || !result.ok;
      setStatus(`exported (${copied} files)`);
      setExportSummary({
        outDir: out,
        requested: targets.length,
        copied,
        failed,
        failedPaths,
        error: hasFailure ? (result.error || '匯出未完全成功') : undefined,
      });
      setIsExportSuccessOpen(true);
      setStatus(hasFailure ? 'done' : `exported (${copied} files)`);
      if (hasFailure) {
        setError(`匯出未完全成功：失敗 ${failed} 張`);
      }
      return {
        ...result,
        data: {
          copied,
          failed,
          failedPaths,
        },
      };
    } catch (err: any) {
      setError(`匯出錯誤: ${err?.message || '未知錯誤'}`);
      setStatus('done');
      setExportSummary({
        outDir: out,
        requested: targets.length,
        copied: 0,
        failed: targets.length,
        error: err?.message || '未知錯誤',
      });
      setIsExportSuccessOpen(true);
      return {
        ok: false,
        error: err?.message || '未知錯誤',
        data: {
          copied: 0,
          failed: targets.length,
          failedPaths: [],
        },
      };
    }
  }, [getExportTargets, folder]);

  const confirmExport = useCallback(async (openAfter = false) => {
    setIsExportPreviewOpen(false);
    const paths = exportPreviewTargets.map((item) => item.path);

    // 讓使用者選擇匯出資料夾
    let outDir: string | null = null;
    if (window.api?.selectFolder) {
      outDir = await window.api.selectFolder();
      if (!outDir) {
        // 使用者取消了選擇
        return;
      }
    }
    if (!outDir) {
      outDir = folder ? folder + '_matched_export' : 'matched_export';
    }

    const result = await handleExportResults(paths, outDir);
    if (openAfter && result?.ok && result.data && window.api) {
      await window.api.openFolder(outDir);
    }
    if (!result?.ok && openAfter) {
      setError(`匯出有錯誤，無法自動開啟輸出資料夾：${result?.error || '未知錯誤'}`);
    }
  }, [handleExportResults, exportPreviewTargets, folder]);

  const openExportFolder = useCallback(async () => {
    if (!exportSummary) {
      return;
    }
    const result = await window.api?.openFolder(exportSummary.outDir);
    if (!result || !result.ok) {
      setError(`打開資料夾失敗: ${result?.error || '未知錯誤'}`);
    }
  }, [exportSummary]);

  const copyExportSummaryToClipboard = useCallback(async () => {
    if (!exportSummary) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setError('目前環境不支援剪貼簿，請手動複製資料夾路徑');
      return;
    }
    const content = [
      `大海撈Ｂ匯出結果`,
      new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
      `輸出資料夾：${exportSummary.outDir}`,
      `成功：${exportSummary.copied} 張`,
      `失敗：${exportSummary.failed} 張`,
      '',
      '請將此路徑貼到手機傳輸工具中使用：',
      exportSummary.outDir,
    ].join('\n');
    setIsExportClipboardCopying(true);
    try {
      await navigator.clipboard.writeText(content);
      setError('已複製匯出結果與路徑，可直接貼給手機端APP。');
    } catch {
      setError('複製失敗，請手動複製輸出資料夾路徑。');
    } finally {
      setIsExportClipboardCopying(false);
    }
  }, [exportSummary]);

  const retryExport = useCallback(async () => {
    if (!exportSummary) {
      return;
    }
    const retryTargets = exportSummary.failedPaths?.length
      ? exportSummary.failedPaths
      : lastExportTargets;
    await handleExportResults(retryTargets, exportSummary.outDir);
  }, [exportSummary, handleExportResults, lastExportTargets]);

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

  const getStatusType = () => {
    if (status === 'idle') return 'idle';
    if (status.includes('ing...')) return 'processing';
    if (status.includes('ready') || status.includes('done') || status.includes('exported')) return 'success';
    return 'idle';
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  const handleDecision = useCallback((path: string, decision: 'accepted' | 'rejected' | null) => {
    setReviewDecisions(prev => {
      if (decision === null) {
        const next = { ...prev };
        delete next[path];
        return next;
      }
      return {
        ...prev,
        [path]: decision,
      };
    });
  }, []);

  const handleReviewScore = useCallback((path: string, score: number) => {
    setReviewScores(prev => ({
      ...prev,
      [path]: score,
    }));
  }, []);

  const handleBatchDecision = (decision: 'accepted' | 'rejected' | null) => {
    setReviewDecisions(() => {
      if (decision === null) {
        return {};
      }

      const next: Record<string, 'accepted' | 'rejected'> = {};
      results.forEach((item) => {
        next[item.path] = decision;
      });

      return next;
    });
  };

  const acceptedCount = results.reduce((count, item) => count + (reviewDecisions[item.path] === 'accepted' ? 1 : 0), 0);
  const rejectedCount = results.reduce((count, item) => count + (reviewDecisions[item.path] === 'rejected' ? 1 : 0), 0);
  const pendingCount = results.length - acceptedCount - rejectedCount;
  const retryCandidates = results.filter(isLowConfidence);
  const filteredResults = results.filter((item) => {
    if (reviewFilter === 'pending') return !reviewDecisions[item.path];
    if (reviewFilter === 'low') return isLowConfidence(item);
    return true;
  });
  const displayedResults = isTopTwentyView ? [...filteredResults].sort((a, b) => b.score - a.score).slice(0, 20) : filteredResults;
  const lowConfidenceCount = retryCandidates.length;
  const exportTargets = getExportTargets();
  const favoriteMatches = results.filter((r) => favoritePaths.includes(r.path));
  const favoriteCountInCurrent = favoriteMatches.length;
  const exportPreviewRate = exportTargets.length > 0 && results.length > 0
    ? `${Math.round((exportTargets.length / results.length) * 100)}%`
    : '0%';
  const thresholdIntensity = `${Math.round(threshold * 100)}%`;
  const isFavorite = (path: string) => favoritePaths.includes(path);

  const toggleFavorite = useCallback((path: string) => {
    setFavoritePaths((prev) => {
      if (prev.includes(path)) {
        return prev.filter((item) => item !== path);
      }
      return [...prev, path];
    });
  }, []);

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
    if (!changed) {
      return;
    }
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
      // 先重新載入參考照片
      const files = refPaths.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (files.length > 0) {
        const refResult = await window.api.embedReferences(files);
        if (refResult.ok) {
          setRefsLoaded(refResult.data?.count || files.length);
        }
      }
      // 再重新掃描
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

  const handleNoMatchSwitchPendingView = useCallback(() => {
    if (!results.length) {
      setReviewFilter('pending');
      setError('目前待複核是空白，先用「低信心先放寬門檻」重新跑一次後再切回篩選');
      return;
    }
    setReviewFilter('pending');
  }, [results.length]);

  const handleBrowseFiles = async () => {
    if (!window.api?.selectFiles) return;
    const files = await window.api.selectFiles();
    if (files && files.length > 0) {
      setRefPaths(prev => {
        const lines = prev.split('\n').map(l => l.trim()).filter(Boolean);
        const newFiles = files.filter(f => !lines.includes(f));
        if (newFiles.length === 0) return prev;
        const current = prev.trim() ? prev.trim() + '\n' : '';
        return current + newFiles.join('\n');
      });
    }
  };

  const handleBrowseFolder = async () => {
    if (!window.api?.selectFolder) return;
    const selectedFolder = await window.api.selectFolder();
    if (selectedFolder) {
      setFolder(selectedFolder);
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      fontFamily: theme.typography.fontFamily.sans.join(', '),
      color: theme.colors.neutral[800],
    }}>
      {/* Left Sidebar */}
      <div style={{
        width: '420px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid rgba(0,0,0,0.05)`,
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(20px)',
        overflowY: 'auto',
      }}>
        <div style={{ padding: theme.spacing[5], display: 'flex', flexDirection: 'column', gap: theme.spacing[5] }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            marginBottom: theme.spacing[2],
          }}>
            <img
              src="logo.png"
              alt="大海撈Ｂ Logo"
              style={{ width: '56px', height: '56px', borderRadius: theme.borderRadius.base }}
            />
            <div>
              <h1 style={{
                margin: 0,
                fontSize: theme.typography.fontSize['2xl'],
                fontWeight: theme.typography.fontWeight.bold,
                background: theme.gradients.primary,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                大海撈Ｂ
              </h1>
              <div style={{ marginTop: theme.spacing[1], display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                <StatusBadge status={getStatusType()} size="sm">
                  {getStatusText()}
                </StatusBadge>
                {modelStatus && (
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: modelStatus.loaded ? (theme.colors.success as Record<string, string>)[500] : (theme.colors.error as Record<string, string>)[500],
                    opacity: 0.8,
                  }}>
                    {modelStatus.loaded ? 'AI 就緒' : 'AI 未載入'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
            <ModernButton variant="ghost" size="sm" onClick={handleHelp}>
              說明
            </ModernButton>
            <ModernButton variant="ghost" size="sm" onClick={() => setIsHelpOpen(true)}>
              {appInfo?.version ? `版本 ${appInfo.version}` : '關於'}
            </ModernButton>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => {
                window.api?.openExternal?.('https://buymeacoffee.com/samulee003');
              }}
              style={{
                background: 'linear-gradient(135deg, #FF813F 0%, #FFDD00 100%)',
                color: '#000',
                fontWeight: 700,
                border: 'none',
                borderRadius: '8px',
                padding: '4px 12px',
                fontSize: '13px',
              }}
            >
              Buy me a coffee
            </ModernButton>
          </div>

          {/* Fast Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
            <ModernButton
              variant="secondary"
              size="md"
              fullWidth
              onClick={handleLoadLastSettings}
              disabled={isProcessing || !hasLastRunConfig}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              }
            >
              載入上次設定
            </ModernButton>
            <ModernButton
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => {
                const path = settings.lastFolder || folder;
                if (!path) {
                  setError('請先選擇照片資料夾');
                  return;
                }
                setFolder(path);
                setError(path === folder ? null : '已切換到上次使用的資料夾');
              }}
              disabled={isProcessing || (!settings.lastFolder && !folder)}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              }
            >
              快速回到相簿資料夾
            </ModernButton>
            <ModernButton
              variant="success"
              size="md"
              fullWidth
              onClick={() => {
                if (!folder) {
                  setError('請先指定照片資料夾');
                  return;
                }
                if (refsLoaded === 0) {
                  setError('請先載入參考照片，才能開始搜尋');
                  return;
                }
                handleRunScan();
              }}
              disabled={isProcessing || !folder || refsLoaded === 0}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              }
            >
              一鍵開始搜尋
            </ModernButton>
          </div>
          {hasLastRunConfig && (
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.neutral[500],
              textAlign: 'center'
            }}>
              上次：{settings.lastReferencePaths.length} 參考照 / {lastFolderDisplay}
            </div>
          )}

          {/* Model Not Loaded Warning */}
          {modelStatus && !modelStatus.loaded && (
            <GlassCard padding="md" style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}>
              <div style={{ color: '#f59e0b', fontSize: theme.typography.fontSize.sm }}>
                <strong>AI 模型尚未載入</strong> — 首次啟動可能需要 10~30 秒載入模型。
                {modelStatus.error && <div style={{ marginTop: 4, opacity: 0.8, fontSize: theme.typography.fontSize.xs }}>錯誤：{modelStatus.error}</div>}
                <div style={{ marginTop: 4, opacity: 0.8, fontSize: theme.typography.fontSize.xs }}>
                  如果長時間未載入，請嘗試重新開啟程式。載入參考照片時會自動觸發模型載入。
                </div>
              </div>
            </GlassCard>
          )}

          {/* Error Alert */}
          {error && (
            <GlassCard padding="md" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              animation: 'slideIn 0.3s ease-out',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: theme.colors.error[600],
              }}>
                <span style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  {error}
                </span>
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setError(null)}
                  style={{ color: theme.colors.error[600], padding: `${theme.spacing[1]} ${theme.spacing[2]}` }}
                >
                  ×
                </ModernButton>
              </div>
            </GlassCard>
          )}

          {/* Left Column - Input Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>
          <TaskReadinessCard items={readinessItems} />
          {/* Step 1: Load Reference Photos */}
          <ModernSection
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: theme.colors.primary[100],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.primary[600],
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  1
                </div>
                載入參考照片
              </div>
            }
            description="提供 3-10 張清晰的小孩照片作為參考"
          >
            <div style={{ marginBottom: theme.spacing[4] }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: theme.spacing[2],
              }}>
                <label style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.neutral[700],
                }}>
                  參考照片路徑（每行一個檔案）
                </label>
                <ModernButton
                  variant="secondary"
                  size="sm"
                  onClick={handleBrowseFiles}
                  disabled={isProcessing}
                >
                  選擇照片
                </ModernButton>
              </div>
              <DragDropZone
                onFilesDrop={handleRefFilesDrop}
                accept="files"
                disabled={isProcessing}
                style={{ marginBottom: theme.spacing[3] }}
              >
                <textarea
                  ref={refPathsTextareaRef}
                  style={{
                    ...modernStyles.input.base,
                    ...modernStyles.input.textarea,
                    minHeight: '120px',
                    border: `2px dashed ${theme.colors.primary[300]}`,
                    background: 'rgba(255, 255, 255, 0.6)',
                  }}
                  placeholder="例如：
C:\Photos\child\photo1.jpg
C:\Photos\child\photo2.jpg
C:\Photos\child\photo3.jpg

( 或直接拖放圖片檔案到這裡 )"
                  value={refPaths}
                  onChange={(e) => setRefPaths(e.target.value)}
                  disabled={isProcessing}
                />
              </DragDropZone>
            </div>

            <ModernButton
              variant="primary"
              size="lg"
              fullWidth
              loading={status === 'embedding refs...'}
              disabled={isProcessing || refPaths.trim() === ''}
              onClick={handleEmbedRefs}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21l7.07-7.07-1.41-1.41z" />
                  <path d="M20.49 19l-5.73-5.73C15.53 12.2 14.11 12 12.5 12c-1.61 0-3.09.59-4.23 1.57l5.73 5.73c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L12.5 14.5c-.39-.39-1.02-.39-1.41 0z" />
                </svg>
              }
            >
              {refsLoaded > 0 ? `重新載入 (已載入 ${refsLoaded} 張)` : '載入參考照片'}
            </ModernButton>
          </ModernSection>

          {/* Step 2: Select Folder */}
          <ModernSection
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: theme.colors.secondary[100],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.secondary[600],
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  2
                </div>
                選擇照片資料夾
              </div>
            }
            description="選擇包含要搜尋照片的資料夾"
          >
            <div style={{ marginBottom: theme.spacing[4] }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: theme.spacing[2],
              }}>
                <label style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.neutral[700],
                }}>
                  要搜尋的照片資料夾路徑
                </label>
                <ModernButton
                  variant="secondary"
                  size="sm"
                  onClick={handleBrowseFolder}
                  disabled={isProcessing}
                >
                  選擇資料夾
                </ModernButton>
              </div>
              <DragDropZone
                onFilesDrop={() => {}}
                onFolderDrop={handleFolderDrop}
                accept="folders"
                disabled={isProcessing}
                style={{ marginBottom: theme.spacing[3] }}
              >
                <input
                  type="text"
                  style={{
                    ...modernStyles.input.base,
                    border: `2px dashed ${theme.colors.secondary[300]}`,
                    background: 'rgba(255, 255, 255, 0.6)',
                  }}
                  placeholder="例如：C:\Photos\Family\2024   ( 或直接拖放資料夾到這裡 )"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  disabled={isProcessing}
                />
              </DragDropZone>
            </div>
          </ModernSection>

          {/* Step 3: Adjust Settings */}
          <ModernSection
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: theme.colors.success[100],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.success[600],
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  3
                </div>
                調整搜尋參數
              </div>
            }
            description="調整相似度門檻和顯示數量以獲得最佳結果"
          >
            <div style={{ marginBottom: theme.spacing[4] }}>
              <label style={{
                display: 'block',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.neutral[700],
                marginBottom: theme.spacing[2],
              }}>
                相似度門檻：<span style={{
                  color: theme.colors.primary[400],
                  fontWeight: theme.typography.fontWeight.semibold,
                }}>{threshold.toFixed(2)}</span>
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[4],
              }}>
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.neutral[600],
                }}>寬鬆 (0.0)</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: theme.borderRadius.full,
                    outline: 'none',
                    appearance: 'none',
                    background: `linear-gradient(to right, ${theme.colors.primary[500]} 0%, ${theme.colors.primary[500]} ${threshold * 100}%, ${theme.colors.neutral[300]} ${threshold * 100}%, ${theme.colors.neutral[300]} 100%)`,
                  }}
                  disabled={isProcessing}
                />
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.neutral[600],
                }}>嚴格 (1.0)</span>
              </div>
            </div>
            
            <div style={{ marginBottom: theme.spacing[6] }}>
              <label style={{
                display: 'block',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.neutral[700],
                marginBottom: theme.spacing[2],
              }}>
                顯示數量 (Top-N)：
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value, 10) || 50)}
                style={{
                  ...modernStyles.input.base,
                  width: '150px',
                }}
                disabled={isProcessing}
              />
              <div style={{
                marginTop: theme.spacing[2],
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.neutral[600],
              }}>
                小提示：{getThresholdGuide()}
              </div>
                <div style={{
                  marginTop: theme.spacing[3],
                  height: '10px',
                  borderRadius: theme.borderRadius.full,
                  background: 'rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: thresholdIntensity,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)',
                    borderRadius: theme.borderRadius.full,
                    transition: 'width 0.2s ease-out',
                  }} />
                </div>
                <div style={{
                  marginTop: theme.spacing[1],
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.neutral[600],
                }}>
                  門檻值位置：{thresholdIntensity}
                </div>
            </div>

            <div style={{
              display: 'flex',
              gap: theme.spacing[3],
            }}>
              <ModernButton
                variant="success"
                size="lg"
                loading={isProcessing}
                disabled={isProcessing || !folder.trim() || refsLoaded === 0}
                onClick={handleRunScan}
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27v.79l5 4.99L20.49 19l-4.99-5zm-6.88-2.77c.59-.59 1.27-.91 2-.91s1.41.32 2 .91l.09.09L9.5 18.5l3.54-3.54-.09-.09z" />
                  </svg>
                }
              >
                {isProcessing ? '處理中...' : '開始搜尋'}
              </ModernButton>
              
              {results.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing[2],
                  width: '100%',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing[2],
                    flexWrap: 'wrap',
                  }}>
                    <button
                      onClick={() => setExportOnlyFavorites(false)}
                      style={{
                        borderRadius: theme.borderRadius.md,
                        border: `1px solid ${!exportOnlyFavorites ? 'rgba(59, 130, 246, 0.5)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: !exportOnlyFavorites ? '#60a5fa' : theme.colors.neutral[600],
                        background: !exportOnlyFavorites ? 'rgba(96, 165, 250, 0.12)' : 'transparent',
                        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                        cursor: 'pointer',
                      }}
                    >
                      全部結果
                    </button>
                    <button
                      onClick={() => setExportOnlyFavorites(true)}
                      style={{
                        borderRadius: theme.borderRadius.md,
                        border: `1px solid ${exportOnlyFavorites ? 'rgba(251, 191, 36, 0.5)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: exportOnlyFavorites ? '#f59e0b' : theme.colors.neutral[600],
                        background: exportOnlyFavorites ? 'rgba(251, 191, 36, 0.12)' : 'transparent',
                        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                        cursor: 'pointer',
                      }}
                    >
                      只匯出收藏
                    </button>
                    <span style={{
                      color: theme.colors.neutral[600],
                      fontSize: theme.typography.fontSize.sm,
                    }}>
                      收藏可用 {favoriteCountInCurrent} 張
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: theme.borderRadius.full,
                    background: 'rgba(0, 0, 0, 0.05)',
                    overflow: 'hidden',
                    marginBottom: theme.spacing[1],
                  }}>
                    <div style={{
                      height: '100%',
                      width: exportPreviewRate,
                      background: exportOnlyFavorites ? 'linear-gradient(90deg, #fbbf24 0%, #f472b6 100%)' : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                      borderRadius: theme.borderRadius.full,
                      transition: 'width 0.2s',
                    }} />
                  </div>
                  <ModernButton
                    variant="secondary"
                    size="lg"
                    disabled={isProcessing}
                onClick={() => handlePrepareExport('default')}
                    icon={
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7V9zm-17 9l3 3v2h12v-2l3-3H2z" />
                      </svg>
                    }
                  >
                    匯出結果 ({exportTargets.length} 張)
                  </ModernButton>
              <ModernButton
                variant="secondary"
                size="md"
                disabled={isProcessing || pendingCount === 0}
                onClick={() => handlePrepareExport('pending')}
                style={{ marginTop: theme.spacing[2] }}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm8 6-3-2V9.2a5 5 0 1 0-10 0V14l-3 2H3v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V10h-1Zm-4-3.08V14h-4v-4.08A5.99 5.99 0 0 0 16 10Z"/>
                  </svg>
                }
              >
                只匯出待複核 ({pendingCount} 張)
              </ModernButton>
                </div>
              )}
            </div>
          </ModernSection>
          </div>
        </div>
      </div>

      {/* Right Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}>
        <div style={{
          padding: theme.spacing[6],
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[6],
          flex: 1,
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}>
          {/* Update Banner */}
          <UpdateBanner />

          {/* Welcome State */}
          {results.length === 0 && !status.includes('ing...') && status !== 'done' && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <GlassCard padding="xl" style={{ textAlign: 'center', maxWidth: '480px', background: 'rgba(255, 255, 255, 0.7)' }}>
                <img
                  src="logo.png"
                  alt="Logo"
                  style={{
                    width: '96px',
                    height: '96px',
                    margin: '0 auto',
                    marginBottom: theme.spacing[6],
                    opacity: 0.9,
                    borderRadius: theme.spacing[3],
                  }}
                />
                <h2 style={{
                  fontSize: theme.typography.fontSize['3xl'],
                  color: theme.colors.primary[600],
                  marginBottom: theme.spacing[4],
                  fontWeight: theme.typography.fontWeight.bold,
                }}>
                  準備就緒，開始尋寶！
                </h2>
                <p style={{
                  color: theme.colors.neutral[600],
                  lineHeight: 1.6,
                  marginBottom: theme.spacing[6],
                  fontSize: theme.typography.fontSize.base,
                }}>
                  請在左側面板載入參考照片，並選擇要搜尋的相簿資料夾。設定好相似度門檻後，點擊「開始搜尋」即可在大海中撈出您的寶貝！
                </p>
                {(!folder || refsLoaded === 0) && (
                   <ModernButton
                     variant="primary"
                     size="lg"
                     onClick={() => refPathsTextareaRef.current?.focus()}
                     icon={
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <line x1="12" y1="5" x2="12" y2="19"></line>
                         <line x1="5" y1="12" x2="19" y2="12"></line>
                       </svg>
                     }
                   >
                     第一步：載入參考照片
                   </ModernButton>
                )}
              </GlassCard>
            </div>
          )}

          {/* AI Analysis Panel during scanning */}
          {progress && (
            <div style={{ animation: 'slideIn 0.3s ease-out' }}>
              <AIAnalysisPanel progress={progress} />
              {status === 'scanning...' && (
                <ScanControls key={scanStartTimeRef.current} onCancelled={() => {
                  setStatus('idle');
                  setProgress(null);
                  setError('掃描已取消');
                }} />
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[6] }}>
          {results.length > 0 && (
            <ModernSection
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.colors.neutral[0],
                    fontWeight: theme.typography.fontWeight.bold,
                    fontSize: theme.typography.fontSize.sm,
                  }}>
                    4
                  </div>
                  搜尋結果 ({results.length} 張)
                </div>
              }
              description="找到與參考照片相似的照片"
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[4],
                marginBottom: theme.spacing[4],
                flexWrap: 'wrap',
              }}>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                  color: theme.colors.neutral[700],
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  <input
                    type="checkbox"
                    checked={reviewMode}
                    onChange={(event) => setReviewMode(event.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  啟用逐一複核
                </label>
                <span style={{ color: theme.colors.neutral[600], fontSize: theme.typography.fontSize.sm }}>
                  保留 {acceptedCount} / 排除 {rejectedCount} / 待審核 {pendingCount}
                </span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[4],
                marginBottom: theme.spacing[3],
                flexWrap: 'wrap',
              }}>
                <div style={{ color: theme.colors.neutral[700], fontSize: theme.typography.fontSize.sm }}>
                  已收藏：{favoritePaths.length} 張
                </div>
                <div style={{
                  color: theme.colors.neutral[600],
                  fontSize: theme.typography.fontSize.xs,
                  lineHeight: 1.5,
                  marginBottom: 0,
                }}>
                  親切提醒：分數越高越像你的小孩；60% 以下先標記「待檢查」，再決定要不要放入收藏
                </div>
                {lowConfidenceCount > 0 && (
                  <button
                    onClick={lowerThresholdForRetry}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      color: '#60a5fa',
                      background: 'rgba(96, 165, 250, 0.12)',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      cursor: 'pointer',
                    }}
                  >
                    低信心先放寬門檻
                  </button>
                )}
              </div>

              {retryCandidates.length > 0 && (
                <div style={{
                  marginBottom: theme.spacing[4],
                  color: theme.colors.neutral[700],
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  低信心待複核：{lowConfidenceCount} 張（建議手動打分或排除）
                </div>
              )}

              {reviewMode && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                  flexWrap: 'wrap',
                  marginBottom: theme.spacing[4],
                }}>
                  <span style={{
                    color: theme.colors.neutral[700],
                    fontSize: theme.typography.fontSize.sm,
                  }}>
                    查看：
                  </span>
                  <button
                    onClick={() => setReviewFilter('all')}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: `1px solid ${reviewFilter === 'all' ? theme.colors.primary[500] : 'rgba(0, 0, 0, 0.12)'}`,
                      color: reviewFilter === 'all' ? theme.colors.primary[700] : theme.colors.neutral[600],
                      background: reviewFilter === 'all' ? 'rgba(0, 151, 245, 0.08)' : 'transparent',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      cursor: 'pointer',
                    }}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setReviewFilter('pending')}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: `1px solid ${reviewFilter === 'pending' ? theme.colors.primary[500] : 'rgba(0, 0, 0, 0.12)'}`,
                      color: reviewFilter === 'pending' ? theme.colors.primary[700] : theme.colors.neutral[600],
                      background: reviewFilter === 'pending' ? 'rgba(0, 151, 245, 0.08)' : 'transparent',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      cursor: 'pointer',
                    }}
                  >
                    待審核
                  </button>
                  <button
                    onClick={() => setReviewFilter('low')}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: `1px solid ${reviewFilter === 'low' ? theme.colors.primary[500] : 'rgba(0, 0, 0, 0.12)'}`,
                      color: reviewFilter === 'low' ? theme.colors.primary[700] : theme.colors.neutral[600],
                      background: reviewFilter === 'low' ? 'rgba(0, 151, 245, 0.08)' : 'transparent',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      cursor: 'pointer',
                    }}
                  >
                    低信心
                  </button>
                <button
                  onClick={() => setIsTopTwentyView((prev) => !prev)}
                  style={{
                    borderRadius: theme.borderRadius.md,
                    border: `1px solid ${isTopTwentyView ? '#60a5fa' : 'rgba(0, 0, 0, 0.12)'}`,
                    color: isTopTwentyView ? '#2563eb' : theme.colors.neutral[600],
                    background: isTopTwentyView ? 'rgba(96, 165, 250, 0.12)' : 'transparent',
                    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                    cursor: 'pointer',
                  }}
                >
                  {isTopTwentyView ? '看全部結果' : '先看最高 20 張'}
                </button>

                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => handleBatchDecision('accepted')}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#15803d',
                      background: 'rgba(16, 185, 129, 0.1)',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      cursor: 'pointer',
                    }}
                  >
                    一鍵保留全部
                  </button>
                  <button
                    onClick={() => handleBatchDecision('rejected')}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#b91c1c',
                      background: 'rgba(239, 68, 68, 0.1)',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      cursor: 'pointer',
                    }}
                  >
                    一鍵排除全部
                  </button>
                  <button
                    onClick={() => handleBatchDecision(null)}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      color: theme.colors.neutral[600],
                      background: 'transparent',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      cursor: 'pointer',
                    }}
                  >
                    清空決定
                  </button>
                </div>
              )}

              <ModernGrid columns="auto" gap="md">
                {displayedResults.map((r, index) => (
                  <MatchResultCard
                    key={r.path}
                    result={r}
                    index={index}
                    onFavorite={toggleFavorite}
                    isFavorite={isFavorite(r.path)}
                    onDecision={reviewMode ? handleDecision : undefined}
                    onReviewScore={reviewMode ? handleReviewScore : undefined}
                    reviewDecision={reviewMode ? reviewDecisions[r.path] : undefined}
                    reviewScore={reviewMode ? reviewScores[r.path] : undefined}
                  />
                ))}
              </ModernGrid>
              {displayedResults.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: theme.spacing[8],
                  color: theme.colors.neutral[600],
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  {isTopTwentyView ? '目前無法組出前20張結果，先取消「先看前20」後再試' : '目前沒有符合篩選條件的結果'}
                </div>
              )}
            </ModernSection>
          )}

          {favoriteMatches.length > 0 && (
            <ModernSection
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f472b6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.colors.neutral[0],
                    fontWeight: theme.typography.fontWeight.bold,
                    fontSize: theme.typography.fontSize.sm,
                  }}>
                    ★
                  </div>
                  收藏清單 ({favoriteMatches.length} 張)
                </div>
              }
              description="你最近標記為有價值的照片（可快速再次使用）"
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: theme.spacing[3],
                flexWrap: 'wrap',
                gap: theme.spacing[2],
              }}>
                <span style={{
                  color: theme.colors.neutral[600],
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  這個清單可直接用來回看，點對應結果也可以取消收藏
                </span>
                <button
                  onClick={() => setFavoritePaths([])}
                  style={{
                    borderRadius: theme.borderRadius.md,
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.08)',
                    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                    cursor: 'pointer',
                  }}
                >
                  清空收藏
                </button>
              </div>

              <div style={{
                display: 'grid',
                gap: theme.spacing[2],
              }}>
                {favoriteMatches.map((item, idx) => (
                  <div key={item.path} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    alignItems: 'center',
                    gap: theme.spacing[2],
                    padding: theme.spacing[2],
                    borderRadius: theme.borderRadius.md,
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    background: 'rgba(255, 255, 255, 0.5)',
                  }}>
                    <span style={{ color: theme.colors.neutral[700], fontSize: theme.typography.fontSize.sm }}>
                      {idx + 1}. {item.path.split(/[/\\]/).pop()}
                    </span>
                    <span style={{ color: theme.colors.neutral[500], fontSize: theme.typography.fontSize.xs }}>
                      {(item.score * 100).toFixed(1)}%
                    </span>
                    <button
                      onClick={() => handleDecision(item.path, 'accepted')}
                      style={{
                        borderRadius: theme.borderRadius.sm,
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                        cursor: 'pointer',
                        fontSize: theme.typography.fontSize.xs,
                      }}
                    >
                      保留
                    </button>
                    <button
                      onClick={() => handleDecision(item.path, 'rejected')}
                      style={{
                        borderRadius: theme.borderRadius.sm,
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.1)',
                        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                        cursor: 'pointer',
                        fontSize: theme.typography.fontSize.xs,
                      }}
                    >
                      排除
                    </button>
                    <button
                      onClick={() => toggleFavorite(item.path)}
                      style={{
                        borderRadius: theme.borderRadius.sm,
                        border: '1px solid rgba(251, 191, 36, 0.4)',
                        color: '#fbbf24',
                        background: 'rgba(251, 191, 36, 0.12)',
                        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                        cursor: 'pointer',
                        fontSize: theme.typography.fontSize.xs,
                      }}
                    >
                      取消收藏
                    </button>
                  </div>
                ))}
              </div>
            </ModernSection>
          )}

          {lastRunSummary && (
            <ModernSection title="本次掃描摘要" description="此次任務的快速結果">
              <div style={{ color: theme.colors.neutral[700], lineHeight: 1.8, fontSize: theme.typography.fontSize.sm }}>
                掃描照片：{lastRunSummary.scanned} 張<br />
                命中結果：{lastRunSummary.matched} 張<br />
                用時：{formatElapsed(lastRunSummary.elapsedMs)}<br />
                {results.length > 0 && `最佳相似度：${getBestScoreText()}`}
              </div>
              <ScanWarningsPanel warnings={scanWarnings} />
            </ModernSection>
          )}

          {results.length === 0 && status === 'done' && (
            <ModernSection
              title="搜尋結果"
              description="未找到匹配的照片"
            >
              <div style={{
                textAlign: 'center',
                padding: theme.spacing[16],
                color: theme.colors.neutral[600],
              }}>
                <div style={{
                  fontSize: theme.typography.fontSize['5xl'],
                  marginBottom: theme.spacing[4],
                  opacity: 0.5,
                }}>
                  🔍
                </div>
                <div style={{
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.semibold,
                  marginBottom: theme.spacing[2],
                  color: theme.colors.neutral[700],
                }}>
                  未找到匹配的照片
                </div>
                <div style={{
                  fontSize: theme.typography.fontSize.base,
                  color: theme.colors.neutral[600],
                  lineHeight: theme.typography.lineHeight.relaxed,
                }}>
                  請嘗試降低門檻值或增加參考照片數量
                </div>
                <div style={{
                  marginTop: theme.spacing[5],
                  display: 'flex',
                  justifyContent: 'center',
                  gap: theme.spacing[3],
                  flexWrap: 'wrap',
                }}>
                  <button
                    onClick={handleNoMatchLowerThresholdAndRerun}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      color: '#60a5fa',
                      background: 'rgba(96, 165, 250, 0.12)',
                      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                      cursor: 'pointer',
                    }}
                  >
                    再試一次：先放寬門檻
                  </button>
                  <button
                    onClick={handleClearCacheAndRescan}
                    disabled={isProcessing}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#ef4444',
                      background: 'rgba(239, 68, 68, 0.12)',
                      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      opacity: isProcessing ? 0.5 : 1,
                    }}
                  >
                    🔄 清除快取重新掃描
                  </button>
                  <button
                    onClick={handleNoMatchAddReference}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                      color: '#fbbf24',
                      background: 'rgba(251, 191, 36, 0.12)',
                      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                      cursor: 'pointer',
                    }}
                  >
                    加參考照再重掃
                  </button>
                  <button
                    onClick={handleNoMatchSwitchPendingView}
                    style={{
                      borderRadius: theme.borderRadius.md,
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.12)',
                      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                      cursor: 'pointer',
                    }}
                  >
                    切到待複核看結果
                  </button>
                </div>
              </div>
            </ModernSection>
          )}
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {isExportPreviewOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8, 12, 28, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing[4],
          zIndex: 1000,
        }}>
          <div style={{
            width: 'min(780px, 100%)',
            maxHeight: '82vh',
            overflow: 'auto',
            background: 'rgba(14, 18, 40, 0.97)',
            borderRadius: theme.borderRadius.xl,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: theme.spacing[5],
          }}>
            <h3 style={{
              margin: `0 0 ${theme.spacing[3]}`,
              color: theme.colors.neutral[100],
            }}>
              確認匯出清單
            </h3>
            <p style={{
              margin: `0 0 ${theme.spacing[4]}`,
              color: theme.colors.neutral[300],
              fontSize: theme.typography.fontSize.sm,
            }}>
              將匯出 {exportPreviewTargets.length} 張照片
            </p>
            <div style={{ color: theme.colors.neutral[200], fontSize: theme.typography.fontSize.sm, maxHeight: '44vh', overflow: 'auto' }}>
              {exportPreviewTargets.slice(0, 50).map((item, index) => (
                <div key={item.path} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: `${theme.spacing[2]} 0`,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  color: theme.colors.neutral[300],
                }}>
                  <span>{index + 1}. {item.path.split(/[/\\]/).pop()}</span>
                  <span style={{ color: theme.colors.neutral[400] }}>
                    {(item.score * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              {exportPreviewTargets.length > 50 && (
                <div style={{ paddingTop: theme.spacing[2], color: theme.colors.neutral[400] }}>
                  還有 {exportPreviewTargets.length - 50} 張未顯示
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2], marginTop: theme.spacing[4], flexWrap: 'wrap' }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[2],
                color: theme.colors.neutral[300],
                fontSize: theme.typography.fontSize.sm,
              }}>
                <input
                  type="checkbox"
                  checked={isOpenFolderAfterExport}
                  onChange={(event) => setIsOpenFolderAfterExport(event.target.checked)}
                />
                匯出完成後直接打開輸出資料夾
              </label>
              <button
                onClick={() => setIsExportPreviewOpen(false)}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: theme.colors.neutral[200],
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={() => confirmExport(isOpenFolderAfterExport)}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  cursor: 'pointer',
                }}
              >
                選擇資料夾並匯出
              </button>
              <button
                onClick={() => confirmExport(true)}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  cursor: 'pointer',
                }}
              >
                選擇資料夾匯出並打開
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportSuccessOpen && exportSummary && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8, 12, 28, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing[4],
          zIndex: 1000,
        }}>
          <div style={{
            width: 'min(620px, 100%)',
            background: 'rgba(14, 18, 40, 0.98)',
            borderRadius: theme.borderRadius.xl,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: theme.spacing[5],
          }}>
            <h3 style={{
              margin: `0 0 ${theme.spacing[3]}`,
              color: theme.colors.neutral[100],
            }}>
              匯出完成
            </h3>
            <div style={{ color: theme.colors.neutral[300], lineHeight: 1.7, fontSize: theme.typography.fontSize.sm }}>
              <div>輸出資料夾：{exportSummary.outDir}</div>
              <div>預計匯出：{exportSummary.requested} 張</div>
              <div>成功匯出：{exportSummary.copied} 張</div>
              <div>失敗張數：{exportSummary.failed} 張</div>
              {exportSummary.error && (
                <div style={{ color: '#ef4444' }}>
                  錯誤訊息：{exportSummary.error}
                </div>
              )}
              {exportSummary.failed > 0 && (
                <div style={{ color: '#f59e0b' }}>
                  失敗數：{exportSummary.failed} 張（請檢查檔案是否仍在、或目的資料夾是否有權限）
                </div>
              )}
              {exportSummary.failed === 0 && (
                <div style={{ color: '#10b981' }}>全部完成，沒有錯過任何一張</div>
              )}
            </div>
              {exportSummary.failed > 0 && exportSummary.failedPaths && exportSummary.failedPaths.length > 0 && (
                <div style={{
                  marginTop: theme.spacing[3],
                  color: theme.colors.neutral[300],
                  fontSize: theme.typography.fontSize.xs,
                  lineHeight: 1.5,
                }}>
                  失敗清單（先挑）
                  <div style={{
                    marginTop: theme.spacing[2],
                    maxHeight: theme.spacing[20],
                    overflow: 'auto',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingTop: theme.spacing[2],
                  }}>
                    {exportSummary.failedPaths.slice(0, 20).map((path, idx) => (
                      <div key={`${path}-${idx}`} style={{
                        marginBottom: theme.spacing[1],
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {idx + 1}. {path.split(/[/\\]/).pop()}
                      </div>
                    ))}
                    {exportSummary.failedPaths.length > 20 && (
                      <div style={{ color: theme.colors.neutral[400] }}>
                        還有 {exportSummary.failedPaths.length - 20} 張未列出
                      </div>
                    )}
                  </div>
                </div>
              )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2], marginTop: theme.spacing[4], flexWrap: 'wrap' }}>
              {window.api && (
                <button
                  onClick={openExportFolder}
                  style={{
                    borderRadius: theme.borderRadius.md,
                    border: '1px solid rgba(96, 165, 250, 0.4)',
                    color: '#60a5fa',
                    background: 'rgba(96, 165, 250, 0.12)',
                    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                    cursor: 'pointer',
                  }}
                >
                  打開輸出資料夾
                </button>
              )}
              <button
                onClick={copyExportSummaryToClipboard}
                disabled={isExportClipboardCopying}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  background: isExportClipboardCopying ? 'rgba(16, 185, 129, 0.06)' : 'rgba(16, 185, 129, 0.12)',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  cursor: isExportClipboardCopying ? 'not-allowed' : 'pointer',
                }}
              >
                一鍵複製結果到手機
              </button>
              {exportSummary.failed > 0 && (
                <button
                  onClick={() => {
                    setIsExportSuccessOpen(false);
                    retryExport();
                  }}
                  style={{
                    borderRadius: theme.borderRadius.md,
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b',
                    background: 'rgba(245, 158, 11, 0.12)',
                    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                    cursor: 'pointer',
                  }}
                >
                  只重試失敗項目
                </button>
              )}
              <button
                onClick={() => {
                  setIsExportSuccessOpen(false);
                  setExportSummary(null);
                }}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  cursor: 'pointer',
                }}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
          checklist={onboardingChecklist}
        />
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} appInfo={appInfo} />

      <style>{animations}</style>
    </div>
  );
}
