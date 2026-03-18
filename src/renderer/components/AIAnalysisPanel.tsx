/**
 * AI Analysis Panel - Real-time face analysis visualization during scanning
 * Shows face detection results with confidence, age, gender analysis
 */

import React, { useEffect, useState, useRef } from 'react';
import type { ScanProgress } from '../../types/api';

interface AIAnalysisPanelProps {
  progress: ScanProgress;
}

// Animated dots for loading text
function PulsingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(timer);
  }, []);
  return <span style={{ display: 'inline-block', width: '1.5em', textAlign: 'left' }}>{dots}</span>;
}

// Animated feature bar
function FeatureBar({
  label,
  value,
  color,
  delay,
}: {
  label: string;
  value: number;
  color: string;
  delay: number;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div style={{ marginBottom: '8px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.7)',
          marginBottom: '3px',
        }}
      >
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div
        style={{
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: '2px',
            width: `${width}%`,
            background: color,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}

// Stats counter that animates from 0 to target
function AnimatedCounter({ target, label }: { target: number; label: string }) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    setCount(target);
  }, [target]);

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '24px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.5)',
          marginTop: '2px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function AIAnalysisPanel({ progress }: AIAnalysisPanelProps) {
  const { current, total, path, thumbPath, faceAnalysis, photosPerSec, etaSeconds } = progress;
  const [totalFacesFound, setTotalFacesFound] = useState(0);
  const [totalNoFace, setTotalNoFace] = useState(0);
  const prevCurrent = useRef(0);

  // Track cumulative stats
  useEffect(() => {
    if (current <= prevCurrent.current) {
      // Reset on new scan
      setTotalFacesFound(0);
      setTotalNoFace(0);
    }
    prevCurrent.current = current;

    if (faceAnalysis) {
      setTotalFacesFound(prev => prev + 1);
    } else if (current > 0) {
      setTotalNoFace(prev => prev + 1);
    }
  }, [current, faceAnalysis]);

  const fileName = path ? path.split(/[/\\]/).pop() : '';
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  // Generate "feature analysis" text based on face data
  const getAnalysisText = () => {
    if (!faceAnalysis) return null;

    const lines: string[] = [];
    lines.push(`偵測到 ${faceAnalysis.faceCount} 張人臉`);
    if (faceAnalysis.confidence > 0) {
      lines.push(`辨識信心度: ${(faceAnalysis.confidence * 100).toFixed(1)}%`);
    }
    if (faceAnalysis.age != null) {
      lines.push(`估計年齡: 約 ${faceAnalysis.age} 歲`);
    }
    if (faceAnalysis.gender) {
      lines.push(`性別特徵: ${faceAnalysis.gender === 'male' ? '男性' : '女性'}`);
    }
    return lines;
  };

  const analysisLines = getAnalysisText();

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(96, 165, 250, 0.2)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background grid effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `
          linear-gradient(rgba(96,165,250,0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(96,165,250,0.5) 1px, transparent 1px)
        `,
          backgroundSize: '20px 20px',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          position: 'relative',
        }}
      >
        {/* AI icon with pulse */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
            animation: 'aiPulse 2s ease-in-out infinite',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
            <path d="M16 14a4 4 0 0 1 4 4v2H4v-2a4 4 0 0 1 4-4" />
            <circle cx="12" cy="7" r="1.5" fill="white" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: '0.5px',
            }}
          >
            AI 臉部特徵分析中
            <PulsingDots />
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '1px',
            }}
          >
            正在提取 1024 維臉部特徵向量
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(96, 165, 250, 0.9)',
          }}
        >
          {percent}%
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '3px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.06)',
          marginBottom: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: '2px',
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
            transition: 'width 0.3s ease',
            boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)',
          }}
        />
      </div>

      {/* Main content: thumbnail + analysis */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '16px',
          minHeight: '100px',
        }}
      >
        {/* Current photo thumbnail */}
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(96, 165, 250, 0.2)',
            background: 'rgba(0,0,0,0.3)',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {thumbPath ? (
            <img
              src={`file://${thumbPath}`}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.2)',
                fontSize: '11px',
              }}
            >
              分析中...
            </div>
          )}
          {/* Scanning overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, 0.15) 100%)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '2px',
                background: 'rgba(96, 165, 250, 0.6)',
                boxShadow: '0 0 8px rgba(96, 165, 250, 0.4)',
                animation: 'scanLine 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Analysis details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '6px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName}
          </div>

          {analysisLines ? (
            <div>
              {analysisLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '12px',
                    color: i === 0 ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: i === 0 ? '#60a5fa' : '#8b5cf6',
                      flexShrink: 0,
                    }}
                  />
                  {line}
                </div>
              ))}

              {/* Confidence bar */}
              {faceAnalysis && (
                <div style={{ marginTop: '8px' }}>
                  <FeatureBar
                    label="臉部特徵匹配度"
                    value={faceAnalysis.confidence * 100}
                    color="linear-gradient(90deg, #3b82f6, #8b5cf6)"
                    delay={100}
                  />
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.35)',
                fontStyle: 'italic',
              }}
            >
              未偵測到人臉，使用檔案特徵比對
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '12px 0 4px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <AnimatedCounter target={current} label="已分析" />
        <AnimatedCounter target={total} label="總照片" />
        <AnimatedCounter target={totalFacesFound} label="偵測到人臉" />
        <AnimatedCounter target={totalNoFace} label="無人臉" />
      </div>
      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          color: 'rgba(255,255,255,0.62)',
          fontSize: '11px',
        }}
      >
        <span>速度：{photosPerSec ? `${photosPerSec.toFixed(2)} 張/秒` : '計算中'}</span>
        <span>
          預估剩餘：
          {typeof etaSeconds === 'number'
            ? etaSeconds >= 60
              ? `${Math.floor(etaSeconds / 60)} 分 ${etaSeconds % 60} 秒`
              : `${etaSeconds} 秒`
            : '計算中'}
        </span>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes aiPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 30px rgba(139, 92, 246, 0.5); }
        }
        @keyframes scanLine {
          0% { top: 0; }
          50% { top: calc(100% - 2px); }
          100% { top: 0; }
        }
      `}</style>
    </div>
  );
}
