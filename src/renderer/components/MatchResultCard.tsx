/**
 * 匹配结果卡片 - 显示解释性信息
 */

import React, { useState } from 'react';
import { theme } from '../styles/theme';
import type { MatchResult } from '../../types/api';

interface MatchResultCardProps {
  result: MatchResult;
  index: number;
  onPreview?: (path: string) => void;
  reviewDecision?: 'accepted' | 'rejected';
  reviewScore?: number;
  onDecision?: (path: string, decision: 'accepted' | 'rejected' | null) => void;
  onReviewScore?: (path: string, score: number) => void;
  onFavorite?: (path: string) => void;
  isFavorite?: boolean;
}

interface MatchExplanation {
  confidenceLevel: 'high' | 'medium' | 'low';
  previewMode?: 'face-only' | 'full-image';
  reasons: string[];
}

function getExplanation(result: MatchResult): MatchExplanation {
  const score = result.score * 100;
  const reasons: string[] = [];

  if (score >= 80) {
    reasons.push('臉部特徵高度相似');
  } else if (score >= 60) {
    reasons.push('臉部特徵中度相似');
  } else {
    reasons.push('僅部分特徵匹配');
  }

  if (score >= 70) {
    reasons.push('輪廓匹配度良好');
  }

  return {
    confidenceLevel: score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low',
    previewMode: score >= 70 ? 'face-only' : 'full-image',
    reasons,
  };
}

function ConfidenceBadge({ level }: { level: MatchExplanation['confidenceLevel'] }) {
  const config = {
    high: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', label: '高信心度', icon: '✓' },
    medium: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', label: '中信心', icon: '~' },
    low: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', label: '低信心度', icon: '!' },
  };

  const c = config[level];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
      background: c.bg,
      borderRadius: theme.borderRadius.full,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: c.color,
    }}>
      <span>{c.icon}</span>
      <span>{c.label}</span>
    </div>
  );
}

