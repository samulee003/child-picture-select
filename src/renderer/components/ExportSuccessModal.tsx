import React from 'react';
import { theme } from '../styles/theme';
import type { ExportSummary } from '../hooks/useExportState';

interface ExportSuccessModalProps {
  summary: ExportSummary;
  onOpenFolder: () => void;
  onCopy: () => void;
  onRetry: () => void;
  onClose: () => void;
  isClipboardCopying: boolean;
}

export function ExportSuccessModal({
  summary,
  onOpenFolder,
  onCopy,
  onRetry,
  onClose,
  isClipboardCopying,
}: ExportSuccessModalProps) {
  return (
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
        <h3 style={{ margin: `0 0 ${theme.spacing[3]}`, color: theme.colors.neutral[100] }}>
          匯出完成
        </h3>
        <div style={{ color: theme.colors.neutral[300], lineHeight: 1.7, fontSize: theme.typography.fontSize.sm }}>
          <div>輸出資料夾：{summary.outDir}</div>
          <div>預計匯出：{summary.requested} 張</div>
          <div>成功匯出：{summary.copied} 張</div>
          <div>失敗張數：{summary.failed} 張</div>
          {summary.error && (
            <div style={{ color: '#ef4444' }}>錯誤訊息：{summary.error}</div>
          )}
          {summary.failed > 0 && (
            <div style={{ color: '#f59e0b' }}>
              失敗數：{summary.failed} 張（請檢查檔案是否仍在、或目的資料夾是否有權限）
            </div>
          )}
          {summary.failed === 0 && (
            <div style={{ color: '#10b981' }}>全部完成，沒有錯過任何一張</div>
          )}
        </div>
        {summary.failed > 0 && summary.failedPaths && summary.failedPaths.length > 0 && (
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
              {summary.failedPaths.slice(0, 20).map((path, idx) => (
                <div key={`${path}-${idx}`} style={{
                  marginBottom: theme.spacing[1],
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {idx + 1}. {path.split(/[/\\]/).pop()}
                </div>
              ))}
              {summary.failedPaths.length > 20 && (
                <div style={{ color: theme.colors.neutral[400] }}>
                  還有 {summary.failedPaths.length - 20} 張未列出
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2], marginTop: theme.spacing[4], flexWrap: 'wrap' }}>
          {window.api && (
            <button
              onClick={onOpenFolder}
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
            onClick={onCopy}
            disabled={isClipboardCopying}
            style={{
              borderRadius: theme.borderRadius.md,
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981',
              background: isClipboardCopying ? 'rgba(16, 185, 129, 0.06)' : 'rgba(16, 185, 129, 0.12)',
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              cursor: isClipboardCopying ? 'not-allowed' : 'pointer',
            }}
          >
            一鍵複製結果到手機
          </button>
          {summary.failed > 0 && (
            <button
              onClick={onRetry}
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
            onClick={onClose}
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
  );
}
