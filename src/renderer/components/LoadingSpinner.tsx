import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function LoadingSpinner({
  size = 'medium',
  color = '#60a5fa',
  className = '',
  style = {}
}: LoadingSpinnerProps) {
  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '32px'
  };

  const spinnerStyle: React.CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    border: `2px solid ${color}20`,
    borderTop: `2px solid ${color}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    ...style
  };

  return (
    <div className={className} style={spinnerStyle} role="status" aria-label="載入中" />
  );
}