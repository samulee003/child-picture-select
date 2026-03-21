import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  showETA?: boolean;
  startTime?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ProgressBar({
  current,
  total,
  label,
  showPercentage = true,
  showETA = false,
  startTime,
  className = '',
  style = {}
}: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const remaining = total - current;
  
  let eta = '';
  if (showETA && startTime && current > 0) {
    const elapsed = Date.now() - startTime;
    const rate = current / elapsed;
    const etaMs = remaining / rate;
    const etaSeconds = Math.floor(etaMs / 1000);
    const etaMinutes = Math.floor(etaSeconds / 60);
    const etaHours = Math.floor(etaMinutes / 60);
    
    if (etaHours > 0) {
      eta = `預計剩餘: ${etaHours}小時${etaMinutes % 60}分鐘`;
    } else if (etaMinutes > 0) {
      eta = `預計剩餘: ${etaMinutes}分鐘${etaSeconds % 60}秒`;
    } else {
      eta = `預計剩餘: ${etaSeconds}秒`;
    }
  }

  const containerStyle: React.CSSProperties = {
    width: '100%',
    ...style
  };

  const barContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '8px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px'
  };

  const fillStyle: React.CSSProperties = {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    transition: 'width 0.3s ease',
    borderRadius: '4px',
    minWidth: '2px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.7)'
  };

  return (
    <div className={className} style={containerStyle}>
      {label && (
        <div style={labelStyle}>
          <span>{label}</span>
          {showPercentage && (
            <span style={{ fontWeight: '600', color: '#60a5fa' }}>
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div style={barContainerStyle}>
        <div style={{ ...fillStyle, width: `${percentage}%` }} />
      </div>
      <div style={labelStyle}>
        <span style={{ fontSize: '12px' }}>
          {current.toLocaleString()} / {total.toLocaleString()}
        </span>
        {showETA && eta && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            {eta}
          </span>
        )}
      </div>
    </div>
  );
}