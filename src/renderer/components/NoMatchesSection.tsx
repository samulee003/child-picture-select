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
    borderRadius: '9999px',
    padding: '12px 24px',
    fontWeight: 600,
    fontSize: '15px',
    cursor: isProcessing ? 'not-allowed' as const : 'pointer' as const,
    transition: 'all 0.2s',
    backdropFilter: 'blur(8px)',
  };

  return (
    <ModernSection title="搜尋結果" description="未找到匹配的照片">
      <div style={{
        textAlign: 'center', padding: '64px', color: '#595c5e', background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(24px)', borderRadius: '32px', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 12px 32px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize: theme.typography.fontSize['5xl'], marginBottom: theme.spacing[4], opacity: 0.5 }}>
          🔍
        </div>
        <div style={{
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.semibold,
          marginBottom: theme.spacing[2],
          color: '#2c2f31',
        }}>
          未找到匹配的照片
        </div>
        <div style={{
          fontSize: theme.typography.fontSize.base,
          color: '#595c5e',
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
              border: '1px solid rgba(0, 106, 40, 0.2)', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)', boxShadow: '0 4px 12px rgba(0, 106, 40, 0.1)',
            }}
          >
            再試一次：先放寬門檻
          </button>
          <button
            onClick={onClearCache}
            disabled={isProcessing}
            style={{
              ...btnBase,
              border: '1px solid rgba(180, 25, 36, 0.2)', color: '#b41924', background: 'rgba(180, 25, 36, 0.05)', boxShadow: '0 4px 12px rgba(180, 25, 36, 0.1)',
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            🔄 清除快取重新掃描
          </button>
          <button
            onClick={onAddReference}
            style={{
              ...btnBase,
              border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706', background: 'rgba(251, 191, 36, 0.1)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)',
            }}
          >
            加參考照再重掃
          </button>
          <button
            onClick={onSwitchPending}
            style={{
              ...btnBase,
              border: 'none', color: '#cfffce', background: '#006a28', boxShadow: '0 8px 16px rgba(0, 106, 40, 0.2)',
            }}
          >
            切到待複核看結果
          </button>
        </div>
      </div>
    </ModernSection>
  );
}
