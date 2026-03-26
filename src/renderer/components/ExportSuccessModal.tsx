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
      background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[4],
      zIndex: 1000,
    }}>
      <div style={{
        width: 'min(620px, 100%)',
        background: 'rgba(255, 255, 255, 0.9)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
        padding: theme.spacing[5],
      }}>
        <h3 style={{ margin: `0 0 ${theme.spacing[3]}`, color: '#006a28' }}>
          匯出完成
        </h3>
        <div style={{ color: '#595c5e', lineHeight: 1.7, fontSize: theme.typography.fontSize.sm }}>
          <div>輸出資料夾：{summary.outDir}</div>
          <div>預計匯出：{summary.requested} 張</div>
          <div>成功匯出：{summary.copied} 張</div>
          <div>失敗張數：{summary.failed} 張</div>
          {summary.error && (
            <div style={{ color: '#b41924' }}>錯誤訊息：{summary.error}</div>
          )}
          {summary.failed > 0 && (
            <div style={{ color: '#d97706' }}>
              失敗數：{summary.failed} 張（請檢查檔案是否仍在、或目的資料夾是否有權限）
            </div>
          )}
          {summary.failed === 0 && (
            <div style={{ color: '#006a28' }}>全部完成，沒有錯過任何一張</div>
          )}
        </div>
        {summary.failed > 0 && summary.failedPaths && summary.failedPaths.length > 0 && (
          <div style={{
            marginTop: theme.spacing[3],
            color: '#595c5e',
            fontSize: theme.typography.fontSize.xs,
            lineHeight: 1.5,
          }}>
            失敗清單（先挑）
            <div style={{
              marginTop: theme.spacing[2],
              maxHeight: theme.spacing[20],
              overflow: 'auto',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
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
                <div style={{ color: '#8d9296' }}>
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
                borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',
                border: '1px solid rgba(0, 106, 40, 0.2)', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',
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
              borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',
              border: 'none', color: '#cfffce', background: isClipboardCopying ? '#9a9d9f' : '#006a28', boxShadow: isClipboardCopying ? 'none' : '0 8px 16px rgba(0, 106, 40, 0.2)',
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
                borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',
                border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706', background: 'rgba(251, 191, 36, 0.1)',
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
              borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',
              border: 'none', color: '#cfffce', background: '#006a28', boxShadow: '0 8px 16px rgba(0, 106, 40, 0.2)',
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
