/**
 * 滑動式快速審核
 * 全螢幕卡片式介面，左右滑動或按鍵快速 accept/reject
 * 設計靈感：Tinder-style photo review for parents
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { theme } from '../styles/theme';
import type { MatchResult } from '../../types/api';

interface SwipeReviewProps {
  results: MatchResult[];
  reviewDecisions: Record<string, 'accepted' | 'rejected'>;
  onDecision: (path: string, decision: 'accepted' | 'rejected' | null) => void;
  onClose: () => void;
}

export function SwipeReview({ results, reviewDecisions, onDecision, onClose }: SwipeReviewProps) {
  // Only show pending (undecided) items
  const pendingResults = results.filter(r => !reviewDecisions[r.path]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const current = pendingResults[currentIndex];
  const remaining = pendingResults.length - currentIndex;

  const handleDecision = useCallback((decision: 'accepted' | 'rejected') => {
    if (!current) return;
    setSwipeDirection(decision === 'accepted' ? 'right' : 'left');
    setTimeout(() => {
      onDecision(current.path, decision);
      setSwipeDirection(null);
      setDragX(0);
      // Stay at same index since the item will be removed from pending list
    }, 250);
  }, [current, onDecision]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') handleDecision('accepted');
      else if (e.key === 'ArrowLeft' || e.key === 'a') handleDecision('rejected');
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown' || e.key === 's') {
        // Skip — move to next without deciding
        if (currentIndex < pendingResults.length - 1) {
          setCurrentIndex(i => i + 1);
        }
      }
      else if (e.key === 'ArrowUp' || e.key === 'w') {
        if (currentIndex > 0) setCurrentIndex(i => i - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDecision, onClose, currentIndex, pendingResults.length]);

  // Touch/mouse drag
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    dragStartRef.current = clientX;
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current;
    setDragX(dx);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (Math.abs(dragX) > 100) {
      handleDecision(dragX > 0 ? 'accepted' : 'rejected');
    } else {
      setDragX(0);
    }
  }, [dragX, handleDecision]);

  // All done
  if (!current || remaining === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>全部審核完畢！</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
          已審核 {Object.keys(reviewDecisions).length} 張照片
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: '24px',
            padding: '12px 32px',
            borderRadius: '12px',
            border: 'none',
            background: theme.colors.primary[500],
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          返回結果
        </button>
      </div>
    );
  }

  const score = Math.round(current.score * 100);
  const rotation = dragX * 0.05;
  const opacity = Math.max(0.3, 1 - Math.abs(dragX) / 400);

  const cardTransform = swipeDirection === 'right'
    ? 'translateX(120vw) rotate(20deg)'
    : swipeDirection === 'left'
      ? 'translateX(-120vw) rotate(-20deg)'
      : `translateX(${dragX}px) rotate(${rotation}deg)`;

  const imgSrc = current.thumbPath
    ? `file://${current.thumbPath.replace(/\\/g, '/')}`
    : `file://${current.path.replace(/\\/g, '/')}`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '14px',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ✕ 關閉
        </button>
        <span>剩餘 {remaining} 張</span>
        <span style={{ fontSize: '12px', opacity: 0.5 }}>← 不要 | 要 →</span>
      </div>

      {/* Card area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          padding: '20px',
        }}
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseMove={(e) => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={() => { if (isDragging) handleDragEnd(); }}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
      >
        {/* Swipe indicators */}
        {dragX > 30 && (
          <div style={{
            position: 'absolute', left: '40px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '72px', opacity: Math.min(1, dragX / 150),
            transition: 'opacity 0.1s',
          }}>✅</div>
        )}
        {dragX < -30 && (
          <div style={{
            position: 'absolute', right: '40px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '72px', opacity: Math.min(1, Math.abs(dragX) / 150),
            transition: 'opacity 0.1s',
          }}>❌</div>
        )}

        {/* Card */}
        <div
          ref={cardRef}
          style={{
            width: '100%',
            maxWidth: '500px',
            maxHeight: '70vh',
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#1a1a1a',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            transform: cardTransform,
            opacity,
            transition: swipeDirection ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : isDragging ? 'none' : 'transform 0.2s ease-out',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          {/* Photo */}
          <div style={{
            width: '100%',
            aspectRatio: '4/3',
            position: 'relative',
            overflow: 'hidden',
            background: '#000',
          }}>
            <img
              src={imgSrc}
              alt=""
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
            {/* Score badge */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: score >= 70 ? 'rgba(16,185,129,0.9)' : score >= 50 ? 'rgba(245,158,11,0.9)' : 'rgba(239,68,68,0.9)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: 700,
              fontSize: '16px',
              backdropFilter: 'blur(8px)',
            }}>
              {score}%
            </div>
          </div>

          {/* Info bar */}
          <div style={{
            padding: '12px 16px',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {current.path.split(/[/\\]/).pop()}
            </span>
            {current.source && current.source !== 'face' && (
              <span style={{
                fontSize: '11px',
                color: '#f59e0b',
                flexShrink: 0,
                marginLeft: '8px',
              }}>
                ⚠ 非臉部比對
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        padding: '16px 20px 32px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => handleDecision('rejected')}
          style={{
            width: '64px', height: '64px',
            borderRadius: '50%',
            border: '3px solid #ef4444',
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            fontSize: '28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s, background 0.15s',
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          title="不要 (← 或 A)"
        >
          ✕
        </button>
        <button
          onClick={() => {
            if (currentIndex < pendingResults.length - 1) {
              setCurrentIndex(i => i + 1);
            }
          }}
          style={{
            width: '48px', height: '48px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          title="跳過 (↓ 或 S)"
        >
          ↓
        </button>
        <button
          onClick={() => handleDecision('accepted')}
          style={{
            width: '64px', height: '64px',
            borderRadius: '50%',
            border: '3px solid #10b981',
            background: 'rgba(16,185,129,0.1)',
            color: '#10b981',
            fontSize: '28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s, background 0.15s',
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          title="要 (→ 或 D)"
        >
          ✓
        </button>
      </div>
    </div>
  );
}
