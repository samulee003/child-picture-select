/**
 * 匹配结果卡片 - 显示解释性信息
 */

import React, { useState } from 'react';
import { theme } from '../styles/theme';
import type { MatchResult } from '../../types/api';

interface MatchResultCardProps {
  result: MatchResult;
  index: number;
  compact?: boolean;
  onPreview?: (path: string) => void;
  reviewDecision?: 'accepted' | 'rejected';
  reviewScore?: number;
  onDecision?: (path: string, decision: 'accepted' | 'rejected' | null) => void;
  onReviewScore?: (path: string, score: number) => void;
  onFavorite?: (path: string) => void;
  isFavorite?: boolean;
  /** Ordered list of reference photo paths (to show which one matched best) */
  refPaths?: string[];
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

export function MatchResultCard({ result, index, compact = false, onPreview, reviewDecision, reviewScore, onDecision, onReviewScore, onFavorite, isFavorite = false, refPaths }: MatchResultCardProps) {
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
      width: '100%',
      height: '100%',
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(24px)',
      borderRadius: '24px',
      overflow: 'hidden',
      boxShadow: '0 12px 24px rgba(0,0,0,0.04)',
      border: '1px solid rgba(255,255,255,0.4)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Confidence Pill Badge */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10,
        background: explanation.confidenceLevel === 'high' ? 'rgba(92, 253, 128, 0.9)' :
                   explanation.confidenceLevel === 'medium' ? 'rgba(242, 136, 255, 0.9)' : 'rgba(255, 195, 191, 0.9)',
        color: explanation.confidenceLevel === 'high' ? '#004819' :
               explanation.confidenceLevel === 'medium' ? '#2f0038' : '#70000d',
        padding: '6px 16px',
        borderRadius: '999px',
        fontWeight: 700,
        fontSize: '14px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        {humanScore}% 相似
      </div>

      {/* Favorite Button (Heart) */}
      {onFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(result.path); }}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 10,
            background: isFavorite ? 'rgba(180, 25, 36, 0.9)' : 'rgba(255,255,255,0.6)',
            color: isFavorite ? '#ffffff' : '#2c2f31',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s, background 0.2s',
            fontSize: '18px'
          }}
          title={isFavorite ? '取消收藏' : '加入收藏'}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      )}

      {/* Image Area */}
      <div
        style={{
          flex: compact ? 1 : 'none',
          height: compact ? 'auto' : '220px',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: '#eef1f3',
          cursor: onPreview ? 'pointer' : 'default'
        }}
        onClick={() => onPreview?.(result.path)}
      >
        <img
          src={result.thumbPath ? `file://${result.thumbPath.replace(/\\/g, '/')}` : `file://${result.path.replace(/\\/g, '/')}`}
          alt=""
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transition: 'transform 0.3s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        />


        {/* Source Hint overlay */}
        {sourceHint && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: sourceHint.bg,
            color: sourceHint.color,
            padding: '4px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            backdropFilter: 'blur(4px)',
            opacity: 0.9
          }}>
            {sourceHint.label}
          </div>
        )}
      </div>

      {/* Info Area */}
      <div style={{
        padding: compact ? '12px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flex: compact ? 'none' : 1
      }}>
        <div>
          <div style={{
            fontSize: '13px',
            color: '#595c5e',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '8px',
            fontWeight: 500
          }} title={result.path}>
            {fileName}
          </div>

          {/* Explanation Reasons (Only in detailed view) */}
          {!compact && explanation.reasons.length > 0 && (
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
               {explanation.reasons.map((reason: string, i: number) => (
                 <span key={i} style={{
                   background: 'rgba(0,0,0,0.04)',
                   color: '#2c2f31',
                   padding: '4px 8px',
                   borderRadius: '8px',
                   fontSize: '11px',
                   fontWeight: 500
                 }}>
                   {reason}
                 </span>
               ))}
             </div>
          )}
        </div>

        {/* Action Buttons */}
        {onDecision && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: 'auto'
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDecision(result.path, reviewDecision === 'accepted' ? null : 'accepted'); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                background: reviewDecision === 'accepted' ? '#006a28' : 'rgba(0, 106, 40, 0.1)',
                color: reviewDecision === 'accepted' ? '#ffffff' : '#006a28',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px'
              }}
              title="保留此照片"
            >
              {reviewDecision === 'accepted' ? '已接受' : '✓ 要'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDecision(result.path, reviewDecision === 'rejected' ? null : 'rejected'); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                background: reviewDecision === 'rejected' ? '#b41924' : 'rgba(180, 25, 36, 0.1)',
                color: reviewDecision === 'rejected' ? '#ffffff' : '#b41924',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px'
              }}
              title="排除此照片"
            >
              {reviewDecision === 'rejected' ? '已排除' : '✕ 不要'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
