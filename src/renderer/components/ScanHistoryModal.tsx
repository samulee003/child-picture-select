/**
 * 掃描歷史紀錄 Modal
 *
 * 顯示過去每次掃描的摘要：日期、資料夾、命中數、花費時間，
 * 以及最多 5 張預覽縮圖。
 */

import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme';
import type { ScanSession } from '../../types/api';

interface ScanHistoryModalProps {
  onClose: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms?: number) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} 秒`;
  return `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}

function shortFolder(folderPath: string) {
  // Show last 2 path segments
  const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return folderPath;
  return '…/' + parts.slice(-2).join('/');
}

export function ScanHistoryModal({ onClose }: ScanHistoryModalProps) {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    window.api
      ?.getScanSessions?.()
      .then(res => {
        if (res?.ok && Array.isArray(res.data?.sessions)) {
          // Newest first
          const sorted = [...res.data.sessions].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setSessions(sorted);
        } else {
          setSessions([]);
        }
      })
      .catch(() => setError('無法讀取歷史記錄'))
      .finally(() => setLoading(false));
  }, []);

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[4],
      }}
      onClick={onClose}
    >
      {/* Modal box */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.25s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: `${theme.spacing[4]} ${theme.spacing[5]}`,
            borderBottom: '1px solid rgba(0,0,0,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '22px' }}>📋</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: theme.typography.fontSize.lg,
                color: theme.colors.neutral[900],
              }}
            >
              掃描歷史
            </div>
            <div
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.neutral[400],
                marginTop: '2px',
              }}
            >
              {sessions.length > 0 ? `共 ${sessions.length} 次掃描記錄` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              color: theme.colors.neutral[400],
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: theme.spacing[4] }}>
          {loading && (
            <div
              style={{
                textAlign: 'center',
                color: theme.colors.neutral[400],
                padding: theme.spacing[8],
              }}
            >
              載入中…
            </div>
          )}

          {error && (
            <div
              style={{
                color: '#ef4444',
                textAlign: 'center',
                padding: theme.spacing[6],
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: theme.colors.neutral[400],
                padding: theme.spacing[10],
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: theme.spacing[3] }}>🔍</div>
              <div>還沒有掃描記錄</div>
              <div style={{ fontSize: theme.typography.fontSize.xs, marginTop: theme.spacing[1] }}>
                完成第一次搜尋後就會出現在這裡
              </div>
            </div>
          )}

          {!loading &&
            sessions.map((session, idx) => (
              <SessionRow key={session.id ?? idx} session={session} />
            ))}
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: ScanSession }) {
  const thumbs = (session.results ?? []).slice(0, 5).filter(r => r.thumbPath);
  const matchCount = session.results?.length ?? 0;

  return (
    <div
      style={{
        padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
        marginBottom: theme.spacing[3],
        background: 'rgba(248,250,252,0.8)',
      }}
    >
      {/* Top row: date + duration */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing[2],
        }}
      >
        <span
          style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: '#006a28',
          }}
        >
          {formatDate(session.createdAt)}
        </span>
        <span
          style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.neutral[400],
          }}
        >
          {formatDuration(session.duration)}
        </span>
      </div>

      {/* Folder path */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: theme.spacing[2],
        }}
      >
        <span style={{ fontSize: '13px' }}>📁</span>
        <span
          title={session.folderPath}
          style={{
            fontSize: theme.typography.fontSize.xs,
            color: '#595c5e',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {shortFolder(session.folderPath)}
        </span>
      </div>

      {/* Stats chips */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[2],
          flexWrap: 'wrap',
          marginBottom: thumbs.length > 0 ? theme.spacing[3] : 0,
        }}
      >
        <Chip
          label={`門檻 ${Math.round(session.threshold * 100)}%`}
          color="rgba(59,130,246,0.12)"
          text="#3b82f6"
        />
        <Chip
          label={`${session.referencePaths?.length ?? 0} 張參考照`}
          color="rgba(16,185,129,0.12)"
          text="#059669"
        />
        <Chip
          label={`命中 ${matchCount} 張`}
          color={matchCount > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.06)'}
          text={matchCount > 0 ? '#d97706' : theme.colors.neutral[500]}
        />
      </div>

      {/* Thumbnail strip */}
      {thumbs.length > 0 && (
        <div style={{ display: 'flex', gap: '6px' }}>
          {thumbs.map((r, i) => (
            <div
              key={i}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.07)',
                flexShrink: 0,
              }}
            >
              <img
                src={`file://${(r.thumbPath ?? '').replace(/\\/g, '/')}`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.opacity = '0';
                }}
              />
            </div>
          ))}
          {(session.results?.length ?? 0) > 5 && (
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#8d9296',
                background: 'rgba(0,0,0,0.03)',
                flexShrink: 0,
              }}
            >
              +{(session.results?.length ?? 0) - 5}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  color,
  text,
}: {
  label: string;
  color: string;
  text: string;
}) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '99px',
        background: color,
        fontSize: '11px',
        fontWeight: 600,
        color: text,
      }}
    >
      {label}
    </span>
  );
}
