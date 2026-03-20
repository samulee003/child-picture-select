import { useState, useCallback } from 'react';
import type { MatchResult } from '../../types/api';

export interface ExportSummary {
  outDir: string;
  requested: number;
  copied: number;
  failed: number;
  failedPaths?: string[];
  error?: string;
}

export interface ExportState {
  isExportPreviewOpen: boolean;
  setIsExportPreviewOpen: (v: boolean) => void;
  exportPreviewTargets: MatchResult[];
  isExportSuccessOpen: boolean;
  setIsExportSuccessOpen: (v: boolean) => void;
  exportSummary: ExportSummary | null;
  setExportSummary: (s: ExportSummary | null) => void;
  isOpenFolderAfterExport: boolean;
  setIsOpenFolderAfterExport: (v: boolean) => void;
  isExportClipboardCopying: boolean;

  // Callbacks
  handlePrepareExport: (mode?: 'default' | 'favorites' | 'pending' | 'low') => void;
  confirmExport: (openAfter?: boolean) => Promise<void>;
  openExportFolder: () => Promise<void>;
  copyExportSummaryToClipboard: () => Promise<void>;
  retryExport: () => Promise<void>;
  getExportTargets: (mode?: 'default' | 'favorites' | 'pending' | 'low') => MatchResult[];

  // Computed
  exportTargets: MatchResult[];
  exportPreviewRate: string;
}

interface ExportDeps {
  results: MatchResult[];
  reviewMode: boolean;
  reviewDecisions: Record<string, 'accepted' | 'rejected'>;
  reviewScores: Record<string, number>;
  exportOnlyFavorites: boolean;
  favoritePaths: string[];
  folder: string;
  setError: (e: string | null) => void;
  setStatus: (s: string) => void;
}

export function useExportState(deps: ExportDeps): ExportState {
  const { results, reviewMode, reviewDecisions, reviewScores, exportOnlyFavorites, favoritePaths, folder, setError, setStatus } = deps;

  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const [exportPreviewTargets, setExportPreviewTargets] = useState<MatchResult[]>([]);
  const [isExportSuccessOpen, setIsExportSuccessOpen] = useState(false);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [lastExportTargets, setLastExportTargets] = useState<string[]>([]);
  const [isOpenFolderAfterExport, setIsOpenFolderAfterExport] = useState(false);
  const [isExportClipboardCopying, setIsExportClipboardCopying] = useState(false);

  const isLowConfidence = useCallback((item: MatchResult) => {
    const score = typeof reviewScores[item.path] === 'number'
      ? reviewScores[item.path]
      : Math.round(item.score * 100);
    return score < 65;
  }, [reviewScores]);

  const getExportTargets = useCallback((mode: 'default' | 'favorites' | 'pending' | 'low' = 'default') => {
    const base = reviewMode
      ? results.filter((r) => reviewDecisions[r.path] !== 'rejected')
      : results;
    if (mode === 'favorites') return base.filter((r) => favoritePaths.includes(r.path));
    if (mode === 'pending') return base.filter((r) => !reviewDecisions[r.path]);
    if (mode === 'low') return base.filter((r) => isLowConfidence(r));
    return exportOnlyFavorites ? base.filter((r) => favoritePaths.includes(r.path)) : base;
  }, [reviewMode, results, reviewDecisions, exportOnlyFavorites, favoritePaths, isLowConfidence]);

  const exportTargets = getExportTargets();
  const exportPreviewRate = exportTargets.length > 0 && results.length > 0
    ? `${Math.round((exportTargets.length / results.length) * 100)}%`
    : '0%';

  const handleExportResults = useCallback(async (manualTargets?: string[], manualOutDir?: string) => {
    const targets = manualTargets || getExportTargets().map((item) => item.path);
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
      setExportSummary({ outDir: out, requested: targets.length, copied: 0, failed: targets.length, error: 'API 未初始化' });
      setIsExportSuccessOpen(true);
      return { ok: false, error: 'API 未初始化', data: { copied: 0, failed: targets.length, failedPaths: [] as string[] } };
    }
    try {
      const result = await window.api.exportCopy(targets, out);
      const copied = result.data?.copied || 0;
      const failed = result.data?.failed ?? Math.max(0, targets.length - copied);
      const failedPaths = result.data?.failedPaths || [];
      setLastExportTargets(failedPaths.length > 0 ? failedPaths : []);
      const hasFailure = failed > 0 || !result.ok;
      setStatus(`exported (${copied} files)`);
      setExportSummary({
        outDir: out, requested: targets.length, copied, failed, failedPaths,
        error: hasFailure ? (result.error || '匯出未完全成功') : undefined,
      });
      setIsExportSuccessOpen(true);
      setStatus(hasFailure ? 'done' : `exported (${copied} files)`);
      if (hasFailure) setError(`匯出未完全成功：失敗 ${failed} 張`);
      return { ...result, data: { copied, failed, failedPaths } };
    } catch (err: any) {
      setError(`匯出錯誤: ${err?.message || '未知錯誤'}`);
      setStatus('done');
      setExportSummary({ outDir: out, requested: targets.length, copied: 0, failed: targets.length, error: err?.message || '未知錯誤' });
      setIsExportSuccessOpen(true);
      return { ok: false, error: err?.message || '未知錯誤', data: { copied: 0, failed: targets.length, failedPaths: [] as string[] } };
    }
  }, [getExportTargets, folder, setError, setStatus]);

  const handlePrepareExport = useCallback((mode: 'default' | 'favorites' | 'pending' | 'low' = 'default') => {
    const targets = getExportTargets(mode);
    if (targets.length === 0) {
      setError('沒有可匯出的結果');
      return;
    }
    setExportPreviewTargets(targets);
    setIsExportPreviewOpen(true);
  }, [getExportTargets, setError]);

  const confirmExport = useCallback(async (openAfter = false) => {
    setIsExportPreviewOpen(false);
    const paths = exportPreviewTargets.map((item) => item.path);
    let outDir: string | null = null;
    if (window.api?.selectFolder) {
      outDir = await window.api.selectFolder();
      if (!outDir) return;
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
  }, [handleExportResults, exportPreviewTargets, folder, setError]);

  const openExportFolder = useCallback(async () => {
    if (!exportSummary) return;
    const result = await window.api?.openFolder(exportSummary.outDir);
    if (!result || !result.ok) {
      setError(`打開資料夾失敗: ${result?.error || '未知錯誤'}`);
    }
  }, [exportSummary, setError]);

  const copyExportSummaryToClipboard = useCallback(async () => {
    if (!exportSummary) return;
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
      '', '請將此路徑貼到手機傳輸工具中使用：', exportSummary.outDir,
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
  }, [exportSummary, setError]);

  const retryExport = useCallback(async () => {
    if (!exportSummary) return;
    const retryTargets = exportSummary.failedPaths?.length
      ? exportSummary.failedPaths
      : lastExportTargets;
    await handleExportResults(retryTargets, exportSummary.outDir);
  }, [exportSummary, handleExportResults, lastExportTargets]);

  return {
    isExportPreviewOpen, setIsExportPreviewOpen,
    exportPreviewTargets,
    isExportSuccessOpen, setIsExportSuccessOpen,
    exportSummary, setExportSummary,
    isOpenFolderAfterExport, setIsOpenFolderAfterExport,
    isExportClipboardCopying,
    handlePrepareExport, confirmExport, openExportFolder,
    copyExportSummaryToClipboard, retryExport, getExportTargets,
    exportTargets, exportPreviewRate,
  };
}
