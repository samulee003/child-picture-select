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
      background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)',
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
        background: 'rgba(255, 255, 255, 0.9)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
        padding: theme.spacing[5],
      }}>
        <h3 style={{ margin: `0 0 ${theme.spacing[3]}`, color: '#006a28' }}>
          確認匯出清單
        </h3>
        <p style={{ margin: `0 0 ${theme.spacing[4]}`, color: '#595c5e', fontSize: theme.typography.fontSize.sm }}>
          將匯出 {targets.length} 張照片
        </p>
        <div style={{ color: '#2c2f31', fontSize: theme.typography.fontSize.sm, maxHeight: '44vh', overflow: 'auto' }}>
          {targets.slice(0, 50).map((item, index) => (
            <div key={item.path} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${theme.spacing[2]} 0`,
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              color: '#595c5e',
            }}>
              <span>{index + 1}. {item.path.split(/[/\\]/).pop()}</span>
              <span style={{ color: '#8d9296' }}>
                {(item.score * 100).toFixed(1)}%
              </span>
            </div>
          ))}
          {targets.length > 50 && (
            <div style={{ paddingTop: theme.spacing[2], color: '#8d9296' }}>
              還有 {targets.length - 50} 張未顯示
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2], marginTop: theme.spacing[4], flexWrap: 'wrap' }}>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.spacing[2],
            color: '#595c5e',
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
              borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#2c2f31',
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
              borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',
              border: 'none', color: '#cfffce', background: '#006a28', boxShadow: '0 8px 16px rgba(0, 106, 40, 0.2)',
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              cursor: 'pointer',
            }}
          >
            選擇資料夾並匯出
          </button>
          <button
            onClick={() => onConfirm(true)}
            style={{
              borderRadius: '9999px', fontWeight: 600, transition: 'all 0.2s',
              border: '1px solid rgba(0, 106, 40, 0.2)', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',
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
