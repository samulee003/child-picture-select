/**
 * UpdateBanner - Shows auto-update notifications
 */
import React, { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../types/api';

export function UpdateBanner() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.api?.onUpdateStatus) return;
    window.api.onUpdateStatus((status: UpdateStatus) => {
      setUpdateStatus(status);
      setDismissed(false);
    });
    return () => {
      window.api?.removeUpdateListener?.();
    };
  }, []);

  useEffect(() => {
    // 啟動後主動檢查一次更新（背景進行，不阻擋操作）
    window.api?.checkForUpdate?.().catch(() => {});
  }, []);

  if (dismissed || !updateStatus) return null;
  // 不干擾家長流程：檢查中 / 無更新 / 檢查失敗都不顯示
  if (
    updateStatus.status === 'checking' ||
    updateStatus.status === 'not-available' ||
    updateStatus.status === 'error'
  )
    return null;

  const handleInstall = () => {
    window.api?.installUpdate?.();
  };

  let content: React.ReactNode = null;
  let bgColor = 'rgba(59, 130, 246, 0.12)';
  let borderColor = 'rgba(59, 130, 246, 0.3)';

  if (updateStatus.status === 'available') {
    content = (
      <>
        <span>🎉 發現新版本 v{updateStatus.version}，正在背景下載更新檔…</span>
      </>
    );
  } else if (updateStatus.status === 'downloading') {
    content = <span>⬇️ 背景下載更新中：{updateStatus.percent}%</span>;
  } else if (updateStatus.status === 'downloaded') {
    bgColor = 'rgba(34, 197, 94, 0.12)';
    borderColor = 'rgba(34, 197, 94, 0.3)';
    content = (
      <>
        <span>✅ 更新已下載完成，關閉後重新開啟就會自動套用。</span>
        <button onClick={handleInstall} style={{ ...btnStyle, background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
          立即重啟更新
        </button>
      </>
    );
  }

  if (!content) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '8px 16px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '10px',
      fontSize: '13px',
      color: 'rgba(255,255,255,0.9)',
    }}>
      {content}
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0 4px',
          marginLeft: '4px',
        }}
      >
        ✕
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 14px',
  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600,
};