export function MatchResultCard({ result, index, onPreview, reviewDecision, reviewScore, onDecision, onReviewScore, onFavorite, isFavorite = false }: MatchResultCardProps) {
  const [showExplain, setShowExplain] = useState(false);
  const explanation = getExplanation(result);
  const fileName = result.path.split(/[/\\]/).pop() || '';
  const humanScore = reviewScore ?? Math.round(result.score * 100);

  const confidenceHint = {
    high: '看起來很像你的小孩，通常可直接放進收藏',
    medium: '有機會是同班其他小孩，建議先看大圖再決定',
    low: '可能是誤判，建議先標記待複核',
  }[explanation.confidenceLevel];
  const sourceHint = result.source === 'face'
    ? { label: '來源：臉部特徵', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' }
    : result.source === 'deterministic'
      ? { label: '來源：保底特徵（建議複核）', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' }
      : { label: '來源：未標記', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.6)',
      border: `1px solid ${explanation.confidenceLevel === 'high' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 0, 0, 0.08)'}`,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[4],
      animation: `scaleIn 0.3s ease-out ${index * 0.05}s both`,
      transition: 'all 0.2s',
      cursor: 'pointer',
    }}
      onClick={() => onPreview?.(result.path)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Thumbnail */}
      {result.thumbPath ? (
        <div style={{
          width: '100%',
          height: '200px',
          borderRadius: theme.borderRadius.md,
          overflow: 'hidden',
          marginBottom: theme.spacing[3],
          position: 'relative',
        }}>
          <img
            src={`file://${result.thumbPath.replace(/\\/g, '/')}`}
            alt={fileName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {/* Confidence Overlay */}
          <div style={{
            position: 'absolute',
            top: theme.spacing[2],
            right: theme.spacing[2],
          }}>
            <ConfidenceBadge level={explanation.confidenceLevel} />
          </div>
        </div>
      ) : null}

      {/* Score Bar */}
      <div style={{ marginBottom: theme.spacing[3] }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            background: sourceHint.bg,
            color: sourceHint.color,
            borderRadius: theme.borderRadius.full,
            fontSize: theme.typography.fontSize.xs,
            marginBottom: theme.spacing[2],
          }}
        >
          {sourceHint.label}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing[2],
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.neutral[700],
          }}>
            相似度
          </span>
          <span style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            color: explanation.confidenceLevel === 'high' ? '#10b981' : 
                   explanation.confidenceLevel === 'medium' ? '#f59e0b' : '#ef4444',
          }}>
            {(result.score * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{
          height: '8px',
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: theme.borderRadius.full,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(result.score * 100, 100)}%`,
            background: explanation.confidenceLevel === 'high' 
              ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
              : explanation.confidenceLevel === 'medium'
              ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
              : 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)',
            borderRadius: theme.borderRadius.full,
            transition: 'width 0.5s ease-out',
          }} />
        </div>
        <div style={{
          marginTop: theme.spacing[1],
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.neutral[600],
          lineHeight: 1.5,
        }}>
          {confidenceHint}
        </div>
      </div>

      {/* Human Review Score */}
      {typeof onReviewScore === 'function' && (
        <div style={{ marginBottom: theme.spacing[3] }}>
          <label style={{
            display: 'block',
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.neutral[700],
            marginBottom: theme.spacing[2],
          }}>
            人工打分（0~100）：{humanScore}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={humanScore}
            onChange={(e) => onReviewScore(result.path, parseInt(e.target.value, 10))}
            style={{
              width: '100%',
              height: '8px',
              borderRadius: theme.borderRadius.full,
              outline: 'none',
              appearance: 'none',
            }}
          />
        </div>
      )}

      {/* Keep / Reject */}
      {typeof onDecision === 'function' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: theme.spacing[2],
          marginBottom: theme.spacing[3],
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDecision?.(result.path, reviewDecision === 'accepted' ? null : 'accepted');
            }}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${reviewDecision === 'accepted' ? '#10b981' : 'rgba(0,0,0,0.12)'}`,
              color: reviewDecision === 'accepted' ? '#15803d' : theme.colors.neutral[600],
              background: reviewDecision === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              transition: 'all 0.2s',
            }}
          >
            ✓ 保留
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDecision?.(result.path, reviewDecision === 'rejected' ? null : 'rejected');
            }}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${reviewDecision === 'rejected' ? '#ef4444' : 'rgba(0,0,0,0.12)'}`,
              color: reviewDecision === 'rejected' ? '#b91c1c' : theme.colors.neutral[600],
              background: reviewDecision === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              transition: 'all 0.2s',
            }}
          >
            ✗ 排除
          </button>
        </div>
      )}

      {/* File Name */}
      <div style={{
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.neutral[600],
        marginBottom: theme.spacing[3],
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {fileName}
      </div>

      {typeof onFavorite === 'function' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavorite(result.path);
          }}
          style={{
            width: '100%',
            marginBottom: theme.spacing[3],
            padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
            borderRadius: theme.borderRadius.md,
            border: `1px solid ${isFavorite ? 'rgba(245, 158, 11, 0.45)' : 'rgba(0,0,0,0.12)'}`,
            background: isFavorite ? 'rgba(251, 191, 36, 0.12)' : 'transparent',
            color: isFavorite ? '#f59e0b' : theme.colors.neutral[600],
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
            cursor: 'pointer',
          }}
        >
          {isFavorite ? '★ 收藏中' : '☆ 加入收藏'}
        </button>
      )}

      {/* Why Match Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowExplain(!showExplain);
        }}
        style={{
          width: '100%',
          padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
          background: 'rgba(0, 0, 0, 0.03)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: theme.borderRadius.md,
          color: theme.colors.neutral[700],
          fontSize: theme.typography.fontSize.xs,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing[2],
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2c0-1.5.45-2.1 1.17-2.83l1.24-1.26c.59-.58.98-1.1.98-2.21 0-2.58-1.41-4.7-4-4.7s-4 2.12-4 4.7c0 1.11.39 1.63.98 2.21l1.24 1.26C9.55 11.9 10 12.5 10 14h2c0-1.5-.45-2.1-1.17-2.83l-.9-.92z" clipRule="evenodd" />
        </svg>
        {showExplain ? '隱藏說明' : '為何匹配？'}
      </button>

      {/* Explanation Panel */}
      {showExplain && (
        <div style={{
          marginTop: theme.spacing[3],
          padding: theme.spacing[3],
          background: 'rgba(0, 0, 0, 0.02)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: theme.borderRadius.md,
          animation: 'slideIn 0.2s ease-out',
        }}>
          <h4 style={{
            margin: `0 0 ${theme.spacing[2]}`,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.primary[400],
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            🔍 匹配原因
          </h4>
          <ul style={{
            margin: 0,
            paddingLeft: theme.spacing[4],
            listStyle: 'none',
          }}>
            {explanation.reasons.map((reason, idx) => (
              <li key={idx} style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.neutral[700],
                marginBottom: theme.spacing[1],
                lineHeight: 1.4,
                position: 'relative',
              }}>
                <span style={{
                  position: 'absolute',
                  left: `-${theme.spacing[4]}`,
                  color: theme.colors.success[400],
                }}>✓</span>
                {reason}
              </li>
            ))}
          </ul>
          
          {explanation.confidenceLevel !== 'high' && (
            <div style={{
              marginTop: theme.spacing[3],
              padding: theme.spacing[2],
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: theme.borderRadius.sm,
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.warning[300],
            }}>
              💡 建議點擊照片查看大圖確認，或降低相似度門檻值
            </div>
          )}
        </div>
      )}
    </div>
  );
}
