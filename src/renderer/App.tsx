/**
 * Modern App Component with Beautiful UI
 * Features glassmorphism, gradients, animations, and contemporary design
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ModernButton } from './components/ModernButton';
import { StatusBadge } from './components/StatusBadge';
import { DragDropZone } from './components/DragDropZone';
import { HelpModal } from './components/HelpModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { AIAnalysisPanel } from './components/AIAnalysisPanel';
import { ScanControls } from './components/ScanControls';
import { UpdateBanner } from './components/UpdateBanner';
import { WelcomeState } from './components/WelcomeState';
import { NoMatchesSection } from './components/NoMatchesSection';
import { ResultsSection } from './components/ResultsSection';
import { ExportPreviewModal } from './components/ExportPreviewModal';
import { ExportSuccessModal } from './components/ExportSuccessModal';
import { RefPhotoFeedback } from './components/RefPhotoFeedback';
import { SwipeReview } from './components/SwipeReview';
import { useKeyboardShortcuts, commonShortcuts } from './hooks/useKeyboardShortcuts';
import { useScanState } from './hooks/useScanState';
import { useReviewState } from './hooks/useReviewState';
import { useFavorites } from './hooks/useFavorites';
import { useExportState } from './hooks/useExportState';
import { theme, animations } from './styles/theme';

export function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSwipeReview, setIsSwipeReview] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('onboardingCompleted');
  });

  // Favorites
  const favorites = useFavorites();

  // Scan state
  const scan = useScanState();

  // Review state bound to scan results
  const review = useReviewState(scan.results);

  // Reset review state when results change (new scan)
  const prevResultsRef = useRef(scan.results);
  useEffect(() => {
    if (scan.results !== prevResultsRef.current && scan.results.length > 0) {
      review.setReviewDecisions({});
      const initialScores = scan.results.reduce<Record<string, number>>((acc, item) => {
        acc[item.path] = Math.round(item.score * 100);
        return acc;
      }, {});
      review.setReviewScores(initialScores);
    }
    prevResultsRef.current = scan.results;
  }, [scan.results]);

  // Export state
  const exportState = useExportState({
    results: scan.results,
    reviewMode: review.reviewMode,
    reviewDecisions: review.reviewDecisions,
    reviewScores: review.reviewScores,
    exportOnlyFavorites: favorites.exportOnlyFavorites,
    favoritePaths: favorites.favoritePaths,
    folder: scan.folder,
    setError: scan.setError,
    setStatus: scan.setStatus,
  });

  // Keyboard shortcuts
  const handleSaveSettings = useCallback(() => {
    const tempError = scan.error;
    scan.setError('設定已儲存');
    setTimeout(() => scan.setError(tempError), 2000);
  }, [scan.error]);

  const handleRun = useCallback(() => {
    if (!scan.isProcessing && scan.folder.trim() && (scan.refsLoaded > 0 || scan.refPaths.trim())) {
      scan.handleRunScan();
    }
  }, [scan.isProcessing, scan.folder, scan.refsLoaded, scan.refPaths]);

  const handleExport = useCallback(() => {
    if (scan.results.length > 0 && !scan.isProcessing) {
      exportState.setIsExportPreviewOpen(true);
    }
  }, [scan.results.length, scan.isProcessing]);

  const handleHelp = useCallback(() => setIsHelpOpen(true), []);

  const handleClear = useCallback(() => {
    scan.handleClear();
    review.setReviewDecisions({});
    review.setReviewScores({});
    exportState.setIsExportPreviewOpen(false);
    exportState.setIsExportSuccessOpen(false);
    exportState.setExportSummary(null);
  }, [scan.handleClear]);

  const handleNoMatchSwitchPending = useCallback(() => {
    scan.handleNoMatchSwitchPendingView();
    review.setReviewFilter('pending');
  }, [scan.handleNoMatchSwitchPendingView]);

  useKeyboardShortcuts([
    { ...commonShortcuts.save, action: handleSaveSettings },
    { ...commonShortcuts.run, action: handleRun },
    { ...commonShortcuts.export, action: handleExport },
    { ...commonShortcuts.clear, action: handleClear },
    { ...commonShortcuts.help, action: handleHelp },
    { key: 'Escape', action: () => setIsHelpOpen(false) }
  ]);

  const handleOnboardingDone = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  const favoriteMatches = favorites.getFavoriteMatches(scan.results);

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
        width: '380px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid rgba(0,0,0,0.06)`,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Compact Header */}
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[3],
          flexShrink: 0,
        }}>
          <img src="logo.png" alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
          <div style={{ flex: 1 }}>
            <h1 style={{
              margin: 0,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              background: theme.gradients.primary,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>大海撈Ｂ</h1>
          </div>
          <StatusBadge status={scan.getStatusType()} size="sm">{scan.getStatusText()}</StatusBadge>
          {scan.modelStatus && (
            <span style={{
              fontSize: '10px',
              color: scan.modelStatus.loaded ? '#10b981' : '#ef4444',
              fontWeight: 600,
            }}>
              {scan.modelStatus.loaded ? 'AI' : '!'}
            </span>
          )}
        </div>

        {/* Scrollable content area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: `${theme.spacing[4]} ${theme.spacing[4]}`,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[4],
        }}>
          {/* Model warning */}
          {scan.modelStatus && !scan.modelStatus.loaded && (
            <div style={{
              padding: theme.spacing[3],
              borderRadius: theme.borderRadius.md,
              background: scan.modelStatus.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${scan.modelStatus.error ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
              fontSize: theme.typography.fontSize.xs,
              color: scan.modelStatus.error ? '#ef4444' : '#f59e0b',
            }}>
              <strong>{scan.modelStatus.error ? 'AI 載入失敗' : 'AI 載入中...'}</strong>
              {scan.modelStatus.error && <div style={{ marginTop: 2, opacity: 0.8 }}>請重新啟動應用程式</div>}
            </div>
          )}

          {/* Error Alert */}
          {scan.error && (
            <div style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              background: scan.error.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${scan.error.startsWith('✅') ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: theme.spacing[2],
            }}>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: scan.error.startsWith('✅') ? '#10b981' : theme.colors.error[600],
                lineHeight: 1.5,
                flex: 1,
              }}>{scan.error}</span>
              <button onClick={() => scan.setError(null)} style={{
                background: 'none', border: 'none', color: theme.colors.neutral[400],
                cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0,
              }}>×</button>
            </div>
          )}

          {/* ① Reference Photos */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[2],
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: scan.refPaths.trim() ? '#10b981' : theme.colors.primary[500],
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '12px', flexShrink: 0,
              }}>{scan.refPaths.trim() ? '✓' : '1'}</div>
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.neutral[800],
              }}>參考照片</span>
              {scan.refsLoaded > 0 && (
                <span style={{ fontSize: theme.typography.fontSize.xs, color: '#10b981', marginLeft: 'auto' }}>
                  {scan.refsLoaded} 張已載入
                </span>
              )}
            </div>
            <DragDropZone onFilesDrop={scan.handleRefFilesDrop} accept="files" disabled={scan.isProcessing}>
              <div
                style={{
                  border: `2px dashed ${scan.refPaths.trim() ? theme.colors.primary[300] : theme.colors.neutral[300]}`,
                  borderRadius: theme.borderRadius.md,
                  padding: scan.refPaths.trim() ? theme.spacing[3] : theme.spacing[4],
                  textAlign: 'center',
                  background: scan.refPaths.trim() ? 'rgba(58,123,170,0.04)' : 'rgba(255,255,255,0.5)',
                  cursor: scan.isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => !scan.isProcessing && scan.handleBrowseFiles()}
              >
                {scan.refPaths.trim() ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], justifyContent: 'center' }}>
                    <span style={{ fontSize: theme.typography.fontSize.lg }}>{scan.refsLoaded > 0 ? '✅' : '📸'}</span>
                    <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.primary[600], fontWeight: 600 }}>
                      {scan.refsLoaded > 0
                        ? `已載入 ${scan.refsLoaded} 張`
                        : `已選 ${scan.refPaths.split(/\r?\n/).filter(s => s.trim()).length} 張`}
                    </span>
                    <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.neutral[400] }}>點擊新增</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '28px', marginBottom: theme.spacing[2], opacity: 0.6 }}>📸</div>
                    <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.primary[600], fontWeight: 600 }}>
                      點擊選擇小孩的照片
                    </div>
                    <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.neutral[400], marginTop: theme.spacing[1] }}>
                      建議 3-10 張清晰正面照 / 可拖放
                    </div>
                  </div>
                )}
              </div>
            </DragDropZone>
            {scan.refPaths.trim() && (
              <div style={{ display: 'flex', gap: theme.spacing[2], marginTop: theme.spacing[2] }}>
                <ModernButton variant="secondary" size="sm" onClick={scan.handleBrowseFiles} disabled={scan.isProcessing}>新增</ModernButton>
                <ModernButton variant="ghost" size="sm" onClick={() => { scan.setRefPaths(''); scan.setRefsLoaded(0); }} disabled={scan.isProcessing}>清除</ModernButton>
                {scan.refsLoaded > 0 && (
                  <ModernButton variant="primary" size="sm" loading={scan.status === 'embedding refs...'} disabled={scan.isProcessing} onClick={scan.handleEmbedRefs}>重新載入</ModernButton>
                )}
              </div>
            )}
            <textarea ref={scan.refPathsTextareaRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} value={scan.refPaths} onChange={(e) => scan.setRefPaths(e.target.value)} tabIndex={-1} />

            {/* Reference photo quality feedback */}
            {scan.refQualityResults.length > 0 && scan.refsLoaded > 0 && (
              <div style={{ marginTop: theme.spacing[2] }}>
                <RefPhotoFeedback
                  results={scan.refQualityResults}
                  onRemove={(path) => {
                    const lines = scan.refPaths.split('\n').filter(p => p.trim() !== path);
                    scan.setRefPaths(lines.join('\n'));
                    scan.setRefsLoaded(0);
                    scan.setStatus('idle');
                  }}
                />
              </div>
            )}
          </div>

          {/* ② Folder */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[2],
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: scan.folder.trim() ? '#10b981' : theme.colors.secondary[500],
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '12px', flexShrink: 0,
              }}>{scan.folder.trim() ? '✓' : '2'}</div>
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.neutral[800],
              }}>搜尋資料夾</span>
            </div>
            <DragDropZone onFilesDrop={() => {}} onFolderDrop={scan.handleFolderDrop} accept="folders" disabled={scan.isProcessing}>
              {scan.folder.trim() ? (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: theme.spacing[2],
                    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                    borderRadius: theme.borderRadius.md,
                    border: '1px solid rgba(16,185,129,0.3)',
                    background: 'rgba(16,185,129,0.05)',
                    cursor: scan.isProcessing ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => !scan.isProcessing && scan.handleBrowseFolder()}
                >
                  <span style={{ color: '#10b981', fontSize: '16px' }}>📁</span>
                  <span style={{
                    flex: 1, fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.neutral[700],
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {scan.folder.split(/[/\\]/).slice(-2).join('/')}
                  </span>
                  <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.neutral[400] }}>換</span>
                </div>
              ) : (
                <div
                  style={{
                    border: `2px dashed ${theme.colors.neutral[300]}`,
                    borderRadius: theme.borderRadius.md,
                    padding: theme.spacing[3],
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.5)',
                    cursor: scan.isProcessing ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => !scan.isProcessing && scan.handleBrowseFolder()}
                >
                  <div style={{ fontSize: '24px', marginBottom: theme.spacing[1], opacity: 0.5 }}>📁</div>
                  <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.secondary[600], fontWeight: 600 }}>
                    點擊選擇照片資料夾
                  </div>
                  <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.neutral[400], marginTop: theme.spacing[1] }}>
                    班級照、活動照的資料夾 / 可拖放
                  </div>
                </div>
              )}
            </DragDropZone>
          </div>

          {/* ③ Search mode */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[2],
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: theme.colors.neutral[400],
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '12px', flexShrink: 0,
              }}>3</div>
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.neutral[800],
              }}>搜尋模式</span>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: scan.getThresholdGuide().color,
                fontWeight: 700,
                marginLeft: 'auto',
              }}>{scan.getThresholdGuide().label}</span>
            </div>
            <div style={{ display: 'flex', gap: theme.spacing[1], marginBottom: theme.spacing[2] }}>
              {[
                { label: '寬鬆', value: 0.45, color: '#3b82f6' },
                { label: '平衡 *', value: 0.6, color: '#f59e0b' },
                { label: '精確', value: 0.75, color: '#ef4444' },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => scan.setThreshold(preset.value)}
                  disabled={scan.isProcessing}
                  style={{
                    flex: 1, padding: `6px 0`,
                    borderRadius: theme.borderRadius.md,
                    border: `2px solid ${Math.abs(scan.threshold - preset.value) < 0.08 ? preset.color : 'rgba(0,0,0,0.08)'}`,
                    background: Math.abs(scan.threshold - preset.value) < 0.08 ? `${preset.color}12` : 'transparent',
                    color: Math.abs(scan.threshold - preset.value) < 0.08 ? preset.color : theme.colors.neutral[500],
                    cursor: scan.isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: Math.abs(scan.threshold - preset.value) < 0.08 ? 700 : 500,
                    fontSize: theme.typography.fontSize.xs,
                    transition: 'all 0.15s',
                  }}
                >{preset.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
              <span style={{ fontSize: '10px', color: '#10b981' }}>多找</span>
              <input
                type="range" min={0} max={1} step={0.01} value={scan.threshold}
                onChange={(e) => scan.setThreshold(parseFloat(e.target.value))}
                style={{
                  flex: 1, height: '6px', borderRadius: theme.borderRadius.full,
                  outline: 'none', appearance: 'none',
                  background: 'linear-gradient(to right, #10b981, #3b82f6 35%, #f59e0b 60%, #ef4444)',
                }}
                disabled={scan.isProcessing}
              />
              <span style={{ fontSize: '10px', color: '#ef4444' }}>精準</span>
            </div>
            <div style={{ fontSize: '11px', color: theme.colors.neutral[400], marginTop: theme.spacing[1] }}>
              {scan.getThresholdGuide().desc}
            </div>
          </div>

          {/* Export section */}
          {scan.results.length > 0 && (
            <div style={{
              padding: theme.spacing[3],
              borderRadius: theme.borderRadius.md,
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.15)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: theme.spacing[2],
                marginBottom: theme.spacing[2], flexWrap: 'wrap',
              }}>
                <button
                  onClick={() => favorites.setExportOnlyFavorites(false)}
                  style={{
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${!favorites.exportOnlyFavorites ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.1)'}`,
                    color: !favorites.exportOnlyFavorites ? '#3b82f6' : theme.colors.neutral[500],
                    background: !favorites.exportOnlyFavorites ? 'rgba(59,130,246,0.1)' : 'transparent',
                    padding: '3px 8px', cursor: 'pointer', fontSize: theme.typography.fontSize.xs,
                  }}
                >全部</button>
                <button
                  onClick={() => favorites.setExportOnlyFavorites(true)}
                  style={{
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${favorites.exportOnlyFavorites ? 'rgba(251,191,36,0.5)' : 'rgba(0,0,0,0.1)'}`,
                    color: favorites.exportOnlyFavorites ? '#f59e0b' : theme.colors.neutral[500],
                    background: favorites.exportOnlyFavorites ? 'rgba(251,191,36,0.1)' : 'transparent',
                    padding: '3px 8px', cursor: 'pointer', fontSize: theme.typography.fontSize.xs,
                  }}
                >收藏 {favoriteMatches.length}</button>
              </div>
              <ModernButton
                variant="secondary" size="md" fullWidth
                disabled={scan.isProcessing}
                onClick={() => exportState.handlePrepareExport('default')}
              >
                匯出 {exportState.exportTargets.length} 張
              </ModernButton>
            </div>
          )}

          {/* Last run shortcut */}
          {scan.hasLastRunConfig && !scan.refPaths.trim() && !scan.folder.trim() && (
            <button
              onClick={scan.handleLoadLastSettings}
              disabled={scan.isProcessing}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                borderRadius: theme.borderRadius.md,
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'rgba(255,255,255,0.6)',
                color: theme.colors.neutral[600],
                cursor: scan.isProcessing ? 'not-allowed' : 'pointer',
                fontSize: theme.typography.fontSize.xs,
                textAlign: 'left',
              }}
            >
              載入上次設定：{scan.settings.lastReferencePaths.length} 張參考照 / {scan.lastFolderDisplay}
            </button>
          )}
        </div>

        {/* Sticky CTA */}
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          background: 'rgba(255,255,255,0.95)',
          flexShrink: 0,
        }}>
          <ModernButton
            variant="success" size="lg" fullWidth
            loading={scan.isProcessing}
            disabled={scan.isProcessing || !scan.folder.trim() || (scan.refsLoaded === 0 && scan.refPaths.trim() === '')}
            onClick={scan.handleRunScan}
          >
            {scan.isProcessing ? '處理中...' : scan.refsLoaded === 0 && scan.refPaths.trim() ? '載入照片並搜尋' : '開始搜尋'}
          </ModernButton>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: theme.spacing[3], marginTop: theme.spacing[2],
          }}>
            <button onClick={handleHelp} style={{ background: 'none', border: 'none', color: theme.colors.neutral[400], cursor: 'pointer', fontSize: theme.typography.fontSize.xs }}>說明</button>
            <button onClick={() => setIsHelpOpen(true)} style={{ background: 'none', border: 'none', color: theme.colors.neutral[400], cursor: 'pointer', fontSize: theme.typography.fontSize.xs }}>{scan.appInfo?.version ? `v${scan.appInfo.version}` : '關於'}</button>
            <button onClick={() => window.api?.openExternal?.('https://buymeacoffee.com/samulee003')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: theme.typography.fontSize.xs, fontWeight: 600 }}>☕ 支持</button>
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
          <UpdateBanner />

          {/* Welcome State */}
          {scan.results.length === 0 && !scan.status.includes('ing...') && scan.status !== 'done' && (
            <WelcomeState
              refPaths={scan.refPaths}
              folder={scan.folder}
              isProcessing={scan.isProcessing}
              onBrowseFiles={scan.handleBrowseFiles}
              onBrowseFolder={scan.handleBrowseFolder}
              onRunScan={scan.handleRunScan}
            />
          )}

          {/* AI Analysis Panel during scanning */}
          {scan.progress && (
            <div style={{ animation: 'slideIn 0.3s ease-out' }}>
              <AIAnalysisPanel progress={scan.progress} />
              {scan.status === 'scanning...' && (
                <ScanControls key={scan.scanStartTimeRef.current} onCancelled={() => {
                  scan.setStatus('idle');
                  scan.setProgress(null);
                  scan.setError('掃描已取消');
                }} />
              )}
            </div>
          )}

          {/* Swipe Review Button */}
          {scan.results.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsSwipeReview(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(59,130,246,0.3)',
                  background: 'rgba(59,130,246,0.05)',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                👆 滑動快速審核
              </button>
            </div>
          )}

          {/* Results, Favorites, Scan Summary */}
          <ResultsSection
            results={scan.results}
            displayedResults={review.displayedResults}
            compactView={review.compactView}
            setCompactView={review.setCompactView}
            reviewMode={review.reviewMode}
            setReviewMode={review.setReviewMode}
            reviewDecisions={review.reviewDecisions}
            reviewScores={review.reviewScores}
            reviewFilter={review.reviewFilter}
            setReviewFilter={review.setReviewFilter}
            isTopTwentyView={review.isTopTwentyView}
            setIsTopTwentyView={review.setIsTopTwentyView}
            acceptedCount={review.acceptedCount}
            rejectedCount={review.rejectedCount}
            pendingCount={review.pendingCount}
            lowConfidenceCount={review.lowConfidenceCount}
            favoritePaths={favorites.favoritePaths}
            onDecision={review.handleDecision}
            onReviewScore={review.handleReviewScore}
            onBatchDecision={review.handleBatchDecision}
            onFavorite={favorites.toggleFavorite}
            isFavorite={favorites.isFavorite}
            onLowerThreshold={scan.lowerThresholdForRetry}
            lastRunSummary={scan.lastRunSummary}
            formatElapsed={scan.formatElapsed}
            getBestScoreText={scan.getBestScoreText}
            scanWarnings={scan.scanWarnings}
            favoriteMatches={favoriteMatches}
            onClearFavorites={() => favorites.setFavoritePaths([])}
          />

          {/* No matches */}
          {scan.results.length === 0 && scan.status === 'done' && (
            <NoMatchesSection
              isProcessing={scan.isProcessing}
              onLowerThreshold={scan.handleNoMatchLowerThresholdAndRerun}
              onClearCache={scan.handleClearCacheAndRescan}
              onAddReference={scan.handleNoMatchAddReference}
              onSwitchPending={handleNoMatchSwitchPending}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {exportState.isExportPreviewOpen && (
        <ExportPreviewModal
          targets={exportState.exportPreviewTargets}
          isOpenFolderAfterExport={exportState.isOpenFolderAfterExport}
          onToggleOpenFolder={exportState.setIsOpenFolderAfterExport}
          onCancel={() => exportState.setIsExportPreviewOpen(false)}
          onConfirm={exportState.confirmExport}
        />
      )}

      {exportState.isExportSuccessOpen && exportState.exportSummary && (
        <ExportSuccessModal
          summary={exportState.exportSummary}
          onOpenFolder={exportState.openExportFolder}
          onCopy={exportState.copyExportSummaryToClipboard}
          onRetry={() => {
            exportState.setIsExportSuccessOpen(false);
            exportState.retryExport();
          }}
          onClose={() => {
            exportState.setIsExportSuccessOpen(false);
            exportState.setExportSummary(null);
          }}
          isClipboardCopying={exportState.isExportClipboardCopying}
        />
      )}

      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingDone}
          onSkip={handleOnboardingDone}
          checklist={scan.onboardingChecklist}
        />
      )}

      {isSwipeReview && scan.results.length > 0 && (
        <SwipeReview
          results={scan.results}
          reviewDecisions={review.reviewDecisions}
          onDecision={review.handleDecision}
          onClose={() => setIsSwipeReview(false)}
        />
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} appInfo={scan.appInfo} />

      <style>{animations}</style>
    </div>
  );
}
