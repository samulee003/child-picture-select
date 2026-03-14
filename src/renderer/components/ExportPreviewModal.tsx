import React from 'react';
import { theme } from '../styles/theme';
import type { MatchResult } from '../../types/api';

interface ExportPreviewModalProps {
  targets: MatchResult[];
  isOpenFolderAfterExport: boolean;
  onToggleOpenFolder: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: (openAfter: boolean) => void;
}

export function ExportPreviewModal({
  targets,
  isOpenFolderAfterExport,
  onToggleOpenFolder,
  onCancel,
  onConfirm,
}: ExportPreviewModalProps) {
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
        width: 'min(780px, 100%)',
        maxHeight: '82vh',
        overflow: 'auto',
        background: 'rgba(14, 18, 40, 0.97)',
        borderRadius: theme.borderRadius.xl,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        padding: theme.spacing[5],
      }}>
        <h3 style={{ margin: `0 0 ${theme.spacing[3]}`, color: theme.colors.neutral[100] }}>
          確認匯出清單
        </h3>
        <p style={{ margin: `0 0 ${theme.spacing[4]}`, color: theme.colors.neutral[300], fontSize: theme.typography.fontSize.sm }}>
          將匯出 {targets.length} 張照片
        </p>
        <div style={{ color: theme.colors.neutral[200], fontSize: theme.typography.fontSize.sm, maxHeight: '44vh', overflow: 'auto' }}>
          {targets.slice(0, 50).map((item, index) => (
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
          {targets.length > 50 && (
            <div style={{ paddingTop: theme.spacing[2], color: theme.colors.neutral[400] }}>
              還有 {targets.length - 50} 張未顯示
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
              onChange={(event) => onToggleOpenFolder(event.target.checked)}
            />
            匯出完成後直接打開輸出資料夾
          </label>
          <button
            onClick={onCancel}
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
            onClick={() => onConfirm(isOpenFolderAfterExport)}
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
            onClick={() => onConfirm(true)}
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
  );
}
