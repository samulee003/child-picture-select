/**
 * 參考照片品質回饋
 * 在載入參考照片後，顯示每張照片的臉部偵測狀態
 * 幫助家長理解哪些照片有效、哪些需要替換
 */

import React from 'react';
import { theme } from '../styles/theme';
import type { RefFileResult } from '../hooks/useScanState';

interface RefPhotoFeedbackProps {
  results: RefFileResult[];
  onRemove?: (path: string) => void;
  onEnhance?: (path: string) => void;
  enhancingPath?: string | null;
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 0.8 ? '#10b981' : confidence >= 0.5 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  );
}

export function RefPhotoFeedback({ results, onRemove, onEnhance, enhancingPath }: RefPhotoFeedbackProps) {
  if (results.length === 0) return null;

  const faceCount = results.filter(r => r.source === 'face').length;
  const noFaceCount = results.length - faceCount;

  return (
    <div style={{
      borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.4)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden',
    }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[2],
        background: faceCount === results.length ? 'rgba(92, 253, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)', borderBottom: '1px solid rgba(0,0,0,0.04)', padding: '12px 16px',
      }}>
        <span style={{ fontSize: '14px' }}>{faceCount === results.length ? '✅' : '⚠️'}</span>
        <span style={{
          fontSize: theme.typography.fontSize.xs,
          color: '#2c2f31', fontWeight: 600,
        }}>
          {faceCount}/{results.length} 張偵測到人臉
        </span>
        {noFaceCount > 0 && (
          <span style={{
            fontSize: '10px',
            color: '#d97706', fontWeight: 600,
            marginLeft: 'auto',
          }}>
            {noFaceCount} 張建議替換
          </span>
        )}
      </div>

      {/* Per-file list */}
      <div style={{
        maxHeight: '200px',
        overflowY: 'auto',
      }}>
        {results.map((r) => (
          <div
            key={r.path}
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              borderBottom: '1px solid rgba(0,0,0,0.03)',
              fontSize: theme.typography.fontSize.xs,
            }}
          >
            {r.source === 'face' && r.faceAnalysis ? (
              <ConfidenceDot confidence={r.faceAnalysis.confidence} />
            ) : (
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                flexShrink: 0,
              }} />
            )}

            <span style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: theme.colors.neutral[600],
            }}>
              {getFileName(r.path)}
            </span>

            {r.source === 'face' && r.faceAnalysis ? (
              <span style={{ color: '#10b981', fontSize: '10px', flexShrink: 0 }}>
                {Math.round(r.faceAnalysis.confidence * 100)}%
                {r.faceAnalysis.faceCount > 1 && ` · ${r.faceAnalysis.faceCount}臉`}
                {r.faceAnalysis.age != null && ` · ~${r.faceAnalysis.age}歲`}
              </span>
            ) : (
              <span style={{ color: '#ef4444', fontSize: '10px', flexShrink: 0 }}>
                未偵測到臉
              </span>
            )}

            {onEnhance && (
              <button
                onClick={() => onEnhance(r.path)}
                disabled={enhancingPath === r.path}
                style={{
                  border: '1px solid rgba(0, 106, 40, 0.2)', borderRadius: '999px', color: '#006a28', background: 'rgba(92, 253, 128, 0.1)',
                  cursor: enhancingPath === r.path ? 'not-allowed' : 'pointer',
                  fontSize: '10px',
                  padding: '1px 5px',
                  flexShrink: 0,
                  opacity: enhancingPath === r.path ? 0.5 : 1,
                }}
                title="智能增強此照片（調整亮度、銳度）"
              >
                {enhancingPath === r.path ? '…' : '✨'}
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(r.path)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.neutral[400],
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '0 2px',
                  flexShrink: 0,
                }}
                title="移除此照片"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Tip */}
      {noFaceCount > 0 && (
        <div style={{
          background: 'rgba(251, 191, 36, 0.05)', fontSize: '12px', color: '#595c5e', padding: '12px',
          lineHeight: 1.5,
        }}>
          💡 紅點照片無法辨識人臉，建議替換為：正面清晰、光線充足、臉部無遮擋的照片
        </div>
      )}
    </div>
  );
}
