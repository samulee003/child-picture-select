import React, { useRef, useEffect, useState } from 'react';
import { Grid, type CellComponentProps } from 'react-window';
import { ModernSection } from './ModernLayout';
import { MatchResultCard } from './MatchResultCard';
import { ScanWarningsPanel } from './ScanWarningsPanel';
import { theme } from '../styles/theme';
import type { MatchResult } from '../../types/api';

interface ResultsSectionProps {
  results: MatchResult[];
  displayedResults: MatchResult[];
  compactView: boolean;
  setCompactView: React.Dispatch<React.SetStateAction<boolean>>;
  reviewMode: boolean;
  setReviewMode: (v: boolean) => void;
  reviewDecisions: Record<string, 'accepted' | 'rejected'>;
  reviewScores: Record<string, number>;
  reviewFilter: 'all' | 'pending' | 'low';
  setReviewFilter: (f: 'all' | 'pending' | 'low') => void;
  isTopTwentyView: boolean;
  setIsTopTwentyView: React.Dispatch<React.SetStateAction<boolean>>;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  lowConfidenceCount: number;
  favoritePaths: string[];
  onDecision: (path: string, decision: 'accepted' | 'rejected' | null) => void;
  onReviewScore: (path: string, score: number) => void;
  onBatchDecision: (decision: 'accepted' | 'rejected' | null) => void;
  onFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
  onLowerThreshold: () => boolean;
  refPaths?: string[];

  // Scan summary
  lastRunSummary: { scanned: number; matched: number; elapsedMs: number } | null;
  formatElapsed: (ms: number) => string;
  getBestScoreText: () => string;
  scanWarnings: string[];

  // Favorites section
  favoriteMatches: MatchResult[];
  onClearFavorites: () => void;
}

const CARD_MIN_WIDTH = 300;
const COMPACT_ROW_HEIGHT = 240;
const DETAILED_ROW_HEIGHT = 380;
const VIRTUALIZE_THRESHOLD = 60;

