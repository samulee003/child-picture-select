/**
 * UpdateBanner - Shows auto-update notifications
 *
 * 設計原則：
 * 1. 狀態存在 main process（持久化），renderer 透過 IPC 查詢
 * 2. mount 時先查詢一次 main 的狀態，避免錯過事件
 * 3. 優先級保護：downloaded 狀態不會被低優先級狀態覆蓋
 */
import React, { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../types/api';

/** Status priority: higher = harder to override */
const STATUS_PRIORITY: Record<string, number> = {
  checking: 0,
  'not-available': 0,
  available: 1,
  downloading: 2,
  downloaded: 3,
  error: 2,
};

function shouldAcceptStatus(
  prev: UpdateStatus | null,
  next: UpdateStatus
): boolean {
  if (!prev) return true;
  const prevP = STATUS_PRIORITY[prev.status] ?? 0;
  const nextP = STATUS_PRIORITY[next.status] ?? 0;

  // downloaded 是最終狀態，只有 error 可以覆蓋（且只有在同優先級時）
  if (prev.status === 'downloaded' && next.status !== 'error') return false;

  // 不允許降級
  if (nextP < prevP) return false;

  return true;
}

export function UpdateBanner() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // 1. mount 時查詢 main process 的持久化狀態，若已是 downloaded 就不再 checkForUpdate
  useEffect(() => {
    window.api?.getUpdateState?.()
      .then((result: { ok: boolean; data?: UpdateStatus | null }) => {
        if (result?.ok && result.data) {
          console.warn('[UpdateBanner] restored state from main:', result.data.status);
          setUpdateStatus(result.data);
          // 已下載完成就不再觸發 checkForUpdates，避免重置狀態
          if (result.data.status === 'downloaded') return;
        }
        // 只在尚未下載完成時才觸發更新檢查
        window.api?.checkForUpdate?.().catch(() => {});
      })
      .catch(() => {});
  }, []);

  // 2. 監聽即時狀態更新
  useEffect(() => {
    if (!window.api?.onUpdateStatus) return;
    const unsubscribe = window.api.onUpdateStatus((status: UpdateStatus) => {
      console.warn('[UpdateBanner] event:', status.status, status);
      setUpdateStatus(prev => {
        if (!shouldAcceptStatus(prev, status)) {
          console.warn(
            `[UpdateBanner] blocked: ${prev?.status} → ${status.status}`
          );
          return prev;
        }
        return status;
      });
      // Reset dismissed when meaningful status arrives
      if (status.status !== 'checking' && status.status !== 'not-available') {
        setDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  // checkForUpdate 已整合到 effect 1，不再額外呼叫

  if (dismissed || !updateStatus) return null;
  if (updateStatus.status === 'checking' || updateStatus.status === 'not-available') return null;

  const handleInstall = () => {
    console.warn('[UpdateBanner] user clicked install');
    window.api?.installUpdate?.();
  };

  const handleRetry = () => {
    setUpdateStatus(null);
    window.api?.checkForUpdate?.().catch(() => {});
  };

  let content: React.ReactNode = null;
  let bgColor = 'rgba(59, 130, 246, 0.12)';
  let borderColor = 'rgba(59, 130, 246, 0.3)';

  if (updateStatus.status === 'available') {
    content = (
      <span>🎉 發現新版本 v{updateStatus.version}，正在背景下載更新檔…</span>
    );
  } else if (updateStatus.status === 'downloading') {
    content =
      updateStatus.percent >= 100 ? (
        <span>⬇️ 下載完成，正在驗證更新檔…</span>
      ) : (
        <span>⬇️ 背景下載更新中：{updateStatus.percent}%</span>
      );
  } else if (updateStatus.status === 'downloaded') {
    bgColor = 'rgba(34, 197, 94, 0.12)';
    borderColor = 'rgba(34, 197, 94, 0.3)';
    const ver = updateStatus.version ? ` v${updateStatus.version}` : '';
    content = (
      <>
        <span>✅ 更新{ver}已下載完成，關閉後重新開啟就會自動套用。</span>
        <button
          onClick={handleInstall}
          style={{
            ...btnStyle,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          }}
        >
          立即重啟更新
        </button>
      </>
    );
  } else if (updateStatus.status === 'error') {
    bgColor = 'rgba(239, 68, 68, 0.12)';
    borderColor = 'rgba(239, 68, 68, 0.3)';
    content = (
      <>
        <span>⚠️ 更新下載失敗：{updateStatus.error || '未知錯誤'}</span>
        <button
          onClick={handleRetry}
          style={{
            ...btnStyle,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          }}
        >
          重試
        </button>
      </>
    );
  }

  if (!content) return null;

  return (
    <div
      style={{
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
      }}
    >
      {content}
      {(updateStatus.status === 'downloaded' || updateStatus.status === 'error') && (
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
      )}
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
