/**
 * 人臉分析預覽面板
 *
 * 在載入參考照後立即顯示，以科技感動畫呈現 AI 辨識小孩臉部特徵的過程。
 * 讓爸媽感受到 AI 正在「學習」小孩的樣貌，增加信任感與互動性。
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { theme } from '../styles/theme';

interface RefPhotoAnalysis {
  path: string;
  source: 'face' | 'deterministic';
  faceAnalysis?: {
    confidence: number;
    age?: number;
    gender?: 'male' | 'female';
    faceCount: number;
  };
}

interface FaceAnalysisPreviewProps {
  referencePaths: string[];
  refsLoaded: number;
  refQualityResults: RefPhotoAnalysis[];
  isEmbedding: boolean;
}

// ------- Scanning line animation canvas -------
function ScannerCanvas({
  imageSrc,
  isScanning,
}: {
  imageSrc: string;
  isScanning: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const scanY = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Load the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageSrc;
    return () => {
      img.onload = null;
    };
  }, [imageSrc]);

  // Run animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgLoaded || !imgRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;

    function drawFrame() {
      if (!ctx || !imgRef.current || !canvas) return;
      ctx.clearRect(0, 0, size, size);

      // Draw image (center crop)
      const img = imgRef.current;
      const scale = Math.max(size / img.width, size / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const sx = (size - sw) / 2;
      const sy = (size - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh);

      if (isScanning) {
        // Overlay subtle teal tint
        ctx.fillStyle = 'rgba(0, 180, 180, 0.06)';
        ctx.fillRect(0, 0, size, size);

        // Scan line
        const grad = ctx.createLinearGradient(0, scanY.current - 12, 0, scanY.current + 12);
        grad.addColorStop(0, 'rgba(0, 220, 200, 0)');
        grad.addColorStop(0.5, 'rgba(0, 220, 200, 0.75)');
        grad.addColorStop(1, 'rgba(0, 220, 200, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, scanY.current - 12, size, 24);

        // Corner brackets
        const br = 16;
        const bw = 28;
        ctx.strokeStyle = '#00dcc8';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        // top-left
        ctx.beginPath(); ctx.moveTo(br, br + bw); ctx.lineTo(br, br); ctx.lineTo(br + bw, br); ctx.stroke();
        // top-right
        ctx.beginPath(); ctx.moveTo(size - br - bw, br); ctx.lineTo(size - br, br); ctx.lineTo(size - br, br + bw); ctx.stroke();
        // bottom-left
        ctx.beginPath(); ctx.moveTo(br, size - br - bw); ctx.lineTo(br, size - br); ctx.lineTo(br + bw, size - br); ctx.stroke();
        // bottom-right
        ctx.beginPath(); ctx.moveTo(size - br - bw, size - br); ctx.lineTo(size - br, size - br); ctx.lineTo(size - br, size - br - bw); ctx.stroke();

        // Facial feature guide dots (hardcoded relative positions for a generic face)
        const dots: [number, number][] = [
          [0.37, 0.4], [0.63, 0.4],   // eyes
          [0.50, 0.56],                 // nose
          [0.38, 0.70], [0.62, 0.70],  // mouth corners
        ];
        dots.forEach(([rx, ry]) => {
          const x = rx * size;
          const y = ry * size;
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#00ffee';
          ctx.fill();
          // pulse ring
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,255,238,0.4)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });

        // Connecting lines between dots
        ctx.strokeStyle = 'rgba(0,220,200,0.3)';
        ctx.lineWidth = 1;
        const dcoords = dots.map(([rx, ry]) => [rx * size, ry * size]);
        const connections: [number, number][] = [[0,1],[0,2],[1,2],[2,3],[2,4],[3,4]];
        connections.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(dcoords[a][0], dcoords[a][1]);
          ctx.lineTo(dcoords[b][0], dcoords[b][1]);
          ctx.stroke();
        });

        // Advance scan line
        scanY.current = (scanY.current + 1.8) % size;
      }

      animRef.current = requestAnimationFrame(drawFrame);
    }

    animRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, [imgLoaded, isScanning]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={160}
      style={{
        borderRadius: '12px',
        display: 'block',
        width: '160px',
        height: '160px',
        border: isScanning ? '2px solid rgba(0,220,200,0.5)' : '2px solid rgba(0,0,0,0.07)',
        boxShadow: isScanning ? '0 0 18px rgba(0,220,200,0.25)' : 'none',
        transition: 'box-shadow 0.5s, border-color 0.5s',
      }}
    />
  );
}

// ------- Feature bar -------
function FeatureBar({
  label,
  value,
  max = 1,
  color,
  delay,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  delay: number;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / max) * 100), delay);
    return () => clearTimeout(t);
  }, [value, max, delay]);

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '11px', color: theme.colors.neutral[500] }}>{label}</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color }}>
          {Math.round((value / max) * 100)}%
        </span>
      </div>
      <div
        style={{
          height: '6px',
          borderRadius: '99px',
          background: 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: color,
            borderRadius: '99px',
            transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>
    </div>
  );
}

// ------- Typing text animation -------
function TypedText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [shown, setShown] = useState('');
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setShown('');
    const start = setTimeout(() => {
      const interval = setInterval(() => {
        if (idx.current < text.length) {
          setShown(text.slice(0, idx.current + 1));
          idx.current++;
        } else {
          clearInterval(interval);
        }
      }, 28);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(start);
  }, [text, delay]);

  return <span>{shown}<span style={{ opacity: shown.length < text.length ? 1 : 0, transition: 'opacity 0.2s' }}>▌</span></span>;
}

// ------- Main export -------
export function FaceAnalysisPreview({
  referencePaths,
  refsLoaded,
  refQualityResults,
  isEmbedding,
}: FaceAnalysisPreviewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<'scan' | 'features' | 'done'>('scan');
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toFileSrc = (p: string) => encodeURI(`file:///${p.replace(/\\/g, '/')}`);

  const facePhotos = referencePaths.slice(0, 5);
  const currentPath = facePhotos[currentIdx] ?? facePhotos[0];
  const currentQuality = refQualityResults.find(r => r.path === currentPath);
  const hasFace = currentQuality?.source === 'face';
  const confidence = hasFace ? (currentQuality?.faceAnalysis?.confidence ?? 0.85) : 0;

  const advance = useCallback(() => {
    setPhase('scan');
    setCurrentIdx(prev => (prev + 1) % facePhotos.length);
  }, [facePhotos.length]);

  // Cycle through photos: scan → features → next
  useEffect(() => {
    if (isEmbedding) {
      setPhase('scan');
      return;
    }
    if (phase === 'scan') {
      cycleRef.current = setTimeout(() => setPhase('features'), 1800);
    } else if (phase === 'features') {
      cycleRef.current = setTimeout(() => {
        if (facePhotos.length > 1) advance(); else setPhase('done');
      }, 2400);
    }
    return () => { if (cycleRef.current) clearTimeout(cycleRef.current); };
  }, [phase, isEmbedding, facePhotos.length, advance]);

  if (!currentPath) return null;

  const statusLines = [
    isEmbedding ? '正在提取臉部特徵...' : phase === 'scan' ? 'AI 正在辨識臉部...' : phase === 'features' ? '特徵提取完成！' : '所有照片已學習完成 ✓',
  ];

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.07)',
        padding: '24px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        animation: 'slideIn 0.4s ease-out',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          🧠
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: theme.colors.neutral[800] }}>
            AI 正在學習你的小孩
          </div>
          <div style={{ fontSize: '12px', color: theme.colors.neutral[400], marginTop: '1px' }}>
            已載入 {refsLoaded} / {referencePaths.length} 張參考照
          </div>
        </div>
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              animation: 'pulse 1.2s infinite',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981' }}>LIVE</span>
        </div>
      </div>

      {/* Photo scanner + info row */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Animated scanner */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ScannerCanvas imageSrc={toFileSrc(currentPath)} isScanning={phase === 'scan' || isEmbedding} />
          {/* Photo index indicator */}
          {facePhotos.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                right: '6px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '100px',
                padding: '2px 8px',
                fontSize: '10px',
                color: '#fff',
              }}
            >
              {currentIdx + 1} / {facePhotos.length}
            </div>
          )}
        </div>

        {/* Right column: status + features */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Status text (typed) */}
          <div
            style={{
              background: 'rgba(14,165,233,0.06)',
              border: '1px solid rgba(14,165,233,0.15)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#0369a1',
              fontWeight: 600,
              fontFamily: 'monospace',
              marginBottom: '14px',
              minHeight: '36px',
            }}
          >
            <TypedText text={statusLines[0]} delay={100} key={statusLines[0]} />
          </div>

          {/* Feature vector bars – only when face detected */}
          {phase !== 'scan' && hasFace && (
            <div>
              <div style={{ fontSize: '11px', color: theme.colors.neutral[400], marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>
                臉部特徵向量
              </div>
              <FeatureBar label="臉部清晰度" value={confidence} color="#0ea5e9" delay={0} />
              <FeatureBar label="特徵點辨識" value={hasFace ? 0.92 : 0.1} color="#06b6d4" delay={120} />
              <FeatureBar label="角度一致性" value={hasFace ? 0.78 + confidence * 0.1 : 0.2} color="#14b8a6" delay={240} />
              <FeatureBar label="光線品質" value={hasFace ? 0.85 : 0.3} color="#6366f1" delay={360} />
            </div>
          )}

          {/* No face detected warning */}
          {phase !== 'scan' && !hasFace && refQualityResults.length > 0 && (
            <div
              style={{
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.25)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#92400e',
              }}
            >
              ⚠️ 此照片未偵測到清晰臉部，建議換一張正面照效果更好
            </div>
          )}
        </div>
      </div>

      {/* Progress dots */}
      {facePhotos.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
          {facePhotos.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIdx ? '20px' : '8px',
                height: '8px',
                borderRadius: '99px',
                background: i === currentIdx ? '#0ea5e9' : 'rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Summary when done */}
      {phase === 'done' && !isEmbedding && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 14px',
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '20px' }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#065f46' }}>
              AI 已學習完成！
            </div>
            <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>
              已從 {refsLoaded} 張照片提取臉部特徵，現在可以開始搜尋了
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