export function ResultsSection(props: ResultsSectionProps) {
  const {
    results, displayedResults, compactView, setCompactView,
    reviewMode, setReviewMode, reviewDecisions, reviewScores,
    reviewFilter, setReviewFilter, isTopTwentyView, setIsTopTwentyView,
    acceptedCount, rejectedCount, pendingCount, lowConfidenceCount,
    onDecision, onReviewScore, onBatchDecision,
    onFavorite, isFavorite, onLowerThreshold,
    lastRunSummary, formatElapsed, getBestScoreText, scanWarnings,
    favoriteMatches, onClearFavorites,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const columnCount = Math.max(1, Math.floor(containerWidth / CARD_MIN_WIDTH));
  const rowHeight = compactView ? COMPACT_ROW_HEIGHT : DETAILED_ROW_HEIGHT;
  const columnWidth = containerWidth / columnCount;
  const rowCount = Math.ceil(displayedResults.length / columnCount);
  const useVirtualization = displayedResults.length >= VIRTUALIZE_THRESHOLD;

  const filterBtnStyle = (active: boolean) => ({
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${active ? theme.colors.primary[500] : 'rgba(0, 0, 0, 0.12)'}`,
    color: active ? theme.colors.primary[700] : theme.colors.neutral[600],
    background: active ? 'rgba(0, 151, 245, 0.08)' : 'transparent',
    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
    cursor: 'pointer' as const,
  });

  interface VirtualCellProps {
    items: MatchResult[];
    cols: number;
    compact: boolean;
    revMode: boolean;
    revDecisions: Record<string, 'accepted' | 'rejected'>;
    revScores: Record<string, number>;
    onDec: (path: string, decision: 'accepted' | 'rejected' | null) => void;
    onScore: (path: string, score: number) => void;
    onFav: (path: string) => void;
    isFav: (path: string) => boolean;
    refPaths?: string[];
  }

  function VirtualCell({ columnIndex, rowIndex, style, ...cellProps }: CellComponentProps<VirtualCellProps>) {
    const index = rowIndex * cellProps.cols + columnIndex;
    if (index >= cellProps.items.length) return null;
    const r = cellProps.items[index];
    return (
      <div style={{ ...style, padding: '8px' }}>
        <MatchResultCard
          result={r}
          index={index}
          compact={cellProps.compact}
          onFavorite={cellProps.onFav}
          isFavorite={cellProps.isFav(r.path)}
          onDecision={cellProps.revMode ? cellProps.onDec : undefined}
          onReviewScore={cellProps.revMode ? cellProps.onScore : undefined}
          reviewDecision={cellProps.revMode ? cellProps.revDecisions[r.path] : undefined}
          reviewScore={cellProps.revMode ? cellProps.revScores[r.path] : undefined}
          refPaths={cellProps.refPaths}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[6] }}>
      {results.length > 0 && (
        <ModernSection
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.colors.neutral[0], fontWeight: theme.typography.fontWeight.bold,
                fontSize: theme.typography.fontSize.sm,
              }}>4</div>
              搜尋結果 ({results.length} 張)
            </div>
          }
          description="找到與參考照片相似的照片"
        >
          {/* Controls row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: theme.spacing[4],
            marginBottom: theme.spacing[4], flexWrap: 'wrap',
          }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: theme.spacing[2],
              color: theme.colors.neutral[700], fontSize: theme.typography.fontSize.sm,
            }}>
              <input type="checkbox" checked={reviewMode} onChange={(e) => setReviewMode(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              啟用逐一複核
            </label>
            <span style={{ color: theme.colors.neutral[600], fontSize: theme.typography.fontSize.sm }}>
              保留 {acceptedCount} / 排除 {rejectedCount} / 待審核 {pendingCount}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setCompactView(v => !v)}
              style={{
                borderRadius: theme.borderRadius.md,
                border: '1px solid rgba(0, 0, 0, 0.12)',
                color: theme.colors.neutral[600],
                background: 'transparent',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              {compactView ? '詳細模式' : '簡潔模式'}
            </button>
          </div>

          {/* Info row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: theme.spacing[4],
            marginBottom: theme.spacing[3], flexWrap: 'wrap',
          }}>
            <div style={{ color: theme.colors.neutral[700], fontSize: theme.typography.fontSize.sm }}>
              已收藏：{props.favoritePaths.length} 張
            </div>
            <div style={{
              color: theme.colors.neutral[600], fontSize: theme.typography.fontSize.xs, lineHeight: 1.5,
            }}>
              親切提醒：分數越高越像你的小孩；60% 以下先標記「待檢查」，再決定要不要放入收藏
            </div>
            {lowConfidenceCount > 0 && (
              <button
                onClick={onLowerThreshold}
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

          {lowConfidenceCount > 0 && (
            <div style={{ marginBottom: theme.spacing[4], color: theme.colors.neutral[700], fontSize: theme.typography.fontSize.sm }}>
              低信心待複核：{lowConfidenceCount} 張（建議手動打分或排除）
            </div>
          )}

          {/* Review mode filters */}
          {reviewMode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: theme.spacing[2],
              flexWrap: 'wrap', marginBottom: theme.spacing[4],
            }}>
              <span style={{ color: theme.colors.neutral[700], fontSize: theme.typography.fontSize.sm }}>查看：</span>
              <button onClick={() => setReviewFilter('all')} style={filterBtnStyle(reviewFilter === 'all')}>全部</button>
              <button onClick={() => setReviewFilter('pending')} style={filterBtnStyle(reviewFilter === 'pending')}>待審核</button>
              <button onClick={() => setReviewFilter('low')} style={filterBtnStyle(reviewFilter === 'low')}>低信心</button>
              <button
                onClick={() => setIsTopTwentyView(prev => !prev)}
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
                onClick={() => onBatchDecision('accepted')}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#15803d',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  cursor: 'pointer',
                }}
              >一鍵保留全部</button>
              <button
                onClick={() => onBatchDecision('rejected')}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#b91c1c',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  cursor: 'pointer',
                }}
              >一鍵排除全部</button>
              <button
                onClick={() => onBatchDecision(null)}
                style={{
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  color: theme.colors.neutral[600],
                  background: 'transparent',
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  cursor: 'pointer',
                }}
              >清空決定</button>
            </div>
          )}

          {/* Results grid — virtualized when many results */}
          <div ref={containerRef}>
            {useVirtualization ? (
              <div style={{ height: `${Math.min(rowCount * rowHeight, 720)}px`, overflow: 'hidden' }}>
                <Grid
                  columnCount={columnCount}
                  columnWidth={columnWidth}
                  rowCount={rowCount}
                  rowHeight={rowHeight}
                  cellComponent={VirtualCell}
                  cellProps={{
                    items: displayedResults,
                    cols: columnCount,
                    compact: compactView,
                    revMode: reviewMode,
                    revDecisions: reviewDecisions,
                    revScores: reviewScores,
                    onDec: onDecision,
                    onScore: onReviewScore,
                    onFav: onFavorite,
                    isFav: isFavorite,
                    refPaths: props.refPaths,
                  }}
                  style={{ height: '100%', overflowX: 'hidden' }}
                />
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: theme.spacing[4],
              }}>
                {displayedResults.map((r, index) => (
                  <MatchResultCard
                    key={r.path}
                    result={r}
                    index={index}
                    compact={compactView}
                    onFavorite={onFavorite}
                    isFavorite={isFavorite(r.path)}
                    onDecision={reviewMode ? onDecision : undefined}
                    onReviewScore={reviewMode ? onReviewScore : undefined}
                    reviewDecision={reviewMode ? reviewDecisions[r.path] : undefined}
                    reviewScore={reviewMode ? reviewScores[r.path] : undefined}
                    refPaths={props.refPaths}
                  />
                ))}
              </div>
            )}
          </div>
          {displayedResults.length === 0 && (
            <div style={{
              textAlign: 'center', padding: theme.spacing[8],
              color: theme.colors.neutral[600], fontSize: theme.typography.fontSize.sm,
            }}>
              {isTopTwentyView ? '目前無法組出前20張結果，先取消「先看前20」後再試' : '目前沒有符合篩選條件的結果'}
            </div>
          )}
        </ModernSection>
      )}

      {/* Favorites section */}
      {favoriteMatches.length > 0 && (
        <ModernSection
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f472b6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.colors.neutral[0], fontWeight: theme.typography.fontWeight.bold,
                fontSize: theme.typography.fontSize.sm,
              }}>★</div>
              收藏清單 ({favoriteMatches.length} 張)
            </div>
          }
          description="你最近標記為有價值的照片（可快速再次使用）"
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: theme.spacing[3], flexWrap: 'wrap', gap: theme.spacing[2],
          }}>
            <span style={{ color: theme.colors.neutral[600], fontSize: theme.typography.fontSize.sm }}>
              這個清單可直接用來回看，點對應結果也可以取消收藏
            </span>
            <button
              onClick={onClearFavorites}
              style={{
                borderRadius: theme.borderRadius.md,
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.08)',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                cursor: 'pointer',
              }}
            >清空收藏</button>
          </div>
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
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
                  onClick={() => onDecision(item.path, 'accepted')}
                  style={{
                    borderRadius: theme.borderRadius.sm,
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                    cursor: 'pointer', fontSize: theme.typography.fontSize.xs,
                  }}
                >保留</button>
                <button
                  onClick={() => onDecision(item.path, 'rejected')}
                  style={{
                    borderRadius: theme.borderRadius.sm,
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                    cursor: 'pointer', fontSize: theme.typography.fontSize.xs,
                  }}
                >排除</button>
                <button
                  onClick={() => onFavorite(item.path)}
                  style={{
                    borderRadius: theme.borderRadius.sm,
                    border: '1px solid rgba(251, 191, 36, 0.4)',
                    color: '#fbbf24',
                    background: 'rgba(251, 191, 36, 0.12)',
                    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                    cursor: 'pointer', fontSize: theme.typography.fontSize.xs,
                  }}
                >取消收藏</button>
              </div>
            ))}
          </div>
        </ModernSection>
      )}

      {/* Scan summary */}
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
    </div>
  );
}
