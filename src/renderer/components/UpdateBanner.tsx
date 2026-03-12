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

  if (dismissed || !updateStatus) return null;
  // Only show banner for actionable statuses — silently ignore check failures
  if (updateStatus.status === 'checking' || updateStatus.status === 'not-available' || updateStatus.status === 'error') return null;

  const handleDownload = () => {
    window.api?.downloadUpdate?.();
  };

  const handleInstall = () => {
    window.api?.installUpdate?.();
  };

  let content: React.ReactNode = null;
  let bgColor = 'rgba(59, 130, 246, 0.12)';
  let borderColor = 'rgba(59, 130, 246, 0.3)';

  if (updateStatus.status === 'available') {
    content = (
      <>
        <span>🎉 新版本 v{updateStatus.version} 可用！</span>
        <button onClick={handleDownload} style={btnStyle}>下載更新</button>
      </>
    );
  } else if (updateStatus.status === 'downloading') {
    content = <span>⬇️ 正在下載更新... {updateStatus.percent}%</span>;
  } else if (updateStatus.status === 'downloaded') {
    bgColor = 'rgba(34, 197, 94, 0.12)';
    borderColor = 'rgba(34, 197, 94, 0.3)';
    content = (
      <>
        <span>✅ 更新已下載完成</span>
        <button onClick={handleInstall} style={{ ...btnStyle, background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
          立即安裝並重啟
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
