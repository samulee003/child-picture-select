import React from 'react';
import { ModernSection } from './ModernLayout';
import { theme } from '../styles/theme';

interface NoMatchesSectionProps {
  isProcessing: boolean;
  onLowerThreshold: () => void;
  onClearCache: () => void;
  onAddReference: () => void;
  onSwitchPending: () => void;
}

export function NoMatchesSection({
  isProcessing,
  onLowerThreshold,
  onClearCache,
  onAddReference,
  onSwitchPending,
}: NoMatchesSectionProps) {
  const btnBase = {
    borderRadius: theme.borderRadius.md,
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    cursor: isProcessing ? 'not-allowed' as const : 'pointer' as const,
  };

  return (
    <ModernSection title="搜尋結果" description="未找到匹配的照片">
      <div style={{
        textAlign: 'center',
        padding: theme.spacing[16],
        color: theme.colors.neutral[400],
      }}>
        <div style={{ fontSize: theme.typography.fontSize['5xl'], marginBottom: theme.spacing[4], opacity: 0.5 }}>
          🔍
        </div>
        <div style={{
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.semibold,
          marginBottom: theme.spacing[2],
          color: theme.colors.neutral[200],
        }}>
          未找到匹配的照片
        </div>
        <div style={{
          fontSize: theme.typography.fontSize.base,
          color: theme.colors.neutral[400],
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
            onClick={onLowerThreshold}
            style={{
              ...btnBase,
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa',
              background: 'rgba(96, 165, 250, 0.12)',
            }}
          >
            再試一次：先放寬門檻
          </button>
          <button
            onClick={onClearCache}
            disabled={isProcessing}
            style={{
              ...btnBase,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              background: 'rgba(239, 68, 68, 0.12)',
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            🔄 清除快取重新掃描
          </button>
          <button
            onClick={onAddReference}
            style={{
              ...btnBase,
              border: '1px solid rgba(251, 191, 36, 0.4)',
              color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.12)',
            }}
          >
            加參考照再重掃
          </button>
          <button
            onClick={onSwitchPending}
            style={{
              ...btnBase,
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.12)',
            }}
          >
            切到待複核看結果
          </button>
        </div>
      </div>
    </ModernSection>
  );
}
